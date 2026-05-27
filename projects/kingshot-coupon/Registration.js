/* global getConfig, loginPlayer, redeemCoupon, findUser_, addUserToSheet_, countUsers_, findCoupon_, addCouponToSheet_, getValidateFid_, readUsers_, readCoupons_, stampDate_ */

/**
 * Kingshot Coupon - 웹앱 UI (유저/쿠폰 자가 등록) + Discord 알림
 *
 * 구조:
 *   doGet → index.html (유저 등록 / 쿠폰 등록 탭)
 *   클라이언트가 google.script.run.apiRegisterUser / apiRegisterCoupon 호출
 *     - 즉시 알 수 있는 결과(등록 성공/중복/잘못된 코드)는 UI 에 인라인 표시
 *     - 시간이 걸리는 배치는 백그라운드(트리거)로 돌리고 결과는 Discord 로 알림
 *
 * 동시성:
 *   - 등록은 LockService 로 직렬화(동시 제출 중복행 방지)
 *   - 쿠폰 신규 등록 시 배치는 requestBatch_ 로 debounce(30s) + runCouponBatch 의 Lock 으로 단일 실행
 *
 * ⚠️ google.script.run 은 이름이 _ 로 끝나는 함수를 호출할 수 없으므로
 *    클라이언트용 진입점은 apiRegisterUser / apiRegisterCoupon (언더스코어 없음).
 */

// ============================================================
// 웹앱 엔트리
// ============================================================

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Kingshot 등록')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============================================================
// 클라이언트 호출 진입점 (google.script.run)
// ============================================================

/** 유저 등록 (UI). @returns {{ok:boolean, message:string}} */
function apiRegisterUser(fid) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { ok: false, message: '서버가 바쁩니다. 잠시 후 다시 시도하세요.' };
  }

  try {
    const res = registerUserByFid_(fid);
    if (res.ok) {
      const msg = `✅ 등록 완료: ${res.nickname || '(닉네임 없음)'} (ID ${res.fid}) — ${res.before} → ${res.after}명`;
      const embed = {
        title: '👤 유저 등록 완료',
        description: `**${res.nickname || '(닉네임 없음)'}**\n🆔 \`${res.fid}\`  ·  👥 ${res.before} → ${res.after}명`,
        color: DISCORD_COLORS.green,
        timestamp: new Date().toISOString(),
      };
      if (res.avatar) {
        embed.thumbnail = { url: res.avatar };
      }
      notifyDiscordEmbed_(embed);
      return { ok: true, message: msg };
    }
    if (res.duplicate) {
      return {
        ok: false,
        message: `ℹ️ 이미 등록됨: ${res.nickname || '(닉네임 없음)'} (ID ${String(fid).trim()})`,
      };
    }
    return { ok: false, message: `❌ ${res.reason}` };
  } finally {
    lock.releaseLock();
  }
}

/** 쿠폰 등록 (UI). 신규·유효하면 추가 후 배치 예약. @returns {{ok:boolean, message:string}} */
function apiRegisterCoupon(code) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { ok: false, message: '서버가 바쁩니다. 잠시 후 다시 시도하세요.' };
  }

  try {
    return registerCouponNow_(code);
  } finally {
    lock.releaseLock();
  }
}

/**
 * fid 프로필 조회 (등록 전 확인용, 시트에 쓰지 않음 = 읽기 전용이라 Lock 불필요).
 * @returns {{ok:boolean, profile?:Object, registered?:boolean, message?:string}}
 */
function apiLookupPlayer(fid) {
  const clean = String(fid || '').trim();
  if (!/^\d+$/.test(clean)) {
    return { ok: false, message: '❌ ID 는 숫자만 가능합니다.' };
  }

  const login = loginPlayer(clean);
  if (!login.ok) {
    const reason = login.rateLimited ? '일시적 제한(429) — 잠시 후 다시' : login.message;
    return { ok: false, message: `❌ 조회 실패: ${reason}` };
  }

  const existing = findUser_(clean);
  return {
    ok: true,
    profile: buildProfile_(clean, login.data),
    registered: !!existing,
    active: existing ? !!existing.active : false,
  };
}

