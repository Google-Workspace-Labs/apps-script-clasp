/* global apiRegisterCoupon, findCoupon_, notify_, NOTIFY_COLORS, logSystem_, checkDatePassword_, safeApi_, touchManage_, removeTriggers_, nt, getConfig, tsToIso_ */

/**
 * Kingshot Coupon — 외부 쿠폰 소스 자동 동기화 (옵션 레이어)
 *
 * 외부 커뮤니티 소스가 발행 쿠폰을 JSON 으로 공개한다. 그 목록을 주기적으로 받아
 * 우리 시트에 없는 "아직 유효한" 신규 코드만 자동 등록한다.
 *
 * 소스 = 주(primary) + 예비(fallback). 인프라가 서로 독립이라 실패가 상관없음(uncorrelated):
 *   - 주  : ks-rewards.com/api/codes — Cloudflare 뒤 동적 API. 신선·검증상태(validation_status) 명시.
 *           validation_status === 'validated' 인 코드만 채택.
 *   - 예비: kingshotdata.kr/data/coupons.json — GitHub Pages 정적 파일. 스테일하지만 초안정.
 *           until >= 오늘 인 코드만 채택.
 *   - 폴백은 **주 소스 fetch/파싱 실패 시에만** 호출(주가 정상이면 코드 0개라도 예비 안 봄 →
 *     스테일·오타 잡음 상시 혼입 방지). 둘 다 실패하면 그 회차만 조용히 스킵.
 *
 * 알림 정책(엣지 트리거): Slack 실패 알림은 **정상→실패 전환 1회**만, 복구 시 **실패→정상 전환 1회**만.
 *   장애가 지속돼도 매 회차 반복 알림 안 함(1시간 폴링에서 하루 24번 노이즈 방지). log 는 매 회차 기록.
 *   백스톱: 모든 소스가 연속 SYNC_FAIL_AUTOOFF_STREAK회(≈1주일) 실패하면 자동 OFF + 알림 1회(영구 death 정리).
 *   성공 1회로 카운터 0 리셋 → 일시 장애는 self-heal, 진짜 영구 고장만 꺼짐.
 *
 * ⚠️ 격리 원칙 (절대 위반 금지):
 *   - 이 파일은 기존 수동 등록/배치 경로와 완전히 독립. 통째로 삭제해도 기존 기능 무손상.
 *   - 모든 진입점 + 각 소스 fetch 가 try/catch 로 감싸여 어떤 오류(네트워크/JSON/스키마/CF차단)도
 *     트리거 밖으로 던지지 않음. **두 소스가 다 죽어도 본체 동작은 "꺼놨을 때"와 동일**(수동 등록 100% 정상).
 *   - 신규 등록은 반드시 apiRegisterCoupon() 만 거침 → 단건 검증·dedup·dead코드 캐시·
 *     debounce 배치를 전부 기존 로직에 위임. 즉 "사람이 손으로 코드 친 것"과 동일한 효과.
 *   - 기본 OFF. AUTO_SYNC_ENABLED='true' 일 때만 시간 트리거가 동작.
 *   - 시트 카피 시 설치형 트리거는 복사되지 않음(GAS 사양) → 지인 시트는 누군가
 *     명시적으로 켜기 전까지 완전 비활성.
 *
 * Script Properties:
 *   - AUTO_SYNC_ENABLED       : 'true' 면 ON (그 외/미설정 = OFF)
 *   - COUPON_SOURCE_URL       : 주 소스 URL (미설정 시 아래 기본 상수 = ks-rewards)
 *   - COUPON_SOURCE_URL_FALLBACK : 예비 소스 URL (미설정 시 아래 기본 상수 = kingshotdata)
 *   - LAST_SYNC_AT            : 마지막 동기화 시각(KST)
 *   - LAST_SYNC_RESULT        : 마지막 동기화 결과 요약(표시용)
 *   - SYNC_FAIL_STREAK        : 연속 실패 횟수(자동 관리, 성공 시 0) — 자동 OFF 백스톱용
 *   - SYNC_FAIL_AUTOOFF_STREAK : 자동 OFF 임계값(미설정 시 168=1주일, 0이면 백스톱 끔)
 */

