/* global apiRegisterCoupon, findCoupon_, notify_, NOTIFY_COLORS, logSystem_, checkDatePassword_, safeApi_, touchManage_, removeTriggers_, nt */

/**
 * Kingshot Coupon — 외부 쿠폰 소스 자동 동기화 (옵션 레이어)
 *
 * 외부 커뮤니티 사이트(kingshotdata.kr)가 발행 쿠폰을 JSON 으로 공개한다.
 * 그 목록을 주기적으로 받아 우리 시트에 없는 "아직 유효한" 신규 코드만 자동 등록한다.
 *
 * ⚠️ 격리 원칙 (절대 위반 금지):
 *   - 이 파일은 기존 수동 등록/배치 경로와 완전히 독립. 통째로 삭제해도 기존 기능 무손상.
 *   - 모든 진입점은 try/catch 로 감싸 어떤 오류(네트워크/JSON/스키마 변경)도
 *     트리거 밖으로 던지지 않음. 사이트가 변하거나 죽어도 수동 등록은 100% 정상.
 *   - 신규 등록은 반드시 apiRegisterCoupon() 만 거침 → 단건 검증·dedup·dead코드 캐시·
 *     debounce 배치를 전부 기존 로직에 위임. 즉 "사람이 손으로 코드 친 것"과 동일한 효과.
 *   - 기본 OFF. AUTO_SYNC_ENABLED='true' 일 때만 시간 트리거가 동작.
 *   - 시트 카피 시 설치형 트리거는 복사되지 않음(GAS 사양) → 지인 시트는 누군가
 *     명시적으로 켜기 전까지 완전 비활성.
 *
 * Script Properties:
 *   - AUTO_SYNC_ENABLED  : 'true' 면 ON (그 외/미설정 = OFF)
 *   - COUPON_SOURCE_URL  : 소스 JSON URL (미설정 시 아래 기본 상수)
 *   - LAST_SYNC_AT       : 마지막 동기화 시각(KST)
 *   - LAST_SYNC_RESULT   : 마지막 동기화 결과 요약(표시용)
 */

const COUPON_SOURCE_URL_DEFAULT = 'https://kingshotdata.kr/data/coupons.json';
const SYNC_TRIGGER_HANDLER = 'syncCouponsScheduled';
const SYNC_INTERVAL_HOURS = 6; // 하루 4회

// ============================================================
// 트리거 진입점 (시간 기반) — 토글 OFF 면 즉시 종료
// ============================================================

/** 시간 트리거가 호출하는 진입점. 토글이 꺼져 있으면 아무것도 안 함. */
function syncCouponsScheduled() {
  if (PropertiesService.getScriptProperties().getProperty('AUTO_SYNC_ENABLED') !== 'true') {
    return;
  }
  runCouponSync_(false);
}

// ============================================================
// 동기화 본체 — 전체가 방어적(throw 없음)
// ============================================================

/**
 * 소스를 받아 신규 유효 쿠폰만 등록한다.
 * @param {boolean} isManual 수동 실행 여부(현재는 반환 메시지 외 동작 차이 없음)
 * @returns {{ok:boolean, registered?:string[], rejected?:string[], candidates?:number, message:string}}
 */
