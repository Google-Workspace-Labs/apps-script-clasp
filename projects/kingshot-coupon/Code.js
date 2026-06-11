/* global getConfig, loginPlayer, redeemCouponWithRetry, notify_, buildBatchEmbed_, requestBatch_, removeTriggers_, nt, invalidateConfigCache_ */

/**
 * Kingshot Coupon - 엔트리 / 메뉴 / 배치 / 시트 I/O
 *
 * 시트 구조 (모든 컬럼 번호는 COL 상수로):
 *   users        : fid(1) | nickname(2) | active(3)  | created(4) | updated(5)
 *   coupons      : code(1) | enabled(2)  | status(3) | created(4) | updated(5)
 *                  status: VALID/PENDING (등록 시) | EXPIRED/INVALID_CODE/EXPIRED_AGE (배치 자동)
 *   logs         : time(1) | fid(2) | code(3) | result(4) | message(5)   (쿠폰 redeem 결과 — dedup 원천)
 *   system_logs  : time(1) | level(2) | source(3) | message(4) | target(5)  (진단, 1000행 회전)
 *
 * 쿠폰 만료 처리: 배치 중 EXPIRED/INVALID_CODE 또는 등록 후 TTL 초과(EXPIRED_AGE) 시
 * 해당 쿠폰을 이번 실행 나머지 유저에게 요청하지 않고 enabled=FALSE + status 기록.
 * 해당 코드의 logs 행도 purge (dedup 안전). 별도 만료일 입력 불필요 — API/시간이 기준.
 */

// ============================================================
// 공용 상수 / 헬퍼 (다른 .js 파일에서도 사용)
// ============================================================

/**
 * 시트별 컬럼 인덱스(1-based). 매직 넘버 대신 `COL.users.active` 처럼 사용.
 * 시트 구조 바꿀 때 이 한 곳만 수정.
 */
const COL = {
  users: { fid: 1, nickname: 2, active: 3, created: 4, updated: 5 },
  coupons: { code: 1, enabled: 2, status: 3, created: 4, updated: 5 },
  logs: { time: 1, fid: 2, code: 3, result: 4, message: 5 },
  systemLogs: { time: 1, level: 2, source: 3, message: 4, target: 5 },
};

/**
 * onboarding 가이드 시트명.
 * 배포자가 [🚀 Setup ▸ 📖 시작하기 시트 생성] 으로 1회 수동 생성 후 멤버에게 공유.
 * 멤버가 카피하면 자동으로 함께 복제되어 첫 안내 역할 — 끝나면 본인이 삭제 가능.
 */
const GUIDE_SHEET_NAME = '📖 Guide';

/**
 * config.sheets 의 논리명(users/coupons/logs/systemLogs) → Sheet 객체.
 * 없으면 null (호출부에서 throw 결정).
 */
function getSheet_(logicalName) {
  const config = getConfig();
  const actualName = config.sheets[logicalName];
  if (!actualName) {
    throw new Error(`알 수 없는 시트 키: ${logicalName}`);
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(actualName);
  if (!sheet) {
    // 마이그레이션: 구버전(이모지 없는) 이름으로 찾으면 새 이름으로 자동 rename.
    // 데이터는 그대로 보존되고 탭 이름만 바뀜. 첫 접근 시 1회만 동작.
    const baseName = actualName.replace(/^[^A-Za-z]+/, '');
    if (baseName && baseName !== actualName) {
      const legacy = ss.getSheetByName(baseName);
      if (legacy) {
        legacy.setName(actualName);
        sheet = legacy;
      }
    }
  }
  return sheet || null;
}

/** getSheet_ 와 같지만 없으면 안내 메시지 포함 throw — I/O 함수 진입 시 사용 */
function requireSheet_(logicalName) {
  const sheet = getSheet_(logicalName);
  if (!sheet) {
    const config = getConfig();
    throw new Error(
      `'${config.sheets[logicalName]}' 시트가 없습니다. 먼저 [🚀 설정 ▸ 시트 4개 생성] 을 실행하세요.`,
    );
  }
  return sheet;
}

// ============================================================
// 메뉴 (Simple Trigger) — onOpen 은 메뉴 빌드만 담당, 시트 생성은 사용자 명시 클릭
// ============================================================

/**
 * 시트가 열릴 때마다 실행됨(Simple Trigger).
 *   - 메뉴 4그룹만 빌드: 🚀 Setup / ▶ 실행 / 🛠 관리 / 🔍 진단
 *
 * 자동 시트 생성은 의도적으로 하지 않음:
 *   - Simple Trigger 는 권한이 제한적이라 첫 사용자는 try/catch 로 silent fail 가능
 *   - 사용자가 명시적으로 [🚀 Setup ▸ Setup Sheets] 클릭 → OAuth 동의창 → 시트 4개 생성
 *     흐름이 권한 흐름·디버깅 측면에서 명확하고 일관적임
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // 메뉴 라벨은 '시트 메뉴 언어(MENU_LANG)'. nt 3번째 인자로 lang 오버라이드.
  // getConfig 실패(권한 제약) 시 ko 폴백 → onOpen 안 깨짐.
  let ml = 'ko';
  try {
    ml = getConfig().menuLang;
  } catch (e) {
    ml = 'ko';
  }

  const setupMenu = ui
    .createMenu(nt('mn_setup', null, ml))
    .addItem(nt('mn_quick_setup', null, ml), 'quickSetupWizard')
    .addItem(nt('mn_setup_sheets', null, ml), 'setupSheets')
    .addSeparator()
    .addItem(nt('mn_create_guide', null, ml), 'createGuideSheet');

  const runMenu = ui
    .createMenu(nt('mn_run', null, ml))
    .addItem(nt('mn_run_batch', null, ml), 'runCouponBatch')
    .addItem(nt('mn_test_coupon', null, ml), 'testSingleCoupon');

  const manageMenu = ui
    .createMenu(nt('mn_manage', null, ml))
    .addItem(nt('mn_deactivate', null, ml), 'deactivateUser')
    .addItem(nt('mn_delete_user', null, ml), 'deleteUser')
    .addItem(nt('mn_clean_dup', null, ml), 'cleanDuplicateUsers')
    .addSeparator()
    .addItem(nt('mn_clean_logs', null, ml), 'cleanExpiredLogs')
    .addItem(nt('mn_clean_invalid', null, ml), 'cleanInvalidCoupons')
    .addItem(nt('mn_clear_syslogs', null, ml), 'clearSystemLogs');

  const syncMenu = ui
    .createMenu(nt('mn_sync', null, ml))
    .addItem(nt('mn_sync_now', null, ml), 'menuRunSyncNow')
    .addItem(nt('mn_sync_toggle', null, ml), 'menuToggleAutoSync');

  const diagMenu = ui
    .createMenu(nt('mn_diag', null, ml))
    .addItem(nt('mn_diagnose', null, ml), 'diagnoseDedup');

  // 🌐 언어 — 시트(진입점)에서 직접 배포자 언어 변경. 웹앱 배포 전에도 가능(모순 해소).
  // 라벨은 이중언어로 고정(어느 기본 언어에서든 인식 가능).
  const langMenu = ui
    .createMenu('🌐 Language / 언어')
    .addItem('한국어 (Korean)', 'menuSetLangKo')
    .addItem('English (영어)', 'menuSetLangEn');

  ui.createMenu('👑 Kingshot Bot')
    .addSubMenu(langMenu)
    .addSeparator()
    .addSubMenu(setupMenu)
    .addSubMenu(runMenu)
    .addSubMenu(manageMenu)
    .addSubMenu(syncMenu)
    .addSubMenu(diagMenu)
    .addToUi();
}

/** 시트 메뉴: 메뉴 언어 KO. */
function menuSetLangKo() {
  setMenuLang_('ko');
}
/** 시트 메뉴: 메뉴 언어 EN. */
function menuSetLangEn() {
  setMenuLang_('en');
}
/**
 * 시트 메뉴 언어(MENU_LANG) 설정 → 메뉴 즉시 재구성(onOpen 재호출, 시트 reload 불필요).
 * Slack 언어(SLACK_LANG)는 최초 null 일 때만 메뉴 언어로 seed(이후 웹앱 전용).
 */
function setMenuLang_(lang) {
  const v = lang === 'en' ? 'en' : 'ko';
  const props = PropertiesService.getScriptProperties();
  props.setProperty('MENU_LANG', v);
  // Slack 알림 언어 최초 1회 seed
  if (props.getProperty('SLACK_LANG') === null) {
    props.setProperty('SLACK_LANG', v);
  }
  invalidateConfigCache_();
  onOpen(); // 메뉴 즉시 재구성 (addToUi 가 기존 메뉴 교체)
  const msg = v === 'en' ? '✓ English — menu updated.' : '✓ 한국어 — 메뉴 갱신됨.';
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, '🌐 Kingshot Bot', 5);
}

/**
 * Quick Setup 마법사 (모달 안내).
 *   - 비개발자가 시트만 복사받은 상황에서 배포·알림 단계가 무엇인지 한 화면에서 안내
 *   - 웹앱 배포 → Slack 설정 (2단계)
 *   - 시트 생성·권한 단계는 이 모달이 아닌 [📖 시작하기] 시트가 담당
 *     (모달은 권한 동의 후에야 열리는 paradox 회피)
 */
