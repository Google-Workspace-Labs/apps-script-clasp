/* global getConfig, readUsers_, readCoupons_, getProcessedSet_, notify_, NOTIFY_COLORS, nt, logSystem_, checkDatePassword_, safeApi_, touchManage_, removeTriggers_, MailApp, fmtTsLang_ */

/**
 * Kingshot Coupon — 정기 보고서 (digest, 옵션 레이어)
 *
 * 운영 데이터(유저·쿠폰·전달 현황·동기화 상태)를 한 기간 단위로 집계해 Slack(+선택 메일)로 1통 보낸다.
 * "이상할 때만" 알리는 엣지 알림(Sync.js)과 정반대 축 — "정상이어도 정기적으로" 현황을 요약한다.
 *
 * 모든 수치는 **현재 시트 상태**에서 계산(전달 현황=활성유저×활성쿠폰 미전달 조합). 행 기반 "기간 내
 * 성공률/전달건수"는 logs purge(유저삭제·쿠폰만료)로 흔들려서 폐기 — 어떤 상태변경에도 안 깨지게 함.
 *
 * 기간(REPORT_PERIOD Property): 'weekly'(기본·1주) | 'biweekly'(2주) | 'monthly'(1달).
 *   발송 시각은 09:00(KST). weekly=매주 월, biweekly=2주마다 월, monthly=매월 1일.
 *
 * 집계 윈도우 = "직전 보고 이후 ~ 지금"(LAST_REPORT_AT 기준). 한 회차를 놓쳐도 다음 보고가
 *   그 구간까지 덮어 누락이 없다. 최초(LAST_REPORT_AT 없음)엔 기간 길이만큼 과거를 본다.
 *   ⚠️ 수동 "지금 보고서"는 미리보기 — 경계(LAST_REPORT_AT)를 옮기지 않아 다음 정기 보고가 온전.
 *
 * 채널:
 *   - Slack 우선(notify_ category 'report'). digest 라 빈도 낮음 → 노이즈·quota 무관.
 *   - 메일은 선택: REPORT_EMAIL(쉼표구분 수신자)이 있을 때만 같은 내용을 메일로도. 발송 전
 *     MailApp.getRemainingDailyQuota() 가드 → 부족하면 메일만 스킵(Slack·본체 무관).
 *
 * 🛡️ 격리 보장 (자동 동기화와 동일 등급 — 절대 위반 금지):
 *   1. **데이터 불변**: users/coupons/logs 를 읽기만 함. 쓰는 건 자기 소유 Property(REPORT_*,
 *      LAST_REPORT_AT)뿐. dedup·배치·동기화 상태를 한 바이트도 안 건드림 → 버그가 나도 데이터 오염 불가능.
 *   2. **예외 벽**: 모든 진입점이 try/catch. runReport_ 는 절대 throw 안 함(트리거가 죽어도 타 트리거 무관).
 *      집계는 구간별 try/catch(safeSection_) — 한 구간 실패해도 그 칸만 비우고 나머지 발송.
 *   3. **트리거 독립**: 핸들러명 reportScheduled 전용. removeTriggers_ 는 자기 핸들러만 제거 →
 *      runCouponBatch·syncCouponsScheduled 트리거 절대 안 건드림. (동기화와 달리 read-only·무해라 기본 ON.)
 *   ⇒ 이 파일을 통째로 삭제해도 기존 기능 무손상.
 *
 * 기본 ON(opt-out): REPORT_ENABLED 가 'false' 가 아니면 켜진 것으로 본다. 단 시간 트리거는 시트 카피 시
 *   복사되지 않으므로(GAS 사양) ensureReportTrigger_()(관리 패널 로드 시 호출)가 트리거를 self-heal 설치한다.
 *
 * Script Properties:
 *   - REPORT_ENABLED   : 'false' 면 OFF (그 외/미설정 = ON, 기본 ON)
 *   - REPORT_PERIOD    : 'weekly'(기본) | 'biweekly' | 'monthly'
 *   - REPORT_EMAIL     : 메일 수신자(쉼표구분). 비우면 Slack 만.
 *   - LAST_REPORT_AT   : 마지막 정기 보고 시각(ISO) — 다음 윈도우 시작 경계
 *   - REPORT_TRIGGER_ENSURED : '1' 이면 self-heal 가 트리거 보장 완료(내부 자동 관리, 게이트용)
 */

