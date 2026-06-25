# Kingshot Coupon Automation

Google Sheets + Apps Script + Web App 로 Kingshot 기프트코드를 **순수 HTTP**(공식
API 직접 호출, 브라우저 자동화/OCR 없음)로 다중 유저에 자동 등록하는 시스템.
공개 웹 UI 에서 멤버가 셀프 등록하고, 관리자는 토글/삭제/TTL 을 같은 화면에서
제어한다. 알림은 **Slack 단일 채널** (Discord 는 GAS IP Cloudflare 차단 이슈로 제거).

## 파일 구조

| 파일              | 역할                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| `Code.js`         | 메뉴(`onOpen`+Quick Setup), 배치(`runCouponBatch`), 시트 I/O 헬퍼(`COL`/`getSheet_`) |
| `Api.js`          | `loginPlayer`, `redeemCoupon`(+재시도), 응답 분류 (`UrlFetchApp`)                    |
| `Sign.js`         | `md5Hex`, `generateSign` (sign 생성, signed-byte 보정)                               |
| `Config.js`       | SALT/URL/시트명/지연·재시도/정원/TTL/Slack 설정 (요청 단위 캐시 포함)                |
| `Registration.js` | 웹앱 (`doGet`/api\*), 관리 액션 (등록·토글·삭제·TTL·Slack 설정)                      |
| `Notify.js`       | Slack 알림 (`notify_` dispatcher · 카테고리 게이트), 배치 트리거 예약                |
| `Sync.js`         | 외부 쿠폰 소스 자동 동기화 (옵션 레이어 · 기본 OFF · 1h 트리거 · 전부 try/catch)     |
| `Report.js`       | 정기 운영 보고서 (옵션 레이어 · 기본 ON · 주간/격주/월간 · read-only 집계 · 격리)    |
| `Time.js`         | 타임스탬프 단일 원천(UTC ISO) 헬퍼 — `tsNow_`/`tsParse_`/`fmtTsLang_`                |
| `index.html`      | 웹 UI (등록·관리, 모바일 대응, 토글 슬라이더, 도움말 프롬프트)                       |

## 시트 구조

| 시트          | 컬럼                                                           | 비고                                                                                                    |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `users`       | fid · nickname · current_nickname · active · created · updated | `active=TRUE` 만 배치 대상. nickname=최초(불변)·current_nickname=현재(조회/배치 갱신), 표시는 현재 우선 |
| `coupons`     | code · enabled · status · created · updated                    | `enabled=TRUE` 만 대상                                                                                  |
| `logs`        | time · fid · code · result · message                           | dedup 원천 (자동 기록)                                                                                  |
| `system_logs` | time · level · source · message · target                       | 진단 로그 (1000행 자동 회전)                                                                            |

> 실제 시트 탭 이름엔 이모지 prefix 가 붙는다: `👤 users` · `🎟️ coupons` · `🧾 logs` ·
> `🩺 system_logs` (위 표/본문은 가독성 위해 식별자만 표기). 온보딩 가이드 탭은 `📖 Guide`.

`result` 값: `SUCCESS`, `ALREADY_USED`, `CONDITION_NOT_MET`, `INVALID_CODE`, `EXPIRED`,
`EXPIRED_AGE`, `RATE_LIMITED`, `CAPTCHA_REQUIRED`, `INVALID_FID`, `ERROR`.
`SUCCESS`/`ALREADY_USED`/`CONDITION_NOT_MET` 조합은 다음 실행에서 자동 skip (중복 요청 방지).

> `CONDITION_NOT_MET` = 유저 조건 미충족 (`40006` 화로레벨·`40017/40018` VIP/충전).
> 해당 fid+코드엔 영구적이라 **터미널(dedup 보존·재시도X·알람X)** 로 처리 — ERROR 오분류로 인한
> 가짜 봇알람/재시도 폭주 방지. 단 코드 자체는 유효하므로 **코드-단위 비활성화는 안 함**(타 유저는 받음).

`status` 값(coupons):

- `VALID` — 살아있는 코드 (enabled=TRUE, 배치 대상). _(레거시 PENDING 행도 alive 취급 — 자동 갱신 안 됨)_
- `EXPIRED`/`INVALID_CODE`/`EXPIRED_AGE` — 죽은 코드 (enabled=FALSE, 배치 skip)
  - 등록 시 단건 검증으로 즉시 감지 + 시트 기록 (dead code 캐시 → 재시도 차단)
  - 또는 배치 중 발견 시 자동 비활성화 + `logs` 행 purge
- **UI 노출 정책**: `EXPIRED`/`EXPIRED_AGE`(한때 유효했던 이력)는 관리 목록에 노출,
  `INVALID_CODE`(존재하지 않는 오타)는 **캐시로만 남기고 목록에서 숨김** (개수 칩 + 정리 버튼만 표시)