function quickSetupWizard() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const editorUrl = `https://script.google.com/home/projects/${ScriptApp.getScriptId()}/edit`;

  const html = HtmlService.createHtmlOutput(
    `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
             padding: 20px; line-height: 1.55; color: #2a2a2a; }
      h2 { margin: 0 0 12px; color: #b8860b; }
      .step { background:#fffdf6; border:1px solid #e6dfc7; border-radius:10px;
              padding:14px 16px; margin: 10px 0; }
      .step h3 { margin: 0 0 6px; font-size: 14px; color:#7a5c00; }
      .step p  { margin: 4px 0; font-size: 13px; }
      .badge { display:inline-block; background:#b8860b; color:#fff; font-weight:700;
               border-radius:999px; padding:2px 10px; font-size:12px; margin-right:6px; }
      a.btn { display:inline-block; margin-top:6px; padding:6px 12px;
              background:#b8860b; color:#fff; border-radius:6px; text-decoration:none;
              font-size:13px; font-weight:600; }
      a.btn:hover { background:#9a7308; }
      code { background:#f3eedb; padding:1px 6px; border-radius:4px; font-size:12px; }
      .note { font-size:12px; color:#666; margin-top:14px; }
    </style>
    <h2>🚀 Kingshot Bot — Quick Setup</h2>
    <p style="font-size:13px; color:#555;">아래 2단계로 사용 준비 완료입니다.</p>
    <p style="font-size:12px; color:#888; margin-top:-2px;">
      💡 시트 4개(<code>👤 users · 🎟️ coupons · 🧾 logs · 🩺 system_logs</code>)가 아직 안 보이면
      먼저 <b>👑 Kingshot Bot ▸ 🚀 설정 ▸ 시트 4개 생성</b> 부터 실행하세요.
    </p>

    <div class="step">
      <h3><span class="badge">1</span>웹앱 배포 + 접속 확인</h3>
      <p>아래 버튼으로 에디터 열기 → 우측 상단 <code>배포 ▸ 새 배포</code> →
         좌측 <code>⚙️ 유형 ▸ 웹 앱</code> 선택<br>
         → 구성: 실행 사용자 = <b>나</b>, 액세스 권한 = <b>모든 사용자</b> →
         <code>배포</code> 클릭<br>
         → <code>액세스 승인</code> → 권한 절차는 <b>📖 시작하기</b> 시트의 1단계 ⓐⓑⓒ 와 동일<br>
         → "배포가 업데이트되었습니다" 화면의 웹 앱 URL <b>[복사]</b><br>
         → 복사한 <code>/exec</code> URL 을 브라우저로 접속 확인</p>
      <a class="btn" href="${editorUrl}" target="_blank">▶ Apps Script 에디터 열기</a>
    </div>

    <div class="step">
      <h3><span class="badge">2</span>Slack 알림 (선택)</h3>
      <p>배치 결과를 Slack 으로 받고 싶다면 위 웹앱 <code>/exec</code> 의
         <b>🛠 관리</b> 패널 → 비밀번호(오늘 MMDD 4자리) → Webhook URL 저장.
         (도움말 버튼에 GPT 프롬프트 복사 기능 있음.)</p>
    </div>

    <p class="note">
      🔁 이 안내 다시 보려면 <b>👑 Kingshot Bot ▸ 🚀 Setup ▸ Quick Setup</b>.
    </p>
  `,
  )
    .setWidth(520)
    .setHeight(540);

  ui.showModalDialog(html, '🚀 Quick Setup');
  // 표시 자체는 부수 효과 없음 — ss 참조는 향후 확장(첫 active 유저 체크 등)에 대비
  void ss;
}

/** setupSheets 의 silent 변형: 토스트/얼럿 없이 생성된 시트명 배열만 반환. */
function setupSheetsSilently_() {
  const config = getConfig();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const defs = [
    { name: config.sheets.users, headers: ['fid', 'nickname', 'active', 'created', 'updated'] },
    { name: config.sheets.coupons, headers: ['code', 'enabled', 'status', 'created', 'updated'] },
    { name: config.sheets.logs, headers: ['time', 'fid', 'code', 'result', 'message'] },
    { name: config.sheets.systemLogs, headers: ['time', 'level', 'source', 'message', 'target'] },
  ];
  const created = [];

  for (const def of defs) {
    // 새 이름(이모지)로 있으면 건너뜀. 없으면 구버전(이모지 없는) 이름을 찾아 rename 으로 흡수.
    let existing = ss.getSheetByName(def.name);
    if (!existing) {
      const baseName = def.name.replace(/^[^A-Za-z]+/, '');
      if (baseName && baseName !== def.name) {
        const legacy = ss.getSheetByName(baseName);
        if (legacy) {
          legacy.setName(def.name);
          existing = legacy;
        }
      }
    }
    if (existing) {
      continue;
    }
    const sheet = ss.insertSheet(def.name);
    sheet
      .getRange(1, 1, 1, def.headers.length)
      .setValues([def.headers])
      .setFontWeight('bold')
      .setBackground('#f0f0f0');
    sheet.setFrozenRows(1);
    created.push(def.name);
  }
  return created;
}

/**
 * 📖 시작하기 가이드 시트 작성 (내부 헬퍼).
 *   - leftmost(index=0) 에 신규 시트 삽입
 *   - 셀 병합 + 색상/굵기로 안내 카드 형태 구성
 *   - 격자선 숨김 (setHiddenGridlines)
 *   - 존재 여부 체크 없음 — 호출부(createGuideSheet)가 가드 책임
 *   - 생성된 Sheet 객체 반환 (호출부가 activate 등 추가 처리 가능)
 */