/** 로그인 응답(data)에서 화면 표시용 프로필 객체 생성 */
function buildProfile_(fid, data) {
  const d = data || {};
  // 일부 계정은 stove_lv_content 가 문자열이 아닐 수 있어 String 으로 강제 변환(.match 안전)
  const levelIcon = String(d.stove_lv_content || '');
  // 표시 레벨은 아이콘 파일명(stove_lv_N.png)의 N — 공식 UI 표기와 일치(raw stove_lv 는 내부값).
  const m = levelIcon.match(/stove_lv_(\d+)/);
  const level = m ? m[1] : (d.stove_lv ?? '');
  return {
    fid: String(fid),
    nickname: d.nickname || '',
    kingdom: d.kid ?? '',
    level,
    avatar: d.avatar_image || '',
    levelIcon,
  };
}

// ============================================================
// 유저 관리 (웹 UI) — 비밀번호 = 오늘 날짜 MMDD(KST)
// ============================================================

/** 오늘 날짜(MMdd, KST) 비밀번호 확인. 입력은 숫자만 추려 4자리로 비교(문자열). */
function checkDatePassword_(password) {
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'MMdd');
  const input = String(password ?? '').replace(/\D/g, '');
  return input.padStart(4, '0') === today;
}

/** 유저 active 토글 (웹 UI). @returns {{ok:boolean, message:string}} */
function apiToggleUser(fid, password) {
  if (!checkDatePassword_(password)) {
    return { ok: false, message: '❌ 비밀번호가 올바르지 않습니다.' };
  }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { ok: false, message: '서버가 바쁩니다. 잠시 후 다시 시도하세요.' };
  }
  try {
    const user = findUser_(fid);
    if (!user) {
      return { ok: false, message: `ID ${String(fid).trim()} 를 찾을 수 없습니다.` };
    }
    const next = !user.active;
    const config = getConfig();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.users);
    sheet.getRange(user.row, 3).setValue(next); // active = C열
    stampDate_(sheet, user.row, 5, new Date()); // updated = E열
    touchManage_();
    notifyDiscordEmbed_({
      title: `🔁 유저 ${next ? '활성화' : '비활성화'}`,
      description: `**${user.nickname || '(닉네임 없음)'}**\n🆔 \`${String(fid).trim()}\``,
      color: next ? DISCORD_COLORS.green : DISCORD_COLORS.gray,
      timestamp: new Date().toISOString(),
    });
    return {
      ok: true,
      active: next,
      message: `✅ ${user.nickname || '(닉네임 없음)'} → ${next ? '활성화' : '비활성화'}`,
    };
  } finally {
    lock.releaseLock();
  }
}

/** 쿠폰 enabled 토글 (웹 UI). @returns {{ok:boolean, enabled?:boolean, message:string}} */
function apiToggleCoupon(code, password) {
  if (!checkDatePassword_(password)) {
    return { ok: false, message: '❌ 비밀번호가 올바르지 않습니다.' };
  }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { ok: false, message: '서버가 바쁩니다. 잠시 후 다시 시도하세요.' };
  }
  try {
    const c = findCoupon_(code);
    if (!c) {
      return { ok: false, message: `쿠폰 ${String(code).trim()} 를 찾을 수 없습니다.` };
    }
    const next = !c.enabled;
    const config = getConfig();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.coupons);
    sheet.getRange(c.row, 2).setValue(next); // enabled = B열
    stampDate_(sheet, c.row, 5, new Date()); // updated = E열
    touchManage_();
    notifyDiscordEmbed_({
      title: `🔁 쿠폰 ${next ? '활성화' : '비활성화'}`,
      description: `🎁 \`${String(code).trim()}\``,
      color: next ? DISCORD_COLORS.green : DISCORD_COLORS.gray,
      timestamp: new Date().toISOString(),
    });
    return {
      ok: true,
      enabled: next,
      message: `✅ ${String(code).trim()} → ${next ? '활성화' : '비활성화'}`,
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 관리 목록 조회(보기 전용, 비번 불필요). 변경/삭제 액션만 비번으로 보호.
 * @returns {{ok:boolean, users:Array, coupons:Array, ttlDays:number}}
 */
function apiListManage() {
  const config = getConfig();
  const usersRaw = readUsers_();
  const couponsRaw = readCoupons_();

  // 정렬: 활성(만료 안 됨) 먼저 → 2차로 최신 등록순(created desc)
  const newest = (a, b) =>
    (b.created ? b.created.getTime() : 0) - (a.created ? a.created.getTime() : 0);
  // 유저: 활성 먼저만 (그 안에선 등록 순서 유지)
  const users = usersRaw
    .slice()
    .sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0))
    .map((u) => ({ fid: u.fid, nickname: u.nickname || '', active: u.active }));
  // 쿠폰: 활성 먼저 → 최신 등록순
  const coupons = couponsRaw
    .slice()
    .sort((a, b) => (b.enabled ? 1 : 0) - (a.enabled ? 1 : 0) || newest(a, b))
    .map((c) => ({
      code: c.code,
      enabled: c.enabled,
      status: c.status || '',
      created: c.created ? Utilities.formatDate(c.created, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '',
    }));

  return {
    ok: true,
    ttlDays: config.couponTtlDays,
    users,
    coupons,
    // 헤더 표시용 "마지막 사용시각" — 시트 안 보는 사용자용
    lastUserReg: fmtTs_(maxCreated_(usersRaw)), // 유저 created 최댓값
    lastCouponReg: fmtTs_(maxCreated_(couponsRaw)), // 쿠폰 created 최댓값
    lastManage: PropertiesService.getScriptProperties().getProperty('LAST_MANAGE_AT') || '',
    discordSet: !!config.discordWebhookUrl, // URL 자체는 노출하지 않음(비밀)
    discordEnabled: !!config.discordWebhookUrl && config.discordEnabled,
  };
}

