/* global getConfig, invalidateConfigCache_, loginPlayer, redeemCoupon, findUser_, addUserToSheet_, countUsers_, findCoupon_, addCouponToSheet_, getValidateFid_, readUsers_, readCoupons_, hasActiveCoupons_, stampDate_, requireSheet_, COL, requestBatch_, notifySlack_, notify_, NOTIFY_COLORS, logSystem_, purgeLogsForUser_, purgeInvalidCoupons_ */

/**
 * Kingshot Coupon - 웹앱 UI (등록·조회·관리)
 *
 * 구조:
 *   doGet → index.html (유저 등록 / 쿠폰 등록 / 🛠 관리)
 *   클라이언트가 google.script.run 으로 아래 진입점 호출:
 *     - apiLookupPlayer(fid)                    프로필 조회 (읽기 전용, 비밀번호 X)
 *     - apiRegisterUser(fid)                    유저 등록
 *     - apiRegisterCoupon(code)                 쿠폰 등록 + 배치 예약(debounce)
 *     - apiListManage()                         관리 목록·설정·마지막사용시각 (보기 전용)
 *     - apiToggleUser(fid, pw)                  유저 활성/비활성 토글
 *     - apiToggleCoupon(code, pw)               쿠폰 활성/비활성 토글
 *     - apiDeleteUser(fid, pw)                  유저 삭제
 *     - apiSetCouponTtl(days, pw)               쿠폰 자동만료 일수 변경
 *     - apiSetSlackWebhook(url, pw)             Slack Webhook URL 저장/해제(+테스트 전송)
 *     - apiSetSlackEnabled(on, pw)              Slack 알림 on/off
 *     - apiSetNotify(category, on, pw)          알림 카테고리(batch/schedule/user/coupon/settings) on/off
 *     - apiRunBatchNow(pw)                      배치 즉시 실행 예약 (debounce 30s)
 *
 * 동시성:
 *   - 등록/관리 액션은 `safeApiWithLock_` 헬퍼로 LockService 직렬화 (동시 제출/race 방지)
 *   - 쿠폰 신규 등록 시 배치는 requestBatch_ (Notify.js) 로 debounce(30s) + runCouponBatch Lock
 *
 * 알림 / 배치 트리거는 Notify.js 로 분리. 여기서는 호출만 함.
 *
 * ⚠️ google.script.run 은 이름이 _ 로 끝나는 함수를 호출할 수 없으므로
 *    클라이언트 진입점은 모두 api... (언더스코어 없음), 내부 헬퍼는 _ 접미사.
 */

// ============================================================
// 웹앱 엔트리
// ============================================================

function doGet() {
  // createTemplateFromFile → <?!= include('i18n') ?> 처리(클라이언트 i18n 사전 끼워넣기)
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Kingshot')
    .setFaviconUrl(faviconUrl_())
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** HtmlTemplate include 헬퍼 — <?!= include('파일') ?> 로 다른 .html 파일 내용을 끼워넣는다. */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/**
 * 탭 favicon URL 결정 — 킹샷 공식 favicon 우선, 가져올 수 없으면 👑 이모지(SVG)로 폴백.
 *  - setFaviconUrl 은 단일 URL이라 브라우저 자동 폴백이 없으므로, 서버에서 가용성 확인 후 선택.
 *  - 결과는 6시간 캐시 → doGet 마다 외부 요청 안 함(첫 1회/만료 후만 확인). 실패해도 앱엔 무영향.
 */
function faviconUrl_() {
  const KS = 'https://ks-giftcode.centurygame.com/favicon.ico';
  const CROWN =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
        '<text x="50" y="54" font-size="80" text-anchor="middle" dominant-baseline="central">👑</text>' +
        '</svg>',
    );
  try {
    const cache = CacheService.getScriptCache();
    const flag = cache.get('FAVICON_KS_OK');
    if (flag === '1') {
      return KS;
    }
    if (flag === '0') {
      return CROWN;
    }
    const code = UrlFetchApp.fetch(KS, {
      muteHttpExceptions: true,
      followRedirects: true,
    }).getResponseCode();
    const ok = code >= 200 && code < 400;
    cache.put('FAVICON_KS_OK', ok ? '1' : '0', 21600); // 6시간
    return ok ? KS : CROWN;
  } catch (e) {
    // 확인 실패(네트워크 등) → 안전하게 👑 폴백
    return CROWN;
  }
}

