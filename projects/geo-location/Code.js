/**
 * 웹 앱 요청이 들어오면 index.html 파일을 서빙합니다.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('내 위치 정보') // 웹 앱의 제목 설정
    .setSandboxMode(HtmlService.SandboxMode.IFRAME); // 보안 모드 설정
}

/**
 * HTML 파일에 작성된 스크립트에서 Apps Script 함수를 호출할 수 있도록 템플릿을 생성합니다.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 클라이언트(브라우저)에서 전송된 위치 정보를 받아 처리합니다.
 * 이 함수는 실제로 위치 정보를 저장하거나 다른 작업을 수행할 수 있습니다.
 * 여기서는 단순히 콘솔 로그에 출력하는 예시를 보여줍니다.
 *
 * @param {Object} locationData 클라이언트에서 전송된 위치 데이터 객체
 */
function processLocationData(locationData) {
  console.log('클라이언트로부터 위치 데이터 수신됨:');
  console.log('위도:', locationData.latitude);
  console.log('경도:', locationData.longitude);
  console.log('정확도:', locationData.accuracy);
  console.log('속도:', locationData.speed);
  console.log('타임스탬프:', new Date(locationData.timestamp).toLocaleString());

  // 여기에 스프레드시트에 저장하거나, 이메일을 보내거나,
  // 다른 Google 서비스와 연동하는 등의 추가 로직을 구현할 수 있습니다.

  return '위치 정보를 서버에서 성공적으로 수신했습니다.';
}

/**
 * workspace-core 라이브러리 테스트 함수
 */
function testWorkspaceCore() {
  Logger.log('=== Workspace Core Library Test ===');

  // 1. 버전 확인
  const version = WorkspaceCore.getLibraryVersion();
  Logger.log('Library Version: ' + version);

  const info = WorkspaceCore.getLibraryInfo();
  Logger.log('Library Info: ' + JSON.stringify(info, null, 2));

  // 2. 날짜 포맷팅 테스트
  const today = new Date();
  const dateStr = WorkspaceCore.formatKoreanDate(today);
  Logger.log('Formatted Date: ' + dateStr);

  const dateTimeStr = WorkspaceCore.formatKoreanDate(today, true);
  Logger.log('Formatted DateTime: ' + dateTimeStr);

  // 3. 상대 시간 테스트
  const pastDate = new Date(today.getTime() - 2 * 60 * 60 * 1000); // 2시간 전
  const relativeTime = WorkspaceCore.getRelativeTime(pastDate);
  Logger.log('Relative Time: ' + relativeTime);

  // 4. 문자열 변환 테스트
  const kebab = WorkspaceCore.toKebabCase('myVariableName');
  Logger.log('Kebab Case: ' + kebab);

  const camel = WorkspaceCore.toCamelCase('my-variable-name');
  Logger.log('Camel Case: ' + camel);

  // 5. 이메일 검증 테스트
  const validEmail = WorkspaceCore.isValidEmail('user@example.com');
  Logger.log('Valid Email: ' + validEmail);

  const invalidEmail = WorkspaceCore.isValidEmail('invalid-email');
  Logger.log('Invalid Email: ' + invalidEmail);

  // 6. 배열 유틸리티 테스트
  const items = [1, 2, 3, 4, 5, 6, 7];
  const chunks = WorkspaceCore.chunk(items, 3);
  Logger.log('Chunks: ' + JSON.stringify(chunks));

  const duplicates = [1, 2, 2, 3, 3, 3];
  const unique = WorkspaceCore.unique(duplicates);
  Logger.log('Unique: ' + JSON.stringify(unique));

  // 7. 에러 핸들링 테스트
  try {
    throw new Error('Test error');
  } catch (error) {
    WorkspaceCore.logError(error, { context: 'Test' });
  }

  Logger.log('=== Test Complete ===');

  return 'Workspace Core test completed successfully!';
}