/**
 * Discord Webhook URL 설정/해제 (비번 필요). URL 자체는 반환하지 않음.
 * 빈 값이면 해제. @returns {{ok:boolean, message:string, discordSet?:boolean}}
 */
function apiSetDiscordWebhook(url, password) {
  if (!checkDatePassword_(password)) {
    return { ok: false, message: '❌ 비밀번호가 올바르지 않습니다.' };
  }
  const props = PropertiesService.getScriptProperties();
  const u = String(url || '').trim();

  if (!u) {
    props.deleteProperty('DISCORD_WEBHOOK_URL');
    touchManage_();
    return { ok: true, message: '✅ Discord 웹훅 해제됨', discordSet: false };
  }
  if (!/^https:\/\//.test(u) || !/discord(app)?\.com\/api\/.*webhooks\//.test(u)) {
    return { ok: false, message: '❌ 올바른 Discord 웹훅 URL이 아닙니다.' };
  }
  props.setProperty('DISCORD_WEBHOOK_URL', u);
  props.setProperty('DISCORD_ENABLED', 'true'); // 저장하면 알림 ON
  touchManage_();
  notifyDiscordEmbed_({
    title: '✅ Discord 연동 완료',
    description: '이 채널로 알림이 전송됩니다. (테스트 메시지)',
    color: DISCORD_COLORS.green,
    timestamp: new Date().toISOString(),
  });
  return { ok: true, message: '✅ Discord 웹훅 저장됨 (테스트 알림 전송)', discordSet: true };
}

/** Discord 알림 on/off 토글 (비번 필요). @returns {{ok:boolean, enabled?:boolean, message:string}} */
function apiSetDiscordEnabled(enabled, password) {
  if (!checkDatePassword_(password)) {
    return { ok: false, message: '❌ 비밀번호가 올바르지 않습니다.' };
  }
  const props = PropertiesService.getScriptProperties();
  const on = enabled === true || enabled === 'true';
  if (on && !props.getProperty('DISCORD_WEBHOOK_URL')) {
    return { ok: false, message: '❌ 먼저 Webhook URL을 저장하세요.' };
  }

  if (on) {
    props.setProperty('DISCORD_ENABLED', 'true');
    touchManage_();
    notifyDiscordEmbed_({
      title: '🔔 Discord 알림 ON',
      description: '이제 이벤트 알림이 이 채널로 전송됩니다.',
      color: DISCORD_COLORS.green,
      timestamp: new Date().toISOString(),
    });
  } else {
    // 끄기 직전(아직 ON 상태)에 마지막 메시지 전송 → 사용자가 OFF 를 즉시 인지
    notifyDiscordEmbed_({
      title: '🔕 Discord 알림 OFF',
      description: '이후 알림이 전송되지 않습니다. (마지막 메시지)',
      color: DISCORD_COLORS.gray,
      timestamp: new Date().toISOString(),
    });
    props.setProperty('DISCORD_ENABLED', 'false');
    touchManage_();
  }
  return { ok: true, enabled: on, message: on ? '✅ Discord 알림 ON' : '✅ Discord 알림 OFF' };
}

