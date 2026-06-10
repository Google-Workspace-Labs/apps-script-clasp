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

/** 서버 i18n 조회 (Slack 알림 전용, SLACK_LANG 기준). */
function nt(key, data) {
  let lang;
  try {
    lang = getConfig().slackLang;
  } catch (e) {
    lang = 'ko';
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
    ttl_t: '⏳ 쿠폰 자동만료(TTL) 변경',
    ttl_d: (d) => {
      const f = (v) => (v === null ? '(미설정)' : v === 0 ? '끔' : `${v}일`);
      return `**${f(d.prev)} → ${f(d.n)}**`;
    },
    user_del_t: '🗑️ 유저 삭제 완료',
    user_del_d: (d) =>
      `🏷️ **${d.nick || '(닉네임 없음)'}**\n🆔 \`${d.fid}\`  ·  👥 ${d.before} → ${d.after}명\n🧹 logs ${d.logs}건 정리`,
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
  },
  en: {
    user_reg_t: '👤 User registered',
    user_reg_d: (d) =>
      `🏷️ **${d.nick || '(no nickname)'}**\n🆔 \`${d.fid}\`  ·  👥 ${d.before} → ${d.after}`,
    sched_user_t: '⏱ Batch scheduled (user)',
    sched_user_d: 'Auto-batch in ~3 min — delivering active coupons to the new user',
    slack_ok_t: '✅ Slack connected',
    slack_ok_d: 'Alerts will be sent to this channel. (test message)',
    ttl_t: '⏳ Coupon auto-expiry (TTL) changed',
    ttl_d: (d) => {
      const f = (v) => (v === null ? 'unset' : v === 0 ? 'off' : `${v} days`);
      return `**${f(d.prev)} → ${f(d.n)}**`;
    },
    user_del_t: '🗑️ User deleted',
    user_del_d: (d) =>
      `🏷️ **${d.nick || '(no nickname)'}**\n🆔 \`${d.fid}\`  ·  👥 ${d.before} → ${d.after}\n🧹 ${d.logs} logs cleaned`,
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
  },
};
