/* global getConfig, loginPlayer, redeemCouponWithRetry, notifyDiscord_, requestBatch_ */

/**
 * Kingshot Coupon - 엔트리 / 메뉴 / 배치 / 시트 I/O
 *
 * 시트 구조:
 *   users   : fid | nickname | active
 *   coupons : code | enabled | status   (status 는 배치가 자동 관리: EXPIRED/INVALID 등)
 *   logs    : time | fid | code | result | message
 *
 * 쿠폰 만료 처리: 배치 중 EXPIRED(기간만료) 또는 INVALID_CODE(코드없음) 응답을 받으면
 * 해당 쿠폰을 이번 실행의 남은 유저에게 요청하지 않고, 시트의 enabled=FALSE + status 를
 * 기록해 다음 실행부터 영구 제외한다. (별도 만료일 입력 불필요 — API 응답이 기준)
 */

// ============================================================
// 메뉴 (Simple Trigger)
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Kingshot Bot')
    .addItem('Run Coupon Batch', 'runCouponBatch')
    .addItem('Test Single Coupon', 'testSingleCoupon')
    .addSeparator()
    .addItem('Setup Sheets', 'setupSheets')
    .addItem('Clean Expired Logs', 'cleanExpiredLogs')
    .addToUi();
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
  try {
    runCouponBatch_();
  } finally {
    lock.releaseLock();
  }
}

