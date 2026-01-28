function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate().setTitle('오늘 뭐 먹지?');
}

function include(filename) {
  // 'filename'에 확장자를 제외한 파일 이름을 전달~!
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