// ============================================================
// 클라이언트 호출 진입점 (google.script.run)
// ============================================================

/**
 * 모든 api* 진입점의 외곽 try/catch 안전망.
 *  - 본문에서 throw 발생 시: system_logs 에 ERROR 기록(메시지+스택) + 구조화된 응답 반환
 *  - 클라이언트는 항상 {ok, message} 구조를 받음 → `withFailureHandler` 거의 안 불림
 *  - "⚠️ undefined" 같은 미스터리 메시지 사라지고, 실제 원인이 system_logs 에 남음
 * @param {string} name  api 함수명 (예: 'apiDeleteUser')
 * @param {Function} fn  실행할 함수
 * @returns {*} fn 의 반환값 또는 {ok:false, message:'❌ 서버 오류: ...'}
 */
function safeApi_(name, fn) {
  try {
    return fn();
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    const stack = err && err.stack ? String(err.stack).slice(0, 400) : '-';
    try {
      logSystem_('ERROR', name, `${msg} | stack: ${stack}`, '');
    } catch (logErr) {
      // 로깅 실패는 조용히 무시 (시트 권한 문제 등)
    }
    return { ok: false, code: 'error', data: { msg } };
  }
}

/**
 * safeApi_ + LockService 콤보 — 5개 api 함수의 동일 패턴 추출.
 * lock 획득 실패 시 "서버 바쁨" 메시지로 graceful degradation.
 * @param {string} name  api 함수명 (system_logs source 로 사용)
 * @param {Function} fn  실행 본문 — lock 보유 중에 호출됨, finally 에서 자동 release
 */
function safeApiWithLock_(name, fn) {
  return safeApi_(name, () => {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(15000);
    } catch (e) {
      return { ok: false, code: 'busy' };
    }
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  });
}

/** 유저 등록을 위한 자동 배치 debounce (3분).
 *  - 쿠폰 등록(30s) 보다 길게 잡아 유저 burst 자연 흡수
 *  - 그 사이 쿠폰 등록(30s)이 오면 자동 단축됨 (트리거 청소 + 짧은 게 이김) */
const USER_BATCH_DEBOUNCE_MS = 180 * 1000;

/** 유저 등록 (UI). @returns {{ok:boolean, message:string}} */
function apiRegisterUser(fid) {
  return safeApiWithLock_('apiRegisterUser', () => {
    const res = registerUserByFid_(fid);
    if (res.ok) {
      // 활성 쿠폰이 _하나라도_ 있을 때만 배치 예약 (없으면 빈 배치 돌릴 이유 없음).
      // 첫 운영 상황 (시트 카피 후 유저만 추가) 에서 무의미한 트리거 + 헷갈리는 메시지 방지.
      const hasCoupons = hasActiveCoupons_();
      if (hasCoupons) {
        // 신규 유저는 기존 활성 쿠폰들을 받지 못한 상태 → 자동 배치 예약(180s debounce)
        // dedup 이 기존 유저들은 SKIP 처리하므로, 실제 호출은 신규 유저 × 활성 쿠폰만큼만 발생.
        requestBatch_(USER_BATCH_DEBOUNCE_MS);
      }

      // 등록 자체 알림 — 카테고리 user (default OFF)
      notify_(
        {
          title: '👤 유저 등록 완료',
          description: `🏷️ **${res.nickname || '(닉네임 없음)'}**\n🆔 \`${res.fid}\`  ·  👥 ${res.before} → ${res.after}명`,
          color: NOTIFY_COLORS.green,
          // 우측에 75x75 아바타 (있을 때만) — Kingshot 응답에 avatar_image 없는 유저는 자동 생략
          thumbnail: res.avatar ? { url: res.avatar } : undefined,
          timestamp: new Date().toISOString(),
        },
        'user-register',
        'user',
      );

      // 배치 예약 알림은 _실제로 예약했을 때만_ 발송 (카테고리 schedule, default OFF)
      if (hasCoupons) {
        notify_(
          {
            title: '⏱ 배치 예약 (유저 등록)',
            description: `약 3분 뒤 자동 배치 — 신규 유저에 활성 쿠폰 발급`,
            color: NOTIFY_COLORS.green,
            timestamp: new Date().toISOString(),
          },
          'schedule-user',
          'schedule',
        );
      }

      // 표시 메시지는 클라이언트가 code+data 로 조립(접속자 언어). hasCoupons 로 문구 분기.
      return {
        ok: true,
        code: 'user_registered',
        data: {
          nick: res.nickname || '',
          fid: res.fid,
          before: res.before,
          after: res.after,
          hasCoupons: hasCoupons,
        },
      };
    }
    if (res.duplicate) {
      return {
        ok: false,
        code: 'user_dup',
        data: { nick: res.nickname || '', fid: String(fid).trim() },
      };
    }
    return { ok: false, code: 'user_fail', data: { reason: res.reason } };
  });
}