const REPORT_TRIGGER_HANDLER = 'reportScheduled';
const REPORT_PERIOD_DEFAULT = 'weekly';
const REPORT_HOUR = 9; // 발송 시각(KST)
const REPORT_MAX_NEW_CODES = 12; // 보고서에 나열할 신규 쿠폰 코드 최대 개수

// 기간 정의 — days 는 최초 보고(LAST_REPORT_AT 없음)의 fallback 윈도우 길이.
// 평상시 윈도우는 LAST_REPORT_AT 로 정확히 잡히므로 days 는 근사여도 됨.
const REPORT_PERIODS = {
  weekly: { days: 7 },
  biweekly: { days: 14 },
  monthly: { days: 30 },
};

// ============================================================
// 트리거 진입점 — 토글 OFF 면 즉시 종료
// ============================================================

/** 시간 트리거가 호출하는 진입점. 명시적으로 꺼둔(=‘false’) 경우에만 아무것도 안 함(기본 ON=opt-out). */
function reportScheduled() {
  if (PropertiesService.getScriptProperties().getProperty('REPORT_ENABLED') === 'false') {
    return;
  }
  runReport_(false);
}

// ============================================================
// 보고서 본체 — 전체가 방어적(throw 없음)
// ============================================================

/**
 * 한 기간을 집계해 보고서를 발송한다.
 * @param {boolean} isManual 수동 미리보기 여부. true 면 LAST_REPORT_AT 경계를 옮기지 않음.
 * @returns {{ok:boolean, message:string, data?:Object}}
 */
function runReport_(isManual) {
  const now = new Date();
  try {
    const props = PropertiesService.getScriptProperties();
    const period = reportPeriod_();
    const windowStart = reportWindowStart_(now, period);

    const data = buildReportData_(windowStart, now);

    // Slack
    notify_(buildReportEmbed_(data, period, windowStart, now), 'report', 'report');

    // 메일(선택) — 수신자가 있을 때만, quota 가드
    const emailed = maybeSendReportEmail_(data, period, windowStart, now);

    // 경계 이동은 정기 발송에서만(수동 미리보기는 다음 정기 보고 보존)
    if (!isManual) {
      props.setProperty('LAST_REPORT_AT', now.toISOString());
    }

    const summary =
      `period=${period} users=${data.users.total} active-coupons=${data.coupons.active} ` +
      `delivery(pending=${data.delivery.pending}/combos=${data.delivery.combos})` +
      (emailed ? ` · emailed=${emailed}` : '');
    logSystem_('INFO', 'report', summary, '');
    return { ok: true, message: `✅ Report sent — ${summary}`, data };
  } catch (err) {
    // 최후 안전망 — 어떤 예외도 트리거/호출자 밖으로 새지 않음
    const reason = err && err.message ? err.message : String(err);
    try {
      logSystem_('WARN', 'report', `report failed: ${reason}`, '');
    } catch (e) {
      // 로깅 실패도 무시 — 격리 원칙
    }
    return { ok: false, message: `report failed: ${reason}`, data: { reason } };
  }
}

/** REPORT_PERIOD 정규화 — 정의된 키만 통과, 그 외 전부 기본(weekly). */
function reportPeriod_() {
  const v = String(
    PropertiesService.getScriptProperties().getProperty('REPORT_PERIOD') || '',
  ).toLowerCase();
  return REPORT_PERIODS[v] ? v : REPORT_PERIOD_DEFAULT;
}