function writeGuideSheet_(ss) {
  const sheet = ss.insertSheet(GUIDE_SHEET_NAME, 0);
  // 좌(영어 A:E) | 간격 F | 우(한국어 G:K) — 빈 열 없이 타이트하게
  for (let c = 1; c <= 5; c++) {
    sheet.setColumnWidth(c, 128);
  }
  sheet.setColumnWidth(6, 44);
  for (let c = 7; c <= 11; c++) {
    sheet.setColumnWidth(c, 128);
  }

  let r = 0;
  const style = (rng, o) => {
    rng.setWrap(true).setVerticalAlignment('middle');
    if (o.size) rng.setFontSize(o.size);
    if (o.bold) rng.setFontWeight('bold');
    if (o.bg) rng.setBackground(o.bg);
    if (o.color) rng.setFontColor(o.color);
    if (o.italic) rng.setFontStyle('italic');
    if (o.center) rng.setHorizontalAlignment('center');
  };
  // 좌=영어(A:E), 우=한국어(G:K), 같은 행
  const row = (en, ko, o) => {
    r++;
    o = o || {};
    const L = sheet.getRange(r, 1, 1, 5).merge();
    const R = sheet.getRange(r, 7, 1, 5).merge();
    if (o.formula) {
      sheet.getRange(r, 1).setFormula(en);
      sheet.getRange(r, 7).setFormula(ko);
    } else {
      L.setValue(en);
      R.setValue(ko);
    }
    style(L, o);
    style(R, o);
    sheet.setRowHeight(r, o.h || 24);
  };
  // 전체폭 A:K
  const full = (text, o) => {
    r++;
    o = o || {};
    style(sheet.getRange(r, 1, 1, 11).merge().setValue(text), o);
    sheet.setRowHeight(r, o.h || 24);
  };
  const gap = (h) => {
    r++;
    sheet.setRowHeight(r, h || 8);
  };

  full('👑 Kingshot Bot — Getting Started / 시작 가이드', {
    size: 16,
    bold: true,
    bg: '#b8860b',
    color: '#ffffff',
    center: true,
    h: 44,
  });
  row(
    'Finish the 2 steps below to be ready — 3️⃣ is optional.',
    '아래 2단계면 준비 완료 — 3️⃣ 은 선택',
    {
      size: 10,
      color: '#555',
      center: true,
    },
  );
  gap();

  row('0️⃣  Choose your language', '0️⃣  언어 선택', {
    size: 12,
    bold: true,
    bg: '#fffdf6',
    color: '#7a5c00',
  });
  row(
    'Top menu [👑 Kingshot Bot ▸ 🌐 Language] → 한국어 / English. The menu switches instantly.',
    '상단 메뉴 [👑 Kingshot Bot ▸ 🌐 Language] → 한국어 / English. 메뉴가 즉시 바뀝니다.',
    { size: 11, h: 34 },
  );
  gap();

  row('1️⃣  Create 4 sheets + approve Google permissions', '1️⃣  시트 4개 생성 + Google 권한 승인', {
    size: 12,
    bold: true,
    bg: '#fffdf6',
    color: '#7a5c00',
  });
  row(
    '① Click [👑 Kingshot Bot ▸ 🚀 Setup ▸ Setup Sheets]',
    '① [👑 Kingshot Bot ▸ 🚀 설정 ▸ 시트 4개 생성] 클릭',
    { size: 11 },
  );
  row(
    '② Approve Google permissions — an "unverified app" warning is normal:',
    '② Google 권한 승인 — "확인하지 않은 앱" 경고는 정상:',
    { size: 11 },
  );
  row(
    '   ⓐ Click [Advanced] (don\'t click "back to safety")',
    "   ⓐ [고급] 클릭 ('안전한 환경으로 돌아가기' 누르지 말 것)",
    { size: 10, color: '#555' },
  );
  row(
    '   ⓑ Click [Go to Kingshot Coupon (unsafe)]',
    '   ⓑ [Kingshot Coupon(으)로 이동(안전하지 않음)] 클릭',
    { size: 10, color: '#555' },
  );
  row('   ⓒ Check [Select all] → [Continue]', '   ⓒ [모두 선택] 체크 → [계속]', {
    size: 10,
    color: '#555',
  });
  row(
    '   ※ "Unsafe" is just Google\'s unverified notice — the code is safe.',
    '   ※ "안전하지 않음"은 Google 미인증 안내일 뿐 — 코드는 안전',
    { size: 10, color: '#888', italic: true },
  );
  row(
    '③ 4 sheets (👤 users · 🎟️ coupons · 🧾 logs · 🩺 system_logs) are auto-created',
    '③ 시트 4개(👤 users · 🎟️ coupons · 🧾 logs · 🩺 system_logs) 자동 생성',
    { size: 11 },
  );
  row('✅ If those 4 sheets already show, Step 1 is done', '✅ 4개 시트가 이미 보이면 1단계 완료', {
    size: 10,
    color: '#888',
    italic: true,
  });
  gap();

  row('2️⃣  Deploy the web app + verify', '2️⃣  웹앱 배포 + 접속 확인', {
    size: 12,
    bold: true,
    bg: '#fffdf6',
    color: '#7a5c00',
  });
  row(
    '① [👑 Kingshot Bot ▸ 🚀 Setup ▸ Quick Setup] → modal [▶ Open Apps Script editor]',
    '① [👑 Kingshot Bot ▸ 🚀 설정 ▸ 빠른 설정] → 모달 [▶ Apps Script 에디터 열기]',
    { size: 11, h: 34 },
  );
  row(
    '② Editor top-right [Deploy ▸ New deployment] → [⚙️ Type] → [Web app]',
    '② 에디터 우측 상단 [배포 ▸ 새 배포] → [⚙️ 유형] → [웹 앱]',
    { size: 11 },
  );
  row(
    '③ Execute as = Me, Who has access = Anyone → [Deploy]',
    '③ 실행 사용자 = 나(본인), 액세스 = 모든 사용자 → [배포]',
    { size: 11 },
  );
  row(
    '④ "Authorization required" → [Authorize] → allow all like Step 1 ⓐⓑⓒ',
    '④ "액세스 권한 부여 요청" → [액세스 승인] → 1단계 ⓐⓑⓒ 처럼 모두 허용',
    { size: 11, h: 34 },
  );
  row(
    '⑤ "Deployment updated" → [Copy] the Web app URL → [Done]',
    '⑤ "배포가 업데이트되었습니다" → 웹 앱 URL [복사] → [완료]',
    { size: 11 },
  );
  row('⑥ Open the copied /exec URL in a browser', '⑥ 복사한 /exec URL 을 브라우저로 접속 확인', {
    size: 11,
  });
  row(
    '⑦ Changing [🛠 Admin] settings needs 🔑 password (today MMDD, 4 digits)',
    '⑦ [🛠 관리] 설정 변경은 🔑 비밀번호(오늘 MMDD 4자리) 필요',
    { size: 11 },
  );
  gap();

  row('3️⃣  (Optional) Auto coupon sync', '3️⃣  (선택) 자동 쿠폰 동기화', {
    size: 12,
    bold: true,
    bg: '#fffdf6',
    color: '#7a5c00',
  });
  row(
    '⑧ To auto-add new community coupons, turn ON Auto coupon sync in [🛠 Admin]',
    '⑧ 커뮤니티 신규 쿠폰 자동 등록하려면 [🛠 관리]에서 자동 쿠폰 동기화 ON',
    { size: 11, h: 34 },
  );
  row(
    '   (or menu [👑 Kingshot Bot ▸ 🔄 Sync ▸ Auto-sync ON/OFF])',
    '   (또는 [👑 Kingshot Bot ▸ 🔄 동기화 ▸ 자동 동기화 ON/OFF])',
    { size: 10, color: '#555' },
  );
  row(
    '⑨ OFF by default per copy — turn ON to install the sync trigger',
    '⑨ 복사본마다 기본 꺼짐 — 켜야 본인 시트에 동기화 트리거 설치',
    { size: 11, h: 34 },
  );
  row(
    '⑩ Manual registration is always safe (ON or OFF) — no impact if the source changes/stops',
    '⑩ 자동 켜짐/꺼짐 무관 수동 등록은 항상 안전 — 외부 사이트 변경·중단에도 영향 없음',
    { size: 11, h: 44 },
  );
  row(
    '=HYPERLINK("https://kingshotdata.kr","🔗 Coupon source: kingshotdata.kr")',
    '=HYPERLINK("https://kingshotdata.kr","🔗 쿠폰 출처: kingshotdata.kr")',
    { formula: true, size: 10 },
  );
  gap();

  full(
    '🪄 After onboarding you can delete this sheet (right-click tab → "Delete sheet")  ·  온보딩 끝나면 삭제 OK',
    {
      size: 10,
      color: '#888',
      center: true,
      h: 30,
    },
  );

  sheet.setHiddenGridlines(true);

  return sheet;
}

// ============================================================
// 메인 배치
// ============================================================

/**
 * active 유저 × enabled 쿠폰 전조합을 순회하며 쿠폰을 등록한다.
 * 이미 성공/이미받음으로 기록된 조합은 건너뛴다(재실행 시 이어서 진행됨).
 */
function runCouponBatch() {
  // 단일 실행 보장: 이미 배치가 돌고 있으면 새로 시작하지 않고 다음으로 재예약(debounce)
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    console.log('[BATCH] 이미 실행 중 — 다음으로 재예약');
    requestBatch_();
    return;
  }
  let nextDelayMs = null;
  try {
    nextDelayMs = runCouponBatch_();
  } finally {
    // 1회성 트리거의 'disabled' 잔재 즉시 청소 (메뉴 직접 실행에선 noop)
    // ⚠️ lock 보유 중에 처리해야 함 — releaseLock 후엔 대기 중이던 apiRegisterCoupon이 새 트리거를 만들어
    //    여기서 우연히 삭제할 race window 가 생김. 그래서 release 보다 먼저.
    try {
      removeTriggers_('runCouponBatch');
    } catch (e) {
      // 트리거 삭제 실패는 무시 (다음 등록 시 자동 청소됨)
    }
    lock.releaseLock();
  }

  // 자동 이어실행 예약 (runCouponBatch_ 가 결정한 delay)
  //   - 시간초과 → 1분 (STOPPED_COOLDOWN_MS)
  //   - RATE_LIMITED warn>0 + 재시도 카운터 < MAX → 3분 (RL_COOLDOWN_MS)
  //   - 정상 종료 또는 최종 실패 → null (재예약 안 함)
  // ⚠️ finally 안의 removeTriggers_ 이후에 호출해야 새 트리거가 같이 지워지지 않음
  if (typeof nextDelayMs === 'number' && nextDelayMs > 0) {
    console.log(`[BATCH] ${Math.round(nextDelayMs / 1000)}초 뒤 자동 이어실행 예약`);
    requestBatch_(nextDelayMs);
  }
}

/** 실제 배치 본문 (runCouponBatch 의 Lock 안에서만 호출).
 * @returns {number|null} nextDelayMs — wrapper 가 이 만큼 뒤에 자동 재예약 (null = 안 함) */