## sign 생성

```
sorted("key=value&...")  +  SALT   →   MD5(hex)
```

- 키 알파벳순 정렬, `captcha_code` 빈 값 포함 (킹샷은 캡차 미요구 가정)
- ⚠️ `computeDigest` 의 signed byte 를 `(b & 0xff)` 보정 + 2자리 zero-pad
- SALT 교체 시 `Config.js` `DEFAULT_SALT` 또는 Script Property `KINGSHOT_SALT`

## 🪄 시트 복사받은 사람용 (비개발자 가이드)

> 동료가 만든 👑 Kingshot Bot 시트를 카피해서 그대로 쓰고 싶을 때.

**복사 → 📖 Guide 시트 안내대로 → 끝.** 코딩 지식 X.

1. **시트 복사** — 원본 시트 메뉴 `파일 ▸ 사본 만들기` (Apps Script 포함되어 복사됨)
2. **첫 오픈** — 복사한 시트를 열면 **`📖 Guide`** 탭이 자동으로 보임
3. **가이드 따라하기** — 그 탭 안의 1·2·3단계 그대로 진행
   - ⚠️ **처음 메뉴를 클릭하면(언어 설정이든 시트 생성이든) Google 권한 동의창이 한 번** 떠도 정상:
     `[고급] ▸ [Kingshot Coupon(으)로 이동(안전하지 않음)] ▸ [모두 선택] ▸ [계속]` (한 번만, 이후 안 뜸)
     - "안전하지 않음" 은 Google 미인증 표기일 뿐 — 코드는 안전
   - 1단계: `🌐 Language` 로 언어 선택 (보통 이 첫 클릭에서 위 동의창이 뜸)
   - 2단계: `🚀 Setup ▸ Setup Sheets` 클릭 → 시트 4개 생성 (권한은 위에서 승인됨)
   - 3단계: `🚀 Setup ▸ Quick Setup` → 모달의 `▶ Apps Script 에디터 열기` →
     에디터 우측 상단 `배포 ▸ 새 배포` → `⚙️ 유형 ▸ 웹 앱` →
     실행: **나**, 액세스: **모든 사용자** → `배포` → `액세스 승인`
     (권한 절차는 위 ⓐⓑⓒ 동일) → 나오는 `/exec` URL **[복사]** → 브라우저로 접속 확인
   - `/exec` 의 **🛠 관리** 패널에서 설정 변경(Slack · TTL 등) 은 🔑 비밀번호 필요
     (접속 기기의 **오늘 날짜 4자리** MMDD, 예: 6월13일→`0613`. 어느 timezone서 접속해도 현지 날짜로 통과)
4. **(완료 후) 가이드 시트 정리** — 안 필요하면 탭 우클릭 `Delete sheet` 로 삭제해도 OK

> 💡 막히면 언제든 `👑 Kingshot Bot ▸ 🚀 Setup ▸ Quick Setup` 다시 열기.

### 📤 배포자 가이드 (시트를 멤버에게 공유하는 사람용)

**배포 전 1회 셋업:**

1. 빈 Google Sheets 생성 + Apps Script 코드 push
2. 시트 열기 → 메뉴 노출 확인
3. `👑 Kingshot Bot ▸ 🚀 Setup ▸ 📖 Guide 시트 생성 (배포자 1회)` 클릭
   - 권한 동의창 → 모든 권한 허용
   - leftmost 위치에 `📖 Guide` 탭 생성됨 + 자동 활성화
4. (선택) `Setup Sheets` 도 실행해 시트 4개 미리 만들어 두기
5. **`📖 Guide` 탭을 활성 상태로 둔 채** 시트 공유/카피 권한 부여
   - 멤버가 카피하면 카피본도 동일하게 `📖 Guide` 가 첫 활성 탭

이렇게 해두면 멤버는 카피 → 열기만 해도 즉시 가이드를 보게 되어, "뭐 부터 해야 하지?" 헤맬 일 없음.

---

## 셋업 (개발자/clasp 사용 시)

container-bound 스크립트 (스프레드시트에 연결).

1. 새 Google Sheets 생성 → 확장 프로그램 → Apps Script
2. `.clasp.json` 에 `scriptId` + `parentId` 채우기
   ```json
   { "scriptId": "<...>", "rootDir": "", "parentId": "<스프레드시트 ID>" }
   ```
3. 업로드
   ```bash
   cd projects/kingshot-coupon
   clasp push
   # 시트 새로고침 → 메뉴 [🚀 Setup ▸ Setup Sheets] 클릭 → 권한 동의 → 시트 4개 생성
   ```
