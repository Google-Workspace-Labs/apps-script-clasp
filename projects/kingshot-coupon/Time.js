/* global getConfig */

/**
 * Kingshot Coupon — 타임스탬프 단일 원천(UTC) 헬퍼
 *
 * 철학: **원본은 UTC 하나만 존재한다.** 시트·Property 에 적는 모든 시각은 UTC ISO-8601 문자열
 *   (`2026-05-28T08:01:07Z`). 어느 나라 누가 복사·배포·기록하든 같은 문자열 = 같은 순간.
 *
 * 표시(format)는 화면 성격에 따라 edge 에서:
 *   - 웹앱(관리+멤버)        : 접속자 **브라우저 현지 시간** (client 의 fmtLocal_ 이 ISO 를 변환)
 *   - Slack footer           : 읽는 사람 현지 (Slack 이 ts 를 자동 로컬라이즈)
 *   - Slack 본문 / 시트 메뉴창 : 배포자 **LANG 기준** — ko=KST 라벨, 그 외=UTC('…Z'). 항상 tz 라벨(fmtTsLang_)
 *
 * 읽기(tsParse_)는 **관대**: ISO 문자열 | Date 값(마이그레이션 전 레거시) | epoch 를 모두 Date 로.
 *   → 코드가 혼재 데이터에도 안 깨짐(NaN 방지). 마이그레이션은 "시각적 통일"용이지 정확성 전제 아님.
 *
 * ⚠️ 예외: 외부 쿠폰 소스의 날짜 비교(Sync.js 의 `today`, until>=today)는 소스 의미(date-only)라
 *   여기 캐논과 무관 — 그 자리는 의도적으로 Asia/Seoul 유지(저장 타임스탬프 아님).
 */

/** 캐논 쓰기: 현재 시각을 UTC ISO 로 (밀리초 제거). 예: 2026-05-28T08:01:07Z */
function tsNow_() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Date 객체 → 캐논 UTC ISO 문자열(밀리초 제거). 빈/무효면 ''. */
function tsToIso_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * 캐논 읽기(관대): ISO 문자열 | Date 값(레거시) | epoch(number) → Date. 못 읽으면 null.
 * ISO 'Z' 는 정확히 UTC instant 로 파싱됨. 마이그레이션 후엔 전부 ISO, 그 전엔 Date 값도 통과.
 */
function tsParse_(v) {
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : v;
  }
  if (typeof v === 'number' && isFinite(v)) {
    return new Date(v);
  }
  const s = String(v === null || v === undefined ? '' : v).trim();
  if (!s) {
    return null;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 배포자 서버 화면(Slack 본문·시트 메뉴창) 표시 — LANG 기준, **항상 tz 라벨**.
 *   ko       → 'yyyy-MM-dd HH:mm KST'
 *   그 외(en) → 'yyyy-MM-ddTHH:mmZ' (UTC)
 * @param {string|Date} v ISO 문자열 또는 Date
 * @param {string} [lang] 'ko'|'en' (미지정 시 Slack 언어)
 */
function fmtTsLang_(v, lang) {
  const d = tsParse_(v);
  if (!d) {
    return '';
  }
  let l = lang;
  if (!l) {
    try {
      l = getConfig().slackLang;
    } catch (e) {
      l = 'en';
    }
  }
  if (l === 'ko') {
    return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') + ' KST';
  }
  return Utilities.formatDate(d, 'UTC', "yyyy-MM-dd'T'HH:mm'Z'");
}