function runCouponBatch_() {
  const config = getConfig();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const startTime = Date.now();
  formatLogsTimeColumn_(); // 기존 logs time 도 24시간 형식으로 정리

  const allUsers = readUsers_();
  const allCoupons = readCoupons_();
  const users = allUsers.filter((u) => u.active);

  // 쿠폰 나이 기반 자동 만료(TTL) 사전 정리 — Notify/실행 부담 줄이려 API 호출 전에 분리
  const { coupons, agedOut } = expireAgedCoupons_(allCoupons, config.couponTtlDays);

  if (users.length === 0 || coupons.length === 0) {
    // 첫 운영자 안내: 어느 쪽이 비었는지 명확히 + 다음에 뭘 해야 하는지 안내
    let msg;
    if (coupons.length === 0 && users.length === 0) {
      msg = '실행 대상 없음 — 유저·쿠폰 둘 다 0건. 먼저 유저+쿠폰을 등록하세요.';
    } else if (coupons.length === 0) {
      // 가장 흔한 첫 상황: 유저는 있는데 쿠폰이 없음
      msg =
        `실행 대상 없음 — 활성 유저 ${users.length}명, 활성 쿠폰 0개.\n` +
        `쿠폰을 등록하면 자동으로 배치가 실행됩니다.`;
    } else {
      // users === 0
      msg =
        `실행 대상 없음 — 활성 쿠폰 ${coupons.length}개, 활성 유저 0명.\n` +
        `유저를 추가하거나 👤 users 시트의 active 열을 확인하세요.`;
    }
    ss.toast(msg, '👑 Kingshot Bot', 10);
    return null; // 처리할 게 없으니 이어실행 불필요
  }

  // 시작 전 예상 안내 — 시간 제한 대비 규모를 미리 가늠할 수 있게
  const combos = users.length * coupons.length;
  const estSec = Math.round((combos * config.requestDelayMs) / 1000);
  ss.toast(
    `시작: ${users.length}명 × ${coupons.length}쿠폰 = 최대 ${combos}건, 예상 ~${estSec}s ` +
      `(시간예산 ${Math.round(config.maxRuntimeMs / 1000)}s 초과 시 안전 중단)`,
    '👑 Kingshot Bot',
    6,
  );

  const processed = getProcessedSet_();
  const deadCoupons = new Set(); // 이번 실행에서 만료/무효로 판정된 쿠폰 → 이후 요청 생략
  const stats = { success: 0, already: 0, disabled: agedOut, fail: 0, skip: 0, warn: 0 };
  let stoppedByTime = false;

  // 진단 로그 — 매 배치 시작 시 dedup 정합성 한 줄 기록.
  // 향후 dedup 누수 재발 시 size 추이로 즉시 추적 가능.
  // (users.length !== uniqueFids 면 users 시트에 중복 → Clean Duplicate Users 권장)
  const uniqueFids = new Set(users.map((u) => u.fid)).size;
  logSystem_(
    'INFO',
    'batch-diag',
    `users=${users.length} (unique=${uniqueFids}) coupons=${coupons.length} ` +
      `dedup=${processed.size} expected=${users.length * coupons.length}`,
    '',
  );

  for (const user of users) {
    // 사전 dedup 체크 — 이 유저가 처리할 (안 죽은) 쿠폰이 하나라도 있는지 확인.
    // 모두 처리 완료 상태면 loginPlayer/redeemCoupon 둘 다 호출 안 함.
    // ⚠️ 중요: 이 가드가 없으면 verifyPlayer 가 IP 429 받을 때 dedup 무관하게
    //   RATE_LIMITED row 가 logs 에 쌓여서 "재호출된 것처럼" 보임 (실측 발견 버그).
    const hasWork = coupons.some(
      (c) => !deadCoupons.has(c.code) && !processed.has(`${user.fid}|${c.code}`),
    );
    if (!hasWork) {
      // 죽지 않은 모든 쿠폰이 dedup 에 있음 → 이 유저는 전부 SKIP
      const skipCount = coupons.filter((c) => !deadCoupons.has(c.code)).length;
      stats.skip += skipCount;
      continue;
    }

    // (선택) fid 사전 검증 — 실측 후 불필요하면 Script Property KINGSHOT_VERIFY_PLAYER='false'
    if (config.verifyPlayer) {
      const login = loginPlayer(user.fid);
      if (!login.ok) {
        // 429/5xx 는 일시적이므로 INVALID_FID 가 아니라 RATE_LIMITED 로 남겨 다음 실행에서 재시도
        const result = login.rateLimited ? 'RATE_LIMITED' : 'INVALID_FID';
        let leakDetected = false;
        for (const coupon of coupons) {
          if (deadCoupons.has(coupon.code)) {
            continue;
          }
          // 이중 안전망: 이미 dedup 에 있으면 RATE_LIMITED row 쓰지 않음.
          // (hasWork 체크에서 걸렸어야 하는데 누수 시 여기서 잡힘 — 진단 로그도 남김)
          const dedupKey = `${user.fid}|${coupon.code}`;
          if (processed.has(dedupKey)) {
            leakDetected = true;
            continue;
          }
          appendLog_(user.fid, coupon.code, result, login.message);
          stats.fail++;
        }
        if (leakDetected) {
          logSystem_(
            'WARN',
            'dedup-leak',
            `hasWork 통과한 ${user.fid} 가 verifyPlayer 단계에서 dedup 히트 — hasWork 로직 점검 필요`,
            user.fid,
          );
        }
        if (login.rateLimited) {
          stats.warn++; // 봇/IP 이상 신호
        }
        console.warn(`[${result}] fid=${user.fid} (${login.message})`);
        // RATE_LIMITED 백오프는 그대로(시간 정확성 중요), 정상 delay 만 jitter
        if (login.rateLimited) {
          Utilities.sleep(config.rateLimitCooldownMs);
        } else {
          sleepWithJitter_(config.requestDelayMs);
        }
        continue;
      }
    }

    for (const coupon of coupons) {
      // 이번 실행에서 만료/무효로 판정된 쿠폰은 더 이상 시도하지 않는다
      if (deadCoupons.has(coupon.code)) {
        continue;
      }

      const key = `${user.fid}|${coupon.code}`;
      if (processed.has(key)) {
        stats.skip++;
        console.log(`[SKIP] 이미 처리됨 fid=${user.fid} code=${coupon.code}`);
        continue;
      }

      // 시간 예산 초과 → 안전 중단(이미 처리분은 logs에 있으니 재실행하면 이어서 진행)
      if (Date.now() - startTime > config.maxRuntimeMs) {
        stoppedByTime = true;
        break;
      }

      const result = redeemCouponWithRetry(user.fid, coupon.code);
      appendLog_(user.fid, coupon.code, result.result, result.message);
      processed.add(key);

      if (result.result === 'SUCCESS') {
        stats.success++;
        console.log(`[SUCCESS] fid=${user.fid} code=${coupon.code}`);
      } else if (result.result === 'ALREADY_USED') {
        stats.already++;
        console.log(`[ALREADY] fid=${user.fid} code=${coupon.code}`);
      } else if (result.result === 'EXPIRED' || result.result === 'INVALID_CODE') {
        // 코드 자체 문제(만료/없음) → 이번 실행 이후 요청 생략 + 영구 비활성화 + 죽은 코드 로그 purge
        deadCoupons.add(coupon.code);
        disableCoupon_(coupon.row, result.result);
        const purged = purgeLogsForCode_(coupon.code);
        processed.delete(key); // 방금 메모리에 넣은 키도 로그가 사라졌으니 함께 정리
        stats.disabled++;
        console.warn(
          `[DISABLED] code=${coupon.code} (${result.result}) → enabled=FALSE + 로그 ${purged}건 purge`,
        );
      } else {
        stats.fail++;
        if (
          result.result === 'RATE_LIMITED' ||
          result.result === 'CAPTCHA_REQUIRED' ||
          result.result === 'ERROR'
        ) {
          stats.warn++; // 봇/IP 이상 신호 (만료·잘못된ID 등 데이터 문제와 구분)
        }
        console.warn(
          `[FAILED] fid=${user.fid} code=${coupon.code} → ${result.result}: ${result.message}`,
        );
      }

      sleepWithJitter_(config.requestDelayMs);
    }

    if (stoppedByTime) {
      break;
    }
  }

  const elapsedSec = Math.round((Date.now() - startTime) / 1000);
  const apiCalls = stats.success + stats.already + stats.disabled + stats.fail;
  const avg = apiCalls > 0 ? (elapsedSec / apiCalls).toFixed(1) : '0';
  const summary =
    `성공 ${stats.success} / 이미받음 ${stats.already} / 만료·무효 ${stats.disabled} / ` +
    `실패 ${stats.fail} / 스킵 ${stats.skip}\n` +
    `소요 ${elapsedSec}s (건당 ~${avg}s)`;
  // toast 는 retry 정보가 아직 안 정해진 시점이라 시간초과만 표시
  const toastSummary =
    summary + (stoppedByTime ? ' — ⏱️ 시간초과 중단(1분 뒤 자동 이어실행 예약됨)' : '');
  ss.toast(toastSummary, '👑 Kingshot Bot 완료', 12);
  console.log(`[BATCH DONE] ${summary}`);

  // 마지막 배치 시각 기록 — 관리 UI 의 'lastBatch' 표시용 (시트 안 보고도 신선도 판단)
  const props = PropertiesService.getScriptProperties();
  props.setProperty(
    'LAST_BATCH_AT',
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
  );

  // ── RATE_LIMITED 자동 N차 재시도 결정 ──
  // stats.warn > 0 (= rate limit/오류 감지) 면 3분 cool-down 후 자동 재시도. 최대 3회.
  // 4번째도 실패 시 retry count 리셋 → 사람 개입 신호 (마지막 임베드에 명시).
  // warn === 0 으로 회복했고 카운터 > 0 이면 → 회복 메시지로 카운터 리셋.
  // stoppedByTime 은 별도 1분 cool-down (시간초과는 IP 와 무관) — retry 와 _독립_ 처리.
  const MAX_RL_RETRIES = 3;
  const RL_COOLDOWN_MS = 3 * 60 * 1000;
  const STOPPED_COOLDOWN_MS = 60 * 1000;
  const prevRetry = parseInt(props.getProperty('BATCH_RL_RETRY_COUNT') || '0', 10) || 0;

  // retryStatus: footer 에 들어갈 한 줄 문구 (null 이면 추가 표시 X)
  let retryStatus = null;
  let nextDelayMs = null;
  if (stoppedByTime) {
    // 시간초과 → 무조건 1분 후 이어실행 (warn 여부 무관)
    nextDelayMs = STOPPED_COOLDOWN_MS;
  } else if (stats.warn > 0) {
    if (prevRetry < MAX_RL_RETRIES) {
      const nextCount = prevRetry + 1;
      props.setProperty('BATCH_RL_RETRY_COUNT', String(nextCount));
      nextDelayMs = RL_COOLDOWN_MS;
      retryStatus = nt('rs_retry', {
        n: nextCount,
        max: MAX_RL_RETRIES,
        min: Math.round(RL_COOLDOWN_MS / 60000),
      });
    } else {
      // 최종 실패 — 더 이상 재시도 안 함, 카운터 리셋, 사람 개입 신호
      props.deleteProperty('BATCH_RL_RETRY_COUNT');
      retryStatus = nt('rs_blocked', { n: MAX_RL_RETRIES, x: stats.warn });
    }
  } else if (prevRetry > 0) {
    // 회복! 카운터 리셋 + 회복 메시지
    props.deleteProperty('BATCH_RL_RETRY_COUNT');
    retryStatus = nt('rs_recovered', { n: prevRetry });
  }

  // Slack 알림 (임베드 빌더는 Notify.js)
  const batchEmbed = buildBatchEmbed_(stats, {
    userCount: users.length,
    couponCount: coupons.length,
    elapsedSec,
    avg,
    stoppedByTime,
    retryStatus,
  });
  notify_(batchEmbed, 'batch', 'batch');

  // wrapper 가 이 값으로 자동 이어실행 여부 결정 (null = 이어실행 X)
  return nextDelayMs;
}

