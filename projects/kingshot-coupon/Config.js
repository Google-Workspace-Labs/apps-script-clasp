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
 *   - DISCORD_WEBHOOK_URL    : 등록/배치 결과를 보낼 Discord Incoming Webhook URL
 *   - KINGSHOT_MAX_USERS     : 유저 등록 정원 (기본 100, 0 이면 무제한)
 */

// 운영사가 salt 를 교체하면 여기 또는 Script Property(KINGSHOT_SALT)만 수정하면 됩니다.
const DEFAULT_SALT = 'mN4!pQs6JrYwV9';
const DEFAULT_BASE_URL = 'https://kingshot-giftcode.centurygame.com';

function getConfig() {
  const props = PropertiesService.getScriptProperties();

  const salt = props.getProperty('KINGSHOT_SALT') || DEFAULT_SALT;
  const baseUrl = props.getProperty('KINGSHOT_BASE_URL') || DEFAULT_BASE_URL;
  // 기본값은 검증 ON. 'false' 문자열일 때만 끈다.
  const verifyPlayer = props.getProperty('KINGSHOT_VERIFY_PLAYER') !== 'false';

  // 유저 정원 (기본 100, 0 이면 무제한)
  const maxUsersProp = parseInt(props.getProperty('KINGSHOT_MAX_USERS'), 10);
  const maxUsers = isNaN(maxUsersProp) ? 100 : maxUsersProp;

  return {
    salt,
    baseUrl,
    playerUrl: `${baseUrl}/api/player`,
    giftCodeUrl: `${baseUrl}/api/gift_code`,

    // 브라우저 요청을 흉내내기 위한 헤더
    origin: 'https://ks-giftcode.centurygame.com',
    referer: 'https://ks-giftcode.centurygame.com/',

    // 시트 이름
    sheets: {
      users: 'users',
      coupons: 'coupons',
      logs: 'logs',
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

    // 쿠폰 등록 시 검증에 쓸 fid (없으면 첫 active 유저 사용)
    validateFid: props.getProperty('KINGSHOT_VALIDATE_FID') || '',

    // Discord 알림용 Incoming Webhook URL
    discordWebhookUrl: props.getProperty('DISCORD_WEBHOOK_URL') || '',
  };
}