/**
 * 집계 윈도우 시작 = LAST_REPORT_AT(있으면) | now - 기간길이(최초/파싱실패).
 * 최초엔 기간 길이만큼 과거를 봐서 첫 보고서도 의미 있는 수치를 담는다.
 */
function reportWindowStart_(now, period) {
  const raw = PropertiesService.getScriptProperties().getProperty('LAST_REPORT_AT');
  if (raw) {
    const t = new Date(raw).getTime();
    if (!isNaN(t)) {
      return new Date(t);
    }
  }
  const days = (REPORT_PERIODS[period] || REPORT_PERIODS.weekly).days;
  return new Date(now.getTime() - days * 86400000);
}

/**
 * 한 집계 구간을 방어적으로 실행 — 실패하면 그 칸만 fallback 으로 비우고 보고서는 계속 발송.
 * (사용자 요구: 보고서 에러가 서비스는 물론 보고서 자체도 안 깨게)
 */
function safeSection_(label, fn, fallback) {
  try {
    return fn();
  } catch (e) {
    try {
      logSystem_(
        'WARN',
        'report-section',
        `${label} failed: ${e && e.message ? e.message : e}`,
        '',
      );
    } catch (e2) {
      // 로깅 실패도 무시
    }
    return fallback;
  }
}

/**
 * 보고서 데이터 집계 (read-only, 구간별 방어).
 *   - 유저: 총/활성/신규(기간 내 created)
 *   - 쿠폰: 활성(enabled)/신규(기간 내 created)/만료·무효(비활성+status)
 *   - 전달(delivery): **현재 상태** 기준 — 활성유저 × 활성쿠폰 중 아직 터미널(성공/이미보유/조건)
 *     에 못 든 "미전달 조합" 수. logs purge(유저삭제·쿠폰만료)는 항상 엔티티의 활성집합 이탈과
 *     짝지어 일어나므로 거짓 미전달이 생기지 않음 → 어떤 상태변경에도 안 깨짐. 로그 나이와 무관.
 *     (행 기반 "기간 내 성공률"은 purge 로 흔들리고 재시도 중간상태를 결과처럼 보여 폐기함.)
 *   - 동기화: REPORT 와 무관한 Sync 상태 스냅샷(Property 읽기 — throw 없음)
 *
 * windowStart 는 "신규(유저/쿠폰)" 판정에만 쓰임. 전달/활성 수치는 전부 현재 상태라 기간 무관.
 */
function buildReportData_(windowStart, now) {
  const props = PropertiesService.getScriptProperties();
  const startMs = windowStart.getTime();

  return {
    users: safeSection_('users', () => aggUsers_(startMs), { total: 0, active: 0, neu: 0 }),
    coupons: safeSection_('coupons', () => aggCoupons_(startMs), {
      active: 0,
      expired: 0,
      neu: 0,
      newCodes: [],
      newCodesMore: 0,
    }),
    delivery: safeSection_('delivery', () => aggDelivery_(), { pending: 0, combos: 0 }),
    sync: {
      enabled: props.getProperty('AUTO_SYNC_ENABLED') === 'true',
      lastAt: props.getProperty('LAST_SYNC_AT') || '',
      failStreak: parseInt(props.getProperty('SYNC_FAIL_STREAK'), 10) || 0,
    },
    lastBatchAt: props.getProperty('LAST_BATCH_AT') || '',
  };
}

/** 유저 집계 — 총/활성/신규(기간 내 created) */
function aggUsers_(startMs) {
  const users = readUsers_();
  let active = 0;
  let neu = 0;
  for (const u of users) {
    if (u.active) {
      active++;
    }
    if (u.created instanceof Date && u.created.getTime() >= startMs) {
      neu++;
    }
  }
  return { total: users.length, active, neu };
}