/**
 * 쿠폰 나이 기반 자동 만료(TTL): created + TTL일 < now 인 enabled 쿠폰을 API 호출 전에 비활성화.
 * @returns {{coupons:Array, agedOut:number}} 살아남은 enabled 쿠폰 + 만료된 개수
 */
function expireAgedCoupons_(allCoupons, ttlDays) {
  const nowMs = Date.now();
  const ttlMs = ttlDays * 86400000;
  const alive = [];
  let agedOut = 0;
  for (const c of allCoupons) {
    if (!c.enabled) {
      continue;
    }
    const aged = ttlDays > 0 && c.created instanceof Date && nowMs - c.created.getTime() > ttlMs;
    if (aged) {
      disableCoupon_(c.row, 'EXPIRED_AGE');
      purgeLogsForCode_(c.code);
      agedOut++;
      console.warn(`[EXPIRED_AGE] code=${c.code} (등록 ${ttlDays}일 초과 → 자동 비활성화)`);
    } else {
      alive.push(c);
    }
  }
  return { coupons: alive, agedOut };
}

// ============================================================
// 단일 테스트 (실측용)
// ============================================================

/**
 * prompt 로 fid/code 를 입력받아 1건만 등록한다.
 * salt / sign / 플로우 검증에 사용.
 */
function testSingleCoupon() {
  const ui = SpreadsheetApp.getUi();

  const fidRes = ui.prompt(
    'Kingshot 단일 테스트',
    '유저 fid 를 입력하세요:',
    ui.ButtonSet.OK_CANCEL,
  );
  if (fidRes.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  const fid = fidRes.getResponseText().trim();

  const codeRes = ui.prompt(
    'Kingshot 단일 테스트',
    '쿠폰 코드를 입력하세요:',
    ui.ButtonSet.OK_CANCEL,
  );
  if (codeRes.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  const code = codeRes.getResponseText().trim();

  if (!fid || !code) {
    ui.alert('fid 와 쿠폰 코드를 모두 입력해야 합니다.');
    return;
  }

  const result = redeemCouponWithRetry(fid, code);
  appendLog_(fid, code, result.result, result.message);

  ui.alert(
    '테스트 결과',
    `fid: ${fid}\ncode: ${code}\n결과: ${result.result}\n메시지: ${result.message}`,
    ui.ButtonSet.OK,
  );
}

// ============================================================
// 시트 초기화
// ============================================================

/**
 * users / coupons / logs 시트를 헤더와 함께 생성한다.
 * 이미 존재하는 시트는 건드리지 않는다.
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // insertSheet() 가 새 시트를 자동 활성화하기 때문에, 가이드 보던 중 클릭한 사용자가
  // 마지막에 만들어진 시트(예: system_logs) 로 튕겨가는 UX 문제 방지.
  // 이전 활성 시트를 캡쳐했다가 작업 후 복원.
  const prevActive = ss.getActiveSheet();
  const created = setupSheetsSilently_();
  const msg = created.length
    ? `생성된 시트: ${created.join(', ')}`
    : '모든 시트가 이미 존재합니다.';
  if (created.length) {
    logSystem_('INFO', 'sheet-setup', `sheets created: ${created.join(',')}`, '');
  }
  if (prevActive) {
    prevActive.activate();
  }
  ss.toast(msg, 'Setup Sheets', 5);
}

/**
 * 📖 시작하기 가이드 시트를 생성한다 — **배포자가 템플릿 공유 전 1회 실행**.
 *
 * 워크플로:
 *   1) 배포자가 빈 시트 만든 뒤 clasp push → 메뉴 노출
 *   2) [🚀 Setup ▸ 📖 시작하기 시트 생성] 클릭 → leftmost 위치에 가이드 생성
 *   3) (선택) Setup Sheets 도 실행해 시트 4개 미리 채워두기
 *   4) 가이드 탭을 활성 상태로 둔 채 멤버에게 시트 공유/카피 허용
 *   5) 멤버는 카피한 시트 열면 가이드 탭이 자동 활성 → 안내 따라 진행
 *
 * 이미 가이드가 있으면 덮어쓰지 않고 토스트만 표시 (실수 클릭 보호).
 */
function createGuideSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(GUIDE_SHEET_NAME)) {
    ss.toast(`'${GUIDE_SHEET_NAME}' 시트가 이미 존재합니다.`, '📖 시작하기', 5);
    return;
  }
  // 생성 직후 활성화 → 배포자가 공유 직전 마지막 상태로 두기 좋음
  writeGuideSheet_(ss).activate();
  logSystem_('INFO', 'guide-create', `'${GUIDE_SHEET_NAME}' sheet created`, '');
  ss.toast(
    `'${GUIDE_SHEET_NAME}' 시트를 생성했습니다.\n` +
      `이 탭을 활성 상태로 둔 뒤 시트를 공유/카피 허용하면 멤버가 자동으로 봅니다.`,
    '📖 시작하기 — 생성 완료',
    8,
  );
}

/**
 * coupons 시트에서 status 가 EXPIRED / INVALID_CODE 인 (죽은) 코드들의 로그를 일괄 정리한다.
 * 배치 중 자동 purge 외에, 수동으로도 청소할 수 있게 하는 메뉴.
 */
function cleanExpiredLogs() {
  const ui = SpreadsheetApp.getUi();
  const deadStatuses = ['EXPIRED', 'INVALID_CODE'];

  const deadCodes = readCoupons_()
    .filter((c) => deadStatuses.includes(String(c.status).toUpperCase()))
    .map((c) => c.code);

  if (deadCodes.length === 0) {
    ui.alert(
      '정리 대상 없음',
      'coupons 시트에 status 가 EXPIRED/INVALID_CODE 인 코드가 없습니다.',
      ui.ButtonSet.OK,
    );
    return;
  }

  let total = 0;
  for (const code of deadCodes) {
    total += purgeLogsForCode_(code);
  }

  logSystem_(
    'INFO',
    'log-cleanup',
    `manual purge — ${deadCodes.length} dead codes / ${total} log rows removed`,
    deadCodes.join(','),
  );
  ui.alert(
    'Clean Expired Logs',
    `죽은 코드 ${deadCodes.length}개의 로그 ${total}건을 정리했습니다.\n코드: ${deadCodes.join(', ')}`,
    ui.ButtonSet.OK,
  );
}

/**
 * 메뉴: 존재하지 않는(오타) 코드 정리 — coupons 시트의 INVALID_CODE 행 삭제(+로그 정리).
 * EXPIRED 는 건드리지 않음(이력 보존). 소스에 남아있는 오타는 다음 동기화에 재검증될 수 있음.
 */
function cleanInvalidCoupons() {
  const ui = SpreadsheetApp.getUi();
  const res = purgeInvalidCoupons_();
  if (res.coupons === 0) {
    ui.alert(
      '🗑 오타 코드 정리',
      '정리할 INVALID(존재하지 않는) 코드가 없습니다.',
      ui.ButtonSet.OK,
    );
    return;
  }
  logSystem_(
    'INFO',
    'coupon-clean-invalid',
    `manual via menu — INVALID ${res.coupons}건 삭제 (${res.codes.join(', ')}), logs ${res.logs}건`,
    res.codes.join(','),
  );
  ui.alert(
    '🗑 오타 코드 정리',
    `존재하지 않는 코드 ${res.coupons}건 삭제\n🧹 관련 logs ${res.logs}건 정리\n코드: ${res.codes.join(', ')}\n\n` +
      `⚠️ 소스에 아직 있는 코드는 다음 동기화 때 1회 재검증 후 재생성될 수 있습니다(UI 엔 숨김).`,
    ui.ButtonSet.OK,
  );
}

/**
 * system_logs 시트에 1줄 기록 (없으면 자동 생성, 1000행 초과 시 오래된 100행 자동 회전).
 * 진단용 — Apps Script Executions 안 열고 시트에서 바로 확인 가능. 로깅 실패는 조용히 무시.
 */