/** 쿠폰 등록 (UI). 신규·유효하면 추가 후 배치 예약. @returns {{ok:boolean, message:string}} */
function apiRegisterCoupon(code) {
  return safeApiWithLock_('apiRegisterCoupon', () => registerCouponNow_(code));
}

/**
 * fid 프로필 조회 (등록 전 확인용, 시트에 쓰지 않음 = 읽기 전용이라 Lock 불필요).
 * @returns {{ok:boolean, profile?:Object, registered?:boolean, message?:string}}
 */
function apiLookupPlayer(fid) {
  return safeApi_('apiLookupPlayer', () => {
    const clean = String(fid || '').trim();
    if (!/^\d+$/.test(clean)) {
      return { ok: false, code: 'id_numeric' };
    }

    const login = loginPlayer(clean);
    if (!login.ok) {
      const reason = login.rateLimited ? '일시적 제한(429) — 잠시 후 다시' : login.message;
      return { ok: false, code: 'lookup_fail', data: { reason } };
    }

    const existing = findUser_(clean);
    return {
      ok: true,
      profile: buildProfile_(clean, login.data),
      registered: !!existing,
      active: existing ? !!existing.active : false,
    };
  });
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
  return safeApiWithLock_('apiToggleUser', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    const user = findUser_(fid);
    if (!user) {
      return { ok: false, code: 'user_not_found', data: { fid: String(fid).trim() } };
    }
    const prev = user.active;
    const next = !user.active;
    const nick = user.nickname || '(닉네임 없음)';
    const cleanFid = String(fid).trim();
    const fmtKr = (b) => (b ? '활성' : '비활성');
    const fmtEn = (b) => (b ? 'active' : 'inactive');
    const sheet = requireSheet_('users');
    sheet.getRange(user.row, COL.users.active).setValue(next);
    stampDate_(sheet, user.row, COL.users.updated, new Date());
    touchManage_();
    logSystem_(
      'INFO',
      'user-toggle',
      `web — nick:${nick} (${fmtEn(prev)} → ${fmtEn(next)})`,
      cleanFid,
    );
    notify_(
      {
        title: `🔁 ${nick}: ${fmtKr(prev)} → ${fmtKr(next)}`,
        description: `🆔 \`${cleanFid}\``,
        color: next ? NOTIFY_COLORS.green : NOTIFY_COLORS.gray,
        timestamp: new Date().toISOString(),
      },
      'user-toggle',
      'user',
    );
    return {
      ok: true,
      active: next,
      message: `✅ ${nick}: ${fmtKr(prev)} → ${fmtKr(next)}`,
    };
  });
}

