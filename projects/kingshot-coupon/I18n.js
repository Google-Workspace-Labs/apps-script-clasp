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
    // ── CP2-2 / CP2-3 에서 채움 ──
  },
  en: {
    // ── CP2-2 / CP2-3 에서 채움 ──
  },
};