4. **웹앱 배포**: 에디터 → Deploy ▸ New deployment ▸ Web app
   (Execute as: Me / Access: Anyone) → `/exec` URL 공유
5. (선택, 멤버에게 공유 예정이면) `🚀 Setup ▸ 📖 Guide 시트 생성` 클릭 →
   leftmost 에 onboarding 가이드 탭 생성 후 활성 상태로 두고 공유
6. (선택) Script Properties 설정 — 아래 참고

## 메뉴 (시트) — `👑 Kingshot Bot` 하위 6그룹

> 그룹 라벨은 `🌐 Language` 설정 따라 EN/KO 로 바뀜(**기본 EN**). 아래 표는 한국어 기준 —
> EN 은 `🚀 Setup` · `▶ Run` · `🛠 Admin` · `🔄 Sync` · `📊 Report` · `🔍 Diagnostics`.

| 그룹      | 항목                          | 동작                                                        |
| --------- | ----------------------------- | ----------------------------------------------------------- |
| 🚀 Setup  | Setup Sheets                  | 시트 4종 생성 (첫 사용 시 필수, 이미 있으면 스킵)           |
|           | Quick Setup                   | 웹앱 배포 / Slack 안내 모달 (2단계, 비개발자용)             |
|           | 📖 Guide 시트 생성            | 배포자가 1회 실행 — 카피 받는 멤버용 onboarding 시트 생성   |
| ▶ 실행    | Run Coupon Batch              | 배치 즉시 실행 (active 유저 × enabled 쿠폰)                 |
|           | Test Single Coupon            | fid+코드 1건 즉석 테스트 (salt/플로우 검증용)               |
| 🛠 관리   | Deactivate User / Delete User | fid 입력 → 비활성/삭제 (시트편집자만, 비밀번호 X)           |
|           | Clean Duplicate Users         | users 시트 fid 중복 row 정리 (첫 등장만 보존)               |
|           | Clean Expired Logs            | 죽은 코드(`EXPIRED`/`INVALID_CODE`)의 로그 일괄 정리        |
|           | Clean Invalid Coupons         | 존재하지 않는(오타) `INVALID_CODE` 쿠폰 행 삭제(+로그)      |
|           | Clear System Logs             | `system_logs` 비우기                                        |
| 🔄 동기화 | 지금 동기화 (1회)             | 외부 소스 즉시 1회 동기화 (테스트·즉시 반영)                |
|           | 자동 동기화 ON/OFF            | 매시간 자동 동기화 토글 (트리거 설치/제거)                  |
| 📊 보고서 | 지금 보고서 (1회)             | 미리보기 1통 즉시 발송 (정기 일정 영향 없음)                |
|           | 정기 보고서: 매주/격주/매월   | 주기 설정 + ON (트리거 설치)                                |
|           | 정기 보고서 끄기              | OFF (트리거 제거)                                           |
| 🔍 진단   | Diagnose Dedup                | logs 시트 dedup 누수 진단 (strict/case/trim/type 변형 비교) |

## 웹 UI (`/exec`)

3개 카드 + 게임풍 베이지 톤:

- **👤 유저 등록** — fid 입력 → `조회`로 닉네임·레벨·왕국·아바타 확인 → 우측 `등록`
  버튼으로 연속 등록 (이미 등록된 ID 는 `등록됨` 상태로 비활성)
- **🎁 쿠폰 등록** — 코드 입력 → 검증(login+redeem 1회) → 결과별:
  - **유효** → 추가 + 배치 예약 (debounce 30s)
  - **없음/만료** → 시트에 `enabled=FALSE` + `INVALID_CODE`/`EXPIRED` 로 기록 →
    같은 코드 재시도 시 **API 호출 없이 1ms 만에 차단**(dead code 캐시)
  - **캐시 히트(이미 등록 또는 죽은 것으로 확인됨)** → 즉시 사유별 메시지 (API 0회)
- **🛠 관리** — 기본 열림(목록은 비밀번호 없이 조회), **변경/삭제·즉시 실행만 비밀번호**(접속 기기의 오늘 날짜 MMDD, any-timezone)
  - 🔑 비밀번호 입력 (4자리 마스킹)
  - ⏳ 쿠폰 자동만료(TTL) 일수 설정·`저장` (값이 저장값과 같으면 버튼 비활성 — 불필요 저장 차단)
  - ⚡ **즉시 배치 실행** — 비밀번호 + 한 클릭 → 약 30초 뒤 배치 동작 (마지막 배치 시각 인라인 표시)
  - 💬 Slack 알림 슬라이더(on/off) + Webhook URL `저장` + 도움말(GPT 프롬프트 복사)
  - 👤 유저 목록 (활성/비활성 카운트, 슬라이더 토글, 삭제) — 활성 먼저 정렬
  - 🎁 쿠폰 목록 (코드 · 등록시각, 슬라이더 토글) — 활성 먼저 → 최신순
    (`INVALID_CODE` 오타 코드는 숨김 → 목록 아래 `🗑 존재하지 않는 코드 N개` 칩 + 정리 버튼)
  - 🔄 자동 쿠폰 동기화 슬라이더(on/off) + `지금 동기화 (1회)` 버튼 + 마지막 동기화 결과
  - 📊 정기 보고서 슬라이더(on/off) + 주기 드롭다운(매주/격주/월간) + `저장` + `지금 보고서 (1회)`
  - 각 헤더 우측에 마지막 사용시각 표시 (`🕒 yyyy-MM-dd HH:mm`, **접속자 현지시간** — 서버는 UTC ISO 저장)

