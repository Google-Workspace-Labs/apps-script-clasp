/* global getConfig, generateSign, sleepWithJitter_ */

/**
 * Kingshot Coupon - API 호출 레이어
 *
 * 엔드포인트:
 *   POST /api/player    → fid 유효성 검증(로그인)
 *   POST /api/gift_code → 쿠폰 등록
 *
 * 요청은 application/x-www-form-urlencoded 로 보낸다.
 */

/**
 * 폼 POST 공통 처리.
 * @returns {{status:number, text:string, json:(Object|null), headers:Object}}
 */
function postForm_(url, params, config) {
  const options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: {
      Origin: config.origin,
      Referer: config.referer,
    },
    payload: params, // 객체 → 자동으로 form-urlencoded 인코딩
    muteHttpExceptions: true, // 4xx/5xx 도 예외 없이 응답으로 받음
  };

  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  const text = response.getContentText();
  const headers = response.getHeaders(); // Retry-After 등 확인용

  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    // JSON 이 아니면 null 유지 → 호출부에서 ERROR 처리
    json = null;
  }

  return { status, text, json, headers };
}

/** 일시적(재시도 가능) 상태인지: HTTP 429(rate limit) 또는 5xx */
function isTransientStatus_(status) {
  return status === 429 || status >= 500;
}

/** Retry-After 헤더(초) → ms. 없거나 파싱 불가면 0 반환(호출부 기본 백오프 사용) */
function retryAfterMs_(res) {
  const headers = res.headers || {};
  const raw = headers['Retry-After'] || headers['retry-after'];
  const sec = parseInt(raw, 10);
  if (!isNaN(sec) && sec > 0) {
    return Math.min(sec * 1000, 60000); // 최대 60초로 캡
  }
  return 0;
}

/**
 * fid 로그인(유효성 검증).
 * @returns {{ok:boolean, message:string, data:(Object|null)}}
 */
function loginPlayer(fid) {
  const config = getConfig();
  const time = Date.now().toString();

  const params = { fid: String(fid), time };
  params.sign = generateSign({ fid: params.fid, time }, config.salt);

  try {
    const res = postForm_(config.playerUrl, params, config);

    // 일시적 실패(429/5xx)는 "잘못된 유저"가 아니라 재시도 대상으로 구분
    if (isTransientStatus_(res.status)) {
      return { ok: false, rateLimited: true, message: `HTTP ${res.status}`, data: null };
    }

    const json = res.json;
    if (
      json &&
      (json.code === 0 ||
        String(json.msg || '')
          .toUpperCase()
          .includes('SUCCESS'))
    ) {
      return { ok: true, rateLimited: false, message: 'login ok', data: json.data || null };
    }
    return {
      ok: false,
      rateLimited: false,
      message: json ? json.msg || 'login failed' : `HTTP ${res.status}`,
      data: null,
    };
  } catch (error) {
    return {
      ok: false,
      rateLimited: false,
      message: `network error: ${error.message}`,
      data: null,
    };
  }
}

/**
 * 쿠폰 등록 (단일 시도).
 * @returns {{result:string, message:string}}
 */
function redeemCoupon(fid, code) {
  const config = getConfig();
  const time = Date.now().toString();

  // sign 대상: captcha_code(빈값), cdk, fid, time
  const signed = {
    captcha_code: '',
    cdk: String(code),
    fid: String(fid),
    time,
  };
  const params = Object.assign({}, signed, { sign: generateSign(signed, config.salt) });

  try {
    const res = postForm_(config.giftCodeUrl, params, config);
    return classifyResponse_(res);
  } catch (error) {
    return { result: 'ERROR', message: `network error: ${error.message}` };
  }
}

/**
 * 쿠폰 등록 + 재시도.
 * RATE_LIMITED(TIMEOUT RETRY) 인 경우에만 백오프 후 재시도한다.
 * @returns {{result:string, message:string}}
 */
function redeemCouponWithRetry(fid, code) {
  const config = getConfig();
  let last = { result: 'ERROR', message: 'no attempt' };

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    last = redeemCoupon(fid, code);

    // gift_code 는 먼저 /api/player 로그인을 요구한다("NOT LOGIN.").
    // 로그인 후 재시도(self-heal). 로그인이 rate limit 이면 재시도, 그 외 실패면 INVALID_FID.
    if (last.result === 'NOT_LOGIN') {
      const login = loginPlayer(fid);
      if (login.ok) {
        sleepWithJitter_(config.requestDelayMs);
        continue;
      }
      if (login.rateLimited) {
        Utilities.sleep(config.rateLimitCooldownMs * attempt);
        continue;
      }
      return { result: 'INVALID_FID', message: login.message };
    }

    if (last.result === 'RATE_LIMITED') {
      // Retry-After 헤더가 있으면 존중, 없으면 rate limit 쿨다운 점증 백오프
      const wait =
        last.retryAfterMs && last.retryAfterMs > 0
          ? last.retryAfterMs
          : config.rateLimitCooldownMs * attempt;
      console.warn(
        `[RATE_LIMIT ${attempt}/${config.maxRetries}] fid=${fid} code=${code} → ${Math.round(
          wait / 1000,
        )}s 대기 (${last.message})`,
      );
      Utilities.sleep(wait);
      continue;
    }

    return last;
  }
  return last;
}

