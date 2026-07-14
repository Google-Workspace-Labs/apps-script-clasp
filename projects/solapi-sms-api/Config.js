/**
 * Solapi 설정 관리
 * Script Properties에서 민감정보를 안전하게 가져옵니다.
 *
 * 설정 방법:
 * 1. GAS 에디터 → 프로젝트 설정 → 스크립트 속성
 * 2. 다음 4개 속성 추가:
 *    - SOLAPI_API_KEY: Solapi API Key
 *    - SOLAPI_API_SECRET: Solapi API Secret
 *    - SOLAPI_PHONE_FROM: 발신자 전화번호
 *    - SOLAPI_PHONE_TO: 수신자 전화번호
 */

function getConfig() {
  const properties = PropertiesService.getScriptProperties();

  const apiKey = properties.getProperty('SOLAPI_API_KEY');
  const apiSecret = properties.getProperty('SOLAPI_API_SECRET');
  const phoneFrom = properties.getProperty('SOLAPI_PHONE_FROM');
  const phoneTo = properties.getProperty('SOLAPI_PHONE_TO');

  // 설정 검증
  if (!apiKey || !apiSecret || !phoneFrom || !phoneTo) {
    const missing = [];
    if (!apiKey) missing.push('SOLAPI_API_KEY');
    if (!apiSecret) missing.push('SOLAPI_API_SECRET');
    if (!phoneFrom) missing.push('SOLAPI_PHONE_FROM');
    if (!phoneTo) missing.push('SOLAPI_PHONE_TO');

    throw new Error(
      '❌ Solapi 설정이 누락되었습니다.\n\n' +
        `누락된 속성: ${missing.join(', ')}\n\n` +
        '설정 위치: GAS 에디터 → 프로젝트 설정 → 스크립트 속성',
    );
  }

  return {
    apiKey,
    apiSecret,
    phoneFrom,
    phoneTo,
    apiUrl: 'https://api.solapi.com/messages/v4/send-many',
  };
}
