function doGet() {
  // 현재 스크립트의 배포 URL(dev 환경 기준)을 가져옵니다.
  const deployLinkA = ScriptApp.getService().getUrl(); // 예: /dev
  // dev → exec 으로 치환한 실제 사용자 실행용 URL을 만듭니다.
  const deployLinkB = ScriptApp.getService().getUrl().replace('/dev', '/exec');

  // 콘솔 로그 (개발자 확인용, 브라우저 console.log() 아님. 이건 Apps Script의 로그)
  console.log('A: ' + deployLinkA);
  console.log('B: ' + deployLinkB);

  // HTML 템플릿 파일(index.html)을 불러옵니다.
  const template = HtmlService.createTemplateFromFile('index');

  // 템플릿 내에서 사용할 변수 값을 전달합니다 (서버에서 클라이언트로 데이터 전달)
  template.urllinkA = deployLinkA; // index.html에서 <?= urllinkA ?> 로 참조 가능
  template.urllinkB = deployLinkB; // index.html에서 <?= urllinkB ?> 로 참조 가능

  // HTMLTemplate 객체를 실제 HTML로 렌더링해서 브라우저에 반환합니다.
  return template.evaluate();

  /**
   * 예시 URL:
   * A (dev URL):   https://script.google.com/macros/s/AKfycbzIpaq.../dev
   * B (exec URL):  https://script.google.com/macros/s/AKfycbzIpaq.../exec
   *
   * dev: 테스트용, 로그인된 사용자가 실행
   * exec: 최종 배포된 실행 URL, 익명 사용자도 접근 가능 (설정에 따라 다름)
   */
}