/** 쿠폰 enabled 토글 (웹 UI). @returns {{ok:boolean, enabled?:boolean, message:string}} */
function apiToggleCoupon(code, password) {
  return safeApiWithLock_('apiToggleCoupon', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    const c = findCoupon_(code);
    if (!c) {
      return { ok: false, code: 'coupon_not_found', data: { code: String(code).trim() } };
    }
    const prev = c.enabled;
    const next = !c.enabled;
    const cleanCode = String(code).trim();
    const fmtKr = (b) => (b ? '활성' : '비활성');
    const fmtEn = (b) => (b ? 'enabled' : 'disabled');
    const sheet = requireSheet_('coupons');
    sheet.getRange(c.row, COL.coupons.enabled).setValue(next);
    stampDate_(sheet, c.row, COL.coupons.updated, new Date());
    touchManage_();
    logSystem_(
      'INFO',
      'coupon-toggle',
      `web — code:${cleanCode} (${fmtEn(prev)} → ${fmtEn(next)})`,
      cleanCode,
    );
    notify_(
      {
        title: `🔁 ${cleanCode}: ${fmtKr(prev)} → ${fmtKr(next)}`,
        description: '',
        color: next ? NOTIFY_COLORS.green : NOTIFY_COLORS.gray,
        timestamp: new Date().toISOString(),
      },
      'coupon-toggle',
      'coupon',
    );
    return {
      ok: true,
      enabled: next,
      message: `✅ ${cleanCode}: ${fmtKr(prev)} → ${fmtKr(next)}`,
    };
  });
}

/**
 * 관리 목록 조회(보기 전용, 비밀번호 불필요). 변경/삭제 액션만 비밀번호으로 보호.
 * @returns {{ok:boolean, users:Array, coupons:Array, ttlDays:number}}
 */
function apiListManage() {
  return safeApi_('apiListManage', () => {
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
    // INVALID_CODE(존재하지 않는 오타) 는 캐시용으로만 시트에 남기고 UI 목록에서는 숨긴다.
    // EXPIRED/EXPIRED_AGE(한때 유효했던 코드) 는 이력 가치가 있어 그대로 노출.
    const isInvalidCode_ = (c) => String(c.status || '').toUpperCase() === 'INVALID_CODE';
    const invalidHiddenCount = couponsRaw.filter(isInvalidCode_).length;
    // 쿠폰: 활성 먼저 → 최신 등록순 (INVALID 제외)
    const coupons = couponsRaw
      .filter((c) => !isInvalidCode_(c))
      .sort((a, b) => (b.enabled ? 1 : 0) - (a.enabled ? 1 : 0) || newest(a, b))
      .map((c) => ({
        code: c.code,
        enabled: c.enabled,
        status: c.status || '',
        created: c.created ? Utilities.formatDate(c.created, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '',
      }));

    const props = PropertiesService.getScriptProperties();
    return {
      ok: true,
      ttlDays: config.couponTtlDays,
      users,
      coupons,
      invalidHiddenCount, // UI 에서 숨긴 INVALID(오타) 코드 개수 — 정리 칩 표시용
      // 헤더 표시용 "마지막 사용시각" — 시트 안 보는 사용자용
      lastUserReg: fmtTs_(maxCreated_(usersRaw)), // 유저 created 최댓값
      lastCouponReg: fmtTs_(maxCreated_(couponsRaw)), // 쿠폰 created 최댓값
      lastManage: props.getProperty('LAST_MANAGE_AT') || '',
      lastBatch: props.getProperty('LAST_BATCH_AT') || '', // 배치 신선도 표시용
      slackSet: !!config.slackWebhookUrl, // URL 자체는 노출하지 않음(비밀)
      slackEnabled: !!config.slackWebhookUrl && config.slackEnabled,
      notify: {
        batch: !!config.notify.batch,
        schedule: !!config.notify.schedule,
        user: !!config.notify.user,
        coupon: !!config.notify.coupon,
        settings: !!config.notify.settings,
        sync: !!config.notify.sync,
      },
      // 외부 쿠폰 소스 자동 동기화 상태 (Sync.js)
      autoSyncEnabled: props.getProperty('AUTO_SYNC_ENABLED') === 'true',
      lastSync: props.getProperty('LAST_SYNC_AT') || '',
      lastSyncResult: props.getProperty('LAST_SYNC_RESULT') || '',
    };
  });
}

/**
 * 연동된 스프레드시트(시트) URL 반환 — 'Entry (DB)' 바로가기용.
 *  - 웹앱이 익명(ANYONE_ANONYMOUS) 접근이라 서버가 접속자를 식별할 수 없음 → 신원확인 불가.
 *    따라서 비밀번호(오늘 MMDD)로 가벼운 게이트만 건다.
 *  - 비번은 약한 잠금이지만, 실제 시트 진입은 **구글 시트 공유 권한**이 다시 통제한다.
 *    → 권한 없는 지인은 URL 을 받아도 구글이 "액세스 요청" 벽으로 차단(진짜 자물쇠).
 * @returns {{ok:boolean, url?:string, message:string}}
 */
function apiGetSheetUrl(password) {
  return safeApi_('apiGetSheetUrl', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    const url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
    logSystem_('INFO', 'db-entry', 'web — Entry(DB) 열기', '');
    return { ok: true, url, message: '' };
  });
}