UI 액션 후 목록·카운트·시각은 자동 갱신됨.

## 알림 — Slack 단일 채널 + 7개 카테고리 토글

**왜 Slack 만?** GAS 공유 IP 는 Discord Cloudflare 에 _지속적으로 차단_ 받음
(429 + cf-ray 헤더 + X-RateLimit-Scope 없음 = IP 평판 문제). 알림 누락 빈도 높아
운영 불가. Slack 은 인프라(AWS) 가 달라 같은 IP 평판 영향 거의 없음 — 검증 완료
후 Discord 코드/UI 모두 제거.

**Slack 호환 노트:**

- Akamai CDN (`akamaized.net`) URL 은 Slack 의 legacy `thumb_url` proxy 가 fetch 못함
- → 아바타는 `image_url` (하단 인라인 큰 이미지) 로 전송
- 닉네임 줄에 🏷️ 이모지 prefix 로 시각 강조 (`🏷️ *닉네임*`)
- 마크다운: 내부 embed 의 `**bold**` → Slack `*bold*` 자동 변환 (`mrkdwn_in` 활성화)
- attachment legacy 필드만 사용 (Block Kit `blocks` 와 혼용 시 `invalid_attachments` 거부됨)

관리 UI 에서 Slack Webhook URL + ON/OFF 토글.

배치/설정 이벤트 시 `notify_(embed, target, category)` dispatcher 가 활성화된 채널 모두 호출.

### 카테고리별 ON/OFF (관리 UI 7개 슬라이더)

채널이 ON 이어도 카테고리 OFF 면 해당 이벤트는 전송 X. 7개 모두 기본 ON
(opt-out) — 처음 전부 켜고 시작 → 노이즈 느끼는 항목만 OFF 로 자기 운영 스타일에 맞춤.

| 카테고리      | 기본 | 포함 이벤트                                                |
| ------------- | ---- | ---------------------------------------------------------- |
| 🎁 배치 결과  | ON   | 배치 완료 (성공/실패/스킵/대상 통계 + 색상 사이드바)       |
| ⏱ 배치 예약   | ON   | 쿠폰/유저 등록·수동 버튼 → "N초 뒤 배치 예약" 안내         |
| 👤 유저 변경  | ON   | 등록 (닉네임/ID/카운트 + 아바타 썸네일) · 삭제 · 활성 토글 |
| 🎟 쿠폰 변경  | ON   | 등록 (VALID/EXPIRED/INVALID_CODE 분기) · 활성 토글         |
| ⚙️ 설정 변경  | ON   | TTL 변경 · Slack URL/토글 · 자동 동기화 토글 · 보고서 설정 |
| 🔄 자동동기화 | ON   | 외부 소스 신규 쿠폰 발견·등록 요약 · fetch/스키마 오류     |
| 📊 정기보고서 | ON   | 정기 운영 보고서 본문(digest) — 주간/격주/월간 발송        |

채널 자체의 테스트/ON/OFF 메시지(`✅ 연동 완료` 등) 는 카테고리 게이트 무시 — 채널 검증 목적.

### 알림 누락 시 진단 (GAS 공유 IP rate limit)

Slack 도 드물게 throttle 가능 (드묾, 안전망 적용). **429 차등 처리**: Cloudflare 차단(cf-ray)·긴
retry-after(>20s)면 재시도 0회, 짧은 throttle 만 최대 5회(`retry_after` 존중·캡 10s). `system_logs`
의 `slack` source 행에서 시도별 HTTP 코드·헤더·포기 사유를 진단할 수 있다. 누락이 잦으면 등록
burst 를 줄이거나 egress 를 GAS 밖(전용 IP)으로 분리.

## 동작 메모

- 요청 간 `requestDelayMs` (기본 2.5s) **+ jitter [-500, +1500ms]** = 실제 2.0~4.0s
  랜덤 간격 → 정확한 2.5s 패턴이 anti-bot 탐지에 잡히지 않게 흐림. 백오프(`TIMEOUT RETRY`/`429`)는
  시간 정확성 위해 jitter 제외
