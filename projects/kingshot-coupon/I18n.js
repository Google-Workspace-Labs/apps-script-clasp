/**
 * Kingshot Coupon - 서버측 i18n (Slack 알림용)
 *
 * 웹 UI 는 접속자 언어(클라이언트 i18n.html) 를 따르지만,
 * Slack 알림은 **자동 전송(배치·트리거)** 이라 "그 순간 접속자"가 없다.
 * → 배포자 본인 채널이므로 **배포자 언어(SLACK_LANG, 관리 탭 설정)** 를 따른다.
 *
 * 사용: notify_ 호출부에서 title/description 을 nt('key', data) 로 만든다.
 *   const lang = getConfig().slackLang  // 'ko' | 'en'
 *   값이 함수면 data 로 호출(템플릿), 아니면 그대로 반환. 없으면 ko 폴백 → key.
 */

/* global getConfig */

/**
 * 서버 i18n 조회. lang 미지정 시 SLACK_LANG(Slack 알림 기준), 지정 시 그 언어(예: 메뉴=MENU_LANG).
 * @param {string} key
 * @param {Object} [data]
 * @param {string} [lang] 'ko'|'en' — 오버라이드(메뉴 등)
 */
function nt(key, data, lang) {
  if (!lang) {
    try {
      lang = getConfig().slackLang;
    } catch (e) {
      lang = 'ko';
    }
  }
  const d = SLACK_MSG[lang] || SLACK_MSG.ko;
  let v = d[key];
  if (v === undefined) {
    v = SLACK_MSG.ko[key];
  }
  if (v === undefined) {
    return key;
  }
  return typeof v === 'function' ? v(data || {}) : v;
}

/**
 * Slack 알림 메시지 카탈로그 (ko/en). 키 = notify_ 호출별 title/desc.
 * 템플릿은 (d) => `...` 형태(데이터 객체 하나).
 */
