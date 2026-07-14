# 📱 Solapi SMS 프로젝트 완전 분석

> **Google Apps Script Standalone** - Solapi API를 활용한 SMS 전송 시스템

---

## 📚 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [Solapi API 이해하기 (초보자용)](#2-solapi-api-이해하기-초보자용)
3. [HMAC-SHA256 인증 방식](#3-hmac-sha256-인증-방식)
4. [GAS 아키텍처](#4-gas-아키텍처)
5. [주요 기능](#5-주요-기능)
6. [GAS API 사용](#6-gas-api-사용)
7. [파일 구조](#7-파일-구조)
8. [코드 상세 분석](#8-코드-상세-분석)
9. [보안 및 권한](#9-보안-및-권한)
10. [배포 및 실행](#10-배포-및-실행)
11. [참고 자료](#11-참고-자료)

---

## 1. 프로젝트 개요

### 🎯 프로젝트 목적

**Solapi REST API를 활용한 SMS 발송 시스템**

- **HMAC-SHA256 인증** 기반 API 호출
- **PropertiesService**로 민감정보 관리 (API Key, Secret)
- **UrlFetchApp**으로 HTTP POST 요청
- **Standalone Script** (독립 실행)

### 🔍 핵심 특징

| 특징 | 설명 |
|------|------|
| **프로젝트 타입** | Standalone Script (독립 실행) |
| **외부 API** | Solapi REST API (SMS 전송) |
| **인증 방식** | HMAC-SHA256 서명 |
| **설정 관리** | PropertiesService (ScriptProperties) |
| **HTTP 요청** | UrlFetchApp |
| **외부 라이브러리** | 없음 (순수 GAS) |

### 🆚 프로젝트 비교

| 구분 | user-permission | geo-location | solapi |
|------|-----------------|--------------|--------|
| **타입** | Web App | Web App | Standalone |
| **외부 API** | 없음 | 없음 | Solapi API |
| **인증** | localStorage | 브라우저 권한 | HMAC-SHA256 |
| **설정 저장** | Google Sheets | 없음 | PropertiesService |
| **UI** | HTML | HTML | 없음 (서버만) |

---

## 2. Solapi API 이해하기 (초보자용)

### 🤔 Solapi란?

**Solapi**는 한국의 SMS/LMS/MMS 발송 서비스입니다.

**공식 사이트:** https://solapi.com

**주요 기능:**
- SMS (단문 문자, 90byte)
- LMS (장문 문자, 2000byte)
- MMS (멀티미디어 문자, 이미지 포함)
- 알림톡 (카카오톡 비즈니스)
- 국제 문자

### 📡 SMS 전송 흐름

```
┌─────────────────────────────────────────────────────┐
│           Google Apps Script                        │
├─────────────────────────────────────────────────────┤
│  1. sendSolapiSMS() 함수 실행                       │
│     ↓                                               │
│  2. getConfig() → PropertiesService에서 설정 읽기   │
│     - SOLAPI_API_KEY                                │
│     - SOLAPI_API_SECRET                             │
│     - SOLAPI_PHONE_FROM (발신자 번호)               │
│     - SOLAPI_PHONE_TO (수신자 번호)                 │
│     ↓                                               │
│  3. HMAC-SHA256 서명 생성                           │
│     - timestamp (ISO 8601)                          │
│     - salt (UUID)                                   │
│     - signature = HMAC(timestamp + salt, apiSecret) │
│     ↓                                               │
│  4. HTTP POST 요청 (UrlFetchApp)                    │
│     URL: https://api.solapi.com/messages/v4/send-many│
│     Headers:                                        │
│       - Content-Type: application/json              │
│       - Authorization: HMAC-SHA256 ...              │
│     Body:                                           │
│       { messages: [{ text, to, from }] }            │
│     ↓                                               │
└─────────────────────────────────────────────────────┘
                     ↓ HTTP POST
┌─────────────────────────────────────────────────────┐
│              Solapi API 서버                        │
├─────────────────────────────────────────────────────┤
│  1. Authorization 헤더 검증                         │
│     - API Key 확인                                  │
│     - HMAC 서명 검증                                │
│     ↓                                               │
│  2. 요청 파라미터 검증                              │
│     - 발신자 번호 (등록된 번호인지)                  │
│     - 수신자 번호 (형식 확인)                        │
│     - 메시지 내용                                   │
│     ↓                                               │
│  3. SMS 발송 큐에 등록                              │
│     ↓                                               │
│  4. 응답 반환 (JSON)                                │
│     { "statusCode": "2000", "statusMessage": "OK" } │
└─────────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│            통신사 (SKT, KT, LG U+)                  │
├─────────────────────────────────────────────────────┤
│  SMS 발송 → 수신자 휴대폰으로 전송                  │
└─────────────────────────────────────────────────────┘
```

### 💰 Solapi 요금제

| 메시지 타입 | 요금 (건당) |
|------------|------------|
| **SMS** | 약 8원 |
| **LMS** | 약 30원 |
| **MMS** | 약 100원 |
| **알림톡** | 약 7원 |

**무료 크레딧:** 신규 가입 시 무료 테스트 크레딧 제공

### 🔐 API Key 발급 방법

1. **Solapi 회원가입**
   - https://solapi.com 접속
   - 회원가입 (이메일 인증)

2. **API Key 생성**
   - 로그인 → 개발자센터
   - API Key 관리 → 새로운 API Key 생성
   - **API Key**: `NCSA...` (공개 가능)
   - **API Secret**: `...` (절대 공개 금지!)

3. **발신번호 등록**
   - 내 정보 → 발신번호 관리
   - 휴대폰 인증 또는 서류 제출
   - 승인 후 발신번호로 사용 가능

---

## 3. HMAC-SHA256 인증 방식

### 🔐 HMAC-SHA256이란?

**HMAC (Hash-based Message Authentication Code)**
- 메시지 인증 코드
- 데이터가 변조되지 않았음을 보장
- 서버만 검증 가능 (API Secret 필요)

**SHA-256**
- 해시 알고리즘 (256bit)
- 단방향 암호화 (복호화 불가능)

### 📊 인증 흐름 상세

```
┌─────────────────────────────────────────────────────┐
│              클라이언트 (GAS)                        │
├─────────────────────────────────────────────────────┤
│  1. 현재 타임스탬프 생성                             │
│     timestamp = "2026-01-27T14:30:45.123Z"          │
│     ↓                                               │
│  2. 랜덤 Salt 생성 (UUID)                           │
│     salt = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"   │
│     ↓                                               │
│  3. 서명 데이터 생성                                 │
│     hmacData = timestamp + salt                     │
│     = "2026-01-27T14:30:45.123Za1b2c3d4-e5f6..."    │
│     ↓                                               │
│  4. HMAC-SHA256 서명 생성                           │
│     signatureBytes = HMAC-SHA256(hmacData, apiSecret)│
│     ↓                                               │
│  5. 바이트 배열 → HEX 문자열 변환                    │
│     signature = "3a7b9c2d..."                       │
│     ↓                                               │
│  6. Authorization 헤더 구성                         │
│     Authorization: HMAC-SHA256                      │
│       apiKey=NCSA...,                               │
│       salt=a1b2c3d4...,                             │
│       date=2026-01-27T14:30:45.123Z,                │
│       signature=3a7b9c2d...                         │
│     ↓                                               │
│  7. HTTP POST 요청 전송                             │
└─────────────────────────────────────────────────────┘
                     ↓ HTTPS
┌─────────────────────────────────────────────────────┐
│              Solapi API 서버                        │
├─────────────────────────────────────────────────────┤
│  1. Authorization 헤더 파싱                         │
│     - apiKey 추출 → DB에서 apiSecret 조회           │
│     - salt, date, signature 추출                    │
│     ↓                                               │
│  2. 타임스탬프 검증                                  │
│     - 현재 시각과 비교 (10분 이내인지)               │
│     - 재전송 공격(Replay Attack) 방지               │
│     ↓                                               │
│  3. 서명 재생성 (서버에서)                           │
│     hmacData = date + salt                          │
│     expectedSignature = HMAC-SHA256(hmacData, apiSecret)│
│     ↓                                               │
│  4. 서명 비교                                        │
│     if (signature === expectedSignature) {          │
│       ✅ 인증 성공                                  │
│     } else {                                        │
│       ❌ 인증 실패 (401 Unauthorized)               │
│     }                                               │
└─────────────────────────────────────────────────────┘
```

### 🔑 왜 HMAC-SHA256을 사용하나?

**일반 API Key 방식 (비추천):**
```
Authorization: Bearer API_KEY
```

**문제점:**
- API Key가 노출되면 누구나 사용 가능
- 요청 변조 불가능 (중간자 공격 취약)

**HMAC-SHA256 방식 (권장):**
```
Authorization: HMAC-SHA256 apiKey=..., signature=...
```

**장점:**
- ✅ **API Secret은 서버에만 보관** (전송 안 함)
- ✅ **타임스탬프로 재전송 공격 방지**
- ✅ **서명으로 요청 변조 감지**
- ✅ **Salt로 동일 요청도 서명 다름**

---

## 4. GAS 아키텍처

### 📊 시스템 구조

```
┌─────────────────────────────────────────────────────┐
│         Google Apps Script (Standalone)             │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐  │
│  │  PropertiesService (Script Properties)       │  │
│  │  ┌────────────────────────────────────────┐  │  │
│  │  │  SOLAPI_API_KEY: "NCSA..."             │  │  │
│  │  │  SOLAPI_API_SECRET: "..."              │  │  │
│  │  │  SOLAPI_PHONE_FROM: "01012345678"      │  │  │
│  │  │  SOLAPI_PHONE_TO: "01087654321"        │  │  │
│  │  └────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────┘  │
│                     ↓ getConfig()                   │
│  ┌──────────────────────────────────────────────┐  │
│  │  Config.js                                   │  │
│  │  function getConfig() {                      │  │
│  │    - PropertiesService 읽기                  │  │
│  │    - 설정 검증                               │  │
│  │    - Config 객체 반환                        │  │
│  │  }                                           │  │
│  └──────────────────────────────────────────────┘  │
│                     ↓                               │
│  ┌──────────────────────────────────────────────┐  │
│  │  Code.js                                     │  │
│  │  function sendSolapiSMS() {                  │  │
│  │    1. getConfig()                            │  │
│  │    2. timestamp = new Date().toISOString()   │  │
│  │    3. salt = Utilities.getUuid()             │  │
│  │    4. signature = HMAC-SHA256(...)           │  │
│  │    5. HTTP POST (UrlFetchApp)                │  │
│  │  }                                           │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                     ↓ HTTPS POST
┌─────────────────────────────────────────────────────┐
│       https://api.solapi.com/messages/v4/send-many  │
└─────────────────────────────────────────────────────┘
                     ↓ SMS 발송
┌─────────────────────────────────────────────────────┐
│              수신자 휴대폰                           │
└─────────────────────────────────────────────────────┘
```

### 🔄 실행 흐름

#### A. 최초 설정 (1회)

```
1. Solapi 회원가입 및 API Key 발급
   ↓
2. GAS 에디터 열기
   clasp open-script
   ↓
3. 프로젝트 설정 → 스크립트 속성
   ┌────────────────────────────────────┐
   │ 속성                | 값            │
   ├────────────────────────────────────┤
   │ SOLAPI_API_KEY      | NCSA...      │
   │ SOLAPI_API_SECRET   | ...          │
   │ SOLAPI_PHONE_FROM   | 01012345678  │
   │ SOLAPI_PHONE_TO     | 01087654321  │
   └────────────────────────────────────┘
   ↓
4. 설정 완료!
```

#### B. SMS 전송 실행

```
1. GAS 에디터에서 sendSolapiSMS() 함수 선택
   ↓
2. 실행 버튼 클릭
   ↓
3. getConfig() 실행
   ├─ PropertiesService.getScriptProperties()
   ├─ 4개 속성 읽기
   ├─ 누락된 속성 확인
   │  ├─ 없으면 → Error throw
   │  └─ 있으면 → Config 객체 반환
   ↓
4. 타임스탬프 생성
   timestamp = "2026-01-27T14:30:45.123Z"
   ↓
5. Salt 생성 (UUID)
   salt = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
   ↓
6. HMAC-SHA256 서명 생성
   ├─ hmacData = timestamp + salt
   ├─ signatureBytes = Utilities.computeHmacSha256Signature(hmacData, apiSecret)
   ├─ signature = bytes → HEX 변환
   ↓
7. HTTP 요청 옵션 구성
   {
     method: 'post',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': 'HMAC-SHA256 apiKey=..., signature=...'
     },
     payload: JSON.stringify({
       messages: [{
         text: '[솔라피 테스트] hello world!',
         to: '01087654321',
         from: '01012345678'
       }]
     })
   }
   ↓
8. UrlFetchApp.fetch() 실행
   ├─ Solapi API로 POST 요청
   ├─ 응답 수신 (JSON)
   └─ console.log(response)
   ↓
9. 실행 로그 확인
   clasp logs
   또는 GAS 에디터 → 실행 로그
```

---

## 5. 주요 기능

### ✅ 기능 목록

| 기능 | 함수 | 파일 | 설명 |
|------|------|------|------|
| **설정 로드** | `getConfig()` | Config.js:14-44 | PropertiesService에서 설정 읽기 |
| **SMS 전송** | `sendSolapiSMS()` | Code.js:1-50 | Solapi API 호출 |

---

### 🎛️ 기능 1: 설정 로드

**함수:** `getConfig()` (Config.js:14-44)

**코드:**
```javascript
function getConfig() {
  const properties = PropertiesService.getScriptProperties();

  const apiKey = properties.getProperty('SOLAPI_API_KEY');
  const apiSecret = properties.getProperty('SOLAPI_API_SECRET');
  const phoneFrom = properties.getProperty('SOLAPI_PHONE_FROM');
  const phoneTo = properties.getProperty('SOLAPI_PHONE_TO');

  // 설정 검증
  if (!apiKey || !apiSecret || !phoneFrom || !phoneTo) {
    const missing = [];
    if (!apiKey) missing.push('SOLAPI_API_KEY');
    if (!apiSecret) missing.push('SOLAPI_API_SECRET');
    if (!phoneFrom) missing.push('SOLAPI_PHONE_FROM');
    if (!phoneTo) missing.push('SOLAPI_PHONE_TO');

    throw new Error(
      '❌ Solapi 설정이 누락되었습니다.\n\n' +
        `누락된 속성: ${missing.join(', ')}\n\n` +
        '설정 위치: GAS 에디터 → 프로젝트 설정 → 스크립트 속성',
    );
  }

  return {
    apiKey,
    apiSecret,
    phoneFrom,
    phoneTo,
    apiUrl: 'https://api.solapi.com/messages/v4/send-many',
  };
}
```

**단계별 설명:**

1. **PropertiesService.getScriptProperties()**
   - 스크립트 레벨 속성 저장소
   - 프로젝트 전체에서 공유
   - Git에 포함되지 않음 (민감정보 보호)

2. **4개 속성 읽기**
   - `SOLAPI_API_KEY`: 공개 키
   - `SOLAPI_API_SECRET`: 비밀 키 (절대 노출 금지)
   - `SOLAPI_PHONE_FROM`: 발신자 번호
   - `SOLAPI_PHONE_TO`: 수신자 번호

3. **설정 검증**
   - 누락된 속성이 있는지 확인
   - 있으면 → 명확한 에러 메시지와 함께 throw

4. **Config 객체 반환**
   - 5개 필드 (API Key, Secret, From, To, URL)
   - `apiUrl`은 하드코딩 (Solapi 공식 엔드포인트)

**장점:**
- ✅ 민감정보를 코드에서 분리
- ✅ 명확한 에러 메시지
- ✅ 설정 검증 (누락 방지)

---

### 📱 기능 2: SMS 전송

**함수:** `sendSolapiSMS()` (Code.js:1-50)

**코드:**
```javascript
function sendSolapiSMS() {
  // ✅ 1. Config에서 안전하게 API 정보 가져오기
  const config = getConfig();
  const { apiKey, apiSecret, phoneFrom, phoneTo, apiUrl } = config;

  // ✅ 2. 현재 타임스탬프 생성 (ISO 8601 형식)
  const timestamp = new Date().toISOString();

  // ✅ 3. 랜덤한 salt 값 생성 (UUID 사용)
  const salt = Utilities.getUuid();

  // ✅ 4. HMAC-SHA256 서명 생성
  const hmacData = timestamp + salt;
  const signatureBytes = Utilities.computeHmacSha256Signature(hmacData, apiSecret);

  // ✅ 5. 서명을 HEX 문자열로 변환
  const signature = signatureBytes
    .map((byte) => ('0' + (byte & 0xff).toString(16)).slice(-2))
    .join('');

  // ✅ 6. 전송할 문자 메시지 내용 설정
  const params = {
    messages: [
      {
        text: '[솔라피 테스트] hello world!',
        to: phoneTo,
        from: phoneFrom,
      },
    ],
  };

  // ✅ 7. HTTP 요청 옵션 설정
  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `HMAC-SHA256 apiKey=${apiKey}, salt=${salt}, date=${timestamp}, signature=${signature}`,
    },
    payload: JSON.stringify(params),
    muteHttpExceptions: true,
  };

  // ✅ 8. API 요청 보내기 & 응답 확인
  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    console.log('Response Text:', response.getContentText());
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}
```

**단계별 상세 설명:**

#### Step 1: 설정 로드

```javascript
const config = getConfig();
const { apiKey, apiSecret, phoneFrom, phoneTo, apiUrl } = config;
```

- `getConfig()` 호출 → PropertiesService 읽기
- 구조 분해 할당 (Destructuring)

#### Step 2: 타임스탬프 생성

```javascript
const timestamp = new Date().toISOString();
// "2026-01-27T14:30:45.123Z"
```

**ISO 8601 형식:**
- `YYYY-MM-DDTHH:mm:ss.sssZ`
- UTC 타임존 (Z = Zulu Time)

**왜 타임스탬프가 필요한가?**
- 재전송 공격(Replay Attack) 방지
- 서버에서 10분 이내 요청만 허용

#### Step 3: Salt 생성

```javascript
const salt = Utilities.getUuid();
// "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

**UUID (Universally Unique Identifier):**
- 128비트 랜덤 값
- 중복 가능성 극히 낮음

**왜 Salt가 필요한가?**
- 동일한 timestamp에도 서명이 다르게 생성됨
- 서명 재사용 공격 방지

#### Step 4: HMAC-SHA256 서명 생성

```javascript
const hmacData = timestamp + salt;
const signatureBytes = Utilities.computeHmacSha256Signature(hmacData, apiSecret);
```

**Utilities.computeHmacSha256Signature():**
- GAS 내장 함수
- HMAC-SHA256 알고리즘으로 서명 생성
- 반환값: 바이트 배열 (Byte[])

**공식 문서:**
https://developers.google.com/apps-script/reference/utilities/utilities#computeHmacSha256Signature(String,String)

#### Step 5: HEX 변환

```javascript
const signature = signatureBytes
  .map((byte) => ('0' + (byte & 0xff).toString(16)).slice(-2))
  .join('');
```

**바이트 배열 → HEX 문자열 변환:**

```
바이트 배열: [58, 123, 156, 45, ...]
   ↓
HEX 문자열: "3a7b9c2d..."
```

**변환 과정:**
1. `byte & 0xff` → 부호 없는 정수로 변환
2. `.toString(16)` → 16진수 문자열
3. `'0' + ...` → 앞에 0 추가 (한 자리 숫자 대비)
4. `.slice(-2)` → 마지막 2자리만 (00-FF)
5. `.join('')` → 문자열 연결

**예시:**
```javascript
58 → (58).toString(16) = "3a" → "3a"
123 → (123).toString(16) = "7b" → "7b"
12 → (12).toString(16) = "c" → "0c" (앞에 0 추가)
```

#### Step 6: 메시지 파라미터 구성

```javascript
const params = {
  messages: [
    {
      text: '[솔라피 테스트] hello world!',
      to: phoneTo,
      from: phoneFrom,
    },
  ],
};
```

**Solapi API 요구 형식:**
- `messages`: 배열 (여러 메시지 동시 발송 가능)
- `text`: 문자 내용 (한글 45자, 영문 90자)
- `to`: 수신자 번호 (하이픈 없음)
- `from`: 발신자 번호 (등록된 번호만)

**여러 메시지 동시 발송:**
```javascript
const params = {
  messages: [
    { text: '메시지1', to: '01012345678', from: phoneFrom },
    { text: '메시지2', to: '01087654321', from: phoneFrom },
  ],
};
```

#### Step 7: HTTP 요청 옵션

```javascript
const options = {
  method: 'post',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `HMAC-SHA256 apiKey=${apiKey}, salt=${salt}, date=${timestamp}, signature=${signature}`,
  },
  payload: JSON.stringify(params),
  muteHttpExceptions: true,
};
```

**Authorization 헤더 형식:**
```
HMAC-SHA256 apiKey=NCSA..., salt=a1b2..., date=2026-01-27T14:30:45.123Z, signature=3a7b...
```

**muteHttpExceptions: true**
- HTTP 오류 응답(4xx, 5xx)도 예외 던지지 않고 반환
- 응답 내용을 확인하여 에러 처리 가능

#### Step 8: API 요청 실행

```javascript
try {
  const response = UrlFetchApp.fetch(apiUrl, options);
  console.log('Response Text:', response.getContentText());
} catch (error) {
  console.error('Error sending SMS:', error);
}
```

**UrlFetchApp.fetch():**
- GAS 내장 HTTP 클라이언트
- 동기 방식 (응답 받을 때까지 대기)

**성공 응답 예시:**
```json
{
  "statusCode": "2000",
  "statusMessage": "정상 접수(이통사로 접수 예정) ",
  "groupId": "G4V20180307105937H3PTASXMNJG2JID"
}
```

**실패 응답 예시:**
```json
{
  "errorCode": "ValidationError",
  "errorMessage": "InvalidApiKey"
}
```

---

## 6. GAS API 사용

### 📚 사용된 GAS API 목록

| API | 사용 위치 | 목적 |
|-----|----------|------|
| **PropertiesService** | getConfig() | 설정 관리 |
| **Utilities** | sendSolapiSMS() | HMAC 서명, UUID |
| **UrlFetchApp** | sendSolapiSMS() | HTTP 요청 |
| **console** | 전체 | 로깅 |

---

### 1️⃣ PropertiesService

**공식 문서:** https://developers.google.com/apps-script/reference/properties/properties-service

**사용 예시:**

#### A. Script Properties (프로젝트 전체 공유)

**저장:**
```javascript
const scriptProperties = PropertiesService.getScriptProperties();
scriptProperties.setProperty('SOLAPI_API_KEY', 'NCSA...');
scriptProperties.setProperty('SOLAPI_API_SECRET', '...');
```

**읽기:**
```javascript
const apiKey = scriptProperties.getProperty('SOLAPI_API_KEY');
```

**삭제:**
```javascript
scriptProperties.deleteProperty('SOLAPI_API_KEY');
```

**모두 가져오기:**
```javascript
const allProps = scriptProperties.getProperties();
// { SOLAPI_API_KEY: 'NCSA...', SOLAPI_API_SECRET: '...' }
```

#### B. PropertiesService 3가지 타입

| 타입 | 메서드 | 범위 |
|------|--------|------|
| **Script** | `getScriptProperties()` | 프로젝트 전체 공유 |
| **User** | `getUserProperties()` | 사용자별 독립 |
| **Document** | `getDocumentProperties()` | 문서별 독립 |

**이 프로젝트는 Script Properties 사용:**
- 모든 사용자가 동일한 API Key 사용
- 프로젝트 레벨 설정

---

### 2️⃣ Utilities

**공식 문서:** https://developers.google.com/apps-script/reference/utilities/utilities

**사용 예시:**

#### A. UUID 생성

**코드:**
```javascript
const uuid = Utilities.getUuid();
// "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

**용도:**
- 고유 ID 생성
- Salt 값
- 세션 ID

#### B. HMAC-SHA256 서명

**코드:**
```javascript
const data = "hello world";
const secret = "my-secret-key";
const signatureBytes = Utilities.computeHmacSha256Signature(data, secret);
```

**반환값:** `Byte[]` (바이트 배열)

**다른 HMAC 알고리즘:**
```javascript
// HMAC-SHA1
Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, data, secret);

// HMAC-SHA256
Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, data, secret);

// HMAC-SHA512
Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_512, data, secret);
```

#### C. Base64 인코딩/디코딩

**인코딩:**
```javascript
const text = "hello world";
const base64 = Utilities.base64Encode(text);
// "aGVsbG8gd29ybGQ="
```

**디코딩:**
```javascript
const decoded = Utilities.base64Decode(base64);
// "hello world"
```

#### D. 날짜 포맷팅

**코드:**
```javascript
const date = new Date();
const formatted = Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
// "2026-01-27 14:30:45"
```

---

### 3️⃣ UrlFetchApp

**공식 문서:** https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app

**사용 예시:**

#### A. GET 요청

**코드:**
```javascript
const response = UrlFetchApp.fetch('https://api.example.com/data');
const text = response.getContentText();
const json = JSON.parse(text);
```

#### B. POST 요청 (JSON)

**코드:**
```javascript
const url = 'https://api.example.com/data';
const options = {
  method: 'post',
  headers: {
    'Content-Type': 'application/json',
  },
  payload: JSON.stringify({ key: 'value' }),
};

const response = UrlFetchApp.fetch(url, options);
```

#### C. 인증 헤더 추가

**Bearer Token:**
```javascript
const options = {
  method: 'get',
  headers: {
    'Authorization': 'Bearer eyJhbGc...',
  },
};
```

**Basic Auth:**
```javascript
const options = {
  method: 'get',
  headers: {
    'Authorization': 'Basic ' + Utilities.base64Encode('user:password'),
  },
};
```

#### D. 응답 처리

**상태 코드 확인:**
```javascript
const response = UrlFetchApp.fetch(url, options);
const statusCode = response.getResponseCode(); // 200, 401, 500, ...

if (statusCode === 200) {
  console.log('성공!');
} else {
  console.error('실패:', statusCode);
}
```

**헤더 읽기:**
```javascript
const headers = response.getHeaders();
console.log(headers['Content-Type']);
```

---

## 7. 파일 구조

### 📂 프로젝트 구조

```
projects/solapi/
├── Code.js                 # SMS 전송 로직 (51줄)
├── Config.js               # 설정 관리 (45줄)
├── appsscript.json         # 프로젝트 설정
└── .clasp.json             # Script ID
```

### 📄 파일별 설명

#### 1. Code.js (51줄)

**역할:** SMS 전송 로직

**함수:**
- `sendSolapiSMS()` (1-50줄) - 메인 로직

**주요 작업:**
1. 설정 로드 (`getConfig()`)
2. 타임스탬프 생성
3. Salt 생성 (UUID)
4. HMAC-SHA256 서명 생성
5. HTTP POST 요청
6. 응답 로깅

**특징:**
- ✅ 상세한 주석 (8개 단계)
- ✅ try-catch 에러 핸들링
- ✅ console.log/error 사용
- ❌ 입력값 검증 없음 (getConfig에서 처리)

#### 2. Config.js (45줄)

**역할:** 설정 관리

**함수:**
- `getConfig()` (14-44줄) - 설정 로드 및 검증

**주요 작업:**
1. PropertiesService 읽기
2. 4개 속성 검증
3. 누락 시 명확한 에러 메시지
4. Config 객체 반환

**특징:**
- ✅ JSDoc 주석
- ✅ 설정 검증 (누락 방지)
- ✅ 명확한 에러 메시지
- ✅ 민감정보 분리

#### 3. appsscript.json (7줄)

**역할:** GAS 프로젝트 설정

**내용:**
```json
{
  "timeZone": "Asia/Seoul",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

**특징:**
- ✅ 외부 라이브러리 없음
- ✅ V8 런타임 (최신)
- ✅ Stackdriver 로깅

#### 4. .clasp.json (10줄)

**역할:** clasp 설정

**내용:**
```json
{
  "scriptId": "19vmqWUMzjAnFc4_wq7F2Estl_32n3UmUi2yI6UTl2bl7TTY5YelWwpN_",
  "rootDir": "",
  "scriptExtensions": [".js", ".gs"],
  "htmlExtensions": [".html"],
  "jsonExtensions": [".json"],
  "filePushOrder": [],
  "skipSubdirectories": false
}
```

**주의:**
- `filePushOrder`가 비어있음
- Config.js가 Code.js보다 먼저 로드되어야 함
- **현재는 알파벳 순서로 로드** (`Code.js` → `Config.js`)
- 하지만 함수 호출 시점에는 모두 로드되어 있으므로 문제없음

---

## 8. 코드 상세 분석

### 🔍 핵심 패턴

#### 패턴 1: 설정 분리 (Config 패턴)

**장점:**
- 민감정보를 코드에서 분리
- PropertiesService로 Git에 노출 방지
- 설정 변경 시 코드 수정 불필요

**구조:**
```javascript
// Config.js
function getConfig() {
  // PropertiesService 읽기
  // 검증
  // 반환
}

// Code.js
function sendSolapiSMS() {
  const config = getConfig(); // 설정 주입
  // 로직 실행
}
```

#### 패턴 2: HMAC 서명 생성 패턴

**재사용 가능한 함수로 분리 가능:**

```javascript
/**
 * HMAC-SHA256 서명 생성 유틸리티
 * @param {string} data - 서명할 데이터
 * @param {string} secret - 비밀키
 * @return {string} HEX 형식 서명
 */
function createHmacSignature(data, secret) {
  const signatureBytes = Utilities.computeHmacSha256Signature(data, secret);
  return signatureBytes
    .map((byte) => ('0' + (byte & 0xff).toString(16)).slice(-2))
    .join('');
}

// 사용
const signature = createHmacSignature(timestamp + salt, apiSecret);
```

#### 패턴 3: try-catch 에러 핸들링

**현재 코드:**
```javascript
try {
  const response = UrlFetchApp.fetch(apiUrl, options);
  console.log('Response Text:', response.getContentText());
} catch (error) {
  console.error('Error sending SMS:', error);
}
```

**개선 가능:**
```javascript
try {
  const response = UrlFetchApp.fetch(apiUrl, options);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode === 200) {
    console.log('✅ SMS 전송 성공:', responseText);
    return { success: true, data: JSON.parse(responseText) };
  } else {
    console.error('❌ SMS 전송 실패 (Status Code):', statusCode);
    console.error('응답:', responseText);
    return { success: false, error: responseText };
  }
} catch (error) {
  console.error('❌ SMS 전송 실패 (Exception):', error.message);
  return { success: false, error: error.message };
}
```

---

### 🐛 개선 제안

#### 이슈 1: 함수 반환값 없음

**현재:**
```javascript
function sendSolapiSMS() {
  try {
    // ...
    console.log('Response Text:', response.getContentText());
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
  // 반환값 없음
}
```

**문제:**
- 성공/실패 여부를 알 수 없음
- 다른 함수에서 호출 시 결과 확인 불가

**개선:**
```javascript
function sendSolapiSMS() {
  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());
    console.log('✅ SMS 전송 성공:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ SMS 전송 실패:', error);
    return { success: false, error: error.message };
  }
}

// 사용
const result = sendSolapiSMS();
if (result.success) {
  console.log('발송 완료!');
} else {
  console.log('발송 실패:', result.error);
}
```

#### 이슈 2: 하드코딩된 메시지

**현재:**
```javascript
const params = {
  messages: [
    {
      text: '[솔라피 테스트] hello world!', // 하드코딩
      to: phoneTo,
      from: phoneFrom,
    },
  ],
};
```

**개선:**
```javascript
function sendSolapiSMS(messageText, recipientPhone) {
  const config = getConfig();
  // ...

  const params = {
    messages: [
      {
        text: messageText || '[솔라피 테스트] hello world!',
        to: recipientPhone || config.phoneTo,
        from: config.phoneFrom,
      },
    ],
  };

  // ...
}

// 사용
sendSolapiSMS('안녕하세요!', '01012345678');
```

#### 이슈 3: ESLint 경고

**현재:**
```javascript
// Code.js:3
const config = getConfig(); // 'getConfig' is not defined.eslintno-undef
```

**해결 방법 1: 주석 추가 (추천)**
```javascript
/* global getConfig */

function sendSolapiSMS() {
  const config = getConfig();
  // ...
}
```

**해결 방법 2: eslint.config.js 수정**
```javascript
// eslint.config.js
const CUSTOM_RESERVED_FUNCTIONS = {
  getConfig: 'readonly',
};
```

---

## 9. 보안 및 권한

### 🔐 민감정보 관리

#### ✅ 올바른 방법 (PropertiesService)

**저장 위치:**
- GAS 에디터 → 프로젝트 설정 → 스크립트 속성
- Git에 포함되지 않음
- 서버에만 저장

**코드:**
```javascript
const scriptProperties = PropertiesService.getScriptProperties();
const apiSecret = scriptProperties.getProperty('SOLAPI_API_SECRET');
```

#### ❌ 잘못된 방법

**1. 코드에 하드코딩 (절대 금지!)**
```javascript
// ❌ Git에 노출됨!
const apiSecret = 'my-secret-key-12345';
```

**2. .env 파일 (GAS에서 지원 안 함)**
```javascript
// ❌ GAS는 .env 파일 사용 불가
require('dotenv').config();
```

**3. appsscript.json에 저장**
```json
{
  "apiSecret": "..." // ❌ Git에 노출됨!
}
```

---

### 🛡️ HMAC 서명 보안

#### 왜 안전한가?

1. **API Secret은 전송 안 함**
   - 클라이언트 → 서버: signature만 전송
   - Secret은 서버에만 보관

2. **서명 재사용 불가**
   - 타임스탬프 포함 (10분 이내만 유효)
   - Salt 랜덤 생성 (매번 다름)

3. **요청 변조 감지**
   - 요청 내용이 변경되면 서명 불일치
   - 중간자 공격 방지

#### 공격 시나리오

**시나리오 1: API Secret 탈취 시도**
```
공격자가 네트워크 패킷 캡처
   ↓
Authorization 헤더 확인
   ↓
signature만 보임 (API Secret 없음)
   ↓
❌ API Secret 탈취 실패
```

**시나리오 2: 서명 재사용 시도**
```
공격자가 이전 요청 캡처
   ↓
동일한 Authorization 헤더로 재전송
   ↓
서버에서 타임스탬프 확인
   ↓
10분 경과 → ❌ 거부
```

**시나리오 3: 요청 변조 시도**
```
공격자가 요청 캡처
   ↓
payload의 "to" 번호를 자신의 번호로 변경
   ↓
Authorization 헤더는 그대로 사용
   ↓
서버에서 서명 검증
   ↓
signature = HMAC(timestamp + salt, secret)
expectedSignature = HMAC(timestamp + salt, secret)
   ↓
변경된 payload는 서명에 포함되지 않음 (timestamp + salt만 서명)
   ↓
⚠️ 이론적으로 가능하지만, Solapi는 실제로 payload도 포함하여 서명
```

**Solapi 실제 서명 방식 (추정):**
```
signature = HMAC(timestamp + salt + JSON.stringify(payload), secret)
```

---

## 10. 배포 및 실행

### 🚀 배포 방법

#### A. Script Properties 설정 (최초 1회)

**GAS 에디터에서 설정:**

```bash
clasp open-script
```

**프로젝트 설정 → 스크립트 속성 → 속성 추가:**

| 속성 | 값 | 비고 |
|------|-----|------|
| `SOLAPI_API_KEY` | `NCSA...` | Solapi 개발자센터에서 발급 |
| `SOLAPI_API_SECRET` | `...` | 절대 노출 금지! |
| `SOLAPI_PHONE_FROM` | `01012345678` | 등록된 발신번호 |
| `SOLAPI_PHONE_TO` | `01087654321` | 수신자 번호 |

---

#### B. 코드 푸시

```bash
cd projects/solapi
clasp push
```

---

#### C. 함수 실행

**GAS 에디터에서:**

1. `clasp open-script` 실행
2. 함수 선택: `sendSolapiSMS`
3. 실행 버튼 클릭
4. 권한 승인 (최초 1회)

**권한 승인 화면:**
```
이 앱은 확인되지 않았습니다
→ 고급 → "프로젝트 이름(안전하지 않음)"으로 이동
→ 허용
```

**필요 권한:**
- PropertiesService 읽기
- 외부 URL 접근 (UrlFetchApp)

---

### 🧪 테스트 방법

#### 시나리오 1: 정상 전송

**실행:**
```
GAS 에디터 → sendSolapiSMS() 실행
```

**기대 결과:**
```
Response Text: {"statusCode":"2000","statusMessage":"정상 접수(이통사로 접수 예정) "}
```

**수신자 휴대폰:**
```
[솔라피 테스트] hello world!
```

#### 시나리오 2: 설정 누락

**상황:**
- Script Properties에서 `SOLAPI_API_KEY` 삭제

**실행:**
```
GAS 에디터 → sendSolapiSMS() 실행
```

**기대 결과 (에러):**
```
Error: ❌ Solapi 설정이 누락되었습니다.

누락된 속성: SOLAPI_API_KEY

설정 위치: GAS 에디터 → 프로젝트 설정 → 스크립트 속성
```

#### 시나리오 3: 잘못된 API Secret

**상황:**
- `SOLAPI_API_SECRET`을 잘못된 값으로 설정

**실행:**
```
GAS 에디터 → sendSolapiSMS() 실행
```

**기대 결과 (실패 응답):**
```
Response Text: {"errorCode":"ValidationError","errorMessage":"InvalidSignature"}
```

#### 시나리오 4: 미등록 발신번호

**상황:**
- `SOLAPI_PHONE_FROM`을 등록되지 않은 번호로 설정

**기대 결과:**
```
Response Text: {"errorCode":"ValidationError","errorMessage":"UnregisteredSenderNumber"}
```

---

### 🛠️ 디버깅

#### A. 로그 확인

**방법 1: clasp logs**
```bash
clasp logs
```

**방법 2: GAS 에디터**
```
GAS 에디터 → 실행 → 최근 실행 → 로그 보기
```

**로그 예시 (성공):**
```
Response Text: {"statusCode":"2000","statusMessage":"정상 접수"}
```

**로그 예시 (실패):**
```
Error sending SMS: Exception: Request failed for https://api.solapi.com returned code 401
```

#### B. 응답 상태 코드 확인

**추가 로깅:**
```javascript
try {
  const response = UrlFetchApp.fetch(apiUrl, options);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  console.log('Status Code:', statusCode);
  console.log('Response Text:', responseText);
} catch (error) {
  console.error('Error:', error);
}
```

**상태 코드 의미:**

| 코드 | 의미 |
|------|------|
| **200** | 성공 |
| **400** | 잘못된 요청 (파라미터 오류) |
| **401** | 인증 실패 (API Key/Secret 오류) |
| **403** | 권한 없음 |
| **429** | 요청 한도 초과 |
| **500** | 서버 오류 |

#### C. Solapi 콘솔 확인

**Solapi 개발자센터:**
- 로그인 → 문자 발송 내역
- 성공/실패 여부 확인
- 실패 사유 확인

---

## 11. 참고 자료

### 📖 공식 문서

| 리소스 | URL |
|--------|-----|
| **Solapi 공식 문서** | https://docs.solapi.com |
| **Solapi API Reference** | https://docs.solapi.com/api-reference/overview |
| **HMAC 인증 가이드** | https://docs.solapi.com/authentication/api-key |
| **Apps Script 공식 문서** | https://developers.google.com/apps-script |
| **PropertiesService** | https://developers.google.com/apps-script/reference/properties/properties-service |
| **UrlFetchApp** | https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app |
| **Utilities** | https://developers.google.com/apps-script/reference/utilities/utilities |

### 🔗 관련 프로젝트

- **user-permission**: Web App + Google Sheets
- **geo-location**: Web App + Geolocation API
- **sidebar-ui**: Container-bound + Sidebar

### 📊 프로젝트 통계

| 항목 | 수치 |
|------|------|
| **총 파일 수** | 4개 |
| **JavaScript 파일** | 2개 (Code.js, Config.js) |
| **HTML 파일** | 0개 |
| **총 코드 라인** | 96줄 |
| **함수 수** | 2개 |
| **사용된 GAS API** | 4개 (PropertiesService, Utilities, UrlFetchApp, console) |
| **외부 API** | 1개 (Solapi REST API) |
| **외부 라이브러리** | 0개 (순수 GAS) |

---

## 📝 마무리

이 프로젝트는 **외부 REST API 연동의 좋은 예시**입니다.

**핵심 학습 포인트:**

1. **PropertiesService** - 민감정보 안전 관리
2. **HMAC-SHA256** - API 인증 방식
3. **UrlFetchApp** - HTTP POST 요청
4. **Utilities** - HMAC 서명, UUID 생성
5. **설정 분리 패턴** - Config.js 분리

**활용 가능한 시나리오:**

- 주문 알림 SMS 발송
- 예약 확인 문자 전송
- 긴급 알림 발송
- 2단계 인증 (OTP)
- 배송 상태 알림

**확장 아이디어:**

- Google Sheets 연동 (주문 데이터 → SMS 발송)
- 폼 제출 시 자동 문자 발송
- 예약 시스템과 연동
- LMS/MMS 발송 (장문, 이미지)
- 알림톡 발송 (카카오톡)

---

**작성일:** 2026-01-28
**프로젝트:** apps-script-clasp/projects/solapi
**GAS Runtime:** V8
**TimeZone:** Asia/Seoul
**외부 API:** Solapi v4