- **GAS 6분 실행 제한 + 자동 이어실행**: `유저수 × 쿠폰수 × 2.5초` 가 약 5분 넘으면
  안전 중단 → **1분 뒤 자동으로 트리거 재예약**. 이미 처리분은 `logs` 의 dedup 으로 SKIP,
  남은 조합만 다음 세션에서 호출. 200명/600조합 같은 큰 배치도 사용자 액션 없이 끝까지 완료
- **쿠폰 TTL**: 등록 후 N일(기본 30) 지난 enabled 쿠폰은 배치 시작 시 API 호출 없이
  `EXPIRED_AGE` 처리 + 로그 purge
- **사전 dedup 체크 (verifyPlayer 보호)**: 배치 루프 시작 시 _이 유저가 처리할
  조합이 하나라도 있는지_ 먼저 확인. 모두 dedup 에 있으면 `loginPlayer` 자체를 안 부름
  → 불필요한 IP rate limit 부담 + logs 노이즈 (RATE_LIMITED 잔재) 제거
- **Dead code 캐시**: 단건 검증에서 `EXPIRED`/`INVALID_CODE` 응답 받은 코드는 시트에
  `enabled=FALSE` 로 기록해 **같은 코드 재시도를 API 호출 없이 1ms 만에 차단**.
  여러 멤버가 같은 만료 코드를 시도해도 킹샷 API 호출은 최초 1회뿐 → GAS 공유 IP
  rate limit 부담 ↓. 시트의 dead row 는 `enabled=FALSE` 라 배치에서도 자동 skip,
  UI 관리 패널에선 활성 코드 뒤로 정렬되어 노출 ↓
- **유저 정원**: `KINGSHOT_MAX_USERS` (기본 200, 0=무제한). 신규 등록 시만 적용(총 행수 기준 — 활성+비활성).
  봇감지 안전은 정원이 아니라 **요청 지연(2.5s+jitter)** 이 좌우 — 정원↑는 쿠폰 드랍당 배치 지속시간만 늘림(자동 이어실행이 흡수)
- **동시성**: 등록/관리 액션은 `safeApiWithLock_` 헬퍼로 `LockService` 직렬화 (race 방지).
  배치는 `tryLock(0)` 으로 단일 실행 보장 + debounce
- **자동 배치 예약 정책** (`requestBatch_(delayMs)` 의 debounce 시간):
  - **쿠폰 등록 → 30s**
  - **유저 등록 → 180s (3분)**
  - **수동 즉시 실행 → 30s**
  - **시간 초과 이어실행 → 60s** (5분 한도 도달 후 자동 재예약)
  - **RATE_LIMITED 자동 재시도 → 180s (3분), 최대 3회** (warn>0 감지 시)
  - 같은 핸들러 트리거가 이미 있으면 **항상 가장 짧은 게 이김** —
    유저(180s) 예약된 상태에서 쿠폰(30s) 들어오면 30s 로 단축. 자연스럽게 합쳐짐
- **RATE_LIMITED 자동 N차 재시도**: 배치 종료 시 warn>0(rate limit 등) 감지 → 3분 뒤 자동 재시도
  (최대 3회, `BATCH_RL_RETRY_COUNT` 카운터). 회복/포기 결과는 배치 임베드 footer 에 한 줄로 표시
- **마지막 배치 시각**: `LAST_BATCH_AT` Script Property 에 KST 시각 자동 기록 →
  관리 UI 의 "⚡ 즉시 배치 실행" 옆 인라인 표시 (시트 안 봐도 신선도 판단 가능)
- **배치 트리거 청소**: `runCouponBatch` 종료 시 `removeTriggers_('runCouponBatch')`
  호출 → GAS 콘솔에 '사용 중지됨' 트리거 누적 안 됨 (lock 보유 중 처리해 race-safe)

## Script Properties (선택)