/** 쿠폰 집계 — 활성/만료·무효/신규(기간 내 created) + 신규 코드 목록 */
function aggCoupons_(startMs) {
  const coupons = readCoupons_();
  let active = 0;
  let expired = 0;
  const newCodes = [];
  for (const c of coupons) {
    if (c.enabled) {
      active++;
    } else if (c.status) {
      expired++; // 비활성 + 사유 있음 = 만료/무효 처리됨
    }
    if (c.created instanceof Date && c.created.getTime() >= startMs) {
      newCodes.push(c.code);
    }
  }
  return {
    active,
    expired,
    neu: newCodes.length,
    newCodes: newCodes.slice(0, REPORT_MAX_NEW_CODES),
    newCodesMore: Math.max(0, newCodes.length - REPORT_MAX_NEW_CODES),
  };
}

/**
 * 전달 현황 집계 (현재 상태) — 활성유저 × 활성쿠폰 중 아직 전달 안 된 조합 수.
 *   pending = 터미널(getProcessedSet_: SUCCESS/ALREADY_USED/CONDITION_NOT_MET) 에 없는 조합
 *   combos  = 전체 조합 수 (활성유저 × 활성쿠폰)
 * 일시 RATE_LIMITED/ERROR 는 재시도로 결국 터미널이 되면 pending 에서 자동으로 빠짐
 * → "결국 전달됐냐"만 반영. 등록 직후 배치 전 짧은 순간만 pending>0(주간 발송 시각엔 사실상 0).
 */
function aggDelivery_() {
  const users = readUsers_().filter((u) => u.active);
  const coupons = readCoupons_().filter((c) => c.enabled);
  if (users.length === 0 || coupons.length === 0) {
    return { pending: 0, combos: 0 };
  }
  const processed = getProcessedSet_();
  let pending = 0;
  for (const u of users) {
    for (const c of coupons) {
      if (!processed.has(`${u.fid}|${c.code}`)) {
        pending++;
      }
    }
  }
  return { pending, combos: users.length * coupons.length };
}

// ============================================================
// 임베드 / 메일 본문 빌더
// ============================================================

/** 보고서 Slack 임베드. 색상은 중립(회색). 시각은 Slack 언어 기준(ko=KST·en=UTC, 라벨, fmtTsLang_). */
function buildReportEmbed_(data, period, windowStart, now) {
  const range = `${fmtTsLang_(windowStart)} ~ ${fmtTsLang_(now)}`;
  const periodLabel = nt(`rp_period_${period}`);

  let description = nt('rp_range', { range });
  if (data.coupons.neu > 0 && data.coupons.newCodes.length > 0) {
    const more = data.coupons.newCodesMore > 0 ? ` +${data.coupons.newCodesMore}` : '';
    description += '\n' + nt('rp_new_codes', { codes: data.coupons.newCodes.join(', '), more });
  }

  return {
    title: nt('rp_title', { period: periodLabel }),
    description,
    color: NOTIFY_COLORS.gray,
    fields: [
      {
        name: nt('rp_f_coupons'),
        value: nt('rp_v_coupons', {
          active: data.coupons.active,
          neu: data.coupons.neu,
          expired: data.coupons.expired,
        }),
        inline: true,
      },
      {
        name: nt('rp_f_users'),
        value: nt('rp_v_users', {
          total: data.users.total,
          active: data.users.active,
          neu: data.users.neu,
        }),
        inline: true,
      },
      {
        name: nt('rp_f_delivery'),
        value: nt('rp_v_delivery', {
          pending: data.delivery.pending,
          combos: data.delivery.combos,
        }),
        inline: true,
      },
      {
        name: nt('rp_f_sync'),
        value: nt('rp_v_sync', {
          on: data.sync.enabled,
          last: data.sync.lastAt ? fmtTsLang_(data.sync.lastAt) : '—',
          streak: data.sync.failStreak,
        }),
        inline: true,
      },
      {
        name: nt('rp_f_last_batch'),
        value: data.lastBatchAt ? fmtTsLang_(data.lastBatchAt) : '—',
        inline: true,
      },
    ],
    footer: { text: nt('rp_footer') },
    timestamp: now.toISOString(),
  };
}