function runCouponSync_(isManual) {
  const startedAt = new Date();
  try {
    const props = PropertiesService.getScriptProperties();
    const url = props.getProperty('COUPON_SOURCE_URL') || COUPON_SOURCE_URL_DEFAULT;

    // 1) fetch — 캐시 회피용 v 파라미터, 예외는 mute 후 코드로 처리
    const resp = UrlFetchApp.fetch(`${url}?v=${startedAt.getTime()}`, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
    });
    const status = resp.getResponseCode();
    if (status !== 200) {
      return syncFail_(`소스 응답 HTTP ${status}`, isManual);
    }

    // 2) 방어적 파싱 — 형식이 깨졌으면 조용히 실패 처리
    let data;
    try {
      data = JSON.parse(resp.getContentText());
    } catch (e) {
      return syncFail_('소스 JSON 파싱 실패 (형식 변경?)', isManual);
    }
    if (!data || !Array.isArray(data.coupons)) {
      return syncFail_('소스 응답에 coupons 배열 없음 (스키마 변경?)', isManual);
    }

    // 3) 후보 선별 — until>=오늘 & 코드 정상 & 시트(활성/죽은코드 캐시)에 없음
    const today = Utilities.formatDate(startedAt, 'Asia/Seoul', 'yyyy-MM-dd');
    const seen = {};
    const candidates = [];
    for (const raw of data.coupons) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const code = String(raw.code ?? '').trim();
      const until = String(raw.until ?? '').trim();
      if (!code) {
        continue;
      }
      // until 이 yyyy-MM-dd 형식이 아니면 보수적으로 스킵(오염 데이터 차단)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) {
        continue;
      }
      // 문자열 ISO 날짜는 사전식 비교로 정확. 오늘 이전(만료)은 제외.
      if (until < today) {
        continue;
      }
      const key = code.toUpperCase();
      if (seen[key]) {
        continue; // 소스 내 중복
      }
      seen[key] = true;
      if (findCoupon_(code)) {
        continue; // 이미 시트에 존재(활성 또는 죽은코드 캐시) → 재등록 안 함
      }
      candidates.push({ code, until });
    }

    // 4) 등록 — 기존 진입점에 위임(검증/dedup/dead캐시/배치 debounce 전부 위임)
    const registered = [];
    const rejected = [];
    for (const c of candidates) {
      let res;
      try {
        res = apiRegisterCoupon(c.code);
      } catch (e) {
        rejected.push(`${c.code}(예외)`);
        continue;
      }
      if (res && res.ok) {
        registered.push(c.code);
      } else {
        rejected.push(c.code);
      }
    }

    // 5) 결과 기록 + 알림(신규가 있을 때만 Slack — 노이즈 방지)
    const summary =
      `신규 ${registered.length}건` +
      (registered.length ? ` (${registered.join(', ')})` : '') +
      (rejected.length ? ` · 거부/보류 ${rejected.length}건` : '') +
      ` · 후보 ${candidates.length}`;
    stampSync_(startedAt, {
      ok: true,
      n: registered.length,
      rej: rejected.length,
      cand: candidates.length,
    });
    logSystem_('INFO', 'sync', summary, '');

    if (registered.length) {
      notify_(
        {
          title: nt('sync_t'),
          description: nt('sync_d', {
            n: registered.length,
            codes: registered.join(', '),
            rej: rejected.length,
            rejCodes: rejected.join(', '),
          }),
          color: NOTIFY_COLORS.green,
          timestamp: startedAt.toISOString(),
        },
        'sync',
        'sync',
      );
    }
    return {
      ok: true,
      registered,
      rejected,
      candidates: candidates.length,
      message: `✅ 동기화 완료 — ${summary}`,
    };
  } catch (err) {
    // 최후 안전망 — 어떤 예외도 트리거/호출자 밖으로 새지 않음
    return syncFail_(err && err.message ? err.message : String(err), isManual);
  }
}

/** 동기화 실패 처리 — 기록/알림도 실패하면 조용히 삼킨다. */
function syncFail_(reason, isManual) {
  const now = new Date();
  try {
    stampSync_(now, { ok: false, reason: String(reason).slice(0, 150) });
    logSystem_('WARN', 'sync', `동기화 실패: ${reason}`, '');
    notify_(
      {
        title: nt('sync_fail_t'),
        description: nt('sync_fail_d', { reason }),
        color: NOTIFY_COLORS.orange,
        timestamp: now.toISOString(),
      },
      'sync',
      'sync',
    );
  } catch (e) {
    // 로깅/알림 실패도 무시 — 격리 원칙
  }
  return { ok: false, isManual: isManual === true, code: 'sync_fail', data: { reason } };
}