/** 실제 배치 본문 (runCouponBatch 의 Lock 안에서만 호출) */
function runCouponBatch_() {
  const config = getConfig();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const startTime = Date.now();

  const allUsers = readUsers_();
  const allCoupons = readCoupons_();
  const users = allUsers.filter((u) => u.active);
  const coupons = allCoupons.filter((c) => c.enabled);

  if (users.length === 0 || coupons.length === 0) {
    // 어느 쪽이 비었는지 정확히 알려준다(전체 vs 필터 통과 수).
    ss.toast(
      `실행 대상 없음 — users: 전체 ${allUsers.length}행 중 active ${users.length}명 / ` +
        `coupons: 전체 ${allCoupons.length}행 중 enabled ${coupons.length}개. ` +
        `각 시트의 active/enabled 열이 TRUE(또는 체크박스 ✓)인지 확인하세요.`,
      'Kingshot Bot',
      10,
    );
    return;
  }

  // 시작 전 예상 안내 — 시간 제한 대비 규모를 미리 가늠할 수 있게
  const combos = users.length * coupons.length;
  const estSec = Math.round((combos * config.requestDelayMs) / 1000);
  ss.toast(
    `시작: ${users.length}명 × ${coupons.length}쿠폰 = 최대 ${combos}건, 예상 ~${estSec}s ` +
      `(시간예산 ${Math.round(config.maxRuntimeMs / 1000)}s 초과 시 안전 중단)`,
    'Kingshot Bot',
    6,
  );

  const processed = getProcessedSet_();
  const deadCoupons = new Set(); // 이번 실행에서 만료/무효로 판정된 쿠폰 → 이후 요청 생략
  const stats = { success: 0, already: 0, disabled: 0, fail: 0, skip: 0 };
  let stoppedByTime = false;

  for (const user of users) {
    // (선택) fid 사전 검증 — 실측 후 불필요하면 Script Property KINGSHOT_VERIFY_PLAYER='false'
    if (config.verifyPlayer) {
      const login = loginPlayer(user.fid);
      if (!login.ok) {
        // 429/5xx 는 일시적이므로 INVALID_FID 가 아니라 RATE_LIMITED 로 남겨 다음 실행에서 재시도
        const result = login.rateLimited ? 'RATE_LIMITED' : 'INVALID_FID';
        for (const coupon of coupons) {
          if (deadCoupons.has(coupon.code)) {
            continue;
          }
          appendLog_(user.fid, coupon.code, result, login.message);
          stats.fail++;
        }
        console.warn(`[${result}] fid=${user.fid} (${login.message})`);
        Utilities.sleep(login.rateLimited ? config.rateLimitCooldownMs : config.requestDelayMs);
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
        console.warn(
          `[FAILED] fid=${user.fid} code=${coupon.code} → ${result.result}: ${result.message}`,
        );
      }

      Utilities.sleep(config.requestDelayMs);
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
    `소요 ${elapsedSec}s (건당 ~${avg}s)` +
    (stoppedByTime ? ' — ⏱️ 시간초과 중단(다시 실행 시 이어서 진행)' : '');
  ss.toast(summary, 'Kingshot Bot 완료', 12);
  console.log(`[BATCH DONE] ${summary}`);

  // Discord 상세 알림 (webhook 설정 시)
  notifyDiscord_(
    `**Kingshot 배치 완료**\n` +
      `• 성공: ${stats.success}\n` +
      `• 이미받음: ${stats.already}\n` +
      `• 만료·무효(자동비활성): ${stats.disabled}\n` +
      `• 실패: ${stats.fail}\n` +
      `• 스킵(중복): ${stats.skip}\n` +
      `• 대상: ${users.length}명 × ${coupons.length}쿠폰\n` +
      `• 소요: ${elapsedSec}s (건당 ~${avg}s)` +
      (stoppedByTime ? `\n• ⏱️ 시간초과 중단 — 다시 실행하면 이어서 진행` : ''),
  );
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
  const config = getConfig();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const defs = [
    { name: config.sheets.users, headers: ['fid', 'nickname', 'active'] },
    { name: config.sheets.coupons, headers: ['code', 'enabled', 'status'] },
    { name: config.sheets.logs, headers: ['time', 'fid', 'code', 'result', 'message'] },
  ];

  const created = [];
  for (const def of defs) {
    if (ss.getSheetByName(def.name)) {
      continue; // 이미 존재 → skip
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

  const msg = created.length
    ? `생성된 시트: ${created.join(', ')}`
    : '모든 시트가 이미 존재합니다.';
  ss.toast(msg, 'Setup Sheets', 5);
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

  ui.alert(
    'Clean Expired Logs',
    `죽은 코드 ${deadCodes.length}개의 로그 ${total}건을 정리했습니다.\n코드: ${deadCodes.join(', ')}`,
    ui.ButtonSet.OK,
  );
}

// ============================================================
// 시트 읽기 / 쓰기 헬퍼
// ============================================================

/** users 시트 → [{fid, nickname, active}] */
function readUsers_() {
  const config = getConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.users);
  if (!sheet) {
    throw new Error(`'${config.sheets.users}' 시트가 없습니다. 먼저 [Setup Sheets] 를 실행하세요.`);
  }

  return sheet
    .getDataRange()
    .getValues()
    .slice(1) // 헤더 제외
    .filter((r) => r[0] !== '' && r[0] !== null)
    .map((r) => ({ fid: String(r[0]).trim(), nickname: r[1], active: isTrue_(r[2]) }));
}

/** coupons 시트 → [{code, enabled, status, row}] (row 는 write-back 용 1-based 시트 행번호) */
function readCoupons_() {
  const config = getConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.coupons);
  if (!sheet) {
    throw new Error(
      `'${config.sheets.coupons}' 시트가 없습니다. 먼저 [Setup Sheets] 를 실행하세요.`,
    );
  }

  const values = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {
    // 헤더(0행) 제외
    const code = values[i][0];
    if (code === '' || code === null) {
      continue;
    }
    out.push({
      code: String(code).trim(),
      enabled: isTrue_(values[i][1]),
      status: values[i][2] ? String(values[i][2]).trim() : '',
      row: i + 1, // values 인덱스 i → 시트 행번호 i+1 (1-based)
    });
  }
  return out;
}

/** 만료/무효 쿠폰을 영구 비활성화: enabled(B열)=FALSE, status(C열)=사유 */
function disableCoupon_(couponRow, statusText) {
  const config = getConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.coupons);
  if (!sheet) {
    return;
  }
  sheet.getRange(couponRow, 2).setValue(false); // enabled = FALSE
  sheet.getRange(couponRow, 3).setValue(statusText); // status = EXPIRED / INVALID_CODE
}

/**
 * 특정 코드의 logs 행을 전부 제거한다(만료/무효 코드 정리).
 * dedup 안전: 죽은 코드는 다시 요청되지 않으므로 그 로그는 더 이상 필요 없음.
 * 삭제는 deleteRow 반복(느림·인덱스 꼬임) 대신 "해당 코드만 빼고 한 번에 다시 쓰기"로 처리.
 * @returns {number} 제거된 행 수
 */
function purgeLogsForCode_(code) {
  const config = getConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.logs);
  if (!sheet) {
    return 0;
  }

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return 0; // 헤더만 있음
  }

  const target = String(code).trim();
  const kept = [values[0]]; // 헤더 유지
  let removed = 0;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][2]).trim() === target) {
      // code 는 3번째 열
      removed++;
    } else {
      kept.push(values[i]);
    }
  }

  if (removed === 0) {
    return 0;
  }

  // bulk 재작성 (clearContents 는 값만 지우고 헤더 서식/고정행은 유지)
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, values[0].length).setValues(kept);
  return removed;
}