/**
 * REPORT_EMAIL 수신자가 있으면 같은 보고서를 메일로도 발송.
 * 발송 전 getRemainingDailyQuota() 로 수신자 수만큼 여유가 없으면 메일만 스킵(Slack·본체 무관).
 * @returns {number} 실제 발송한 수신자 수(0 = 안 보냄)
 */
function maybeSendReportEmail_(data, period, windowStart, now) {
  const raw = PropertiesService.getScriptProperties().getProperty('REPORT_EMAIL') || '';
  const recipients = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.indexOf('@') > 0);
  if (recipients.length === 0) {
    return 0;
  }
  try {
    const remaining = MailApp.getRemainingDailyQuota();
    if (remaining < recipients.length) {
      logSystem_(
        'WARN',
        'report-email',
        `skip email — quota ${remaining} < recipients ${recipients.length}`,
        '',
      );
      return 0;
    }
    const periodLabel = nt(`rp_period_${period}`);
    const subject = nt('rp_email_subj', { period: periodLabel, date: fmtTsLang_(now) });
    const body = reportEmailBody_(data, periodLabel, windowStart, now);
    MailApp.sendEmail({ to: recipients.join(','), subject, body });
    return recipients.length;
  } catch (e) {
    logSystem_('WARN', 'report-email', `email send failed: ${e && e.message ? e.message : e}`, '');
    return 0;
  }
}

/** 메일 본문(plain text) — Slack 임베드와 동일 수치를 줄글로. */
function reportEmailBody_(data, periodLabel, windowStart, now) {
  return nt('rp_email_body', {
    period: periodLabel,
    range: `${fmtTsLang_(windowStart)} ~ ${fmtTsLang_(now)}`,
    cpnActive: data.coupons.active,
    cpnNew: data.coupons.neu,
    cpnExpired: data.coupons.expired,
    usersTotal: data.users.total,
    usersActive: data.users.active,
    usersNew: data.users.neu,
    pending: data.delivery.pending,
    combos: data.delivery.combos,
    syncOn: data.sync.enabled ? 'ON' : 'OFF',
    syncLast: data.sync.lastAt ? fmtTsLang_(data.sync.lastAt) : '—',
    lastBatch: data.lastBatchAt ? fmtTsLang_(data.lastBatchAt) : '—',
  });
}

// ============================================================
// 트리거 설치/제거
// ============================================================

/** 보고서 트리거 설치(중복 누적 방지 위해 기존 것 제거 후 1개만). 주기는 REPORT_PERIOD 에 따라. */
function installReportTrigger_() {
  removeTriggers_(REPORT_TRIGGER_HANDLER);
  const period = reportPeriod_();
  const builder = ScriptApp.newTrigger(REPORT_TRIGGER_HANDLER).timeBased();
  if (period === 'monthly') {
    builder.onMonthDay(1).atHour(REPORT_HOUR).create();
  } else if (period === 'biweekly') {
    builder.everyWeeks(2).onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(REPORT_HOUR).create();
  } else {
    builder.onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(REPORT_HOUR).create();
  }
  // 트리거 확실히 존재 → self-heal 게이트 도장. 이후 ensureReportTrigger_ 가 트리거 열거를 생략한다.
  PropertiesService.getScriptProperties().setProperty('REPORT_TRIGGER_ENSURED', '1');
}

/** 보고서 트리거 제거(자기 핸들러만 — 배치/동기화 트리거 안 건드림) */
function removeReportTrigger_() {
  removeTriggers_(REPORT_TRIGGER_HANDLER);
  // 트리거 없어짐 → 도장 제거. 나중에 다시 켜지면 self-heal 가 재확인/재설치하도록.
  PropertiesService.getScriptProperties().deleteProperty('REPORT_TRIGGER_ENSURED');
}

