/**
 * Kingshot Coupon - 설정 관리
 *
 * SALT / BASE_URL 은 운영사가 교체할 수 있으므로 Script Properties로 덮어쓸 수 있게 합니다.
 * 속성이 없으면 아래 DEFAULT 값을 사용합니다 (첫 실측이 바로 가능하도록).
 *
 * 설정 위치(선택): GAS 에디터 → 프로젝트 설정 → 스크립트 속성
 *   - KINGSHOT_SALT      : sign 생성용 secret salt (교체 시에만 입력)
 *   - KINGSHOT_BASE_URL  : API 베이스 URL (기본값 사용 시 생략 가능)
 *   - KINGSHOT_VERIFY_PLAYER : 'false' 로 설정하면 fid 사전 로그인 검증 생략
 *   - KINGSHOT_VALIDATE_FID  : 쿠폰 등록 시 검증에 쓸 fid (없으면 첫 active 유저로 검증)
 *   - SLACK_WEBHOOK_URL      : 등록/배치 결과를 보낼 Slack Incoming Webhook URL
 *   - NOTIFY_BATCH/SCHEDULE/USER/COUPON/SETTINGS/SYNC : 카테고리별 알림 ON/OFF
 *     ('false' 면 OFF, 그 외 ON. 6개 모두 기본 ON — opt-out 정책)
 *   - KINGSHOT_MAX_USERS     : 유저 등록 정원 (기본 100, 0 이면 무제한)
 *   - KINGSHOT_COUPON_TTL_DAYS : 쿠폰 자동 만료 일수 (기본 7, 0 이면 끔)
 *   - AUTO_SYNC_ENABLED      : 외부 쿠폰 소스 자동 동기화 ON/OFF ('true' 면 ON, 기본 OFF) — Sync.js
 *   - COUPON_SOURCE_URL      : 자동 동기화 소스 JSON URL (미설정 시 Sync.js 기본 상수)
 */

// 운영사가 salt 를 교체하면 여기 또는 Script Property(KINGSHOT_SALT)만 수정하면 됩니다.
const DEFAULT_SALT = 'mN4!pQs6JrYwV9';
const DEFAULT_BASE_URL = 'https://kingshot-giftcode.centurygame.com';

// 요청 단위 캐시: 한 실행 안에서 getConfig() 가 여러 번 호출돼도 PropertiesService 는 1회만 읽음.
// GAS 는 entry point 마다 새 isolate → 요청 끝나면 자동 폐기. setProperty 하는 api 는 invalidateConfigCache_ 호출.
let __configCache = null;
function invalidateConfigCache_() {
  __configCache = null;
}

function getConfig() {
  if (__configCache) {
    return __configCache;
  }
  const props = PropertiesService.getScriptProperties();

  const salt = props.getProperty('KINGSHOT_SALT') || DEFAULT_SALT;
  const baseUrl = props.getProperty('KINGSHOT_BASE_URL') || DEFAULT_BASE_URL;
  // 기본값은 검증 ON. 'false' 문자열일 때만 끈다.
  const verifyPlayer = props.getProperty('KINGSHOT_VERIFY_PLAYER') !== 'false';

  // 유저 정원 (기본 100, 0 이면 무제한)
  const maxUsersProp = parseInt(props.getProperty('KINGSHOT_MAX_USERS'), 10);
  const maxUsers = isNaN(maxUsersProp) ? 100 : maxUsersProp;

  // 쿠폰 자동 만료 일수 (기본 7, 0 이면 끔)
  const ttlProp = parseInt(props.getProperty('KINGSHOT_COUPON_TTL_DAYS'), 10);
  const couponTtlDays = isNaN(ttlProp) ? 7 : ttlProp;

  __configCache = {
    salt,
    baseUrl,
    playerUrl: `${baseUrl}/api/player`,
    giftCodeUrl: `${baseUrl}/api/gift_code`,

    // 브라우저 요청을 흉내내기 위한 헤더
    origin: 'https://ks-giftcode.centurygame.com',
    referer: 'https://ks-giftcode.centurygame.com/',

    // 시트 이름
    sheets: {
      users: '👤 users',
      coupons: '🎟️ coupons',
      logs: '🧾 logs',
      systemLogs: '🩺 system_logs',
    },

    // Rate limit 대응
    requestDelayMs: 2500, // 요청 간 기본 지연
    rateLimitCooldownMs: 8000, // 429/TIMEOUT RETRY 시 재시도 전 대기(점증: 8→16→24s)
    maxRetries: 3, // 재시도 횟수

    // 한 번 실행의 시간 예산. GAS 6분 제한 대비 여유(초과 시 안전 중단 → 재실행하면 이어감)
    // 건당 평균 소요(약 requestDelayMs + 네트워크)로 처리 가능 건수를 가늠할 수 있다.
    maxRuntimeMs: 5 * 60 * 1000,

    // fid 사전 로그인 검증 여부 (실측 후 불필요하면 false)
    verifyPlayer,

    // 유저 등록 정원 (0 = 무제한)
    maxUsers,

    // 쿠폰 자동 만료 일수 (0 = 끔)
    couponTtlDays,

    // 쿠폰 등록 시 검증에 쓸 fid (없으면 첫 active 유저 사용)
    validateFid: props.getProperty('KINGSHOT_VALIDATE_FID') || '',

    // Slack 알림용 Incoming Webhook URL (유일한 채널)
    slackWebhookUrl: props.getProperty('SLACK_WEBHOOK_URL') || '',
    slackEnabled: props.getProperty('SLACK_ENABLED') !== 'false',
    // Slack 알림 언어(SLACK_LANG) — 배포자 채널용. 최초 null 이면 메뉴 언어로 seed, 이후 웹앱 전용.
    // 기본 en(국제 게임·안전한 실패모드: 영어권이 한국어에 막히는 것보다 한국인이 영어 보는 게 나음).
    slackLang: props.getProperty('SLACK_LANG') === 'ko' ? 'ko' : 'en',
    // 시트 메뉴 언어(MENU_LANG) — 시트 메뉴에서 변경(웹앱 배포 전에도 가능). 기본 en.
    menuLang: props.getProperty('MENU_LANG') === 'ko' ? 'ko' : 'en',

    // 알림 카테고리 — 채널(Slack)이 ON 이어도 해당 카테고리 OFF 면 전송 X.
    // 6개 카테고리 모두 기본 ON (opt-out 정책) — 처음 전부 켜놓고 노이즈 느끼면 관리 UI 에서 끔.
    notify: {
      batch: props.getProperty('NOTIFY_BATCH') !== 'false',
      schedule: props.getProperty('NOTIFY_SCHEDULE') !== 'false',
      user: props.getProperty('NOTIFY_USER') !== 'false',
      coupon: props.getProperty('NOTIFY_COUPON') !== 'false',
      settings: props.getProperty('NOTIFY_SETTINGS') !== 'false',
      sync: props.getProperty('NOTIFY_SYNC') !== 'false',
    },
  };
  return __configCache;
}