function logSystem_(level, source, msg, target) {
  try {
    const config = getConfig();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = getSheet_('systemLogs'); // 구버전 이름 자동 마이그레이션 포함
    if (!sheet) {
      sheet = ss.insertSheet(config.sheets.systemLogs);
      sheet
        .getRange(1, 1, 1, 5)
        .setValues([['time', 'level', 'source', 'message', 'target']])
        .setFontWeight('bold')
        .setBackground('#f0f0f0');
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([new Date(), level, source, String(msg).slice(0, 1000), target || '']);
    sheet.getRange(sheet.getLastRow(), COL.systemLogs.time).setNumberFormat(DATE_NUMBER_FORMAT);
    if (sheet.getLastRow() > 1001) {
      sheet.deleteRows(2, 100); // 오래된 100행 회전
    }
  } catch (e) {
    // 로깅 실패는 조용히 무시
  }
}

/** system_logs 시트의 데이터 행을 모두 삭제 (헤더 유지) */
function clearSystemLogs() {
  const ui = SpreadsheetApp.getUi();
  const sheet = getSheet_('systemLogs');
  if (!sheet) {
    ui.alert(`'${getConfig().sheets.systemLogs}' 시트가 없습니다.`);
    return;
  }
  const last = sheet.getLastRow();
  if (last < 2) {
    ui.alert('system_logs 가 비어있습니다.');
    return;
  }
  const ans = ui.alert(
    'Clear System Logs',
    `system_logs ${last - 1}건을 모두 삭제할까요?`,
    ui.ButtonSet.YES_NO,
  );
  if (ans !== ui.Button.YES) {
    return;
  }
  const cleared = last - 1;
  sheet.deleteRows(2, cleared);
  // 청소 후 첫 한 줄은 본 액션의 audit — system_logs 가 비어있어도 누가 언제 비웠는지 흔적 남김
  logSystem_('INFO', 'sysl-clear', `system_logs cleared by admin — ${cleared} rows removed`, '');
  ui.alert('✅ system_logs 청소 완료');
}

/**
 * users 시트에서 fid 중복 row 찾아 _뒷_ row 삭제 (첫 등장만 보존).
 * 직접 sheet paste 등으로 같은 fid 가 두 번 들어간 케이스 정리용.
 * 메뉴: 🛠 관리 ▸ Clean Duplicate Users.
 */
function cleanDuplicateUsers() {
  const ui = SpreadsheetApp.getUi();
  const sheet = requireSheet_('users');
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    ui.alert('users 시트가 비어있습니다.');
    return;
  }

  const fidIdx = COL.users.fid - 1;
  const seen = new Set();
  const dupes = []; // 1-based row numbers
  for (let i = 1; i < values.length; i++) {
    const fid = String(values[i][fidIdx]).trim();
    if (!fid) {
      continue;
    }
    if (seen.has(fid)) {
      dupes.push({ row: i + 1, fid, nickname: values[i][COL.users.nickname - 1] });
    } else {
      seen.add(fid);
    }
  }

  if (dupes.length === 0) {
    ui.alert('중복 없음', `users 시트 OK — unique fid ${seen.size}개, 중복 0건.`, ui.ButtonSet.OK);
    return;
  }

  const preview = dupes
    .slice(0, 5)
    .map((d) => `  row ${d.row}: ${d.fid} (${d.nickname || '-'})`)
    .join('\n');
  const confirm = ui.alert(
    '중복 발견',
    `중복 fid ${dupes.length}건 발견 — 뒷 row 삭제 (첫 등장 보존)?\n\n` +
      preview +
      (dupes.length > 5 ? `\n  ... 총 ${dupes.length}건` : ''),
    ui.ButtonSet.YES_NO,
  );
  if (confirm !== ui.Button.YES) {
    return;
  }

  // 뒤에서부터 삭제 (인덱스 안 꼬임)
  for (let i = dupes.length - 1; i >= 0; i--) {
    sheet.deleteRow(dupes[i].row);
  }
  logSystem_(
    'INFO',
    'cleanup',
    `removed ${dupes.length} duplicate user rows`,
    dupes.map((d) => d.fid).join(','),
  );
  ui.alert(
    '✅ 정리 완료',
    `중복 ${dupes.length}건 삭제됨. 현재 유저: ${seen.size}명 (unique).`,
    ui.ButtonSet.OK,
  );
}

/**
 * Dedup 누수 진단: 활성 유저 × 활성 쿠폰 조합 중 dedup 에 _누락_ 된 것 찾기.
 *
 * 현재 getProcessedSet_ 의 strict 매칭 vs 다음 3개 loose 변형을 비교:
 *   - case-insensitive (result 'success'/'already_used' 도 통과)
 *   - whitespace-tolerant (fid/code 양쪽 trim 강화)
 *   - type-coerce (Number/String 양쪽 시도)
 *
 * loose 가 더 많이 찾으면 → 데이터 형식 이슈가 원인.
 * loose 도 못 찾으면 → 진짜로 logs 시트에 entry 가 _없는_ 것.
 *
 * 결과는 alert + console.log + system_logs 셋 다 기록.
 */
function diagnoseDedup() {
  const ui = SpreadsheetApp.getUi();
  const logsSheet = getSheet_('logs');
  if (!logsSheet) {
    ui.alert('logs 시트 없음');
    return;
  }

  const fidIdx = COL.logs.fid - 1;
  const codeIdx = COL.logs.code - 1;
  const resultIdx = COL.logs.result - 1;
  const values = logsSheet.getDataRange().getValues();
  const totalLogRows = values.length - 1;

  // 1) strict — getProcessedSet_ 과 동일
  const strictSet = new Set();
  // 2) caseLoose — result 대소문자 무시
  const caseLooseSet = new Set();
  // 3) trimLoose — fid/code 더 적극 normalize (공백/제어문자)
  const trimLooseSet = new Set();
  // 4) typeLoose — fid Number → String 양방향
  const typeLooseSet = new Set();

  const SUCCESS_LIKE_STRICT = ['SUCCESS', 'ALREADY_USED'];
  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/[\s​‌‍﻿]/g, '')
      .trim();

  for (let i = 1; i < values.length; i++) {
    const rawResult = values[i][resultIdx];
    const rawFid = values[i][fidIdx];
    const rawCode = values[i][codeIdx];

    const resultStr = String(rawResult || '').trim();
    const resultUpper = resultStr.toUpperCase();

    if (SUCCESS_LIKE_STRICT.indexOf(resultStr) >= 0) {
      strictSet.add(`${String(rawFid).trim()}|${String(rawCode).trim()}`);
    }
    if (resultUpper === 'SUCCESS' || resultUpper === 'ALREADY_USED') {
      caseLooseSet.add(`${String(rawFid).trim()}|${String(rawCode).trim()}`);
      trimLooseSet.add(`${norm(rawFid)}|${norm(rawCode)}`);
      // type-coerce
      typeLooseSet.add(`${Number(rawFid)}|${String(rawCode).trim()}`);
      typeLooseSet.add(`${String(rawFid).trim()}|${String(rawCode).trim()}`);
    }
  }

  // 활성 유저 × 활성 쿠폰 조합
  const users = readUsers_().filter((u) => u.active);
  const coupons = readCoupons_().filter((c) => c.enabled);

  const missingStrict = [];
  const missingCase = [];
  const missingTrim = [];
  const missingType = [];

  for (const user of users) {
    for (const coupon of coupons) {
      const key = `${user.fid}|${coupon.code}`;
      const keyTrim = `${norm(user.fid)}|${norm(coupon.code)}`;
      const keyTypeNum = `${Number(user.fid)}|${coupon.code}`;
      if (!strictSet.has(key)) {
        missingStrict.push(key);
      }
      if (!caseLooseSet.has(key)) {
        missingCase.push(key);
      }
      if (!trimLooseSet.has(keyTrim)) {
        missingTrim.push(keyTrim);
      }
      if (!typeLooseSet.has(key) && !typeLooseSet.has(keyTypeNum)) {
        missingType.push(key);
      }
    }
  }

  // 결과 — 누락이 strict 보다 적은 변형이 있으면 그 normalize 가 답
  const sampleMissing = missingStrict.slice(0, 8);
  const recoveredByCase = missingStrict.length - missingCase.length;
  const recoveredByTrim = missingStrict.length - missingTrim.length;
  const recoveredByType = missingStrict.length - missingType.length;

  const msg =
    `=== Dedup 진단 ===\n\n` +
    `logs 데이터 행: ${totalLogRows}\n` +
    `활성 유저: ${users.length}, 활성 쿠폰: ${coupons.length}\n` +
    `예상 조합: ${users.length * coupons.length}\n\n` +
    `── dedup 셋 크기 (변형별) ──\n` +
    `strict (현재):     ${strictSet.size}\n` +
    `case-loose:        ${caseLooseSet.size}\n` +
    `trim-loose:        ${trimLooseSet.size}\n` +
    `type-loose:        ${typeLooseSet.size}\n\n` +
    `── 누락 조합 수 (변형별) ──\n` +
    `strict:            ${missingStrict.length}\n` +
    `case-loose:        ${missingCase.length}   (회복: ${recoveredByCase})\n` +
    `trim-loose:        ${missingTrim.length}   (회복: ${recoveredByTrim})\n` +
    `type-loose:        ${missingType.length}   (회복: ${recoveredByType})\n\n` +
    `누락 샘플 (strict, 최대 8):\n` +
    (sampleMissing.length ? sampleMissing.join('\n') : '(없음 — dedup 완벽)');

  console.log(msg);
  logSystem_(
    'INFO',
    'diag-dedup',
    `strict=${strictSet.size} case=${caseLooseSet.size} trim=${trimLooseSet.size} type=${typeLooseSet.size} missing-strict=${missingStrict.length}`,
    '',
  );
  ui.alert('Dedup 진단', msg, ui.ButtonSet.OK);
}

