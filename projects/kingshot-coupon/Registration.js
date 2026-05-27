/* global getConfig, loginPlayer, redeemCoupon, findUser_, addUserToSheet_, countUsers_, findCoupon_, addCouponToSheet_, getValidateFid_ */

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
      const msg = `✅ 등록 완료: ${res.nickname || '(닉네임 없음)'} (fid ${res.fid}) — ${res.before} → ${res.after}명`;
      notifyDiscord_(msg);
      return { ok: true, message: msg };
    }
    if (res.duplicate) {
      return {
        ok: false,
        message: `ℹ️ 이미 등록됨: ${res.nickname || '(닉네임 없음)'} (fid ${String(fid).trim()})`,
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
    return { ok: false, before, after: before, reason: `fid 형식 오류: "${clean}"` };
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

  const nickname = (login.data && login.data.nickname) || '';
  addUserToSheet_(clean, nickname);
  const after = countUsers_();

  return { ok: true, fid: clean, nickname, before, after };
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
  notifyDiscord_(`🆕 신규 쿠폰 등록: ${code} [${status}, ${note}] — 배치 예약됨(결과는 곧 알림)`);

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

/** Discord Incoming Webhook 으로 메시지 전송 (URL 미설정 시 무시) */
function notifyDiscord_(text) {
  const config = getConfig();
  const url = config.discordWebhookUrl;
  if (!url) {
    return;
  }
  try {
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ content: text }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.warn(`Discord 알림 실패: ${err.message}`);
  }
}
