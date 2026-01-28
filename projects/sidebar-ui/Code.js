// ✅ 스프레드시트 열릴 때 사용자 UI 메뉴 추가
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙ 사용자 설정')
    .addItem('📌 사이드바 열기', 'showSidebar') // 단순 열기 기능
    .addItem('🔄 사이드바 자동 실행 ON/OFF', 'toggleSidebarAutoTrigger') // 자동 실행 설정
    .addItem('👤 소유자 전용 자동 실행 ON/OFF', 'toggleOwnerOnlySidebar') // 소유자 전용 설정 추가
    .addToUi();
}

// ✅ 사이드바 표시 함수 (공동 작업자는 자동 실행 X, 단 소유자가 허용하면 실행 가능)
function showSidebar() {
  const properties = PropertiesService.getDocumentProperties();
  const ownerOnlyMode = properties.getProperty('ownerOnlySidebar') === 'true'; // 소유자 전용 모드 여부 확인

  if (ownerOnlyMode && !isUserOwner()) {
    return; // ✅ 소유자 전용 모드가 켜져 있고, 공동 작업자라면 실행 안 함
  }

  const htmlOutput =
    HtmlService.createHtmlOutputFromFile('sidebar').setTitle('📌 자동 실행 사이드바');
  SpreadsheetApp.getUi().showSidebar(htmlOutput);
}

// ✅ 소유자 전용 자동 실행 ON/OFF 토글
function toggleOwnerOnlySidebar() {
  if (!isUserOwner()) {
    SpreadsheetApp.getUi().alert('❌ 소유자 전용 설정 변경은 문서 소유자만 가능합니다.');
    return;
  }

  const properties = PropertiesService.getDocumentProperties();
  const ownerOnlyMode = properties.getProperty('ownerOnlySidebar') === 'true';

  if (ownerOnlyMode) {
    properties.deleteProperty('ownerOnlySidebar');
    SpreadsheetApp.getUi().alert('✅ 공동 작업자도 사이드바 자동 실행이 허용되었습니다.');
  } else {
    properties.setProperty('ownerOnlySidebar', 'true');
    SpreadsheetApp.getUi().alert(
      '👤 소유자 전용 모드가 활성화되었습니다. 공동 작업자는 자동 실행되지 않습니다.',
    );
  }
}

// ✅ 사이드바 자동 실행 ON/OFF 토글 (소유자만 가능)
function toggleSidebarAutoTrigger() {
  const triggerName = 'SidebarAutoTrigger';
  const properties = PropertiesService.getDocumentProperties();
  const isTriggerEnabled = properties.getProperty(triggerName);

  if (!isUserOwner()) {
    SpreadsheetApp.getUi().alert('❌ 자동 실행 트리거 설정은 문서 소유자만 가능합니다.');
    return;
  }

  if (isTriggerEnabled === 'true') {
    deleteTriggerByName(triggerName);
    properties.deleteProperty(triggerName);
    SpreadsheetApp.getUi().alert('❌ 사이드바 자동 실행이 해제되었습니다.');
  } else {
    createTriggerWithName(triggerName);
    properties.setProperty(triggerName, 'true');
    SpreadsheetApp.getUi().alert('✅ 사이드바 자동 실행이 설정되었습니다.');
  }
}

// ✅ 지정된 이름으로 자동 실행 트리거 등록
function createTriggerWithName(triggerName) {
  if (!isUserOwner()) {
    SpreadsheetApp.getUi().alert('❌ 자동 실행 트리거 설정은 문서 소유자만 가능합니다.');
    return;
  }

  if (isTriggerExists(triggerName)) {
    return; // 이미 존재하면 새로 등록하지 않음
  }

  ScriptApp.newTrigger('showSidebar')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onOpen()
    .create();
}

// ✅ 지정된 이름의 기존 트리거 삭제
function deleteTriggerByName(triggerName) {
  if (!isUserOwner()) {
    SpreadsheetApp.getUi().alert('❌ 자동 실행 트리거 해제는 문서 소유자만 가능합니다.');
    return;
  }

  const triggers = ScriptApp.getProjectTriggers().filter(
    (trigger) => trigger.getHandlerFunction() === 'showSidebar',
  );

  triggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}

// ✅ 특정 트리거가 존재하는지 확인
function isTriggerExists(triggerName) {
  return ScriptApp.getProjectTriggers().some(
    (trigger) => trigger.getHandlerFunction() === 'showSidebar',
  );
}

// ✅ 현재 사용자가 문서 소유자인지 확인
function isUserOwner() {
  const file = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const ownerEmail = file.getOwner().getEmail();
  const userEmail = Session.getActiveUser().getEmail();

  return ownerEmail === userEmail; // 소유자와 현재 사용자가 같으면 true
}