const COUPON_SOURCE_URL_DEFAULT = 'https://ks-rewards.com/api/codes'; // 주
const COUPON_SOURCE_URL_FALLBACK_DEFAULT = 'https://kingshotdata.kr/data/coupons.json'; // 예비
const SYNC_TRIGGER_HANDLER = 'syncCouponsScheduled';
const SYNC_INTERVAL_HOURS = 1; // 매시간(24회/일) — 소스 폴링만, 킹샷 API 부하와 무관(신규코드 dedup→1회 등록)
// 연속 실패(=모든 소스 동시 실패) N회 도달 시 자동 OFF — 영구 death 백스톱. 168 ≈ 1주일 @1h.
// 일시 장애엔 안 꺼짐(성공 1회로 0 리셋). Property(SYNC_FAIL_AUTOOFF_STREAK)로 오버라이드, 0이면 끔.
const SYNC_FAIL_AUTOOFF_STREAK = 168;

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
// 소스 fetch — 각 함수가 독립 try/catch, 절대 throw 안 함
// 반환: { ok:boolean, codes:string[], error:string }
//   ok=true  → 성공적으로 받아 파싱함(코드 0개여도 ok). 폴백 안 함.
//   ok=false → fetch/파싱/스키마 실패 → 호출부가 다음 소스로 폴백.
// ============================================================

/** 공통 GET — 캐시 회피 v 파라미터, 예외 mute. */
function syncFetchJson_(url, startedAt) {
  const resp = UrlFetchApp.fetch(`${url}?v=${startedAt.getTime()}`, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
  });
  return { status: resp.getResponseCode(), text: resp.getContentText() };
}

/** 주 소스: ks-rewards — {success, codes:[{code, validation_status}]}. validated 만 채택. */
function fetchKsRewards_(url, startedAt) {
  try {
    const r = syncFetchJson_(url, startedAt);
    if (r.status !== 200) {
      return { ok: false, codes: [], error: `ks-rewards HTTP ${r.status}` };
    }
    let data;
    try {
      data = JSON.parse(r.text);
    } catch (e) {
      // 200 인데 JSON 아님 = CF 차단 HTML 등 → 실패로 보고 폴백
      return { ok: false, codes: [], error: 'ks-rewards JSON 파싱 실패(차단?)' };
    }
    if (!data || !Array.isArray(data.codes)) {
      return { ok: false, codes: [], error: 'ks-rewards codes 배열 없음(스키마 변경?)' };
    }
    const codes = [];
    for (const raw of data.codes) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const code = String(raw.code ?? '').trim();
      const vs = String(raw.validation_status ?? '')
        .trim()
        .toLowerCase();
      if (!code || vs !== 'validated') {
        continue; // expired/invalid/pending 은 무시 — 오타·만료 잡음 원천 차단
      }
      codes.push(code);
    }
    return { ok: true, codes, error: '' };
  } catch (e) {
    return { ok: false, codes: [], error: e && e.message ? e.message : String(e) };
  }
}

/** 예비 소스: kingshotdata — {coupons:[{code, until}]}. until>=오늘 만 채택. */
function fetchKingshotData_(url, startedAt, today) {
  try {
    const r = syncFetchJson_(url, startedAt);
    if (r.status !== 200) {
      return { ok: false, codes: [], error: `kingshotdata HTTP ${r.status}` };
    }
    let data;
    try {
      data = JSON.parse(r.text);
    } catch (e) {
      return { ok: false, codes: [], error: 'kingshotdata JSON 파싱 실패' };
    }
    if (!data || !Array.isArray(data.coupons)) {
      return { ok: false, codes: [], error: 'kingshotdata coupons 배열 없음(스키마 변경?)' };
    }
    const codes = [];
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
      codes.push(code);
    }
    return { ok: true, codes, error: '' };
  } catch (e) {
    return { ok: false, codes: [], error: e && e.message ? e.message : String(e) };
  }
}

/**
 * 주 소스 시도 → 실패 시에만 예비 폴백.
 * @returns {{codes:string[], source:(string|null), error:string}} source=null 이면 둘 다 실패.
 */
function collectSourceCodes_(startedAt, today) {
  const props = PropertiesService.getScriptProperties();

  const primaryUrl = props.getProperty('COUPON_SOURCE_URL') || COUPON_SOURCE_URL_DEFAULT;
  const primary = fetchKsRewards_(primaryUrl, startedAt);
  if (primary.ok) {
    return { codes: primary.codes, source: 'ks-rewards', error: '' };
  }

  // 주 실패 → 예비
  const fallbackUrl =
    props.getProperty('COUPON_SOURCE_URL_FALLBACK') || COUPON_SOURCE_URL_FALLBACK_DEFAULT;
  const fallback = fetchKingshotData_(fallbackUrl, startedAt, today);
  if (fallback.ok) {
    return { codes: fallback.codes, source: 'kingshotdata(fallback)', error: primary.error };
  }

  return {
    codes: [],
    source: null,
    error: `주(${primary.error}) · 예비(${fallback.error})`,
  };
}

// ============================================================
// 동기화 본체 — 전체가 방어적(throw 없음)
// ============================================================