/**
 * Slack Webhook URL 설정/해제 (비밀번호 필요).
 * 저장 시 자동 ON + 테스트 메시지 전송. URL 자체는 반환하지 않음(비밀).
 * URL 형태: https://hooks.slack.com/services/T.../B.../...
 */
function apiSetSlackWebhook(url, password) {
  return safeApi_('apiSetSlackWebhook', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    const props = PropertiesService.getScriptProperties();
    const u = String(url || '').trim();

    if (!u) {
      props.deleteProperty('SLACK_WEBHOOK_URL');
      invalidateConfigCache_();
      touchManage_();
      logSystem_('INFO', 'settings-slack-url', 'webhook cleared', '');
      return { ok: true, code: 'slack_cleared', slackSet: false };
    }
    if (!/^https:\/\//.test(u) || !/hooks\.slack\.com\/services\//.test(u)) {
      return { ok: false, code: 'slack_invalid_url' };
    }
    props.setProperty('SLACK_WEBHOOK_URL', u);
    props.setProperty('SLACK_ENABLED', 'true');
    invalidateConfigCache_();
    touchManage_();
    // ⚠️ URL 자체는 secret 성격 — message 에 도메인만 기록, 전체 URL 은 sheet 에 저장된 그대로 참조
    logSystem_('INFO', 'settings-slack-url', 'webhook set (slack auto-enabled)', '');
    notifySlack_(
      {
        title: '✅ Slack 연동 완료',
        description: '이 채널로 알림이 전송됩니다. (테스트 메시지)',
        color: NOTIFY_COLORS.green,
        timestamp: new Date().toISOString(),
      },
      'webhook',
    );
    return { ok: true, code: 'slack_saved', slackSet: true };
  });
}

/** Slack 알림 on/off 토글 (비밀번호 필요). */
function apiSetSlackEnabled(enabled, password) {
  return safeApi_('apiSetSlackEnabled', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    const props = PropertiesService.getScriptProperties();
    const on = enabled === true || enabled === 'true';
    if (on && !props.getProperty('SLACK_WEBHOOK_URL')) {
      return { ok: false, code: 'slack_no_url' };
    }

    // 이전 상태 — Slack/로그 메시지의 화살표 좌측에 들어감 (default !== 'false' → 기본 ON)
    const prevOn = props.getProperty('SLACK_ENABLED') !== 'false';
    const fmt = (b) => (b ? 'ON' : 'OFF');

    if (on) {
      props.setProperty('SLACK_ENABLED', 'true');
      invalidateConfigCache_();
      touchManage_();
      logSystem_('INFO', 'settings-slack-on', `slack: ${fmt(prevOn)} → ${fmt(on)}`, '');
      notifySlack_(
        {
          title: `🔔 Slack 알림: ${fmt(prevOn)} → ${fmt(on)}`,
          description: '이제 이벤트 알림이 이 채널로 전송됩니다.',
          color: NOTIFY_COLORS.green,
          timestamp: new Date().toISOString(),
        },
        'on',
      );
    } else {
      // 끄기 직전(아직 ON 상태)에 마지막 메시지 전송
      notifySlack_(
        {
          title: `🔕 Slack 알림: ${fmt(prevOn)} → ${fmt(on)}`,
          description: '이후 알림이 전송되지 않습니다. (마지막 메시지)',
          color: NOTIFY_COLORS.gray,
          timestamp: new Date().toISOString(),
        },
        'off',
      );
      props.setProperty('SLACK_ENABLED', 'false');
      invalidateConfigCache_();
      touchManage_();
      logSystem_('INFO', 'settings-slack-on', `slack: ${fmt(prevOn)} → ${fmt(on)}`, '');
    }
    return { ok: true, enabled: on, code: 'slack_set', data: { prev: prevOn, on } };
  });
}

