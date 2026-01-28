/* global getConfig */

function sendSolapiSMS() {
  // ✅ 1. Config에서 안전하게 API 정보 가져오기
  const config = getConfig();
  const { apiKey, apiSecret, phoneFrom, phoneTo, apiUrl } = config;

  // ✅ 2. 현재 타임스탬프 생성 (ISO 8601 형식, 예: "2025-03-09T11:11:33.180Z")
  const timestamp = new Date().toISOString();

  // ✅ 3. 랜덤한 salt 값 생성 (UUID 사용)
  const salt = Utilities.getUuid(); // 요청마다 다르게 생성해야 함

  // ✅ 4. HMAC-SHA256 서명 생성 (Solapi 공식 문서 기준)
  const hmacData = timestamp + salt; // 서명 데이터: "timestamp + salt"
  const signatureBytes = Utilities.computeHmacSha256Signature(hmacData, apiSecret);

  // ✅ 5. 서명을 HEX 문자열로 변환 (Base64 ❌ → HEX ✅)
  const signature = signatureBytes
    .map((byte) => ('0' + (byte & 0xff).toString(16)).slice(-2))
    .join('');

  // ✅ 6. 전송할 문자 메시지 내용 설정 (여러 개도 가능)
  const params = {
    messages: [
      {
        text: '[솔라피 테스트] hello world!', // 보낼 문자 내용
        to: phoneTo, // 수신자 전화번호 (Script Properties에서 가져옴)
        from: phoneFrom, // 발신자 전화번호 (Script Properties에서 가져옴)
      },
    ],
  };

  // ✅ 7. HTTP 요청 옵션 설정
  const options = {
    method: 'post', // POST 요청
    headers: {
      'Content-Type': 'application/json',
      Authorization: `HMAC-SHA256 apiKey=${apiKey}, salt=${salt}, date=${timestamp}, signature=${signature}`, // Solapi 요구사항에 맞춘 인증 헤더
    },
    payload: JSON.stringify(params), // 메시지 데이터를 JSON 형식으로 변환
    muteHttpExceptions: true, // HTTP 오류 응답도 받을 수 있도록 설정
  };

  // ✅ 8. API 요청 보내기 & 응답 확인
  try {
    const response = UrlFetchApp.fetch(apiUrl, options); // API 요청 실행
    console.log('Response Text:', response.getContentText()); // 응답 결과 출력
  } catch (error) {
    console.error('Error sending SMS:', error); // 오류 발생 시 로그 출력
  }
}