/** logs 에서 이미 성공/이미받음 처리된 'fid|code' Set 반환 (중복 요청 방지) */
function getProcessedSet_() {
  const config = getConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.logs);
  const set = new Set();
  if (!sheet) {
    return set;
  }

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const fid = values[i][1];
    const code = values[i][2];
    const result = values[i][3];
    if (result === 'SUCCESS' || result === 'ALREADY_USED') {
      set.add(`${String(fid).trim()}|${String(code).trim()}`);
    }
  }
  return set;
}

/** logs 시트에 한 줄 기록 */
function appendLog_(fid, code, result, message) {
  const config = getConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.logs);
  if (!sheet) {
    throw new Error(`'${config.sheets.logs}' 시트가 없습니다. 먼저 [Setup Sheets] 를 실행하세요.`);
  }
  sheet.appendRow([new Date(), fid, code, result, message]);
}

/** TRUE / true / 불리언 true 를 모두 참으로 인식 */
function isTrue_(value) {
  if (value === true) {
    return true;
  }
  const v = String(value).trim().toUpperCase();
  return v === 'TRUE' || v === 'Y' || v === 'YES' || v === '1';
}

// ============================================================
// 등록 헬퍼 (Slack 웹앱에서 사용)
// ============================================================

/** users 시트에서 fid 검색 → {nickname, row} 또는 null */
function findUser_(fid) {
  const config = getConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.users);
  if (!sheet) {
    return null;
  }
  const values = sheet.getDataRange().getValues();
  const target = String(fid).trim();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === target) {
      return { nickname: values[i][1], row: i + 1 };
    }
  }
  return null;
}

/** users 시트에 추가: [fid, nickname, TRUE] */
function addUserToSheet_(fid, nickname) {
  const config = getConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.users);
  if (!sheet) {
    throw new Error(`'${config.sheets.users}' 시트가 없습니다. 먼저 [Setup Sheets] 를 실행하세요.`);
  }
  sheet.appendRow([String(fid).trim(), nickname || '', true]);
}

/** 현재 등록된 유저 수(데이터 행) */
function countUsers_() {
  return readUsers_().length;
}

/** coupons 시트에서 code 검색 → {row} 또는 null */
function findCoupon_(code) {
  const config = getConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.coupons);
  if (!sheet) {
    return null;
  }
  const values = sheet.getDataRange().getValues();
  const target = String(code).trim();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === target) {
      return { row: i + 1 };
    }
  }
  return null;
}

/** coupons 시트에 추가: [code, TRUE, status] */
function addCouponToSheet_(code, status) {
  const config = getConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheets.coupons);
  if (!sheet) {
    throw new Error(
      `'${config.sheets.coupons}' 시트가 없습니다. 먼저 [Setup Sheets] 를 실행하세요.`,
    );
  }
  sheet.appendRow([String(code).trim(), true, status || '']);
}

/** 현재 등록된 쿠폰 수(데이터 행) */
function countCoupons_() {
  return readCoupons_().length;
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
// TODO: Discord Webhook 알림 (UrlFetchApp 으로 배치 요약 전송 — GAS에서 구현 가능)
// TODO: Telegram Bot 알림
// TODO: 자동 쿠폰 크롤링(공식/커뮤니티 소스)
// TODO: 관리자 권한 분리 (Session.getEffectiveUser 기반)
// TODO: Web App(doGet/doPost) 배포로 외부 트리거
// TODO: 대량 처리 시 time-based trigger 기반 이어실행 자동화
