# 📍 Geo-Location 프로젝트 완전 분석

> **Google Apps Script Web App** - 브라우저 Geolocation API를 활용한 실시간 위치 추적 시스템

---

## 📚 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [Geolocation API 이해하기 (초보자용)](#2-geolocation-api-이해하기-초보자용)
3. [GAS 아키텍처](#3-gas-아키텍처)
4. [주요 기능](#4-주요-기능)
5. [WorkspaceCore 라이브러리](#5-workspacecore-라이브러리)
6. [GAS API 사용](#6-gas-api-사용)
7. [파일 구조](#7-파일-구조)
8. [코드 상세 분석](#8-코드-상세-분석)
9. [보안 및 권한](#9-보안-및-권한)
10. [배포 및 실행](#10-배포-및-실행)
11. [참고 자료](#11-참고-자료)

---

## 1. 프로젝트 개요

### 🎯 프로젝트 목적

**브라우저의 Geolocation API를 활용한 위치 추적 Web App**

- **실시간 위치 정보 표시** (위도, 경도, 정확도, 속도)
- **30초간 위치 감시** (watchPosition)
- **서버로 위치 데이터 전송** (google.script.run)
- **WorkspaceCore 라이브러리 테스트** (유틸리티 함수)

### 🔍 핵심 특징

| 특징 | 설명 |
|------|------|
| **프로젝트 타입** | Web App (독립 URL) |
| **위치 API** | Geolocation API (브라우저 내장) |
| **위치 추적 방식** | watchPosition (실시간) |
| **라이브러리** | WorkspaceCore (GAS 라이브러리) |
| **UI 방식** | 전체 화면 HTML |
| **외부 CDN** | 없음 (순수 HTML/CSS) |

### 🆚 프로젝트 비교

| 구분 | user-permission | sidebar-ui | geo-location |
|------|-----------------|------------|--------------|
| **타입** | Web App | Container-bound | Web App |
| **주요 기능** | CRM 시스템 | 사이드바 자동 실행 | 위치 추적 |
| **외부 라이브러리** | 5개 CDN | 없음 | 1개 GAS 라이브러리 |
| **복잡도** | 높음 (18개 함수) | 낮음 (8개 함수) | 낮음 (4개 함수) |
| **데이터 저장** | Google Sheets | PropertiesService | 없음 (콘솔만) |

---

## 2. Geolocation API 이해하기 (초보자용)

### 🤔 Geolocation API란?

**Geolocation API**는 브라우저에 내장된 JavaScript API로, 사용자의 현재 위치를 가져올 수 있습니다.

**중요:** 외부 라이브러리가 아닌 **브라우저 내장 기능**입니다!

```
┌─────────────────────────────────────────┐
│         사용자 브라우저 (Chrome)         │
│  ┌────────────────────────────────┐    │
│  │    JavaScript 실행 환경         │    │
│  │  ┌─────────────────────────┐   │    │
│  │  │  Geolocation API        │   │    │
│  │  │  (브라우저 내장)         │   │    │
│  │  │                         │   │    │
│  │  │  - getCurrentPosition() │   │    │
│  │  │  - watchPosition()      │   │    │
│  │  └─────────────────────────┘   │    │
│  └────────────────────────────────┘    │
│                 ↓                       │
│  ┌────────────────────────────────┐    │
│  │    위치 소스 (자동 선택)        │    │
│  │  - GPS (가장 정확)             │    │
│  │  - Wi-Fi                       │    │
│  │  - IP 주소                     │    │
│  │  - 통신사 기지국               │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 📡 위치 정보는 어떻게 가져오나요?

브라우저는 다음 소스를 **자동으로** 사용합니다:

| 소스 | 정확도 | 사용 가능 환경 |
|------|--------|----------------|
| **GPS** | ✅ 매우 높음 (1-10m) | 스마트폰, GPS 지원 노트북 |
| **Wi-Fi** | 🟡 중간 (10-100m) | Wi-Fi 연결 시 |
| **IP 주소** | ❌ 낮음 (도시 단위) | 항상 가능 |
| **통신사 기지국** | 🟡 중간 (100-1000m) | 모바일 네트워크 연결 시 |

**브라우저가 알아서 최선의 방법을 선택합니다!**

### 🔐 권한 요청

Geolocation API는 **사용자 권한**이 필요합니다.

```
사용자가 "위치 정보 가져오기" 버튼 클릭
   ↓
navigator.geolocation.watchPosition() 호출
   ↓
브라우저가 권한 요청 팝업 표시
   ├─ "허용" → 위치 정보 제공
   └─ "차단" → PERMISSION_DENIED 에러
```

**팝업 예시:**
```
┌──────────────────────────────────────────┐
│  이 사이트에서 사용자의 위치를            │
│  확인하도록 허용하시겠습니까?             │
│                                          │
│        [ 차단 ]      [ 허용 ]           │
└──────────────────────────────────────────┘
```

### 📊 getCurrentPosition vs watchPosition

| 구분 | getCurrentPosition | watchPosition |
|------|-------------------|---------------|
| **호출 횟수** | 1회 | 연속적 |
| **사용 목적** | 현재 위치 1번만 확인 | 실시간 위치 추적 |
| **에너지 소비** | 낮음 | 높음 |
| **정지 방법** | 자동 정지 | `clearWatch()` 필요 |
| **예시** | 주소 검색, 현재 위치 표시 | 네비게이션, 배달 추적 |

**이 프로젝트는 `watchPosition`을 사용합니다!**

---

## 3. GAS 아키텍처

### 📊 시스템 구조

```
┌─────────────────────────────────────────────────────┐
│                  사용자 브라우저                     │
├─────────────────────────────────────────────────────┤
│  1. Web App URL 접근                                │
│     https://script.google.com/macros/s/.../exec     │
│                     ↓                               │
│  ┌──────────────────────────────────────────────┐  │
│  │           Google Apps Script                 │  │
│  │  ┌────────────────────────────────────────┐  │  │
│  │  │  doGet()                               │  │  │
│  │  │  → index.html + styles.html 렌더링     │  │  │
│  │  └────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────┘  │
│                     ↓                               │
│  2. HTML + CSS + JavaScript 렌더링                  │
│  ┌──────────────────────────────────────────────┐  │
│  │  [내 현재 위치 확인]                         │  │
│  │  [ 위치 정보 가져오기 🔄 ]                   │  │
│  │  ┌────────────────────────────────────────┐ │  │
│  │  │ 버튼을 클릭하여 위치 정보를 가져오세요   │ │  │
│  │  └────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────┘  │
│                     ↓                               │
│  3. 사용자가 "위치 정보 가져오기" 버튼 클릭          │
│                     ↓                               │
│  4. 브라우저 권한 요청 팝업                          │
│     "이 사이트에서 위치 확인을 허용하시겠습니까?"     │
│     [ 차단 ] [ 허용 ]                              │
│                     ↓ (허용)                        │
│  5. navigator.geolocation.watchPosition() 실행      │
│     → Geolocation API (브라우저 내장)               │
│     → GPS/Wi-Fi/IP로 위치 정보 가져오기             │
│                     ↓                               │
│  6. showPosition(position) 콜백 실행                │
│     - 위도, 경도, 정확도, 속도 표시                  │
│     - google.script.run.processLocationData() 호출  │
│                     ↓                               │
│  ┌──────────────────────────────────────────────┐  │
│  │  위도: 37.566535                             │  │
│  │  경도: 126.977969                            │  │
│  │  정확도: 약 20.00 미터                        │  │
│  │  속도: 0.00 m/s                              │  │
│  │  업데이트 시각: 2026-01-27 14:30:45          │  │
│  └──────────────────────────────────────────────┘  │
│                     ↓                               │
│  7. 30초간 위치 감시 (자동 업데이트)                 │
│     → 이동 시 위치 정보 갱신                        │
│                     ↓                               │
│  8. 30초 후 자동 중지 (clearWatch)                  │
│     "30초가 경과하여 위치 감시가 중지되었습니다."     │
└─────────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│         Google Apps Script 서버                     │
├─────────────────────────────────────────────────────┤
│  processLocationData(locationData)                  │
│  → console.log로 위치 정보 출력                     │
│  → 실제 프로젝트에서는:                             │
│     - Google Sheets에 저장                         │
│     - 이메일 전송                                  │
│     - 외부 API 호출 등                             │
└─────────────────────────────────────────────────────┘
```

### 🔄 실행 흐름

#### A. Web App 최초 접근

```
1. 사용자가 Web App URL 접근
   ↓
2. doGet() 함수 실행 (서버)
   ↓
3. HtmlService.createTemplateFromFile('index')
   ↓
4. <?!= include('styles'); ?> 처리
   → styles.html 내용을 index.html에 삽입
   ↓
5. HTML + CSS + JavaScript 렌더링 (클라이언트)
   ↓
6. 버튼 이벤트 리스너 등록
```

#### B. 위치 정보 가져오기 (버튼 클릭)

```
1. 버튼 클릭
   ↓
2. navigator.geolocation.watchPosition() 호출
   │
   ├─ 브라우저 권한 확인
   │  ├─ 이미 허용 → 바로 위치 가져오기
   │  └─ 권한 없음 → 권한 요청 팝업
   │
   ├─ 옵션 설정
   │  - enableHighAccuracy: true (높은 정확도)
   │  - timeout: 10000 (10초 타임아웃)
   │  - maximumAge: 0 (캐시 사용 안 함)
   │
   └─ watchId 저장 (나중에 중지용)
   ↓
3. 위치 정보 수신
   │
   ├─ 성공 → showPosition(position) 콜백
   │  ├─ 위도, 경도, 정확도, 속도 표시
   │  ├─ google.script.run.processLocationData() 호출
   │  └─ 서버로 데이터 전송
   │
   └─ 실패 → errorPosition(err) 콜백
      ├─ err.PERMISSION_DENIED → "권한이 거부되었습니다"
      ├─ err.POSITION_UNAVAILABLE → "위치 정보 사용 불가"
      ├─ err.TIMEOUT → "요청 시간 초과"
      └─ err.UNKNOWN_ERROR → "알 수 없는 오류"
   ↓
4. 위치 감시 계속 (이동 시 자동 업데이트)
   ↓
5. 30초 후 setTimeout 실행
   ↓
6. navigator.geolocation.clearWatch(watchId)
   ↓
7. "30초가 경과하여 위치 감시가 중지되었습니다."
```

#### C. 서버로 위치 데이터 전송

```
1. google.script.run.processLocationData({ ... }) 호출
   ↓
2. GAS 서버에서 processLocationData() 실행
   ↓
3. console.log로 위치 정보 출력
   - 위도: 37.566535
   - 경도: 126.977969
   - 정확도: 20.00 미터
   - 속도: 0.00 m/s
   - 타임스탬프: 2026-01-27 14:30:45
   ↓
4. '위치 정보를 서버에서 성공적으로 수신했습니다.' 반환
   ↓
5. withSuccessHandler 콜백 실행
   ↓
6. console.log('서버 응답:', response)
```

---

## 4. 주요 기능

### ✅ 기능 목록

| 기능 | 함수/API | 위치 | 설명 |
|------|---------|------|------|
| **Web App 라우팅** | `doGet()` | Code.js:4-9 | HTML 렌더링 |
| **HTML 템플릿 포함** | `include()` | Code.js:14-16 | styles.html 포함 |
| **위치 데이터 처리** | `processLocationData()` | Code.js:25-37 | 서버에서 위치 정보 수신 |
| **라이브러리 테스트** | `testWorkspaceCore()` | Code.js:42-98 | WorkspaceCore 기능 테스트 |
| **위치 추적** | `navigator.geolocation.watchPosition()` | index.html:44 | 실시간 위치 감시 |
| **위치 표시** | `showPosition()` | index.html:66-101 | 위치 정보 UI 업데이트 |
| **에러 처리** | `errorPosition()` | index.html:107-129 | 위치 에러 핸들링 |

---

### 🎛️ 기능 1: Web App 라우팅

**함수:** `doGet()` (Code.js:4-9)

**코드:**
```javascript
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('내 위치 정보')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}
```

**단계별 설명:**

1. **HtmlService.createTemplateFromFile('index')**
   - `index.html` 파일을 템플릿으로 읽기
   - `<?!= ... ?>` scriptlet 처리 가능

2. **.evaluate()**
   - 템플릿을 실제 HTML로 변환
   - scriptlet 실행 (`<?!= include('styles'); ?>`)

3. **.setTitle('내 위치 정보')**
   - 브라우저 탭 제목 설정

4. **.setSandboxMode(HtmlService.SandboxMode.IFRAME)**
   - 보안 모드 설정 (IFRAME 샌드박스)

**Web App URL 예시:**
```
https://script.google.com/macros/s/AKfy...xyz/exec
```

---

### 📄 기능 2: HTML 템플릿 포함

**함수:** `include()` (Code.js:14-16)

**코드:**
```javascript
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

**사용 예시 (index.html:5):**
```html
<?!= include('styles'); ?>
```

**처리 과정:**
```
1. doGet() 실행
   ↓
2. HtmlService.createTemplateFromFile('index')
   ↓
3. <?!= include('styles'); ?> 발견
   ↓
4. include('styles') 함수 호출
   ↓
5. styles.html 내용 읽기
   ↓
6. <style>...</style> 반환
   ↓
7. index.html에 삽입
   ↓
8. 최종 HTML 생성
```

**최종 HTML (렌더링 후):**
```html
<!doctype html>
<html>
  <head>
    <base target="_top" />
    <style>
      /* styles.html의 내용이 여기에 삽입됨 */
      body { font-family: Arial, sans-serif; ... }
      .container { background-color: #ffffff; ... }
      ...
    </style>
  </head>
  <body>
    ...
  </body>
</html>
```

---

### 📡 기능 3: 위치 데이터 처리 (서버)

**함수:** `processLocationData()` (Code.js:25-37)

**코드:**
```javascript
function processLocationData(locationData) {
  console.log('클라이언트로부터 위치 데이터 수신됨:');
  console.log('위도:', locationData.latitude);
  console.log('경도:', locationData.longitude);
  console.log('정확도:', locationData.accuracy);
  console.log('속도:', locationData.speed);
  console.log('타임스탬프:', new Date(locationData.timestamp).toLocaleString());

  return '위치 정보를 서버에서 성공적으로 수신했습니다.';
}
```

**클라이언트 호출 (index.html:86-100):**
```javascript
google.script.run
  .withSuccessHandler(function (response) {
    console.log('서버 응답:', response);
  })
  .withFailureHandler(function (error) {
    console.error('서버 전송 실패:', error);
    statusMessageDiv.textContent = '서버 전송 실패: ' + error.message;
  })
  .processLocationData({
    latitude: lat,
    longitude: lon,
    accuracy: accuracy,
    speed: speed,
    timestamp: position.timestamp,
  });
```

**전송 데이터 예시:**
```json
{
  "latitude": 37.566535,
  "longitude": 126.977969,
  "accuracy": 20.00,
  "speed": 0.00,
  "timestamp": 1706329845000
}
```

**실제 활용 예시 (주석에 명시):**

```javascript
function processLocationData(locationData) {
  // 1. Google Sheets에 저장
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('위치기록');
  sheet.appendRow([
    new Date(locationData.timestamp),
    locationData.latitude,
    locationData.longitude,
    locationData.accuracy,
    locationData.speed
  ]);

  // 2. 이메일 전송
  GmailApp.sendEmail(
    'admin@example.com',
    '위치 정보 알림',
    `새 위치: ${locationData.latitude}, ${locationData.longitude}`
  );

  // 3. 외부 API 호출
  const response = UrlFetchApp.fetch('https://api.example.com/location', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(locationData)
  });

  return '위치 정보 처리 완료';
}
```

---

### 📍 기능 4: 실시간 위치 추적 (클라이언트)

**API:** `navigator.geolocation.watchPosition()` (index.html:44)

**코드:**
```javascript
const options = {
  enableHighAccuracy: true, // 높은 정확도 요청
  timeout: 10000, // 10초 내에 응답 없으면 타임아웃
  maximumAge: 0, // 캐시된 위치 대신 항상 최신 위치 정보 요청
};

watchId = navigator.geolocation.watchPosition(showPosition, errorPosition, options);

// 30초 후 자동 중지
setTimeout(() => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    statusMessageDiv.textContent = '30초가 경과하여 위치 감시가 중지되었습니다.';
  }
}, 30000);
```

**옵션 설명:**

| 옵션 | 값 | 설명 |
|------|-----|------|
| **enableHighAccuracy** | `true` | GPS 사용 (배터리 소모 증가) |
| **timeout** | `10000` | 10초 내에 응답 없으면 에러 |
| **maximumAge** | `0` | 캐시 사용 안 함 (항상 최신 위치) |

**watchPosition vs getCurrentPosition:**

```javascript
// 1회만 위치 가져오기
navigator.geolocation.getCurrentPosition(showPosition, errorPosition, options);

// 계속 위치 추적 (이동 시 자동 업데이트)
watchId = navigator.geolocation.watchPosition(showPosition, errorPosition, options);

// 위치 추적 중지
navigator.geolocation.clearWatch(watchId);
```

---

### 🖼️ 기능 5: 위치 정보 표시

**함수:** `showPosition()` (index.html:66-101)

**코드:**
```javascript
function showPosition(position) {
  console.log('위치 정보 수신:', position);
  loader.style.display = 'none'; // 로딩 스피너 숨김
  statusMessageDiv.textContent = '위치 정보 업데이트 중...';

  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const accuracy = position.coords.accuracy;
  const speed = position.coords.speed; // null일 수 있음
  const timestamp = new Date(position.timestamp).toLocaleString();

  resultDiv.innerHTML = `
    <p><span class="info-label">위도:</span> ${lat.toFixed(6)}</p>
    <p><span class="info-label">경도:</span> ${lon.toFixed(6)}</p>
    <p><span class="info-label">정확도:</span> 약 ${accuracy.toFixed(2)} 미터</p>
    <p><span class="info-label">속도:</span> ${speed !== null ? speed.toFixed(2) + ' m/s' : '알 수 없음'}</p>
    <p><span class="info-label">업데이트 시각:</span> ${timestamp}</p>
  `;

  // 서버로 전송
  google.script.run
    .withSuccessHandler(function (response) {
      console.log('서버 응답:', response);
    })
    .withFailureHandler(function (error) {
      console.error('서버 전송 실패:', error);
    })
    .processLocationData({
      latitude: lat,
      longitude: lon,
      accuracy: accuracy,
      speed: speed,
      timestamp: position.timestamp,
    });
}
```

**GeolocationPosition 객체 구조:**

```javascript
{
  coords: {
    latitude: 37.566535,        // 위도
    longitude: 126.977969,      // 경도
    altitude: null,             // 고도 (GPS 없으면 null)
    accuracy: 20.00,            // 정확도 (미터)
    altitudeAccuracy: null,     // 고도 정확도
    heading: null,              // 방향 (북쪽 기준 각도)
    speed: 0.00                 // 속도 (m/s, 정지 시 0)
  },
  timestamp: 1706329845000      // Unix 타임스탬프 (밀리초)
}
```

**표시 예시:**

```
┌────────────────────────────────────┐
│ 위도: 37.566535                    │
│ 경도: 126.977969                   │
│ 정확도: 약 20.00 미터               │
│ 속도: 0.00 m/s                     │
│ 업데이트 시각: 2026-01-27 14:30:45 │
└────────────────────────────────────┘
```

---

### ❌ 기능 6: 에러 처리

**함수:** `errorPosition()` (index.html:107-129)

**코드:**
```javascript
function errorPosition(err) {
  loader.style.display = 'none';
  let errorMessage = '';
  switch (err.code) {
    case err.PERMISSION_DENIED:
      errorMessage = '위치 정보 사용 권한이 거부되었습니다.';
      break;
    case err.POSITION_UNAVAILABLE:
      errorMessage = '위치 정보를 사용할 수 없습니다.';
      break;
    case err.TIMEOUT:
      errorMessage = '위치 정보를 가져오는 요청 시간이 초과되었습니다.';
      break;
    case err.UNKNOWN_ERROR:
      errorMessage = '알 수 없는 오류가 발생했습니다.';
      break;
    default:
      errorMessage = '알 수 없는 오류가 발생했습니다.';
  }
  resultDiv.innerHTML = `<span class="error">오류: ${errorMessage}</span>`;
  statusMessageDiv.textContent = `오류 발생: ${err.message}`;
  console.error('위치 정보 오류:', err);
}
```

**에러 코드 설명:**

| 에러 코드 | 값 | 발생 상황 | 사용자 대응 |
|----------|-----|----------|------------|
| **PERMISSION_DENIED** | 1 | 사용자가 권한 거부 | 브라우저 설정에서 위치 권한 허용 |
| **POSITION_UNAVAILABLE** | 2 | 위치 정보 획득 실패 | GPS 켜기, 실외로 이동 |
| **TIMEOUT** | 3 | 10초 내에 위치 못 가져옴 | 다시 시도 |
| **UNKNOWN_ERROR** | 0 | 알 수 없는 에러 | 브라우저 재시작 |

**에러 처리 흐름:**

```
navigator.geolocation.watchPosition() 호출
   ↓
에러 발생
   ↓
errorPosition(err) 콜백 실행
   ↓
err.code 확인
   ├─ 1 (PERMISSION_DENIED)
   │  → "위치 정보 사용 권한이 거부되었습니다."
   ├─ 2 (POSITION_UNAVAILABLE)
   │  → "위치 정보를 사용할 수 없습니다."
   ├─ 3 (TIMEOUT)
   │  → "요청 시간이 초과되었습니다."
   └─ 0 (UNKNOWN_ERROR)
      → "알 수 없는 오류가 발생했습니다."
   ↓
UI에 에러 메시지 표시 (빨간색)
```

---

## 5. WorkspaceCore 라이브러리

### 📚 라이브러리란?

**GAS 라이브러리**는 재사용 가능한 코드 모음으로, **다른 프로젝트에서 가져다 쓸 수 있습니다.**

**CDN vs GAS 라이브러리 비교:**

| 구분 | CDN (Chart.js 등) | GAS 라이브러리 (WorkspaceCore) |
|------|-------------------|-------------------------------|
| **사용 위치** | 클라이언트 (브라우저) | 서버 (GAS) |
| **로드 방식** | `<script src="https://...">` | `appsscript.json`에 등록 |
| **언어** | JavaScript (브라우저) | JavaScript (GAS) |
| **예시** | Chart.js, jQuery | WorkspaceCore, Moment |

### 🔧 WorkspaceCore 라이브러리 사용

**appsscript.json (Line 4-11):**

```json
{
  "dependencies": {
    "libraries": [
      {
        "userSymbol": "WorkspaceCore",
        "libraryId": "1II0VGB7VY1_tNxLbNfoxp3ApVIqq7Am99LevLMMgX4LlgMI5vQCj4l4V",
        "version": "3",
        "developmentMode": false
      }
    ]
  }
}
```

**필드 설명:**

| 필드 | 값 | 설명 |
|------|-----|------|
| **userSymbol** | `WorkspaceCore` | 코드에서 사용할 이름 |
| **libraryId** | `1II0V...` | 라이브러리 Script ID |
| **version** | `"3"` | 사용할 버전 (3번째 버전) |
| **developmentMode** | `false` | 개발 모드 OFF (안정 버전 사용) |

**코드에서 사용:**

```javascript
// WorkspaceCore 라이브러리의 함수 호출
const version = WorkspaceCore.getLibraryVersion();
const dateStr = WorkspaceCore.formatKoreanDate(new Date());
const isValid = WorkspaceCore.isValidEmail('user@example.com');
```

### 🧪 WorkspaceCore 테스트 함수

**함수:** `testWorkspaceCore()` (Code.js:42-98)

**테스트 항목:**

1. **버전 확인**
```javascript
const version = WorkspaceCore.getLibraryVersion();
// "3.0.0"

const info = WorkspaceCore.getLibraryInfo();
// { name: "WorkspaceCore", version: "3.0.0", ... }
```

2. **날짜 포맷팅**
```javascript
const today = new Date();
const dateStr = WorkspaceCore.formatKoreanDate(today);
// "2026년 1월 27일"

const dateTimeStr = WorkspaceCore.formatKoreanDate(today, true);
// "2026년 1월 27일 14:30:45"
```

3. **상대 시간**
```javascript
const pastDate = new Date(today.getTime() - 2 * 60 * 60 * 1000);
const relativeTime = WorkspaceCore.getRelativeTime(pastDate);
// "2시간 전"
```

4. **문자열 변환**
```javascript
const kebab = WorkspaceCore.toKebabCase('myVariableName');
// "my-variable-name"

const camel = WorkspaceCore.toCamelCase('my-variable-name');
// "myVariableName"
```

5. **이메일 검증**
```javascript
const validEmail = WorkspaceCore.isValidEmail('user@example.com');
// true

const invalidEmail = WorkspaceCore.isValidEmail('invalid-email');
// false
```

6. **배열 유틸리티**
```javascript
const items = [1, 2, 3, 4, 5, 6, 7];
const chunks = WorkspaceCore.chunk(items, 3);
// [[1, 2, 3], [4, 5, 6], [7]]

const duplicates = [1, 2, 2, 3, 3, 3];
const unique = WorkspaceCore.unique(duplicates);
// [1, 2, 3]
```

7. **에러 로깅**
```javascript
try {
  throw new Error('Test error');
} catch (error) {
  WorkspaceCore.logError(error, { context: 'Test' });
  // Stackdriver Logging에 구조화된 에러 로그 기록
}
```

**실행 방법:**

```bash
# GAS 에디터에서 직접 실행
# 또는
clasp push
clasp open-script
# → testWorkspaceCore() 함수 선택 → 실행

# 로그 확인
clasp logs
```

---

## 6. GAS API 사용

### 📚 사용된 GAS API 목록

| API | 사용 위치 | 목적 |
|-----|----------|------|
| **HtmlService** | doGet(), include() | HTML 렌더링 |
| **console.log** | processLocationData() | 서버 로깅 |
| **WorkspaceCore** | testWorkspaceCore() | 유틸리티 함수 |

---

### 1️⃣ HtmlService

**공식 문서:** https://developers.google.com/apps-script/reference/html/html-service

**사용 예시:**

#### A. 템플릿에서 HTML 생성

**코드:**
```javascript
const template = HtmlService.createTemplateFromFile('index');
const html = template.evaluate();
```

**설명:**
- `createTemplateFromFile(filename)` → 템플릿 객체 생성
- `.evaluate()` → scriptlet 실행 후 HTML 반환

#### B. HTML 파일에서 직접 생성

**코드:**
```javascript
const html = HtmlService.createHtmlOutputFromFile('sidebar');
```

**설명:**
- scriptlet 처리 안 함 (정적 HTML)
- `include()` 함수에서 사용

#### C. Sandbox Mode 설정

**코드:**
```javascript
html.setSandboxMode(HtmlService.SandboxMode.IFRAME);
```

**Sandbox Mode 옵션:**

| 모드 | 설명 | 권장 |
|------|------|------|
| **IFRAME** | iframe 샌드박스 (기본값) | ✅ 권장 (보안) |
| **NATIVE** | 샌드박스 없음 (레거시) | ❌ 사용 안 함 |
| **EMULATED** | Caja 샌드박스 (구식) | ❌ 사용 안 함 |

---

### 2️⃣ google.script.run (클라이언트)

**공식 문서:** https://developers.google.com/apps-script/guides/html/reference/run

**사용 예시:**

#### A. 기본 사용법

**클라이언트 (index.html):**
```javascript
google.script.run.processLocationData(locationData);
```

**서버 (Code.js):**
```javascript
function processLocationData(locationData) {
  console.log(locationData);
  return '성공';
}
```

#### B. 콜백 함수

**코드:**
```javascript
google.script.run
  .withSuccessHandler(function (response) {
    console.log('성공:', response);
  })
  .withFailureHandler(function (error) {
    console.error('실패:', error);
  })
  .processLocationData(locationData);
```

**설명:**
- `withSuccessHandler(callback)` → 성공 시 실행
- `withFailureHandler(callback)` → 실패 시 실행
- 비동기 호출 (Promise 아님)

#### C. 사용자 객체 전달

**코드:**
```javascript
google.script.run
  .withUserObject({ userId: 123 })
  .withSuccessHandler(function (response, userObject) {
    console.log('User ID:', userObject.userId);
  })
  .processLocationData(locationData);
```

**설명:**
- `withUserObject(obj)` → 콜백에 추가 데이터 전달
- 콜백의 두 번째 인자로 받음

---

## 7. 파일 구조

### 📂 프로젝트 구조

```
projects/geo-location/
├── Code.js                 # 서버 로직 (99줄)
├── index.html              # 클라이언트 UI + JavaScript (133줄)
├── styles.html             # CSS 스타일 (84줄)
├── appsscript.json         # 프로젝트 설정 + 라이브러리
└── .clasp.json             # Script ID
```

### 📄 파일별 설명

#### 1. Code.js (99줄)

**역할:** 서버 사이드 로직

**함수 목록:**

| 함수 | 줄 | 설명 |
|------|-----|------|
| `doGet()` | 4-9 | Web App 진입점, HTML 렌더링 |
| `include()` | 14-16 | HTML 템플릿 포함 |
| `processLocationData()` | 25-37 | 위치 데이터 수신 및 로깅 |
| `testWorkspaceCore()` | 42-98 | WorkspaceCore 라이브러리 테스트 |

**특징:**
- ✅ JSDoc 주석 포함
- ✅ console.log 사용 (Logger.log 아님)
- ❌ 에러 핸들링 없음 (try-catch)

#### 2. index.html (133줄)

**역할:** 클라이언트 UI + JavaScript

**구조:**
```html
<!doctype html>
<html>
  <head>
    <base target="_top" />
    <?!= include('styles'); ?> <!-- 서버 scriptlet -->
  </head>
  <body>
    <div class="container">
      <h1>내 현재 위치 확인</h1>
      <button id="getLocation">위치 정보 가져오기</button>
      <div id="result">...</div>
      <div id="statusMessage">...</div>
    </div>

    <script>
      // JavaScript 로직 (클라이언트)
      // - 버튼 이벤트 리스너
      // - navigator.geolocation.watchPosition()
      // - showPosition(), errorPosition()
      // - google.script.run
    </script>
  </body>
</html>
```

**특징:**
- ✅ 외부 라이브러리 없음 (순수 JavaScript)
- ✅ Geolocation API 사용
- ✅ google.script.run으로 서버 통신
- ✅ 30초 타이머 (자동 중지)

#### 3. styles.html (84줄)

**역할:** CSS 스타일

**주요 스타일:**

```css
body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f4f7f6;
}

.container {
  background-color: #ffffff;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  max-width: 500px;
}

.loader {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
}
```

**특징:**
- ✅ 반응형 디자인 (max-width, box-sizing)
- ✅ CSS 애니메이션 (로딩 스피너)
- ✅ 깔끔한 색상 팔레트

#### 4. appsscript.json (20줄)

**역할:** GAS 프로젝트 설정

**내용:**
```json
{
  "timeZone": "Asia/Seoul",
  "dependencies": {
    "libraries": [
      {
        "userSymbol": "WorkspaceCore",
        "libraryId": "1II0VGB7VY1_tNxLbNfoxp3ApVIqq7Am99LevLMMgX4LlgMI5vQCj4l4V",
        "version": "3",
        "developmentMode": false
      }
    ]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

**설정 설명:**

| 필드 | 값 | 설명 |
|------|-----|------|
| **timeZone** | `Asia/Seoul` | 서버 타임존 |
| **libraries** | `[WorkspaceCore]` | 외부 라이브러리 |
| **exceptionLogging** | `STACKDRIVER` | 에러 로깅 위치 |
| **runtimeVersion** | `V8` | JavaScript 엔진 |
| **webapp.executeAs** | `USER_DEPLOYING` | 배포자 권한으로 실행 |
| **webapp.access** | `ANYONE_ANONYMOUS` | 누구나 접근 가능 |

---

## 8. 코드 상세 분석

### 🔍 핵심 패턴

#### 패턴 1: watchPosition 사용

**30초 타이머와 함께 사용:**

```javascript
let watchId = null;

// 위치 추적 시작
watchId = navigator.geolocation.watchPosition(showPosition, errorPosition, options);

// 30초 후 자동 중지
setTimeout(() => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    statusMessageDiv.textContent = '30초가 경과하여 위치 감시가 중지되었습니다.';
  }
}, 30000);
```

**주의사항:**
- `watchId`를 전역 변수로 관리
- 중복 실행 방지 (이전 watchId 중지)
- 메모리 누수 방지 (clearWatch 필수)

#### 패턴 2: google.script.run 에러 핸들링

**성공/실패 콜백:**

```javascript
google.script.run
  .withSuccessHandler(function (response) {
    // 성공 시 처리
    console.log('서버 응답:', response);
  })
  .withFailureHandler(function (error) {
    // 실패 시 처리
    console.error('서버 전송 실패:', error);
    statusMessageDiv.textContent = '서버 전송 실패: ' + error.message;
  })
  .processLocationData(locationData);
```

**장점:**
- 비동기 에러 처리
- 사용자에게 에러 피드백

#### 패턴 3: Geolocation 에러 처리

**switch 문으로 에러 구분:**

```javascript
function errorPosition(err) {
  let errorMessage = '';
  switch (err.code) {
    case err.PERMISSION_DENIED:
      errorMessage = '위치 정보 사용 권한이 거부되었습니다.';
      break;
    case err.POSITION_UNAVAILABLE:
      errorMessage = '위치 정보를 사용할 수 없습니다.';
      break;
    case err.TIMEOUT:
      errorMessage = '위치 정보를 가져오는 요청 시간이 초과되었습니다.';
      break;
    default:
      errorMessage = '알 수 없는 오류가 발생했습니다.';
  }
  resultDiv.innerHTML = `<span class="error">오류: ${errorMessage}</span>`;
}
```

---

### 🐛 개선 제안

#### 이슈 1: 서버 함수에 에러 핸들링 없음

**문제점:**

```javascript
function processLocationData(locationData) {
  console.log('위도:', locationData.latitude); // locationData가 null이면?
  console.log('경도:', locationData.longitude);
  // ...
}
```

**개선안:**

```javascript
function processLocationData(locationData) {
  try {
    if (!locationData) {
      throw new Error('위치 데이터가 비어있습니다.');
    }

    if (typeof locationData.latitude !== 'number' || typeof locationData.longitude !== 'number') {
      throw new Error('잘못된 위치 데이터 형식입니다.');
    }

    console.log('클라이언트로부터 위치 데이터 수신됨:');
    console.log('위도:', locationData.latitude);
    console.log('경도:', locationData.longitude);
    console.log('정확도:', locationData.accuracy);
    console.log('속도:', locationData.speed);
    console.log('타임스탬프:', new Date(locationData.timestamp).toLocaleString());

    return '위치 정보를 서버에서 성공적으로 수신했습니다.';
  } catch (error) {
    console.error('processLocationData 에러:', error.message);
    throw error; // withFailureHandler로 전달
  }
}
```

#### 이슈 2: 중복 버튼 클릭 처리

**문제점:**
- 버튼을 여러 번 빠르게 클릭하면 여러 개의 watchPosition 실행
- 30초 타이머가 중복 생성

**현재 방어 코드:**

```javascript
// 이전 watchPosition 중지
if (watchId !== null) {
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}
```

**개선안:**

```javascript
let watchId = null;
let timeoutId = null;
let isTracking = false;

getLocationBtn.addEventListener('click', () => {
  if (isTracking) {
    // 이미 추적 중이면 중지
    stopTracking();
    getLocationBtn.textContent = '위치 정보 가져오기';
    return;
  }

  startTracking();
  getLocationBtn.textContent = '위치 추적 중지';
});

function startTracking() {
  isTracking = true;
  resultDiv.innerHTML = '<span class="loading">위치 정보를 가져오는 중...</span>';
  loader.style.display = 'inline-block';

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  };

  watchId = navigator.geolocation.watchPosition(showPosition, errorPosition, options);

  timeoutId = setTimeout(() => {
    stopTracking();
    statusMessageDiv.textContent = '30초가 경과하여 위치 감시가 중지되었습니다.';
  }, 30000);
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  isTracking = false;
  loader.style.display = 'none';
}
```

#### 이슈 3: Logger.log 사용 (testWorkspaceCore)

**문제점:**

```javascript
function testWorkspaceCore() {
  Logger.log('=== Workspace Core Library Test ==='); // Logger.log
  // ...
}
```

**개선안:**

```javascript
function testWorkspaceCore() {
  console.log('=== Workspace Core Library Test ==='); // console.log
  // ...
}
```

**이유:**
- `console.log` → Stackdriver Logging (구조화된 로그)
- `Logger.log` → 레거시 로깅 (clasp logs에서 안 보임)

---

## 9. 보안 및 권한

### 🔐 브라우저 권한

**Geolocation API는 사용자 권한이 필요합니다.**

#### 권한 요청 흐름

```
1. 사용자가 Web App 접근
   ↓
2. 버튼 클릭
   ↓
3. navigator.geolocation.watchPosition() 호출
   ↓
4. 브라우저가 권한 상태 확인
   │
   ├─ 이미 허용됨 → 바로 위치 가져오기
   │
   ├─ 이미 거부됨 → PERMISSION_DENIED 에러
   │
   └─ 권한 없음 → 권한 요청 팝업 표시
      │
      ├─ 사용자가 "허용" 클릭 → 위치 가져오기
      │
      └─ 사용자가 "차단" 클릭 → PERMISSION_DENIED 에러
```

#### 권한 상태 확인 (Permissions API)

**코드:**
```javascript
navigator.permissions.query({ name: 'geolocation' })
  .then(permissionStatus => {
    console.log('위치 권한 상태:', permissionStatus.state);
    // "granted", "denied", "prompt"
  });
```

**상태 값:**

| 상태 | 설명 |
|------|------|
| **granted** | 권한 허용됨 |
| **denied** | 권한 거부됨 |
| **prompt** | 권한 요청 필요 (미결정) |

#### HTTPS 필수

**Geolocation API는 HTTPS에서만 작동합니다!**

```
❌ http://example.com → Geolocation API 사용 불가
✅ https://example.com → Geolocation API 사용 가능
✅ localhost → 개발 시 예외적으로 허용
```

**GAS Web App은 자동으로 HTTPS 제공:**
```
https://script.google.com/macros/s/.../exec
```

---

### 🛡️ Web App 보안 설정

**appsscript.json (Line 15-18):**

```json
"webapp": {
  "executeAs": "USER_DEPLOYING",
  "access": "ANYONE_ANONYMOUS"
}
```

**설정 옵션:**

| 필드 | 옵션 | 설명 |
|------|------|------|
| **executeAs** | `USER_DEPLOYING` | 배포자 권한으로 실행 |
| | `USER_ACCESSING` | 접근자 권한으로 실행 |
| **access** | `ANYONE` | 인증된 사용자만 |
| | `ANYONE_ANONYMOUS` | 누구나 (익명 포함) |
| | `DOMAIN` | 같은 도메인 사용자만 |

**이 프로젝트 설정:**
- `USER_DEPLOYING` + `ANYONE_ANONYMOUS`
- **의미:** 누구나 접근 가능하지만, 서버 함수는 배포자 권한으로 실행
- **주의:** 배포자의 Drive, Sheets 등 접근 가능

---

## 10. 배포 및 실행

### 🚀 배포 방법

#### A. 웹 앱 배포

```bash
cd projects/geo-location

# 1. 코드 업로드
clasp push

# 2. 웹 앱 배포 (최초)
clasp deploy --description "v1.0.0"

# 3. 배포 URL 확인
clasp deployments
```

**출력 예시:**
```
- AKfycby... @1
  - https://script.google.com/macros/s/AKfycby.../exec (1.0.0)
```

#### B. 기존 배포 업데이트

```bash
# 코드 수정 후
clasp push

# 기존 배포 업데이트
clasp deploy --deploymentId AKfycby... --description "v1.0.1"
```

---

### 🧪 테스트 방법

#### 시나리오 1: 위치 정보 가져오기 (데스크톱)

1. Web App URL 접근
2. "위치 정보 가져오기" 버튼 클릭
3. 브라우저 권한 팝업 → "허용" 클릭
4. 위치 정보 표시 확인
   - 위도, 경도 (IP 기반 → 낮은 정확도)
   - 정확도: 수백~수천 미터
   - 속도: "알 수 없음" (GPS 없음)

#### 시나리오 2: 위치 정보 가져오기 (스마트폰)

1. Web App URL 접근
2. "위치 정보 가져오기" 버튼 클릭
3. 브라우저 권한 팝업 → "허용" 클릭
4. 위치 정보 표시 확인
   - 위도, 경도 (GPS 기반 → 높은 정확도)
   - 정확도: 10-50 미터
   - 속도: 이동 시 m/s 표시

#### 시나리오 3: 실시간 위치 추적

1. 스마트폰으로 Web App 접근
2. "위치 정보 가져오기" 버튼 클릭
3. 걸어다니기
4. **위치 정보가 자동으로 업데이트되는지 확인**
5. 30초 후 "위치 감시가 중지되었습니다" 메시지 확인

#### 시나리오 4: 권한 거부

1. Web App URL 접근
2. "위치 정보 가져오기" 버튼 클릭
3. 브라우저 권한 팝업 → "차단" 클릭
4. **에러 메시지 확인**
   - "오류: 위치 정보 사용 권한이 거부되었습니다."

#### 시나리오 5: 서버 통신 확인

1. Web App URL 접근
2. "위치 정보 가져오기" 버튼 클릭 (권한 허용)
3. 브라우저 개발자 도구 → Console 탭
4. **"서버 응답: 위치 정보를 서버에서 성공적으로 수신했습니다." 확인**
5. 서버 로그 확인
   ```bash
   clasp logs
   ```
   **출력:**
   ```
   클라이언트로부터 위치 데이터 수신됨:
   위도: 37.566535
   경도: 126.977969
   정확도: 20.00
   속도: 0.00
   타임스탬프: 2026-01-27 오후 2:30:45
   ```

---

### 🛠️ 디버깅

#### A. 브라우저 개발자 도구

**Chrome:**
```
F12 → Console 탭
```

**로그 확인:**
```javascript
// 클라이언트 로그
console.log('위치 정보 수신:', position);
console.log('서버 응답:', response);
console.error('서버 전송 실패:', error);
```

#### B. GAS 서버 로그

```bash
clasp logs
```

**또는**

```
Apps Script 에디터 → 실행 로그
```

#### C. 권한 재설정

**Chrome:**
```
1. 주소창 왼쪽 자물쇠 아이콘 클릭
2. "사이트 설정"
3. "위치" → "허용" 또는 "차단"
```

---

## 11. 참고 자료

### 📖 공식 문서

| 리소스 | URL |
|--------|-----|
| **Geolocation API** | https://developer.mozilla.org/ko/docs/Web/API/Geolocation_API |
| **Apps Script 공식 문서** | https://developers.google.com/apps-script |
| **HtmlService** | https://developers.google.com/apps-script/reference/html/html-service |
| **google.script.run** | https://developers.google.com/apps-script/guides/html/reference/run |
| **GAS 라이브러리** | https://developers.google.com/apps-script/guides/libraries |

### 🔗 관련 프로젝트

- **user-permission**: Web App + CRM 시스템
- **sidebar-ui**: Container-bound + Sidebar

### 📊 프로젝트 통계

| 항목 | 수치 |
|------|------|
| **총 파일 수** | 5개 |
| **JavaScript 파일** | 1개 (Code.js) |
| **HTML 파일** | 2개 (index.html, styles.html) |
| **총 코드 라인** | 316줄 |
| **함수 수** | 7개 (서버 4개, 클라이언트 3개) |
| **사용된 GAS API** | 2개 (HtmlService, console.log) |
| **외부 라이브러리** | 1개 (WorkspaceCore) |
| **브라우저 API** | 1개 (Geolocation API) |

---

## 📝 마무리

이 프로젝트는 **브라우저 Geolocation API와 Google Apps Script를 결합한 실시간 위치 추적 시스템**입니다.

**핵심 학습 포인트:**

1. **Geolocation API** - 브라우저 내장 위치 정보 API
2. **watchPosition** - 실시간 위치 추적 (getCurrentPosition과 차이)
3. **google.script.run** - 클라이언트-서버 비동기 통신
4. **GAS 라이브러리** - WorkspaceCore 사용법
5. **권한 처리** - 브라우저 위치 권한 요청 및 에러 핸들링

**활용 가능한 시나리오:**

- 출퇴근 위치 기록 (Google Sheets 저장)
- 배달 기사 위치 추적
- 영업 사원 경로 기록
- 긴급 구조 요청 시스템
- 지오펜싱 (특정 위치 진입 시 알림)

**확장 아이디어:**

- Google Maps API와 연동하여 지도에 마커 표시
- Google Sheets에 위치 기록 저장
- 특정 거리 이상 이동 시 알림 (GmailApp)
- 위치 히스토리 차트 (Chart.js)
- 지오펜싱 (UrlFetchApp로 외부 API 호출)

---

**작성일:** 2026-01-27
**프로젝트:** apps-script-clasp/projects/geo-location
**GAS Runtime:** V8
**TimeZone:** Asia/Seoul