/** 알림 카테고리 6개 (batch/schedule/user/coupon/settings/sync) 의 개별 토글 */
const NOTIFY_CATEGORIES = ['batch', 'schedule', 'user', 'coupon', 'settings', 'sync'];
const NOTIFY_PROP_KEYS = {
  batch: 'NOTIFY_BATCH',
  schedule: 'NOTIFY_SCHEDULE',
  user: 'NOTIFY_USER',
  coupon: 'NOTIFY_COUPON',
  settings: 'NOTIFY_SETTINGS',
  sync: 'NOTIFY_SYNC',
};

/** 알림 카테고리 ON/OFF (비밀번호 필요). */
function apiSetNotify(category, enabled, password) {
  return safeApi_('apiSetNotify', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    if (NOTIFY_CATEGORIES.indexOf(category) < 0) {
      return { ok: false, code: 'unknown_category', data: { category } };
    }
    const props = PropertiesService.getScriptProperties();
    // 기본값 ON (!== 'false') — Property 미존재면 prev=true
    const prev = props.getProperty(NOTIFY_PROP_KEYS[category]) !== 'false';
    const on = enabled === true || enabled === 'true';
    props.setProperty(NOTIFY_PROP_KEYS[category], on ? 'true' : 'false');
    invalidateConfigCache_();
    touchManage_();
    const fmt = (b) => (b ? 'on' : 'off');
    logSystem_('INFO', 'settings-notify', `notify[${category}]: ${fmt(prev)} → ${fmt(on)}`, '');
    return {
      ok: true,
      category,
      enabled: on,
      code: 'notify_set',
      data: { category, prev, on },
    };
  });
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
  return safeApi_('apiSetCouponTtl', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    const n = parseInt(days, 10);
    if (isNaN(n) || n < 0 || n > 365) {
      return { ok: false, code: 'ttl_range' };
    }
    const props = PropertiesService.getScriptProperties();
    const prevRaw = props.getProperty('KINGSHOT_COUPON_TTL_DAYS');
    const prevN = prevRaw === null ? null : parseInt(prevRaw, 10);
    props.setProperty('KINGSHOT_COUPON_TTL_DAYS', String(n));
    invalidateConfigCache_();
    touchManage_();

    // 표시 포맷: Slack/UI 는 한국어 + 끔, 로그는 영문 (`days`/`off`/`unset`)
    const fmtKr = (v) => (v === null ? '(미설정)' : v === 0 ? '끔' : `${v}일`);
    const fmtEn = (v) => (v === null ? 'unset' : v === 0 ? 'off' : `${v} days`);

    logSystem_('INFO', 'settings-ttl', `TTL: ${fmtEn(prevN)} → ${fmtEn(n)}`, '');
    notify_(
      {
        title: '⏳ 쿠폰 자동만료(TTL) 변경',
        description: `**${fmtKr(prevN)} → ${fmtKr(n)}**`,
        color: NOTIFY_COLORS.green,
        timestamp: new Date().toISOString(),
      },
      'settings-ttl',
      'settings',
    );
    return {
      ok: true,
      ttlDays: n,
      code: 'ttl_set',
      data: { prev: prevN, n },
    };
  });
}