| 키                                  | 기본                                        | 설명                                                 |
| ----------------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| `KINGSHOT_SALT`                     | (코드 기본값)                               | sign salt 교체                                       |
| `KINGSHOT_BASE_URL`                 | `https://kingshot-giftcode.centurygame.com` | API 베이스                                           |
| `KINGSHOT_VERIFY_PLAYER`            | (ON)                                        | `'false'` 면 fid 사전 로그인 검증 끔                 |
| `KINGSHOT_MAX_USERS`                | `200`                                       | 유저 등록 정원 (0=무제한)                            |
| `KINGSHOT_COUPON_TTL_DAYS`          | `30`                                        | 쿠폰 자동만료 일수 (0=끔)                            |
| `KINGSHOT_VALIDATE_FID`             | (첫 active 유저)                            | 쿠폰 검증에 쓸 fid                                   |
| `SLACK_WEBHOOK_URL`                 | —                                           | Slack 웹훅 URL (UI에서 저장 가능)                    |
| `SLACK_ENABLED`                     | (true)                                      | `'false'` 면 알림 OFF (UI 슬라이더와 동일)           |
| `NOTIFY_BATCH`                      | (true)                                      | 카테고리: 배치 결과 (기본 ON)                        |
| `NOTIFY_SCHEDULE`                   | (true)                                      | 카테고리: 배치 예약 (기본 ON)                        |
| `NOTIFY_USER`                       | (true)                                      | 카테고리: 유저 변경 (기본 ON)                        |
| `NOTIFY_COUPON`                     | (true)                                      | 카테고리: 쿠폰 변경 (기본 ON)                        |
| `NOTIFY_SETTINGS`                   | (true)                                      | 카테고리: 설정 변경 (기본 ON)                        |
| `NOTIFY_SYNC`                       | (true)                                      | 카테고리: 자동동기화 (기본 ON)                       |
| `NOTIFY_REPORT`                     | (true)                                      | 카테고리: 정기보고서 (기본 ON)                       |
| `AUTO_SYNC_ENABLED`                 | (OFF)                                       | `'true'` 면 자동 동기화 ON (UI/메뉴 토글과 동일)     |
| `COUPON_SOURCE_URL`                 | `https://ks-rewards.com/api/codes`          | 주 동기화 소스 URL 교체 (ks-rewards 스키마)          |
| `COUPON_SOURCE_URL_FALLBACK`        | `https://kingshotdata.kr/data/coupons.json` | 예비 소스 URL 교체 (kingshotdata 스키마, 주 실패 시) |
| `SYNC_FAIL_AUTOOFF_STREAK`          | `168` (≈1주일 @1h)                          | 모든 소스 연속 실패 N회 시 자동 OFF (0이면 끔)       |
| `SYNC_FAIL_STREAK`                  | —                                           | 자동 관리 (연속 실패 카운터, 성공 시 0)              |
| `REPORT_ENABLED`                    | (ON)                                        | `'false'` 면 정기 보고서 OFF (그 외/미설정=기본 ON)  |
| `REPORT_PERIOD`                     | `weekly`                                    | 보고서 주기 `weekly`/`biweekly`/`monthly`            |
| `REPORT_EMAIL`                      | —                                           | 보고서 메일 수신자(쉼표구분). 비우면 Slack 만        |
| `REPORT_TRIGGER_ENSURED`            | —                                           | 자동 관리 (self-heal 게이트 도장)                    |
| `LAST_MANAGE_AT`                    | —                                           | 자동 기록 (관리 헤더 표시용, **UTC ISO**)            |
| `LAST_BATCH_AT`                     | —                                           | 자동 기록 (마지막 배치 시각, **UTC ISO**)            |
| `LAST_SYNC_AT` / `LAST_SYNC_RESULT` | —                                           | 자동 기록 (마지막 동기화 시각(UTC ISO)·결과)         |
| `LAST_REPORT_AT`                    | —                                           | 자동 기록 (마지막 정기 보고 시각, **UTC ISO**)       |
| `BATCH_RL_RETRY_COUNT`              | —                                           | 자동 관리 (RATE_LIMITED N차 재시도 카운터, 0~3)      |

## 자동 쿠폰 동기화 (옵션 · `Sync.js`)

외부 커뮤니티 소스가 발행 쿠폰을 JSON 으로 공개한다. 이를 주기적으로 받아 **시트에 없는
"아직 유효한" 신규 코드만** 자동 등록 + 배치한다. **기본 OFF** — 관리 UI 토글 또는 메뉴
`🔄 동기화 ▸ 자동 동기화 ON/OFF` 로 켠다(매시간 주기). 주기 변경 시 토글 OFF→ON 으로 재설치해야 반영된다.

**소스 = 주(primary) + 예비(fallback)** — 인프라가 독립이라 실패가 상관없음(uncorrelated):

|      | 소스                                | 인프라                                      | 채택 기준                           |
| ---- | ----------------------------------- | ------------------------------------------- | ----------------------------------- |
| 주   | `ks-rewards.com/api/codes`          | Cloudflare 뒤 동적 API (신선·검증상태 명시) | `validation_status === 'validated'` |
| 예비 | `kingshotdata.kr/data/coupons.json` | GitHub Pages 정적 (스테일하지만 초안정)     | `until >= 오늘`                     |

폴백은 **주 소스 fetch/파싱 실패 시에만** 호출 — 주가 정상이면 코드 0개라도 예비 안 봄
(스테일·오타 잡음 상시 혼입 방지). 둘 다 실패하면 그 회차만 조용히 스킵.