// ============================================================
// 시트 읽기 / 쓰기 헬퍼
// ============================================================

/** users 시트 → [{fid, nickname, active, created}] */
function readUsers_() {
  const sheet = requireSheet_('users');
  return sheet
    .getDataRange()
    .getValues()
    .slice(1) // 헤더 제외
    .filter((r) => r[COL.users.fid - 1] !== '' && r[COL.users.fid - 1] !== null)
    .map((r) => ({
      fid: String(r[COL.users.fid - 1]).trim(),
      nickname: r[COL.users.nickname - 1],
      active: isTrue_(r[COL.users.active - 1]),
      created: r[COL.users.created - 1] instanceof Date ? r[COL.users.created - 1] : null,
    }));
}

/** coupons 시트 → [{code, enabled, status, created, row}] (row 는 write-back 용 1-based) */
function readCoupons_() {
  const sheet = requireSheet_('coupons');
  const values = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const code = values[i][COL.coupons.code - 1];
    if (code === '' || code === null) {
      continue;
    }
    out.push({
      code: String(code).trim(),
      enabled: isTrue_(values[i][COL.coupons.enabled - 1]),
      status: values[i][COL.coupons.status - 1]
        ? String(values[i][COL.coupons.status - 1]).trim()
        : '',
      created:
        values[i][COL.coupons.created - 1] instanceof Date
          ? values[i][COL.coupons.created - 1]
          : null,
      row: i + 1, // values 인덱스 i → 시트 행번호 i+1
    });
  }
  return out;
}

/**
 * 활성(enabled=TRUE) 쿠폰이 1개라도 있는지 빠르게 확인.
 * apiRegisterUser 가 무의미한 배치 예약을 피하는 데 사용 — 쿠폰 없으면 배치 의미 X.
 */
function hasActiveCoupons_() {
  return readCoupons_().some((c) => c.enabled);
}

/** 만료/무효 쿠폰을 영구 비활성화: enabled=FALSE, status=사유, updated=now */
function disableCoupon_(couponRow, statusText) {
  const sheet = getSheet_('coupons');
  if (!sheet) {
    return;
  }
  sheet.getRange(couponRow, COL.coupons.enabled).setValue(false);
  sheet.getRange(couponRow, COL.coupons.status).setValue(statusText);
  stampDate_(sheet, couponRow, COL.coupons.updated, new Date());
}

/**
 * 특정 코드의 logs 행을 전부 제거한다(만료/무효 코드 정리).
 * dedup 안전: 죽은 코드는 다시 요청되지 않으므로 그 로그는 더 이상 필요 없음.
 * 삭제는 deleteRow 반복(느림·인덱스 꼬임) 대신 "해당 코드만 빼고 한 번에 다시 쓰기"로 처리.
 * @returns {number} 제거된 행 수
 */
function purgeLogsForCode_(code) {
  const sheet = getSheet_('logs');
  if (!sheet) {
    return 0;
  }
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return 0;
  }

  const target = String(code).trim();
  const codeIdx = COL.logs.code - 1;
  const kept = [values[0]]; // 헤더 유지
  let removed = 0;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][codeIdx]).trim() === target) {
      removed++;
    } else {
      kept.push(values[i]);
    }
  }

  if (removed === 0) {
    return 0;
  }
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, values[0].length).setValues(kept);
  return removed;
}

/**
 * coupons 시트에서 status 가 INVALID_CODE 인 (존재하지 않는 = 오타) 행을 전부 제거한다.
 * EXPIRED/EXPIRED_AGE 는 보존 — 한때 유효했던 이력이라 UI 에도 계속 노출. INVALID_CODE 만 대상.
 * 각 코드의 logs 행도 함께 정리. clearContents+setValues 패턴(인덱스 안 꼬임).
 * ⚠️ 소스에 아직 남아있는 오타는 다음 동기화 때 1회 재검증 후 재생성될 수 있음(단 UI 엔 숨김).
 * @returns {{coupons:number, logs:number, codes:string[]}}
 */
function purgeInvalidCoupons_() {
  const sheet = getSheet_('coupons');
  if (!sheet) {
    return { coupons: 0, logs: 0, codes: [] };
  }
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return { coupons: 0, logs: 0, codes: [] };
  }
  const codeIdx = COL.coupons.code - 1;
  const statusIdx = COL.coupons.status - 1;
  const kept = [values[0]]; // 헤더 유지
  const removedCodes = [];
  for (let i = 1; i < values.length; i++) {
    const code = values[i][codeIdx];
    const status = String(values[i][statusIdx] || '')
      .trim()
      .toUpperCase();
    if (code !== '' && code !== null && status === 'INVALID_CODE') {
      removedCodes.push(String(code).trim());
    } else {
      kept.push(values[i]); // INVALID 아닌 행(빈 행 포함)은 그대로 보존
    }
  }
  if (removedCodes.length === 0) {
    return { coupons: 0, logs: 0, codes: [] };
  }
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, values[0].length).setValues(kept);

  let logsRemoved = 0;
  for (const code of removedCodes) {
    logsRemoved += purgeLogsForCode_(code);
  }
  return { coupons: removedCodes.length, logs: logsRemoved, codes: removedCodes };
}

/**
 * 특정 fid 의 logs 행을 전부 제거한다 (유저 삭제 시 호출).
 * dedup 영향: 삭제된 유저는 batch 대상이 아니므로 dedup 손실 영향 없음.
 *   같은 fid 재등록 시: 첫 배치에서 API 가 ALREADY_USED 응답 → dedup 자동 복구 (일회성 비용).
 * 구현은 purgeLogsForCode_ 와 동일 패턴 (clearContents + 일괄 setValues).
 * @returns {number} 제거된 행 수
 */
function purgeLogsForUser_(fid) {
  const target = String(fid || '').trim();
  if (!target) {
    return 0; // 빈 fid 방어 — empty trim 이 가짜 매칭(빈 셀) 유발 못하게
  }
  const sheet = getSheet_('logs');
  if (!sheet) {
    return 0;
  }
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return 0;
  }

  const fidIdx = COL.logs.fid - 1;
  const kept = [values[0]];
  let removed = 0;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][fidIdx]).trim() === target) {
      removed++;
    } else {
      kept.push(values[i]);
    }
  }

  if (removed === 0) {
    return 0;
  }
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, values[0].length).setValues(kept);
  return removed;
}

/** logs 에서 이미 성공/이미받음 처리된 'fid|code' Set 반환 (중복 요청 방지) */
function getProcessedSet_() {
  const sheet = getSheet_('logs');
  const set = new Set();
  if (!sheet) {
    return set;
  }
  const values = sheet.getDataRange().getValues();
  const fidIdx = COL.logs.fid - 1;
  const codeIdx = COL.logs.code - 1;
  const resultIdx = COL.logs.result - 1;
  for (let i = 1; i < values.length; i++) {
    const result = values[i][resultIdx];
    if (result === 'SUCCESS' || result === 'ALREADY_USED') {
      set.add(`${String(values[i][fidIdx]).trim()}|${String(values[i][codeIdx]).trim()}`);
    }
  }
  return set;
}

/**
 * logs 시트 — 3중 정리 메커니즘으로 무한 누적 방지:
 *   1) **쿠폰 단위 자동 purge** — 배치 중 EXPIRED/INVALID_CODE 판정 → purgeLogsForCode_
 *   2) **유저 단위 자동 purge** — deleteUser/apiDeleteUser → purgeLogsForUser_
 *   3) **노이즈 안전망 회전** — 5001행 초과 시 rotateNoiseLogs_ (SUCCESS/ALREADY_USED 보존)
 *
 * 3번이 _SUCCESS 보존_ 인 이유: dedup 진실 보호 → 영원 쿠폰 운영자가 cap 트리거 시
 * "다음 배치에서 100명 재시도 → API ALREADY_USED 응답 → 새 SUCCESS 행 추가" 루프 회피.
 */
function appendLog_(fid, code, result, message) {
  const sheet = requireSheet_('logs');
  sheet.appendRow([new Date(), fid, code, result, message]);
  sheet.getRange(sheet.getLastRow(), COL.logs.time).setNumberFormat(DATE_NUMBER_FORMAT);
  if (sheet.getLastRow() > 5001) {
    rotateNoiseLogs_(sheet);
  }
}

/**
 * logs 시트 안전망 회전 (5001행 초과 시 appendLog_ 가 호출).
 *   - SUCCESS / ALREADY_USED 는 dedup 의 진실 — 절대 보존
 *   - 그 외 (RATE_LIMITED · ERROR · CAPTCHA_REQUIRED · INVALID_FID · FAILED · EXPIRED_AGE 등)
 *     중 가장 오래된 최대 100행 회전
 *   - 보존 대상만 남은 극단 케이스(영원 쿠폰 × 다수 SUCCESS): no-op (시트는 자라되 API 낭비 0)
 *   - 회전 시 system_logs 에 audit 한 줄 → 운영자가 빈도 모니터링 가능
 */