/** rows 중 created(Date) 최댓값 반환 */
function maxCreated_(rows) {
  let max = null;
  for (const r of rows) {
    if (r.created instanceof Date && (!max || r.created.getTime() > max.getTime())) {
      max = r.created;
    }
  }
  return max;
}

/** Date → 'yyyy-MM-dd HH:mm'(KST) 또는 '' */
function fmtTs_(date) {
  return date ? Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '';
}

/** 마지막 관리 액션 시각을 Script Property 에 기록 */
function touchManage_() {
  PropertiesService.getScriptProperties().setProperty(
    'LAST_MANAGE_AT',
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
  );
}

/** 쿠폰 자동만료 일수(TTL) 변경 → Script Property 저장. @returns {{ok:boolean, ttlDays?:number, message:string}} */
function apiSetCouponTtl(days, password) {
  if (!checkDatePassword_(password)) {
    return { ok: false, message: '❌ 비밀번호가 올바르지 않습니다.' };
  }
  const n = parseInt(days, 10);
  if (isNaN(n) || n < 0 || n > 365) {
    return { ok: false, message: '❌ 0~365 사이 숫자를 입력하세요.' };
  }
  PropertiesService.getScriptProperties().setProperty('KINGSHOT_COUPON_TTL_DAYS', String(n));
  touchManage_();
  notifyDiscordEmbed_({
    title: '⏳ 쿠폰 자동만료 설정 변경',
    description: n === 0 ? '자동만료 **끔**' : `자동만료 **${n}일**`,
    color: DISCORD_COLORS.blue,
    timestamp: new Date().toISOString(),
  });
  return { ok: true, ttlDays: n, message: `✅ 쿠폰 자동만료 ${n === 0 ? '끔' : n + '일'} 로 설정` };
}

/** 유저 삭제 (웹 UI). @returns {{ok:boolean, message:string}} */
function apiDeleteUser(fid, password) {
  if (!checkDatePassword_(password)) {
    return { ok: false, message: '❌ 비밀번호가 올바르지 않습니다.' };
  }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { ok: false, message: '서버가 바쁩니다. 잠시 후 다시 시도하세요.' };
  }
  try {
    const user = findUser_(fid);
    if (!user) {
      return { ok: false, message: `ID ${String(fid).trim()} 를 찾을 수 없습니다.` };
    }
    const config = getConfig();
    const removedNick = user.nickname || '(닉네임 없음)';
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.users).deleteRow(user.row);
    touchManage_();
    notifyDiscordEmbed_({
      title: '🗑️ 유저 삭제',
      description: `**${removedNick}**\n🆔 \`${String(fid).trim()}\``,
      color: DISCORD_COLORS.orange,
      timestamp: new Date().toISOString(),
    });
    return {
      ok: true,
      message: `🗑️ 삭제 완료: ${removedNick} (ID ${String(fid).trim()})`,
    };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// 핵심 등록 로직
// ============================================================

/**
 * fid 로 유저 등록: 공백제거 → 형식검사 → 중복검사 → API 검증(닉네임 조회) → 시트 기록.
 * @returns {{ok:boolean, fid?:string, nickname?:string, before:number, after:number, duplicate?:boolean, reason?:string}}
 */
function registerUserByFid_(fid) {
  const clean = String(fid || '').trim();
  const before = countUsers_();

  if (!/^\d+$/.test(clean)) {
    return { ok: false, before, after: before, reason: `ID 형식 오류: "${clean}"` };
  }

  const existing = findUser_(clean);
  if (existing) {
    return {
      ok: false,
      duplicate: true,
      nickname: existing.nickname,
      before,
      after: before,
      reason: '이미 등록됨',
    };
  }

  // 정원 제한 (신규 등록에만 적용)
  const config = getConfig();
  if (config.maxUsers > 0 && before >= config.maxUsers) {
    return { ok: false, before, after: before, reason: `정원 초과 (최대 ${config.maxUsers}명)` };
  }

  const login = loginPlayer(clean);
  if (!login.ok) {
    const reason = login.rateLimited ? '일시적 제한(429) — 잠시 후 다시' : login.message;
    return { ok: false, before, after: before, reason };
  }

  // 시트에는 최소 정보(fid, nickname)만 기록. 왕국/레벨/아바타는 UI·알림 표시용으로만 사용.
  const data = login.data || {};
  const nickname = data.nickname || '';
  addUserToSheet_(clean, nickname);
  const after = countUsers_();

  return { ok: true, fid: clean, nickname, before, after, avatar: data.avatar_image || '' };
}