/**
 * 소스를 받아 신규 유효 쿠폰만 등록한다.
 * @param {boolean} isManual 수동 실행 여부(현재는 반환 메시지 외 동작 차이 없음)
 * @returns {{ok:boolean, registered?:string[], rejected?:string[], candidates?:number, source?:string, message:string}}
 */
function runCouponSync_(isManual) {
  const startedAt = new Date();
  // 직전 상태를 stampSync_ 가 덮어쓰기 전에 캡처 → 알림은 상태 전이(엣지)에서만.
  let wasOk = true;
  try {
    wasOk = lastSyncWasOk_();
    // ⚠️ 의도적 KST: 외부 소스(kingshotdata)의 until 날짜와 비교하는 date-only 값(소스 의미) —
    //    우리 저장 타임스탬프(UTC ISO 단일원천)와 무관. UTC 로 바꾸면 만료 경계가 몇 시간 어긋남.
    const today = Utilities.formatDate(startedAt, 'Asia/Seoul', 'yyyy-MM-dd');

    // 1) 소스 수집(주→예비 폴백). 둘 다 죽으면 조용히 실패 처리.
    const src = collectSourceCodes_(startedAt, today);
    if (src.source === null) {
      return syncFail_(`모든 소스 실패 — ${src.error}`, isManual, wasOk);
    }

    // 2) 후보 선별 — 소스 내 dedup + 시트(활성/죽은코드 캐시)에 없는 것만
    const seen = {};
    const candidates = [];
    for (const code of src.codes) {
      const key = code.toUpperCase();
      if (seen[key]) {
        continue; // 소스 내 중복
      }
      seen[key] = true;
      if (findCoupon_(code)) {
        continue; // 이미 시트에 존재(활성 또는 죽은코드 캐시) → 재등록 안 함
      }
      candidates.push(code);
    }

    // 3) 등록 — 기존 진입점에 위임(검증/dedup/dead캐시/배치 debounce 전부 위임)
    const registered = [];
    const rejected = [];
    for (const code of candidates) {
      let res;
      try {
        res = apiRegisterCoupon(code);
      } catch (e) {
        rejected.push(`${code}(예외)`);
        continue;
      }
      if (res && res.ok) {
        registered.push(code);
      } else {
        rejected.push(code);
      }
    }

    // 4) 결과 기록 + 알림(신규가 있을 때만 Slack — 노이즈 방지)
    const summary =
      `[${src.source}] new ${registered.length}` +
      (registered.length ? ` (${registered.join(', ')})` : '') +
      (rejected.length ? ` · ${rejected.length} rejected/pending` : '') +
      ` · ${candidates.length} candidates`;
    stampSync_(startedAt, {
      ok: true,
      n: registered.length,
      rej: rejected.length,
      cand: candidates.length,
    });
    // 성공(주·예비 중 하나라도 응답) → 자동 OFF 카운터 리셋. 일시 장애가 임계값에 누적되지 않게.
    PropertiesService.getScriptProperties().setProperty('SYNC_FAIL_STREAK', '0');
    logSystem_('INFO', 'sync', summary, '');

    // 직전이 실패였으면(엣지: 실패→정상) 복구 알림 1회. 신규 0건이어도 "다시 동작함"을 알림.
    if (!wasOk) {
      notify_(
        {
          title: nt('sync_recover_t'),
          description: nt('sync_recover_d'),
          color: NOTIFY_COLORS.green,
          timestamp: startedAt.toISOString(),
        },
        'sync',
        'sync',
      );
    }

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
      source: src.source,
      message: `✅ Sync done — ${summary}`,
    };
  } catch (err) {
    // 최후 안전망 — 어떤 예외도 트리거/호출자 밖으로 새지 않음
    return syncFail_(err && err.message ? err.message : String(err), isManual, wasOk);
  }
}

/**
 * 동기화 실패 처리 — 기록/알림도 실패하면 조용히 삼킨다.
 * Slack 알림은 **상태 전이(정상→실패)일 때만** 보낸다(wasOk===true). 이미 실패 중이면 log/stamp 만 —
 * 1시간 폴링에서 장애 지속 시 매시간 같은 알림이 쏟아지는 노이즈를 막는다. 복구 알림은 runCouponSync_ 가 담당.
 */
function syncFail_(reason, isManual, wasOk) {
  const now = new Date();
  try {
    stampSync_(now, { ok: false, reason: String(reason).slice(0, 150) });
    logSystem_('WARN', 'sync', `sync failed: ${reason}`, '');
    if (wasOk !== false) {
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
    }
    bumpFailStreakAndMaybeAutoOff_(reason, isManual);
  } catch (e) {
    // 로깅/알림 실패도 무시 — 격리 원칙
  }
  return { ok: false, isManual: isManual === true, code: 'sync_fail', data: { reason } };
}