function rotateNoiseLogs_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return;
  }
  const resultIdx = COL.logs.result - 1;
  const PRESERVE = new Set(['SUCCESS', 'ALREADY_USED']);

  // 가장 오래된 최대 100행 노이즈 인덱스 수집
  const toRemove = new Set();
  for (let i = 1; i < values.length && toRemove.size < 100; i++) {
    const r = String(values[i][resultIdx]).trim().toUpperCase();
    if (!PRESERVE.has(r)) {
      toRemove.add(i);
    }
  }
  if (toRemove.size === 0) {
    return; // 모두 SUCCESS/ALREADY_USED — no-op (예상 가능한 극단 케이스)
  }

  // purgeLogsForCode_ 와 동일 패턴: clearContents + 일괄 setValues (deleteRow N회 회피)
  const kept = [values[0]];
  for (let i = 1; i < values.length; i++) {
    if (!toRemove.has(i)) {
      kept.push(values[i]);
    }
  }
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, values[0].length).setValues(kept);

  logSystem_(
    'INFO',
    'logs-rotation',
    `rotated ${toRemove.size} noise rows (cap=5000, preserve SUCCESS/ALREADY_USED)`,
    '',
  );
}

/** logs 시트의 time 컬럼 전체를 24시간 형식으로 (기존 행 포함) */
function formatLogsTimeColumn_() {
  const sheet = getSheet_('logs');
  if (!sheet) {
    return;
  }
  const last = sheet.getLastRow();
  if (last >= 2) {
    sheet.getRange(2, COL.logs.time, last - 1, 1).setNumberFormat(DATE_NUMBER_FORMAT);
  }
}

/** TRUE / true / 불리언 true 를 모두 참으로 인식 */
function isTrue_(value) {
  if (value === true) {
    return true;
  }
  const v = String(value).trim().toUpperCase();
  return v === 'TRUE' || v === 'Y' || v === 'YES' || v === '1';
}

/**
 * 베이스 ms 에 jitter 를 더해 Utilities.sleep 호출.
 * 호출 간격 패턴(정확히 2.5초마다)을 흐려 anti-bot 패턴 탐지 회피용.
 *   - 분포: [baseMs - 500, baseMs + 1500) 범위 균등 분포
 *   - 안전 최소 500ms (sleep 0 또는 음수 방지)
 *   - 예: base 2500 → 2000~4000ms (평균 ~2750ms)
 * IP 자체 차단(블랙리스트)은 못 풀지만, 패턴 탐지 요인은 줄임.
 */
function sleepWithJitter_(baseMs) {
  const jitter = Math.floor(Math.random() * 2000) - 500; // [-500, +1499]
  const ms = Math.max(500, baseMs + jitter);
  Utilities.sleep(ms);
}

// ============================================================
// 유저 관리 (메뉴: 비활성화 / 삭제) — 시트 편집권한자(관리자)만 메뉴 사용 가능
// ============================================================

/** fid 를 입력받아 active=FALSE 로 (배치에서 제외, 행은 유지) */
function deactivateUser() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('유저 비활성화', '비활성화할 fid 를 입력하세요:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  const fid = res.getResponseText().trim();
  const user = findUser_(fid);
  if (!user) {
    ui.alert(`fid ${fid} 를 users 시트에서 찾을 수 없습니다.`);
    return;
  }
  const nick = user.nickname || '(닉네임 없음)';
  requireSheet_('users').getRange(user.row, COL.users.active).setValue(false);
  logSystem_('INFO', 'user-deactivate', `manual via menu — nick:${nick}`, fid);
  ui.alert(`✅ 비활성화: ${nick} (fid ${fid}) — 배치에서 제외됩니다.`);
}

/** fid 를 입력받아 users 행을 삭제 (확인 후) */
function deleteUser() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('유저 삭제', '삭제할 fid 를 입력하세요:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  const fid = res.getResponseText().trim();
  const user = findUser_(fid);
  if (!user) {
    ui.alert(`fid ${fid} 를 users 시트에서 찾을 수 없습니다.`);
    return;
  }
  // 시트 메뉴는 편집권한자(관리자)만 쓰므로 비밀번호 없이 확인만
  const confirm = ui.alert(
    '삭제 확인',
    `${user.nickname || '(닉네임 없음)'} (fid ${fid}) 행을 삭제할까요?`,
    ui.ButtonSet.YES_NO,
  );
  if (confirm !== ui.Button.YES) {
    return;
  }
  const nick = user.nickname || '(닉네임 없음)';
  const before = countUsers_();
  requireSheet_('users').deleteRow(user.row);
  const purgedLogs = purgeLogsForUser_(fid);
  const after = countUsers_();
  logSystem_(
    'INFO',
    'user-delete',
    `manual via menu — nick:${nick} (${before} → ${after}), logs purged:${purgedLogs}`,
    fid,
  );
  ui.alert(
    `🗑️ 삭제 완료: ${nick} (fid ${fid}) — ${before} → ${after}명\n` +
      `🧹 logs 행 ${purgedLogs}건 같이 정리됨`,
  );
}

// ============================================================
// 등록 헬퍼 (웹앱 등록에서 사용)
// ============================================================

/** users 시트에서 fid 검색 → {nickname, row, active} 또는 null */
function findUser_(fid) {
  const sheet = getSheet_('users');
  if (!sheet) {
    return null;
  }
  const values = sheet.getDataRange().getValues();
  const target = String(fid).trim();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][COL.users.fid - 1]).trim() === target) {
      return {
        nickname: values[i][COL.users.nickname - 1],
        row: i + 1,
        active: isTrue_(values[i][COL.users.active - 1]),
      };
    }
  }
  return null;
}

// created/updated 셀 표시 형식 (24시간, 오전/오후 없이)
const DATE_NUMBER_FORMAT = 'yyyy-mm-dd hh:mm:ss';

/** 날짜 값을 셀에 쓰고 표시 형식을 24시간으로 지정 */
function stampDate_(sheet, row, col, value) {
  sheet.getRange(row, col).setValue(value).setNumberFormat(DATE_NUMBER_FORMAT);
}

/**
 * users/coupons 시트의 created/updated 컬럼 (4,5번째) 전체를 24시간 날짜 형식으로 통일.
 * 기존 행 포함 self-healing — 시트가 자동 포맷 잃어버려도 매 append 시 복구됨.
 *
 * ⚠️ Invariant: users.created === coupons.created === 4, users.updated === coupons.updated === 5.
 *    스키마 분기 (예: coupons.created 위치 변경) 시 이 함수도 시트별 분기 필요.
 *    (현재 COL 정의에서 단언 가능)
 */
function formatDateColumns_(sheet) {
  const last = sheet.getLastRow();
  if (last >= 2) {
    sheet.getRange(2, COL.users.created, last - 1, 2).setNumberFormat(DATE_NUMBER_FORMAT);
  }
}

/** users 시트에 추가: [fid, nickname, TRUE, created, updated] (등록 시 active 자동 TRUE) */
function addUserToSheet_(fid, nickname) {
  const sheet = requireSheet_('users');
  const now = new Date();
  sheet.appendRow([String(fid).trim(), nickname || '', true, now, now]);
  formatDateColumns_(sheet);
}

/** 현재 등록된 유저 수(데이터 행) */
function countUsers_() {
  return readUsers_().length;
}

/** coupons 시트에서 code 검색 → {row, enabled, status} 또는 null */
function findCoupon_(code) {
  const sheet = getSheet_('coupons');
  if (!sheet) {
    return null;
  }
  const values = sheet.getDataRange().getValues();
  const target = String(code).trim();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][COL.coupons.code - 1]).trim() === target) {
      return {
        row: i + 1,
        enabled: isTrue_(values[i][COL.coupons.enabled - 1]),
        status: values[i][COL.coupons.status - 1]
          ? String(values[i][COL.coupons.status - 1]).trim()
          : '',
      };
    }
  }
  return null;
}

/**
 * coupons 시트에 추가: [code, enabled, status, created, updated]
 * @param {string} code
 * @param {string} status  VALID/PENDING(살아있는 코드) | EXPIRED/INVALID_CODE(죽은 코드, 캐시용)
 * @param {boolean} [enabled=true]  죽은 코드는 false 로 호출 → 배치에서 무시되되 findCoupon_ 캐시 히트로 재시도 차단
 */
function addCouponToSheet_(code, status, enabled) {
  const sheet = requireSheet_('coupons');
  const now = new Date();
  const isEnabled = enabled === undefined ? true : !!enabled;
  sheet.appendRow([String(code).trim(), isEnabled, status || '', now, now]);
  formatDateColumns_(sheet);
}

/** 쿠폰 검증에 쓸 fid: 설정값(KINGSHOT_VALIDATE_FID) 우선, 없으면 첫 active 유저 */
function getValidateFid_() {
  const config = getConfig();
  if (config.validateFid) {
    return String(config.validateFid).trim();
  }
  const active = readUsers_().filter((u) => u.active);
  return active.length ? active[0].fid : '';
}

// ============================================================
// TODO (향후 개선)
// ============================================================
// TODO: 관리자 권한 분리 (Session.getEffectiveUser 기반)
// (DONE: 자동 쿠폰 동기화(커뮤니티 소스 kingshotdata.kr) — Sync.js, 옵션 레이어/기본 OFF)
// (DONE: Telegram → Slack 단일 채널로 정착)
// (DONE: 대량 처리 자동 이어실행 — stoppedByTime 후 자동 재예약 + RATE_LIMITED 자동 N차 재시도)