/**
 * 마지막 동기화 시각/결과를 Script Property 에 기록.
 * 결과는 **구조화(JSON)** 로 저장 → 웹 UI(클라이언트)가 접속자 언어로 직접 포맷한다.
 *   성공: { ok:true, n:<신규수>, rej:<거부수>, cand:<후보수> }
 *   실패: { ok:false, reason:<사유> }
 * @param {Date} date
 * @param {Object} result
 */
function stampSync_(date, result) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('LAST_SYNC_AT', Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd HH:mm'));
  props.setProperty('LAST_SYNC_RESULT', JSON.stringify(result).slice(0, 300));
}

// ============================================================
// 트리거 설치/제거
// ============================================================

/** 6시간 주기 시간 트리거 설치(중복 누적 방지 위해 기존 것 제거 후 1개만) */
function installSyncTrigger_() {
  removeTriggers_(SYNC_TRIGGER_HANDLER);
  ScriptApp.newTrigger(SYNC_TRIGGER_HANDLER).timeBased().everyHours(SYNC_INTERVAL_HOURS).create();
}

/** 동기화 트리거 제거 */
function removeSyncTrigger_() {
  removeTriggers_(SYNC_TRIGGER_HANDLER);
}

// ============================================================
// 웹 UI 진입점 (비밀번호 = 오늘 MMDD)
// ============================================================

/** 자동 동기화 ON/OFF (비밀번호 필요). 켜면 트리거 설치, 끄면 제거. */
function apiSetAutoSync(enabled, password) {
  return safeApi_('apiSetAutoSync', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    const props = PropertiesService.getScriptProperties();
    const prev = props.getProperty('AUTO_SYNC_ENABLED') === 'true';
    const on = enabled === true || enabled === 'true';
    props.setProperty('AUTO_SYNC_ENABLED', on ? 'true' : 'false');
    if (on) {
      installSyncTrigger_();
    } else {
      removeSyncTrigger_();
    }
    touchManage_();
    const fmt = (b) => (b ? 'on' : 'off');
    logSystem_('INFO', 'settings-sync', `auto-sync: ${fmt(prev)} → ${fmt(on)}`, '');
    notify_(
      {
        title: nt('sync_set_t'),
        description: nt('sync_set_d', { prev, on, hours: SYNC_INTERVAL_HOURS }),
        color: on ? NOTIFY_COLORS.green : NOTIFY_COLORS.gray,
        timestamp: new Date().toISOString(),
      },
      'settings-sync',
      'settings',
    );
    return {
      ok: true,
      enabled: on,
      code: 'autosync_set',
      data: { prev, on },
    };
  });
}

/** 지금 즉시 1회 동기화 (비밀번호 필요). 토글과 무관하게 실행 — 테스트용. */
function apiRunSyncNow(password) {
  return safeApi_('apiRunSyncNow', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    touchManage_();
    return runCouponSync_(true);
  });
}

// ============================================================
// 시트 메뉴 진입점 (소유자 실행 — 비밀번호 불필요)
// ============================================================

/** 메뉴: 지금 1회 동기화 */
function menuRunSyncNow() {
  const ui = SpreadsheetApp.getUi();
  const res = runCouponSync_(true);
  ui.alert('🔄 쿠폰 동기화', (res && res.message) || '완료', ui.ButtonSet.OK);
}

/** 메뉴: 자동 동기화 ON/OFF 토글 */
function menuToggleAutoSync() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const prev = props.getProperty('AUTO_SYNC_ENABLED') === 'true';
  const next = !prev;
  props.setProperty('AUTO_SYNC_ENABLED', next ? 'true' : 'false');
  if (next) {
    installSyncTrigger_();
  } else {
    removeSyncTrigger_();
  }
  logSystem_(
    'INFO',
    'settings-sync',
    `auto-sync(menu): ${prev ? 'on' : 'off'} → ${next ? 'on' : 'off'}`,
    '',
  );
  ui.alert(
    '🔄 자동 동기화',
    next ? `ON — ${SYNC_INTERVAL_HOURS}시간마다 자동 확인합니다.` : 'OFF 되었습니다.',
    ui.ButtonSet.OK,
  );
}