/**
 * 실패 스트릭 +1, 임계값(SYNC_FAIL_AUTOOFF_STREAK) 도달 시 자동 OFF.
 * "실패" = 모든 소스 동시 실패(collectSourceCodes_ source=null) 또는 예외. 소스 하나라도 성공하면
 * 성공 경로에서 0으로 리셋된다. 수동 "지금 동기화"(테스트)와 OFF 상태는 카운트하지 않는다.
 */
function bumpFailStreakAndMaybeAutoOff_(reason, isManual) {
  if (isManual === true) {
    return; // 수동 테스트는 백스톱 스트릭에 영향 X
  }
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTO_SYNC_ENABLED') !== 'true') {
    return; // 꺼져 있으면 카운트 무의미
  }
  const streak = (parseInt(props.getProperty('SYNC_FAIL_STREAK'), 10) || 0) + 1;
  props.setProperty('SYNC_FAIL_STREAK', String(streak));
  const limit =
    parseInt(props.getProperty('SYNC_FAIL_AUTOOFF_STREAK'), 10) || SYNC_FAIL_AUTOOFF_STREAK;
  if (limit > 0 && streak >= limit) {
    autoOffSync_(streak, reason);
  }
}

/** 연속 실패 임계값 도달 → 자동 동기화 OFF + 트리거 제거 + 알림 1회(소스 영구 death 정리). */
function autoOffSync_(streak, reason) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('AUTO_SYNC_ENABLED', 'false');
  props.setProperty('SYNC_FAIL_STREAK', '0'); // 다음에 다시 켤 때 깨끗하게
  removeSyncTrigger_();
  logSystem_('WARN', 'settings-sync', `auto-sync OFF — ${streak} consecutive failures`, '');
  notify_(
    {
      title: nt('sync_autooff_t'),
      description: nt('sync_autooff_d', { n: streak, reason: reason || '' }),
      color: NOTIFY_COLORS.orange,
      timestamp: new Date().toISOString(),
    },
    'settings-sync',
    'sync',
  );
}

/**
 * 직전 동기화가 정상(ok)이었는지 — LAST_SYNC_RESULT 의 ok 플래그로 판정.
 * 없거나 파싱 실패면 정상(true)으로 가정 → 첫 실패는 반드시 알림.
 */
function lastSyncWasOk_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('LAST_SYNC_RESULT');
    if (!raw) {
      return true;
    }
    const obj = JSON.parse(raw);
    return !obj || obj.ok !== false;
  } catch (e) {
    return true;
  }
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
  props.setProperty('LAST_SYNC_AT', tsToIso_(date)); // UTC ISO (단일 원천)
  props.setProperty('LAST_SYNC_RESULT', JSON.stringify(result).slice(0, 300));
}

// ============================================================
// 트리거 설치/제거
// ============================================================

/** 매시간 시간 트리거 설치(중복 누적 방지 위해 기존 것 제거 후 1개만). 주기 변경은 토글 OFF→ON 시 재설치되어야 반영됨. */
function installSyncTrigger_() {
  removeTriggers_(SYNC_TRIGGER_HANDLER);
  PropertiesService.getScriptProperties().setProperty('SYNC_FAIL_STREAK', '0'); // 켤 때 백스톱 카운터 초기화
  ScriptApp.newTrigger(SYNC_TRIGGER_HANDLER).timeBased().everyHours(SYNC_INTERVAL_HOURS).create();
}

/** 동기화 트리거 제거 */
function removeSyncTrigger_() {
  removeTriggers_(SYNC_TRIGGER_HANDLER);
}

// ============================================================
// 웹 UI 진입점 (비밀번호 = 접속 기기의 오늘 날짜 MMdd, any-timezone)
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
  const ml = getConfig().menuLang;
  const res = runCouponSync_(true);
  let body;
  if (res && res.ok) {
    body = nt(
      'md_sync_result',
      {
        n: res.registered.length,
        codes: res.registered.join(', '),
        rej: res.rejected.length,
        cand: res.candidates,
      },
      ml,
    );
  } else {
    body = nt('md_sync_fail', { reason: (res && res.data && res.data.reason) || '' }, ml);
  }
  ui.alert(nt('md_sync_title', null, ml), body, ui.ButtonSet.OK);
}

/** 메뉴: 자동 동기화 ON/OFF 토글 */
function menuToggleAutoSync() {
  const ui = SpreadsheetApp.getUi();
  const ml = getConfig().menuLang;
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
    nt('md_autosync_title', null, ml),
    next
      ? nt('md_autosync_on', { hours: SYNC_INTERVAL_HOURS }, ml)
      : nt('md_autosync_off', null, ml),
    ui.ButtonSet.OK,
  );
}
