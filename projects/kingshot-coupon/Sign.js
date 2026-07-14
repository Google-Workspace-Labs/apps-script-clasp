/**
 * Kingshot Coupon - sign 생성
 *
 * 알고리즘:
 *   1) params 키를 알파벳순으로 정렬
 *   2) "key=value&key=value..." 쿼리 문자열 생성 (값은 인코딩하지 않음, 빈 값도 포함)
 *   3) 끝에 secret salt 문자열을 append
 *   4) MD5 해시 → hex 문자열(소문자, 바이트당 2자리)
 *
 * 예) params = { captcha_code:'', cdk:'KS0526', fid:'42668855', time:'1779860897672' }
 *     정렬 문자열 = "captcha_code=&cdk=KS0526&fid=42668855&time=1779860897672"
 *     sign = MD5(정렬문자열 + salt)
 */

/**
 * MD5 hex 문자열 반환.
 *
 * ⚠️ computeDigest 는 signed byte(-128~127) 배열을 반환하므로
 *    음수 바이트를 (b & 0xff) 로 보정하고 2자리로 zero-pad 해야 한다.
 *    (이 처리를 빼면 sign 이 틀어져 API 가 거부함)
 *
 * @param {string} str
 * @returns {string} 32자리 hex
 */
function md5Hex(str) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    str,
    Utilities.Charset.UTF_8,
  );
  return bytes.map((b) => `0${(b & 0xff).toString(16)}`.slice(-2)).join('');
}

/**
 * sign 생성.
 * @param {Object} params  sign 대상 파라미터 (sign 필드는 포함하지 않는다)
 * @param {string} salt    secret salt
 * @returns {string} sign(hex)
 */
function generateSign(params, salt) {
  const query = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return md5Hex(query + salt);
}