/** 유저 삭제 (웹 UI). @returns {{ok:boolean, message:string}} */
function apiDeleteUser(fid, password) {
  return safeApiWithLock_('apiDeleteUser', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    const user = findUser_(fid);
    if (!user) {
      return { ok: false, code: 'user_not_found', data: { fid: String(fid).trim() } };
    }
    const removedNick = user.nickname || '(닉네임 없음)';
    const cleanFid = String(fid).trim();
    const before = countUsers_();
    requireSheet_('users').deleteRow(user.row);
    const purgedLogs = purgeLogsForUser_(cleanFid);
    const after = countUsers_();
    touchManage_();
    logSystem_(
      'INFO',
      'user-delete',
      `web — nick:${removedNick} (${before} → ${after}), logs purged:${purgedLogs}`,
      cleanFid,
    );
    notify_(
      {
        title: '🗑️ 유저 삭제 완료',
        description:
          `🏷️ **${removedNick}**\n🆔 \`${cleanFid}\`  ·  👥 ${before} → ${after}명` +
          `\n🧹 logs ${purgedLogs}건 정리`,
        color: NOTIFY_COLORS.orange,
        timestamp: new Date().toISOString(),
      },
      'user-delete',
      'user',
    );
    return {
      ok: true,
      code: 'user_deleted',
      data: { nick: removedNick || '', fid: cleanFid, before, after, logs: purgedLogs },
    };
  });
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
 * 쿠폰 등록: 공백제거 → 시트 캐시 조회 → 단건 검증(login+redeem) → 분기:
 *   - 살아있는 코드(VALID/PENDING) → 시트 추가(enabled=TRUE) + 배치 예약
 *   - 죽은 코드(EXPIRED/INVALID_CODE) → 시트 추가(enabled=FALSE) 로 캐시 → 다음 시도 시 API 없이 차단
 *   - 캐시 히트(이미 등록 또는 이전에 죽은 것으로 확인) → API 없이 사유별 메시지
 * @returns {{ok:boolean, message:string, sheetUpdated?:boolean}}
 *   sheetUpdated: ok=false 라도 시트에 새 행이 추가됐다는 신호 (UI list 새로고침용)
 */
function registerCouponNow_(codeRaw) {
  const code = String(codeRaw || '').trim();
  if (!code) {
    return { ok: false, code: 'coupon_need_code' };
  }

  // 캐시 히트 — 이미 시트에 같은 코드가 있으면 API 호출 없이 즉시 처리
  const existing = findCoupon_(code);
  if (existing) {
    const s = String(existing.status || '').toUpperCase();
    if (s === 'EXPIRED' || s === 'EXPIRED_AGE') {
      return { ok: false, code: 'coupon_expired_cached', data: { code } };
    }
    if (s === 'INVALID_CODE') {
      return { ok: false, code: 'coupon_invalid_cached', data: { code } };
    }
    // VALID/PENDING 등 살아있는 상태
    return { ok: false, code: 'coupon_dup', data: { code } };
  }

  // 단건 검증 (긴 대기 없는 단일 시도)
  let status = 'PENDING';
  let note = '검증 안 함(유저 없음)'; // Slack 알림용(배포자 언어, Phase 2)
  let nc = 'no_user'; // 클라 표시용 noteCode: no_user | ok | pending
  let nr = ''; // pending 사유
  const validateFid = getValidateFid_();
  if (validateFid) {
    const login = loginPlayer(validateFid);
    if (login.ok) {
      const r = redeemCoupon(validateFid, code);
      // 죽은 코드도 시트에 enabled=FALSE 로 기록 → 같은 코드 재시도 시 캐시 차단(API 호출 절약)
      if (r.result === 'INVALID_CODE') {
        addCouponToSheet_(code, 'INVALID_CODE', /*enabled=*/ false);
        notify_(
          {
            title: '🎟 쿠폰 등록 거부 (존재 X)',
            description: `\`${code}\` — INVALID_CODE, dead code 캐시 기록`,
            color: NOTIFY_COLORS.red,
            timestamp: new Date().toISOString(),
          },
          'coupon-invalid',
          'coupon',
        );
        return {
          ok: false,
          sheetUpdated: true,
          code: 'coupon_invalid_new',
          data: { code },
        };
      }
      if (r.result === 'EXPIRED') {
        addCouponToSheet_(code, 'EXPIRED', /*enabled=*/ false);
        notify_(
          {
            title: '🎟 쿠폰 등록 거부 (만료)',
            description: `\`${code}\` — EXPIRED, dead code 캐시 기록`,
            color: NOTIFY_COLORS.orange,
            timestamp: new Date().toISOString(),
          },
          'coupon-expired',
          'coupon',
        );
        return {
          ok: false,
          sheetUpdated: true,
          code: 'coupon_expired_new',
          data: { code },
        };
      }
      if (r.result === 'SUCCESS' || r.result === 'ALREADY_USED') {
        status = 'VALID';
        note = '검증 OK';
        nc = 'ok';
      } else {
        note = `검증 보류(${r.result})`;
        nc = 'pending';
        nr = r.result;
      }
    } else {
      note = login.rateLimited ? '검증 보류(429)' : `검증 보류(${login.message})`;
      nc = 'pending';
      nr = login.rateLimited ? '429' : login.message;
    }
  }

  // 살아있는 코드 — enabled=true 로 등록 + 배치 예약
  addCouponToSheet_(code, status);
  requestBatch_();

  notify_(
    {
      title: '🎟 쿠폰 등록 완료',
      description: `🎟 \`${code}\`\n📍 상태: **${status}** _(${note})_`,
      color: NOTIFY_COLORS.green,
      timestamp: new Date().toISOString(),
    },
    'coupon-register',
    'coupon',
  );
  notify_(
    {
      title: '⏱ 배치 예약 (쿠폰 등록)',
      description: `약 30초 뒤 자동 배치 — 신규 쿠폰 \`${code}\` 전 유저에 발급`,
      color: NOTIFY_COLORS.green,
      timestamp: new Date().toISOString(),
    },
    'schedule-coupon',
    'schedule',
  );

  return {
    ok: true,
    sheetUpdated: true,
    code: 'coupon_registered',
    data: { code, status, nc, nr },
  };
}