**동작:** 주→예비 소스 수집 → 시트에 없음 필터 → 후보를 `apiRegisterCoupon()` 에 위임
→ 단건 검증·dedup·dead코드 캐시·debounce 배치를 기존 로직이 그대로 처리. 즉 **"사람이 손으로
코드 친 것"과 동일한 경로** — 새로운 상태 오염 불가. 만료/오타 코드는 소스 필터 또는 우리 검증에서
걸러져 캐시되므로 낭비 없음.

**격리 보장 (두 소스가 다 죽어도 본체 무영향 — "꺼놨을 때"와 동일):**

- 전 과정 `try/catch` + **각 소스 fetch 도 독립 try/catch** — 네트워크/JSON/스키마/CF차단 등 어떤
  오류도 삼키고 트리거 밖으로 안 던짐. 한 소스 실패가 다른 소스·본체로 안 번짐
- **실패 알림(엣지 트리거):** Slack 실패 경보는 **정상→실패 전환 1회**만, 복구 시 **실패→정상 1회**만
  (`LAST_SYNC_RESULT.ok` 비교). 장애 지속돼도 매 회차 반복 안 함 — 1시간 폴링에서 하루 24번
  노이즈 방지. `logs` 에는 매 회차 기록. 실패 알림엔 "장기화 시 자동 동기화 OFF 권장" 안내 포함
- **자동 OFF 백스톱:** **모든 소스가 연속 168회(≈1주일 @1h) 실패**하면 자동으로 동기화 OFF + 알림 1회
  (영구 death 정리 — URL·스키마 변경, 사이트 폐쇄 등). 성공 1회로 카운터 0 리셋이라 **일시 장애는
  self-heal, 진짜 영구 고장만 꺼짐**. 임계값은 `SYNC_FAIL_AUTOOFF_STREAK` 로 조정(0=끔). 엣지 알림
  (조기경보)과 보완 관계 — 복구 후 다시 켜는 건 수동(의도된 "give up" 상태)
- 기존 수동 등록/배치 경로와 완전 분리 — `Sync.js` 통째로 삭제해도 무손상
- 시트 카피 시 **설치형 트리거는 복사 안 됨** → 멤버/지인 시트는 켜기 전까지 완전 비활성 = 수동 등록 100% 유지
- 킬스위치: `AUTO_SYNC_ENABLED='false'` 또는 토글 OFF 로 즉시 정지(트리거 제거)

## 정기 보고서 (옵션 · `Report.js`)

운영 현황을 **기간 단위로 요약**해 Slack(+선택 메일)로 1통 보낸다. "이상할 때만" 알리는 엣지
알림(동기화)과 정반대 축 — "정상이어도 정기적으로" 현황을 보고. **기본 ON** — 관리 UI 슬라이더,
주기 드롭다운(매주/격주/월간) + `저장`, 또는 메뉴 `📊 보고서` 로 제어. 트리거는 시트 카피 시
복사 안 되므로 관리 패널 첫 로드에서 `ensureReportTrigger_` 가 self-heal 설치(once-flag 게이트).

**보고 항목 (전부 현재 상태 기준):**

- 🎟 쿠폰: 활성 / 신규(기간 내) / 만료 · 👤 유저: 총 / 활성 / 신규
- 📦 **전달 현황** = 활성유저 × 활성쿠폰 중 **미전달 조합 수** (0이면 "전부 전달")
- 🔄 동기화 상태 · 🗓 마지막 배치

> 전달 현황을 "현재 상태 미전달 조합"으로 잡는 이유: `logs` 는 죽은 코드·삭제 유저 행이 purge 되므로
> 행 기반 "기간 내 성공률"은 흔들린다. purge 는 항상 엔티티의 활성집합 이탈과 짝지어 일어나므로,
> 현재상태 집계는 **유저삭제·쿠폰만료·상태변경 어떤 조합에도 안 깨진다**(로그 나이와 무관).

**격리 보장 (`Report.js` 통째 삭제해도 본체 무영향):**

- **read-only** — `users`/`coupons`/`logs` 읽기만. 쓰는 건 자기 Property(`REPORT_*`)뿐 → dedup·배치·동기화 무접촉
- 모든 진입점 `try/catch` + 집계 구간별 `try/catch` → 한 구간 실패해도 그 칸만 비우고 나머지 발송. 무데이터/시트삭제도 안전
- 트리거 핸들러 독립(`reportScheduled` 전용) → 배치·동기화 트리거 무접촉. 알림은 ON↔OFF·주기변경에만(무변경 skip)

## 참고 프로젝트 비교 (생태계 분석)