/**
 * API 응답을 결과 코드로 분류한다.
 *
 * ⚠️ Century Games API 의 err_code/msg 는 변동 가능성이 있으므로
 *    실측 응답을 보고 아래 매핑을 보정할 것.
 *
 * @returns {{result:string, message:string}}
 */
function classifyResponse_(res) {
  // HTTP 429(rate limit) / 5xx → 하드 에러가 아니라 재시도 대상
  if (isTransientStatus_(res.status)) {
    return {
      result: 'RATE_LIMITED',
      message: `HTTP ${res.status}`,
      retryAfterMs: retryAfterMs_(res),
    };
  }

  const json = res.json;
  if (!json) {
    // 200인데 JSON 이 아니면 보통 Cloudflare/HTML 차단 페이지(공유 GAS IP) → 하드에러가 아니라 일시적(재시도) 처리.
    const body = String(res.text || '').toLowerCase();
    const looksBlocked =
      res.status === 200 &&
      (body.indexOf('<html') !== -1 ||
        body.indexOf('<!doctype') !== -1 ||
        body.indexOf('cloudflare') !== -1 ||
        body.indexOf('cf-ray') !== -1 ||
        body.indexOf('challenge') !== -1);
    if (looksBlocked) {
      return { result: 'RATE_LIMITED', message: 'blocked (HTML/cf) — transient' };
    }
    return {
      result: 'ERROR',
      message: `HTTP ${res.status} / 비정상 응답: ${truncate_(res.text, 120)}`,
    };
  }

  const msg = String(json.msg || '').toUpperCase();
  const errCode = json.err_code;

  if (json.code === 0 || errCode === 20000 || msg.includes('SUCCESS')) {
    return { result: 'SUCCESS', message: json.msg || 'success' };
  }
  // 40011 SAME TYPE EXCHANGE = 같은 타입 보상 이미 보유(보상은 전달됨) → 재시도 무의미한 terminal.
  // ALREADY_USED 로 처리해야 dedup 보존 + warn/RATE_LIMITED 재시도에서 제외됨 (안 그러면 ERROR→매 배치 재시도+가짜 봇알람).
  if (
    msg.includes('RECEIVED') ||
    msg.includes('USED') ||
    msg.includes('SAME TYPE') ||
    msg.includes('CLAIMED') ||
    msg.includes('DUPLICATE') ||
    errCode === 40008 ||
    errCode === 40011
  ) {
    return { result: 'ALREADY_USED', message: json.msg || 'already received' };
  }
  if (msg.includes('CDK NOT FOUND') || msg.includes('NOT FOUND') || errCode === 40014) {
    return { result: 'INVALID_CODE', message: json.msg || 'cdk not found' };
  }
  if (msg.includes('TIME ERROR') || msg.includes('EXPIRED') || errCode === 40007) {
    return { result: 'EXPIRED', message: json.msg || 'expired' };
  }
  if (
    msg.includes('TIMEOUT RETRY') ||
    msg.includes('TOO FREQUENT') ||
    msg.includes('BUSY') ||
    msg.includes('TRY AGAIN') ||
    errCode === 40004
  ) {
    return { result: 'RATE_LIMITED', message: json.msg || 'timeout retry' };
  }
  if (msg.includes('CAPTCHA')) {
    // 킹샷은 보통 캡차 미요구. 발생 시 설계 가정이 깨진 것이므로 경고용으로 분류.
    return { result: 'CAPTCHA_REQUIRED', message: json.msg || 'captcha required' };
  }
  if (msg.includes('NOT LOGIN') || msg.includes('PLEASE LOGIN')) {
    // gift_code 호출 전 /api/player 로그인이 필요함 → 호출부에서 로그인 후 재시도
    return { result: 'NOT_LOGIN', message: json.msg || 'not login' };
  }
  if (msg.includes('INVALID') || msg.includes('NOT EXIST')) {
    return { result: 'INVALID_FID', message: json.msg || 'invalid player' };
  }
  return { result: 'ERROR', message: `${json.msg || 'unknown'} (err_code=${errCode})` };
}

/** 긴 문자열 자르기 (로그 가독성) */
function truncate_(str, max) {
  const s = String(str || '');
  return s.length > max ? `${s.slice(0, max)}...` : s;
}
