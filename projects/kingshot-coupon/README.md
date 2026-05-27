# Kingshot Coupon Automation

Google Sheets에 입력한 유저(fid)와 쿠폰 코드를 기반으로, Google Apps Script가 Kingshot
기프트코드 API를 **순수 HTTP**로 호출해 쿠폰을 자동 등록하는 시스템.

브라우저 자동화(Playwright/Puppeteer)나 OCR을 사용하지 않는다. (킹샷은 캡차 미요구 가정)

## 파일 구조

| 파일 | 역할 |
| --- | --- |
| `Code.js` | onOpen 메뉴, 배치(`runCouponBatch`), 단일 테스트, `setupSheets`, 시트 I/O |
| `Api.js` | `loginPlayer`, `redeemCoupon`, 재시도, 응답 분류 (`UrlFetchApp`) |
| `Sign.js` | `md5Hex`, `generateSign` (sign 생성 알고리즘) |
| `Config.js` | SALT / BASE_URL / 시트명 / 지연·재시도 설정 (`getConfig`) |

## 시트 구조

- **users** : `fid | nickname | active` — `active=TRUE` 인 유저만 대상
- **coupons** : `code | enabled` — `enabled=TRUE` 인 쿠폰만 대상
- **logs** : `time | fid | code | result | message` — 실행 결과 기록

`result` 값: `SUCCESS`, `ALREADY_USED`, `INVALID_CODE`, `EXPIRED`, `RATE_LIMITED`,
`CAPTCHA_REQUIRED`, `INVALID_FID`, `ERROR`. 이 중 `SUCCESS`/`ALREADY_USED` 조합은
다음 실행에서 자동으로 건너뛴다(중복 요청 방지).

## sign 생성

```
sorted("key=value&...")  +  SALT   →   MD5(hex)
```

- 키 알파벳순 정렬, `captcha_code` 는 빈 값으로 포함
- ⚠️ `computeDigest` 의 signed byte 를 `(b & 0xff)` 보정 + 2자리 zero-pad (`Sign.js`)
- ⚠️ SALT 는 운영사가 교체 가능 → `Config.js` 의 `DEFAULT_SALT` 또는 Script Property
  `KINGSHOT_SALT` 로 덮어쓴다.

## 셋업

이 프로젝트는 스프레드시트에 연결된 **container-bound** 스크립트다.

1. 새 Google Sheets 생성 → **확장 프로그램 → Apps Script**
2. 스크립트 ID 와 스프레드시트 ID 확인:
   - 스크립트 ID: Apps Script 편집기 → 프로젝트 설정 → 스크립트 ID
   - 스프레드시트 ID: 시트 URL 의 `/d/<여기>/edit`
3. `.clasp.json` 의 `scriptId` 채우기 + `parentId` 추가:
   ```json
   {
     "scriptId": "<스크립트 ID>",
     "rootDir": "",
     "parentId": "<스프레드시트 ID>"
   }
   ```
   > clasp clone 으로 가져온 경우 `parentId` 가 누락되므로 수동으로 추가한다(레포 트러블슈팅 참고).
4. 업로드 & 시트 초기화:
   ```bash
   cd projects/kingshot-coupon
   clasp push
   # 시트 새로고침 → 상단 메뉴 [Kingshot Bot ▸ Setup Sheets]
   ```
5. (선택) SALT 교체 시: Apps Script → 프로젝트 설정 → 스크립트 속성 → `KINGSHOT_SALT`

## 실행

1. **(실측 먼저)** `Kingshot Bot ▸ Test Single Coupon` 으로 본인 fid + 유효 쿠폰 1건 검증
   → salt / 2단계 로그인 필요 여부 / 응답 코드 매핑 확인
2. `users`, `coupons` 시트 입력
3. `Kingshot Bot ▸ Run Coupon Batch` 실행 → `logs` 확인

## 동작 메모

- 요청 간 2.5초 지연(`requestDelayMs`), `TIMEOUT RETRY` 시 백오프 재시도(`maxRetries`)
- **GAS 6분 실행 제한**: `유저수 × 쿠폰수` 가 약 140건을 넘으면 시간초과로 안전 중단됨.
  이미 처리분은 `logs` 에 남으므로 **다시 실행하면 이어서 진행**된다.
- `KINGSHOT_VERIFY_PLAYER='false'` 로 fid 사전 로그인 검증을 끌 수 있다(실측 후 불필요하면).

## 주의

- 개인 자동화 용도. API 는 비공식이며 운영사가 스펙(엔드포인트·salt)을 변경할 수 있다.
- `.clasprc.json`(개인 OAuth 토큰)은 절대 커밋 금지.