/**
 * 수동 배치 실행 (관리 UI 비밀번호 게이트).
 * 동기 실행은 6분 요청 한도 위험 → debounce 트리거 예약으로 통일 (약 30초 뒤 실행).
 * tryLock(0) 보호로 이미 도는 중이면 새로 안 시작 (debounce 만 재예약).
 * @returns {{ok:boolean, message:string}}
 */
function apiRunBatchNow(password) {
  return safeApi_('apiRunBatchNow', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    requestBatch_(); // 기본 30s
    touchManage_();
    logSystem_('INFO', 'schedule-manual', 'manual batch trigger requested', '');
    notify_(
      {
        title: '⚡ 즉시 배치 실행',
        description: '수동 트리거 — 약 30초 뒤 자동 시작',
        color: NOTIFY_COLORS.green,
        timestamp: new Date().toISOString(),
      },
      'schedule-manual',
      'schedule',
    );
    return {
      ok: true,
      code: 'batch_scheduled',
    };
  });
}

/**
 * 존재하지 않는(오타) 코드 정리 (비밀번호 필요).
 * coupons 시트의 INVALID_CODE 행 삭제 + 해당 코드 logs 정리. EXPIRED 는 보존.
 * @returns {{ok:boolean, removed?:number, message:string}}
 */
function apiCleanInvalidCoupons(password) {
  return safeApiWithLock_('apiCleanInvalidCoupons', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    const res = purgeInvalidCoupons_();
    touchManage_();
    if (res.coupons === 0) {
      return { ok: true, removed: 0, code: 'clean_none' };
    }
    logSystem_(
      'INFO',
      'coupon-clean-invalid',
      `web — INVALID ${res.coupons}건 삭제 (${res.codes.join(', ')}), logs ${res.logs}건`,
      res.codes.join(','),
    );
    notify_(
      {
        title: '🗑 오타 코드 정리',
        description: `존재하지 않는 코드 **${res.coupons}건** 삭제\n🧹 관련 logs ${res.logs}건 정리`,
        color: NOTIFY_COLORS.gray,
        timestamp: new Date().toISOString(),
      },
      'coupon-clean-invalid',
      'coupon',
    );
    return {
      ok: true,
      removed: res.coupons,
      code: 'clean_done',
      data: { coupons: res.coupons, logs: res.logs },
    };
  });
}

// Slack 알림 / 배치 트리거 예약은 Notify.js 로 분리됨.