/**
 * 기본 ON 보장(self-heal). REPORT_ENABLED 가 명시적 'false' 가 아니면(=기본 ON) 보고서 트리거가
 * 없을 때 한 번 설치한다. 트리거는 시트 카피 시 복사되지 않으므로(GAS 사양) "기본 ON"을 실제 발송까지
 * 잇는 다리. 관리 패널 로드(apiListManage)에서 호출 — 실패는 조용히 무시(옵션 레이어).
 *
 * ⚡ once-flag 게이트: 한 번 보장하면 REPORT_TRIGGER_ENSURED='1' 도장을 찍고, 이후엔 도장만 보고 즉시
 *   통과 → 매 로드(익명 포함)마다 ScriptApp.getProjectTriggers() 를 열거하던 낭비 제거. 무거운 열거는
 *   최초/카피본(Property 미복사)에서만 1회. install/remove 가 도장을 set/clear 하므로 상태와 항상 일치.
 */
function ensureReportTrigger_() {
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('REPORT_ENABLED') === 'false') {
      return; // 명시적 OFF — 손대지 않음
    }
    if (props.getProperty('REPORT_TRIGGER_ENSURED') === '1') {
      return; // 이미 보장됨 — 트리거 열거 생략(최적화 핵심)
    }
    const exists = ScriptApp.getProjectTriggers().some(
      (t) => t.getHandlerFunction() === REPORT_TRIGGER_HANDLER,
    );
    if (!exists) {
      installReportTrigger_(); // 내부에서 도장 set
    } else {
      props.setProperty('REPORT_TRIGGER_ENSURED', '1'); // 이미 있었으면 여기서 도장
    }
  } catch (e) {
    // 트리거 보장 실패는 무시 — 보고서는 옵션 레이어, 본체 무관. 도장 안 찍혀 다음 로드에 재시도.
  }
}

// ============================================================
// 웹 UI 진입점 (비밀번호 = 접속 기기의 오늘 날짜 MMdd, any-timezone)
// ============================================================

/**
 * 정기 보고서 ON/OFF + 주기 설정 (비밀번호 필요).
 * 노이즈 정책:
 *   - 실제 변경분만 처리 — 아무것도 안 바뀌면(같은 값 재선택) 트리거 재설치·알림 모두 skip.
 *   - 알림 문구를 변경 종류에 맞춤: ON↔OFF 전환은 "OFF → ON", 주기 변경은 "주간 → 월간"
 *     ("ON → ON" 같은 무의미 문구 제거). 폭주는 클라 디바운스 + no-op skip 으로 차단.
 * @returns code: 'report_set'(ON/OFF 변경) | 'report_period_set'(주기만) | 'report_nochange'(변동 없음)
 */
function apiSetReport(enabled, period, password) {
  return safeApi_('apiSetReport', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    const props = PropertiesService.getScriptProperties();
    const prevEnabled = props.getProperty('REPORT_ENABLED') !== 'false'; // 기본 ON
    const prevPeriod = reportPeriod_();
    const on = enabled === true || enabled === 'true';
    const newPeriod = REPORT_PERIODS[period] ? period : prevPeriod;

    const enabledChanged = on !== prevEnabled;
    const periodChanged = newPeriod !== prevPeriod;
    if (!enabledChanged && !periodChanged) {
      // 변동 없음 — 트리거·알림 모두 손대지 않음
      return { ok: true, enabled: on, period: newPeriod, code: 'report_nochange', data: {} };
    }

    props.setProperty('REPORT_PERIOD', newPeriod);
    props.setProperty('REPORT_ENABLED', on ? 'true' : 'false');
    // 트리거: 켜져 있고 (켜짐 전환 or 주기 변경) 이면 재설치, 꺼짐 전환이면 제거
    if (on && (enabledChanged || periodChanged)) {
      installReportTrigger_();
    } else if (!on && enabledChanged) {
      removeReportTrigger_();
    }
    touchManage_();
    logSystem_(
      'INFO',
      'settings-report',
      `report: ${prevEnabled ? 'on' : 'off'}→${on ? 'on' : 'off'} period ${prevPeriod}→${newPeriod}`,
      '',
    );

    // Slack 알림 — 변경 종류에 맞는 문구로(ON/OFF 전환 vs 주기 변경). no-op 은 위에서 이미 return.
    if (enabledChanged) {
      notify_(
        {
          title: nt('rp_set_t'),
          description: nt('rp_set_d', {
            prev: prevEnabled,
            on,
            period: nt(`rp_period_${newPeriod}`),
          }),
          color: on ? NOTIFY_COLORS.green : NOTIFY_COLORS.gray,
          timestamp: new Date().toISOString(),
        },
        'settings-report',
        'settings',
      );
    } else if (periodChanged) {
      notify_(
        {
          title: nt('rp_period_t'),
          description: nt('rp_period_d', {
            prev: nt(`rp_period_${prevPeriod}`),
            next: nt(`rp_period_${newPeriod}`),
          }),
          color: NOTIFY_COLORS.gray,
          timestamp: new Date().toISOString(),
        },
        'settings-report',
        'settings',
      );
    }

    return {
      ok: true,
      enabled: on,
      period: newPeriod,
      code: enabledChanged ? 'report_set' : 'report_period_set',
      data: { prev: prevEnabled, on, period: newPeriod },
    };
  });
}