같은 Kingshot/Whiteout 기프트코드 API 를 다루는 외부 프로젝트들. 모두 redemption
엔진(엔드포인트·salt·sign·err_code)은 우리와 **동일**하고, 갈리는 건 **플랫폼·운영 방식**.

**참고 링크:**

- [ks-rewards.com](https://ks-rewards.com/) — adaja(Kingdom 847) 제작. 무료 호스팅 웹 서비스
  ([Codeberg 소스](https://codeberg.org/adaja/ks-rewards.com), AGPL-3.0). redemption 로직은 justncodes 기반
- [justncodes/ks-giftcode](https://github.com/justncodes/ks-giftcode) — Kingshot redemption 로직 "원본"(Python CLI)
- [kingshot-project/Kingshot-Discord-Bot](https://github.com/kingshot-project/Kingshot-Discord-Bot) — Kingshot Discord 봇 (WOS 봇 fork)
- [justncodes/wos-giftcode](https://github.com/justncodes/wos-giftcode) · [whiteout-project/bot](https://github.com/whiteout-project/bot) —
  전작 Whiteout Survival 성숙판 (**캡차 ONNX 솔버 보유**)

### 운영 archetype 3종

| 축            | 우리 (copy-distributed)       | ks-rewards (central SaaS) | Discord 봇 (federated)        |
| ------------- | ----------------------------- | ------------------------- | ----------------------------- |
| 셋업          | **시트 복사 = 끝** (비개발자) | URL 접속                  | Python·호스팅·봇토큰 (개발자) |
| 비용          | **0** (구글 호스팅)           | 운영자 부담               | 각 운영자 부담                |
| UI            | 웹앱                          | 웹앱                      | Discord                       |
| 저장소        | Google Sheet                  | SQLite                    | SQLite                        |
| 코드 발견     | 수동 + 선택적 1h sync         | 자동 15분                 | 커뮤니티 공유 풀 5~10분       |
| 다중대상      | 전 유저                       | Player ID 리스트          | 연합(alliance) bulk           |
| 업데이트 전파 | **없음**(복사 동결)           | Docker pull               | GitHub 자동                   |

우리 해자 = **0-셋업·0-비용·비개발자 친화**. 참고들은 커뮤니티/연합 스케일 + 기술 운영자
대상이라 무거운 기계장치(프록시·캡차·자동업데이트)가 필수 — 우리 타깃엔 불필요.
→ **Discord 봇을 따라가지 말 것** (해자를 버리는 길).

### redemption 엔진: 우리와 동일 (교차검증)

- 엔드포인트 `kingshot-giftcode.centurygame.com/api/{player,gift_code}` · salt `mN4!pQs6JrYwV9` — 3개 소스 모두 일치
- **킹샷은 캡차 미요구** — ks-rewards·ks-giftcode·KS봇 독립 확인. KS봇은 WOS 에서 물려받은
  OCR 스택(`onnxruntime`/`rapidocr`)을 **탑재했지만 KS용으론 안 씀**. → 우리 `captcha_code=''` 무캡차 설계가 정답
- err_code 함정도 동일: WOS 성숙판이 짚는 `40011 SAME TYPE EXCHANGE`(=성공 취급)를 우리도 이미 ALREADY_USED 처리

> 같은 게임 API 라 모두 같은 벽(레이트리밋·공유IP, WOS 의 캡차)에 부딪히고, 참고들은 프록시
> 로테이션·ONNX 캡차솔버로 우회하지만 **우리만 GAS 라 그 우회가 전부 막혀 있음**. 우리 429 한계는
> 코드 버그가 아니라 플랫폼 본질 제약(외부 증거로 재확인).

## 알려진 제약 / 주의

- **GAS 공유 IP 차단**: 킹샷 API 도 비슷한 IP throttle 가능 (대량 등록 시 429 누적).
  소규모면 무방, 대규모/정기면 egress 를 GAS 밖(Cloud Run 등)으로 이전이 정답
- **웹앱 재배포 필요**: 코드 변경 시 `/exec` 에 반영하려면 Deploy ▸ Manage
  deployments ▸ Edit ▸ New version. 트리거/배치는 재배포 없이 즉시 반영
- **공개 링크 + 비밀번호 = 가벼운 보호**: 비밀번호 = 접속 기기의 오늘 날짜(MMDD). 서버가
  any-timezone(UTC-12~+14)으로 검증해 관리자가 어디서 접속하든 **현지 날짜**로 통과. 검증은
  서버에서만(클라는 입력만) → 소스에 "날짜=비번" 패턴 비노출. "장난 방지"용 가벼운 잠금
- API 는 비공식, 운영사가 스펙(엔드포인트/salt) 변경 가능
- `.clasprc.json` 은 절대 커밋 금지 (`.gitignore` 처리됨)