/**
 * 쿠폰 등록: 공백제거 → 중복검사 → 단건 검증(login+redeem) →
 *   없음/만료면 거부(추가 안 함), 유효/보류면 추가 후 배치 예약(debounce).
 * @returns {{ok:boolean, message:string}}
 */
function registerCouponNow_(codeRaw) {
  const code = String(codeRaw || '').trim();
  if (!code) {
    return { ok: false, message: '❌ 쿠폰 코드를 입력하세요.' };
  }

  if (findCoupon_(code)) {
    return { ok: false, message: `ℹ️ 이미 등록된 쿠폰: ${code}` };
  }

  // 단건 검증 (긴 대기 없는 단일 시도)
  let status = 'PENDING';
  let note = '검증 안 함(유저 없음)';
  const validateFid = getValidateFid_();
  if (validateFid) {
    const login = loginPlayer(validateFid);
    if (login.ok) {
      const r = redeemCoupon(validateFid, code);
      if (r.result === 'INVALID_CODE') {
        return { ok: false, message: `❌ 존재하지 않는 코드(CDK NOT FOUND): ${code} — 등록 안 함` };
      }
      if (r.result === 'EXPIRED') {
        return { ok: false, message: `❌ 만료된 코드(TIME ERROR): ${code} — 등록 안 함` };
      }
      if (r.result === 'SUCCESS' || r.result === 'ALREADY_USED') {
        status = 'VALID';
        note = '검증 OK';
      } else {
        note = `검증 보류(${r.result})`;
      }
    } else {
      note = login.rateLimited ? '검증 보류(429)' : `검증 보류(${login.message})`;
    }
  }

  addCouponToSheet_(code, status);
  requestBatch_();
  notifyDiscordEmbed_({
    title: '🆕 신규 쿠폰 등록',
    description: `🎁 \`${code}\`\n상태: ${status} · ${note}\n배치가 예약되었습니다 — 결과는 곧 알림됩니다.`,
    color: DISCORD_COLORS.blue,
    timestamp: new Date().toISOString(),
  });

  return {
    ok: true,
    message: `✅ 쿠폰 등록: ${code} [${status}, ${note}]\n곧 배치가 백그라운드로 실행되며, 결과는 Discord 로 알립니다.`,
  };
}

// ============================================================
// 배치 예약(debounce) / 트리거 / Discord 알림
// ============================================================

/**
 * 배치 실행을 debounce 로 예약한다.
 * 기존 예약 트리거를 지우고 30초 뒤 1회성 트리거를 만들어,
 * 연달아 등록해도 버스트가 끝난 뒤 배치가 한 번만 돌게 한다.
 */
function requestBatch_() {
  removeTriggers_('runCouponBatch');
  ScriptApp.newTrigger('runCouponBatch')
    .timeBased()
    .after(30 * 1000)
    .create();
}

/** 특정 핸들러의 트리거 제거(중복 누적 방지) */
function removeTriggers_(handlerName) {
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(t);
    }
  }
}

// Discord 임베드 색상 (decimal)
const DISCORD_COLORS = {
  green: 3066993,
  blue: 3447003,
  orange: 15105570,
  red: 15158332,
  gray: 9807270,
};

/** Discord 임베드 전송 (URL 미설정 시 무시) */
function notifyDiscordEmbed_(embed) {
  const config = getConfig();
  const url = config.discordWebhookUrl;
  if (!url || !config.discordEnabled) {
    return; // URL 없거나 알림 OFF면 전송 안 함
  }
  const payload = JSON.stringify({ embeds: [embed] });
  // 연속 알림 시 Discord webhook rate limit(429)로 메시지가 누락되지 않도록 retry_after 만큼 대기 후 재시도
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload,
        muteHttpExceptions: true,
      });
      if (res.getResponseCode() !== 429) {
        return; // 성공(또는 비-429) → 종료
      }
      let waitMs = 1000;
      try {
        const j = JSON.parse(res.getContentText());
        if (j && j.retry_after) {
          waitMs = Math.ceil(Number(j.retry_after) * 1000) + 150; // retry_after(초) → ms
        }
      } catch (e) {
        waitMs = 1000;
      }
      Utilities.sleep(Math.min(waitMs, 5000));
    } catch (err) {
      console.warn(`Discord 알림 실패: ${err.message}`);
      return;
    }
  }
}
