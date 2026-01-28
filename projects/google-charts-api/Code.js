function doGet() {
  // 스프레드시트 데이터 가져오기
  const data = getData();

  // HTML 템플릿 로드
  const template = HtmlService.createTemplateFromFile('Index');

  // 데이터를 JSON 형태로 변환하여 템플릿에 전달 (보안 이슈 방지)
  template.initialData = JSON.stringify(data).replace(/</g, '\\u003c');

  return template
    .evaluate()
    .setTitle('부서별 급여 차트')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // iframe 허용
}

function getData() {
  const ss = SpreadsheetApp.openById('15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4');
  const sheet = ss.getSheetByName('급여 데이터');
  const data = sheet.getDataRange().getValues();

  // 첫 번째 행(헤더) 제외 후 JSON 변환
  return data.slice(1).map((row) => ({
    department: row[0], // 부서명
    salary: row[1], // 급여
  }));
}