/** 지금 즉시 1회 보고서(미리보기 — 경계 안 옮김). 비밀번호 필요. */
function apiRunReportNow(password) {
  return safeApi_('apiRunReportNow', () => {
    if (!checkDatePassword_(password)) {
      return { ok: false, code: 'bad_pw' };
    }
    touchManage_();
    return runReport_(true);
  });
}

// ============================================================
// 시트 메뉴 진입점 (소유자 실행 — 비밀번호 불필요)
// ============================================================

/** 메뉴: 지금 보고서 1회(미리보기) */
function menuRunReportNow() {
  const ui = SpreadsheetApp.getUi();
  const ml = getConfig().menuLang;
  const res = runReport_(true);
  ui.alert(
    nt('md_report_title', null, ml),
    res && res.ok
      ? nt('md_report_done', null, ml)
      : nt('md_report_fail', { reason: (res && res.data && res.data.reason) || '' }, ml),
    ui.ButtonSet.OK,
  );
}

/** 메뉴: 정기 보고서 ON + 주기 = 매주 */
function menuSetReportWeekly() {
  menuSetReportPeriod_('weekly');
}
/** 메뉴: 정기 보고서 ON + 주기 = 격주 */
function menuSetReportBiweekly() {
  menuSetReportPeriod_('biweekly');
}
/** 메뉴: 정기 보고서 ON + 주기 = 매월 */
function menuSetReportMonthly() {
  menuSetReportPeriod_('monthly');
}

/** 주기 설정 + ON + 트리거 재설치 (메뉴에서 주기별 항목으로 호출). */
function menuSetReportPeriod_(period) {
  const ui = SpreadsheetApp.getUi();
  const ml = getConfig().menuLang;
  const props = PropertiesService.getScriptProperties();
  props.setProperty('REPORT_PERIOD', REPORT_PERIODS[period] ? period : REPORT_PERIOD_DEFAULT);
  props.setProperty('REPORT_ENABLED', 'true');
  installReportTrigger_();
  logSystem_('INFO', 'settings-report', `report ON (${reportPeriod_()}) via menu`, '');
  ui.alert(
    nt('md_report_title', null, ml),
    nt('md_report_on', { period: nt(`rp_period_${reportPeriod_()}`, null, ml) }, ml),
    ui.ButtonSet.OK,
  );
}

/** 메뉴: 정기 보고서 끄기 */
function menuReportOff() {
  const ui = SpreadsheetApp.getUi();
  const ml = getConfig().menuLang;
  PropertiesService.getScriptProperties().setProperty('REPORT_ENABLED', 'false');
  removeReportTrigger_();
  logSystem_('INFO', 'settings-report', 'report OFF via menu', '');
  ui.alert(nt('md_report_title', null, ml), nt('md_report_off', null, ml), ui.ButtonSet.OK);
}