const SLACK_MSG = {
  ko: {
    user_reg_t: '👤 유저 등록 완료',
    user_reg_d: (d) =>
      `🏷️ **${d.nick || '(닉네임 없음)'}**\n🆔 \`${d.fid}\`  ·  👥 ${d.before} → ${d.after}명`,
    sched_user_t: '⏱ 배치 예약 (유저 등록)',
    sched_user_d: '약 3분 뒤 자동 배치 — 신규 유저에 활성 쿠폰 발급',
    slack_ok_t: '✅ Slack 연동 완료',
    slack_ok_d: '이 채널로 알림이 전송됩니다. (테스트 메시지)',
    slack_on_t: (d) => `🔔 Slack 알림: ${d.prev ? 'ON' : 'OFF'} → ${d.on ? 'ON' : 'OFF'}`,
    slack_on_d: '이제 이벤트 알림이 이 채널로 전송됩니다.',
    slack_off_t: (d) => `🔕 Slack 알림: ${d.prev ? 'ON' : 'OFF'} → ${d.on ? 'ON' : 'OFF'}`,
    slack_off_d: '이후 알림이 전송되지 않습니다. (마지막 메시지)',
    ttl_t: '⏳ 쿠폰 자동만료(TTL) 변경',
    ttl_d: (d) => {
      const f = (v) => (v === null ? '(미설정)' : v === 0 ? '끔' : `${v}일`);
      return `**${f(d.prev)} → ${f(d.n)}**`;
    },
    user_del_t: '🗑️ 유저 삭제 완료',
    user_del_d: (d) =>
      `🏷️ **${d.nick || '(닉네임 없음)'}**\n🆔 \`${d.fid}\`  ·  👥 ${d.before} → ${d.after}명\n🧹 logs ${d.logs}건 정리`,
    user_toggle_t: (d) =>
      `🔁 ${d.nick || '(닉네임 없음)'}: ${d.prev ? '활성' : '비활성'} → ${d.next ? '활성' : '비활성'}`,
    coupon_toggle_t: (d) =>
      `🔁 ${d.code}: ${d.prev ? '활성' : '비활성'} → ${d.next ? '활성' : '비활성'}`,
    cpn_invalid_t: '🎟 쿠폰 등록 거부 (존재 X)',
    cpn_invalid_d: (d) => `\`${d.code}\` — INVALID_CODE, dead code 캐시 기록`,
    cpn_expired_t: '🎟 쿠폰 등록 거부 (만료)',
    cpn_expired_d: (d) => `\`${d.code}\` — EXPIRED, dead code 캐시 기록`,
    cpn_reg_t: '🎟 쿠폰 등록 완료',
    cpn_reg_d: (d) => {
      const note =
        d.nc === 'ok'
          ? '검증 OK'
          : d.nc === 'no_user'
            ? '검증 안 함(유저 없음)'
            : `검증 보류(${d.nr})`;
      return `🎟 \`${d.code}\`\n📍 상태: **${d.status}** _(${note})_`;
    },
    sched_cpn_t: '⏱ 배치 예약 (쿠폰 등록)',
    sched_cpn_d: (d) => `약 30초 뒤 자동 배치 — 신규 쿠폰 \`${d.code}\` 전 유저에 발급`,
    batch_now_t: '⚡ 즉시 배치 실행',
    batch_now_d: '수동 트리거 — 약 30초 뒤 자동 시작',
    clean_t: '🗑 오타 코드 정리',
    clean_d: (d) => `존재하지 않는 코드 **${d.coupons}건** 삭제\n🧹 관련 logs ${d.logs}건 정리`,
    sync_t: '🔄 자동 쿠폰 동기화',
    sync_d: (d) =>
      `소스에서 신규 쿠폰 **${d.n}건** 등록\n🎟 ${d.codes}` +
      (d.rej ? `\n⚠️ 거부/보류 ${d.rej}건: ${d.rejCodes}` : ''),
    sync_fail_t: '⚠️ 자동 쿠폰 동기화 실패',
    sync_fail_d: (d) => `${d.reason}\n_기존 수동 등록은 정상 동작합니다._`,
    sync_set_t: '🔄 자동 쿠폰 동기화 설정',
    sync_set_d: (d) =>
      `자동 동기화: **${d.prev ? 'ON' : 'OFF'} → ${d.on ? 'ON' : 'OFF'}**` +
      (d.on ? `\n⏱ ${d.hours}시간마다 소스 확인` : ''),
    // 배치 완료 임베드 (buildBatchEmbed_)
    bm_title: '🎁 Kingshot 배치 완료',
    bm_f_success: '✅ 성공',
    bm_f_already: '🔁 이미받음',
    bm_f_disabled: '🗑️ 만료·무효',
    bm_f_fail: '❌ 실패',
    bm_f_skip: '⏭️ 스킵',
    bm_f_target: '🎯 대상',
    bm_target_val: (d) => `${d.users}명 × ${d.coupons}쿠폰`,
    bm_footer: (d) => `소요 ${d.elapsed}s (건당 ~${d.avg}s)`,
    bm_timeout: '⏱️ 시간초과 → 1분 뒤 자동 이어실행',
    bm_warn: (d) => `🚨 rate limit/오류 ${d.warn}건 감지 — 봇·IP 상태 점검 필요`,
    // 배치 재시도 상태(meta.retryStatus, Code.js)
    rs_retry: (d) => `🔁 자동 재시도 ${d.n}/${d.max} — ${d.min}분 뒤`,
    rs_blocked: (d) => `🚫 ${d.n}회 재시도 후 ${d.x}건 영구 차단 — 수동 확인 필요`,
    rs_recovered: (d) => `✅ 자동 재시도 ${d.n}회 만에 회복`,
    // 시트 메뉴 (onOpen) — 배포자 언어. 이미 영문인 항목은 하드코딩 유지.
    mn_run: '▶ 실행',
    mn_manage: '🛠 관리',
    mn_sync: '🔄 동기화',
    mn_diag: '🔍 진단',
    mn_setup: '🚀 설정',
    mn_quick_setup: '빠른 설정 (안내)',
    mn_setup_sheets: '시트 4개 생성',
    mn_create_guide: '📖 시작하기 시트 생성 (배포자 1회)',
    mn_clean_invalid: '오타 코드 정리',
    mn_sync_now: '지금 동기화 (1회)',
    mn_sync_toggle: '자동 동기화 ON/OFF',
    mn_run_batch: '쿠폰 배치 실행',
    mn_test_coupon: '단일 쿠폰 테스트',
    mn_deactivate: '유저 비활성화',
    mn_delete_user: '유저 삭제',
    mn_clean_dup: '중복 유저 정리',
    mn_clean_logs: '만료 로그 정리',
    mn_clear_syslogs: '시스템 로그 비우기',
    mn_diagnose: '중복 처리 진단',
    // ── 시트 메뉴 다이얼로그/토스트 (CP3) — 배포자 언어(MENU_LANG) ──
    md_bot: '👑 Kingshot Bot',
    md_bot_done: '👑 Kingshot Bot 완료',
    md_batch_none_both: '실행 대상 없음 — 유저·쿠폰 둘 다 0건. 먼저 유저+쿠폰을 등록하세요.',
    md_batch_none_coupon: (d) =>
      `실행 대상 없음 — 활성 유저 ${d.users}명, 활성 쿠폰 0개.\n쿠폰을 등록하면 자동으로 배치가 실행됩니다.`,
    md_batch_none_user: (d) =>
      `실행 대상 없음 — 활성 쿠폰 ${d.coupons}개, 활성 유저 0명.\n유저를 추가하거나 👤 users 시트의 active 열을 확인하세요.`,
    md_batch_start: (d) =>
      `시작: ${d.users}명 × ${d.coupons}쿠폰 = 최대 ${d.combos}건, 예상 ~${d.est}s (시간예산 ${d.budget}s 초과 시 안전 중단)`,
    md_batch_summary: (d) =>
      `성공 ${d.success} / 이미받음 ${d.already} / 만료·무효 ${d.disabled} / 실패 ${d.fail} / 스킵 ${d.skip}\n소요 ${d.elapsed}s (건당 ~${d.avg}s)`,
    md_batch_timeout: ' — ⏱️ 시간초과 중단(1분 뒤 자동 이어실행 예약됨)',
    md_test_title: 'Kingshot 단일 테스트',
    md_test_fid: '유저 fid 를 입력하세요:',
    md_test_code: '쿠폰 코드를 입력하세요:',
    md_test_need_both: 'fid 와 쿠폰 코드를 모두 입력해야 합니다.',
    md_test_result_t: '테스트 결과',
    md_test_result_d: (d) =>
      `fid: ${d.fid}\ncode: ${d.code}\n결과: ${d.result}\n메시지: ${d.message}`,
    md_setup_title: '시트 생성',
    md_setup_created: (d) => `생성된 시트: ${d.list}`,
    md_setup_exists: '모든 시트가 이미 존재합니다.',
    md_guide_title: '📖 가이드',
    md_guide_exists: (d) => `'${d.name}' 시트가 이미 존재합니다.`,
    md_guide_done_t: '📖 가이드 — 생성 완료',
    md_guide_done_d: (d) =>
      `'${d.name}' 시트를 생성했습니다.\n이 탭을 활성 상태로 둔 뒤 시트를 공유/카피 허용하면 멤버가 자동으로 봅니다.`,
    md_clean_none_t: '정리 대상 없음',
    md_clean_none_d: 'coupons 시트에 status 가 EXPIRED/INVALID_CODE 인 코드가 없습니다.',
    md_clean_done_t: '만료 로그 정리',
    md_clean_done_d: (d) =>
      `죽은 코드 ${d.codes}개의 로그 ${d.total}건을 정리했습니다.\n코드: ${d.list}`,
    md_invalid_title: '🗑 오타 코드 정리',
    md_invalid_none: '정리할 INVALID(존재하지 않는) 코드가 없습니다.',
    md_invalid_done: (d) =>
      `존재하지 않는 코드 ${d.coupons}건 삭제\n🧹 관련 logs ${d.logs}건 정리\n코드: ${d.codes}\n\n⚠️ 소스에 아직 있는 코드는 다음 동기화 때 1회 재검증 후 재생성될 수 있습니다(UI 엔 숨김).`,
    md_syslog_missing: (d) => `'${d.name}' 시트가 없습니다.`,
    md_syslog_empty: 'system_logs 가 비어있습니다.',
    md_syslog_title: '시스템 로그 비우기',
    md_syslog_confirm: (d) => `system_logs ${d.n}건을 모두 삭제할까요?`,
    md_syslog_done: '✅ system_logs 청소 완료',
    md_dup_empty: '👤 users 시트가 비어있습니다.',
    md_dup_none_t: '중복 없음',
    md_dup_none_d: (d) => `users 시트 OK — unique fid ${d.unique}개, 중복 0건.`,
    md_dup_found_t: '중복 발견',
    md_dup_found_d: (d) =>
      `중복 fid ${d.count}건 발견 — 뒷 row 삭제 (첫 등장 보존)?\n\n${d.preview}${d.more}`,
    md_dup_more: (d) => `\n  ... 총 ${d.count}건`,
    md_dup_done_t: '✅ 정리 완료',
    md_dup_done_d: (d) => `중복 ${d.count}건 삭제됨. 현재 유저: ${d.unique}명 (unique).`,
    md_diag_no_logs: 'logs 시트 없음',
    md_diag_title: '중복 처리 진단',
    md_diag_body: (d) =>
      `=== Dedup 진단 ===\n\n` +
      `logs 데이터 행: ${d.totalLogRows}\n` +
      `활성 유저: ${d.users}, 활성 쿠폰: ${d.coupons}\n` +
      `예상 조합: ${d.combos}\n\n` +
      `── dedup 셋 크기 (변형별) ──\n` +
      `strict (현재):     ${d.strict}\n` +
      `case-loose:        ${d.caseL}\n` +
      `trim-loose:        ${d.trimL}\n` +
      `type-loose:        ${d.typeL}\n\n` +
      `── 누락 조합 수 (변형별) ──\n` +
      `strict:            ${d.mStrict}\n` +
      `case-loose:        ${d.mCase}   (회복: ${d.rCase})\n` +
      `trim-loose:        ${d.mTrim}   (회복: ${d.rTrim})\n` +
      `type-loose:        ${d.mType}   (회복: ${d.rType})\n\n` +
      `누락 샘플 (strict, 최대 8):\n` +
      (d.sample || '(없음 — dedup 완벽)'),
    md_no_nick: '(닉네임 없음)',
    md_user_not_found: (d) => `fid ${d.fid} 를 users 시트에서 찾을 수 없습니다.`,
    md_deact_title: '유저 비활성화',
    md_deact_prompt: '비활성화할 fid 를 입력하세요:',
    md_deact_done: (d) => `✅ 비활성화: ${d.nick} (fid ${d.fid}) — 배치에서 제외됩니다.`,
    md_del_title: '유저 삭제',
    md_del_prompt: '삭제할 fid 를 입력하세요:',
    md_del_confirm_t: '삭제 확인',
    md_del_confirm_d: (d) => `${d.nick} (fid ${d.fid}) 행을 삭제할까요?`,
    md_del_done: (d) =>
      `🗑️ 삭제 완료: ${d.nick} (fid ${d.fid}) — ${d.before} → ${d.after}명\n🧹 logs 행 ${d.logs}건 같이 정리됨`,
    md_sync_title: '🔄 쿠폰 동기화',
    md_sync_result: (d) =>
      `신규 ${d.n}건` +
      (d.n ? ` (${d.codes})` : '') +
      (d.rej ? ` · 거부/보류 ${d.rej}건` : '') +
      ` · 후보 ${d.cand}`,
    md_sync_fail: (d) => `동기화 실패: ${d.reason}`,
    md_autosync_title: '🔄 자동 동기화',
    md_autosync_on: (d) => `ON — ${d.hours}시간마다 자동 확인합니다.`,
    md_autosync_off: 'OFF 되었습니다.',
  },
  en: {
    user_reg_t: '👤 User registered',
    user_reg_d: (d) =>
      `🏷️ **${d.nick || '(no nickname)'}**\n🆔 \`${d.fid}\`  ·  👥 ${d.before} → ${d.after}`,
    sched_user_t: '⏱ Batch scheduled (user)',
    sched_user_d: 'Auto-batch in ~3 min — delivering active coupons to the new user',
    slack_ok_t: '✅ Slack connected',
    slack_ok_d: 'Alerts will be sent to this channel. (test message)',
    slack_on_t: (d) => `🔔 Slack alerts: ${d.prev ? 'ON' : 'OFF'} → ${d.on ? 'ON' : 'OFF'}`,
    slack_on_d: 'Event alerts will now be sent to this channel.',
    slack_off_t: (d) => `🔕 Slack alerts: ${d.prev ? 'ON' : 'OFF'} → ${d.on ? 'ON' : 'OFF'}`,
    slack_off_d: 'No more alerts will be sent. (final message)',
    ttl_t: '⏳ Coupon auto-expiry (TTL) changed',
    ttl_d: (d) => {
      const f = (v) => (v === null ? 'unset' : v === 0 ? 'off' : `${v} days`);
      return `**${f(d.prev)} → ${f(d.n)}**`;
    },
    user_del_t: '🗑️ User deleted',
    user_del_d: (d) =>
      `🏷️ **${d.nick || '(no nickname)'}**\n🆔 \`${d.fid}\`  ·  👥 ${d.before} → ${d.after}\n🧹 ${d.logs} logs cleaned`,
    user_toggle_t: (d) =>
      `🔁 ${d.nick || '(no nickname)'}: ${d.prev ? 'active' : 'inactive'} → ${d.next ? 'active' : 'inactive'}`,
    coupon_toggle_t: (d) =>
      `🔁 ${d.code}: ${d.prev ? 'enabled' : 'disabled'} → ${d.next ? 'enabled' : 'disabled'}`,
    cpn_invalid_t: '🎟 Coupon rejected (nonexistent)',
    cpn_invalid_d: (d) => `\`${d.code}\` — INVALID_CODE, dead-code cached`,
    cpn_expired_t: '🎟 Coupon rejected (expired)',
    cpn_expired_d: (d) => `\`${d.code}\` — EXPIRED, dead-code cached`,
    cpn_reg_t: '🎟 Coupon registered',
    cpn_reg_d: (d) => {
      const note =
        d.nc === 'ok' ? 'verified' : d.nc === 'no_user' ? 'no user to verify' : `pending(${d.nr})`;
      return `🎟 \`${d.code}\`\n📍 status: **${d.status}** _(${note})_`;
    },
    sched_cpn_t: '⏱ Batch scheduled (coupon)',
    sched_cpn_d: (d) => `Auto-batch in ~30s — delivering new coupon \`${d.code}\` to all users`,
    batch_now_t: '⚡ Run batch now',
    batch_now_d: 'Manual trigger — auto-starts in ~30s',
    clean_t: '🗑 Typo codes cleaned',
    clean_d: (d) =>
      `Removed **${d.coupons}** nonexistent code(s)\n🧹 ${d.logs} related logs cleaned`,
    sync_t: '🔄 Auto coupon sync',
    sync_d: (d) =>
      `Registered **${d.n}** new coupon(s) from source\n🎟 ${d.codes}` +
      (d.rej ? `\n⚠️ ${d.rej} rejected/pending: ${d.rejCodes}` : ''),
    sync_fail_t: '⚠️ Auto coupon sync failed',
    sync_fail_d: (d) => `${d.reason}\n_Manual registration still works fine._`,
    sync_set_t: '🔄 Auto coupon sync setting',
    sync_set_d: (d) =>
      `Auto-sync: **${d.prev ? 'ON' : 'OFF'} → ${d.on ? 'ON' : 'OFF'}**` +
      (d.on ? `\n⏱ checks source every ${d.hours}h` : ''),
    bm_title: '🎁 Kingshot batch complete',
    bm_f_success: '✅ Success',
    bm_f_already: '🔁 Already had',
    bm_f_disabled: '🗑️ Expired/invalid',
    bm_f_fail: '❌ Failed',
    bm_f_skip: '⏭️ Skipped',
    bm_f_target: '🎯 Target',
    bm_target_val: (d) => `${d.users} users × ${d.coupons} coupons`,
    bm_footer: (d) => `took ${d.elapsed}s (~${d.avg}s each)`,
    bm_timeout: '⏱️ Timeout → auto-continues in 1 min',
    bm_warn: (d) => `🚨 ${d.warn} rate-limit/error(s) detected — check bot/IP status`,
    rs_retry: (d) => `🔁 Auto-retry ${d.n}/${d.max} — in ${d.min} min`,
    rs_blocked: (d) => `🚫 ${d.x} permanently blocked after ${d.n} retries — manual check needed`,
    rs_recovered: (d) => `✅ Recovered after ${d.n} auto-retries`,
    mn_run: '▶ Run',
    mn_manage: '🛠 Admin',
    mn_sync: '🔄 Sync',
    mn_diag: '🔍 Diagnostics',
    mn_setup: '🚀 Setup',
    mn_quick_setup: 'Quick Setup (guide)',
    mn_setup_sheets: 'Setup Sheets (create 4 sheets)',
    mn_create_guide: '📖 Create Getting Started sheet (deployer, once)',
    mn_clean_invalid: 'Clean Invalid Coupons (typo codes)',
    mn_sync_now: 'Sync now (once)',
    mn_sync_toggle: 'Auto-sync ON/OFF',
    mn_run_batch: 'Run Coupon Batch',
    mn_test_coupon: 'Test Single Coupon',
    mn_deactivate: 'Deactivate User',
    mn_delete_user: 'Delete User',
    mn_clean_dup: 'Clean Duplicate Users',
    mn_clean_logs: 'Clean Expired Logs',
    mn_clear_syslogs: 'Clear System Logs',
    mn_diagnose: 'Diagnose Dedup',
    // ── Sheet menu dialogs/toasts (CP3) — deployer language (MENU_LANG) ──
    md_bot: '👑 Kingshot Bot',
    md_bot_done: '👑 Kingshot Bot — done',
    md_batch_none_both: 'Nothing to run — 0 users and 0 coupons. Register users + coupons first.',
    md_batch_none_coupon: (d) =>
      `Nothing to run — ${d.users} active user(s), 0 active coupons.\nRegister a coupon and the batch runs automatically.`,
    md_batch_none_user: (d) =>
      `Nothing to run — ${d.coupons} active coupon(s), 0 active users.\nAdd users or check the 'active' column in the 👤 users sheet.`,
    md_batch_start: (d) =>
      `Start: ${d.users} users × ${d.coupons} coupons = up to ${d.combos}, est ~${d.est}s (safe-stops if over ${d.budget}s time budget)`,
    md_batch_summary: (d) =>
      `Success ${d.success} / Already ${d.already} / Expired·invalid ${d.disabled} / Failed ${d.fail} / Skipped ${d.skip}\nTook ${d.elapsed}s (~${d.avg}s each)`,
    md_batch_timeout: ' — ⏱️ Timed out (auto-continues in 1 min)',
    md_test_title: 'Kingshot Single Test',
    md_test_fid: 'Enter user fid:',
    md_test_code: 'Enter coupon code:',
    md_test_need_both: 'Both fid and coupon code are required.',
    md_test_result_t: 'Test result',
    md_test_result_d: (d) =>
      `fid: ${d.fid}\ncode: ${d.code}\nresult: ${d.result}\nmessage: ${d.message}`,
    md_setup_title: 'Setup Sheets',
    md_setup_created: (d) => `Created sheets: ${d.list}`,
    md_setup_exists: 'All sheets already exist.',
    md_guide_title: '📖 Guide',
    md_guide_exists: (d) => `'${d.name}' sheet already exists.`,
    md_guide_done_t: '📖 Guide — created',
    md_guide_done_d: (d) =>
      `Created the '${d.name}' sheet.\nLeave this tab active, then share/allow-copy so members see it automatically.`,
    md_clean_none_t: 'Nothing to clean',
    md_clean_none_d: 'No coupons with status EXPIRED/INVALID_CODE in the coupons sheet.',
    md_clean_done_t: 'Clean Expired Logs',
    md_clean_done_d: (d) =>
      `Cleaned ${d.total} log row(s) for ${d.codes} dead code(s).\nCodes: ${d.list}`,
    md_invalid_title: '🗑 Clean Invalid Coupons',
    md_invalid_none: 'No INVALID (nonexistent) codes to clean.',
    md_invalid_done: (d) =>
      `Removed ${d.coupons} nonexistent code(s)\n🧹 Cleaned ${d.logs} related log(s)\nCodes: ${d.codes}\n\n⚠️ Codes still in the source may be re-verified once on the next sync and re-created (hidden in the UI).`,
    md_syslog_missing: (d) => `'${d.name}' sheet not found.`,
    md_syslog_empty: 'system_logs is empty.',
    md_syslog_title: 'Clear System Logs',
    md_syslog_confirm: (d) => `Delete all ${d.n} system_logs row(s)?`,
    md_syslog_done: '✅ system_logs cleared',
    md_dup_empty: '👤 users sheet is empty.',
    md_dup_none_t: 'No duplicates',
    md_dup_none_d: (d) => `users sheet OK — ${d.unique} unique fid(s), 0 duplicates.`,
    md_dup_found_t: 'Duplicates found',
    md_dup_found_d: (d) =>
      `Found ${d.count} duplicate fid(s) — delete later rows (keep first)?\n\n${d.preview}${d.more}`,
    md_dup_more: (d) => `\n  ... ${d.count} total`,
    md_dup_done_t: '✅ Cleaned',
    md_dup_done_d: (d) => `Removed ${d.count} duplicate(s). Current users: ${d.unique} (unique).`,
    md_diag_no_logs: 'logs sheet not found',
    md_diag_title: 'Diagnose Dedup',
    md_diag_body: (d) =>
      `=== Dedup diagnosis ===\n\n` +
      `logs data rows: ${d.totalLogRows}\n` +
      `active users: ${d.users}, active coupons: ${d.coupons}\n` +
      `expected combos: ${d.combos}\n\n` +
      `── dedup set size (by variant) ──\n` +
      `strict (current):  ${d.strict}\n` +
      `case-loose:        ${d.caseL}\n` +
      `trim-loose:        ${d.trimL}\n` +
      `type-loose:        ${d.typeL}\n\n` +
      `── missing combos (by variant) ──\n` +
      `strict:            ${d.mStrict}\n` +
      `case-loose:        ${d.mCase}   (recovered: ${d.rCase})\n` +
      `trim-loose:        ${d.mTrim}   (recovered: ${d.rTrim})\n` +
      `type-loose:        ${d.mType}   (recovered: ${d.rType})\n\n` +
      `missing sample (strict, max 8):\n` +
      (d.sample || '(none — dedup perfect)'),
    md_no_nick: '(no nickname)',
    md_user_not_found: (d) => `fid ${d.fid} not found in the users sheet.`,
    md_deact_title: 'Deactivate User',
    md_deact_prompt: 'Enter fid to deactivate:',
    md_deact_done: (d) => `✅ Deactivated: ${d.nick} (fid ${d.fid}) — excluded from the batch.`,
    md_del_title: 'Delete User',
    md_del_prompt: 'Enter fid to delete:',
    md_del_confirm_t: 'Confirm delete',
    md_del_confirm_d: (d) => `Delete the row for ${d.nick} (fid ${d.fid})?`,
    md_del_done: (d) =>
      `🗑️ Deleted: ${d.nick} (fid ${d.fid}) — ${d.before} → ${d.after} users\n🧹 ${d.logs} log row(s) cleaned too`,
    md_sync_title: '🔄 Coupon sync',
    md_sync_result: (d) =>
      `${d.n} new` +
      (d.n ? ` (${d.codes})` : '') +
      (d.rej ? ` · ${d.rej} rejected/pending` : '') +
      ` · ${d.cand} candidate(s)`,
    md_sync_fail: (d) => `Sync failed: ${d.reason}`,
    md_autosync_title: '🔄 Auto sync',
    md_autosync_on: (d) => `ON — checks automatically every ${d.hours}h.`,
    md_autosync_off: 'Turned OFF.',
  },
};
