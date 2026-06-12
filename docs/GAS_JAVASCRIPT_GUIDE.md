# JavaScript 코딩 가이드 (Apps Script)

Apps Script 프로젝트에서 권장하는 JavaScript 코딩 스타일입니다.

**기반:** [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)

---

## 📚 목차

1. [변수 선언](#1-변수-선언)
2. [로깅](#2-로깅)
3. [함수 선언](#3-함수-선언)
4. [문자열](#4-문자열)
5. [객체와 배열](#5-객체와-배열)
6. [에러 핸들링](#6-에러-핸들링)
7. [비동기 처리](#7-비동기-처리)
8. [주석](#8-주석)
9. [네이밍 규칙](#9-네이밍-규칙)
10. [Apps Script 특수 사항](#10-apps-script-특수-사항)

---

## 1. 변수 선언

### ✅ 권장

```javascript
// const를 기본으로 사용 (재할당 없는 경우)
const API_KEY = 'your-api-key';
const sheet = SpreadsheetApp.getActiveSheet();
const data = sheet.getDataRange().getValues();

// 재할당이 필요한 경우만 let 사용
let counter = 0;
for (let i = 0; i < data.length; i++) {
  counter += data[i][0];
}
```

### ❌ 금지

```javascript
// var는 절대 사용하지 마세요
var sheet = SpreadsheetApp.getActiveSheet();  // ❌
var counter = 0;  // ❌
```

### 왜 var를 금지하나?

- **함수 스코프 문제**: 블록 스코프가 아닌 함수 스코프
- **호이스팅 혼란**: 선언 전에 사용 가능해 버그 유발
- **Google 공식 권장**: "The var keyword must not be used."

> **"Use `const` by default, unless a variable needs to be reassigned."**

---

## 2. 로깅

### ✅ 권장: console.log

```javascript
function processData() {
  console.log('Processing started...');

  try {
    const result = calculateTotal();
    console.log('Total:', result);
  } catch (error) {
    console.error('Error occurred:', error.message);
  }
}

// 성능 측정
function performanceTest() {
  console.time('data-processing');
  // ... 작업 수행
  console.timeEnd('data-processing');  // "data-processing: 1234ms"
}

// 로그 레벨 구분
console.log('일반 정보');
console.info('참고 정보');
console.warn('경고 메시지');
console.error('에러 발생!');
```

### ⚠️ 레거시: Logger.log

```javascript
// Logger.log는 레거시 API
Logger.log('Processing...');  // ⚠️ 구식
```

### console.log vs Logger.log

| 항목 | console.log | Logger.log |
|------|------------|-----------|
| **도입** | V8 런타임 (2019~) | 초기부터 |
| **로그 레벨** | ✅ log, info, warn, error | ❌ log만 |
| **성능 측정** | ✅ time(), timeEnd() | ❌ 없음 |
| **표준성** | ✅ 표준 JavaScript | ⚠️ GAS 전용 |

### 언제 Logger.log를 쓸까?

```javascript
// Cloud Logging에 구조화된 JSON 데이터 전송
function logStructuredData() {
  Logger.log(JSON.stringify({
    event: 'user_signup',
    userId: 12345,
    timestamp: new Date(),
    metadata: { source: 'web' }
  }));
}
```

---

## 3. 함수 선언

### ✅ 권장

```javascript
// Arrow function (콜백, 간단한 함수)
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
const users = data.filter(user => user.active);

// 일반 함수 (Apps Script 진입점, 복잡한 로직)
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index');
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Custom Menu')
    .addItem('Run Script', 'myFunction')
    .addToUi();
}
```

### ❌ 금지

```javascript
// 불필요한 function 키워드
const doubled = numbers.map(function(n) {  // ❌
  return n * 2;
});

// var + function 조합
var myFunc = function() {  // ❌
  // ...
};
```

---

## 4. 문자열

### ✅ 권장: Template Literals

```javascript
const name = 'John';
const age = 30;
const message = `User ${name} is ${age} years old`;

// 멀티라인
const html = `
  <div>
    <h1>Hello, ${name}</h1>
    <p>Welcome to our app</p>
  </div>
`;
```

### ❌ 금지: 문자열 연결

```javascript
const message = 'User ' + name + ' is ' + age + ' years old';  // ❌

const html = '<div>' +  // ❌
  '<h1>Hello, ' + name + '</h1>' +
  '</div>';
```

---

## 5. 객체와 배열

### ✅ 권장

```javascript
// Destructuring
const { firstName, lastName } = user;
const [first, second, ...rest] = items;

// Spread operator
const newUser = { ...user, active: true };
const combined = [...array1, ...array2];

// Property shorthand
const name = 'John';
const age = 30;
const user = { name, age };  // { name: name, age: age }
```

### ❌ 금지

```javascript
// 전통적인 방식
const firstName = user.firstName;  // ❌ (destructuring 가능할 때)
const lastName = user.lastName;

const newUser = Object.assign({}, user, { active: true });  // ❌
```

---

## 6. 에러 핸들링

### ✅ 권장

```javascript
function processUserData(userId) {
  try {
    const user = fetchUser(userId);

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    return processUser(user);

  } catch (error) {
    console.error('Error processing user:', error.message);
    console.error('Stack trace:', error.stack);

    // 선택: WorkspaceCore 라이브러리 사용
    // WorkspaceCore.logError(error, { userId });

    throw error;  // 재throw 필요 시
  }
}
```

### ❌ 금지

```javascript
function processUserData(userId) {
  try {
    // ...
  } catch (e) {
    Logger.log(e);  // ❌ 에러 정보 부족
    // 에러를 무시하거나 처리 없이 삼킴
  }
}
```

---

## 7. 비동기 처리

Apps Script는 동기적이지만, `UrlFetchApp` 등 외부 API 호출 시 유용합니다.

### ✅ 권장: 병렬 처리

```javascript
function fetchMultipleApis() {
  const urls = [
    'https://api1.example.com/data',
    'https://api2.example.com/data',
    'https://api3.example.com/data'
  ];

  // UrlFetchApp.fetchAll()로 병렬 요청
  const requests = urls.map(url => ({ url }));
  const responses = UrlFetchApp.fetchAll(requests);

  return responses.map(response => JSON.parse(response.getContentText()));
}
```

### ❌ 금지: 순차 처리

```javascript
function fetchMultipleApis() {
  const results = [];
  results.push(UrlFetchApp.fetch(url1));  // ❌ 느림
  results.push(UrlFetchApp.fetch(url2));
  results.push(UrlFetchApp.fetch(url3));
  return results;
}
```

---

## 8. 주석

### ✅ 권장: JSDoc

```javascript
/**
 * 사용자의 총 점수를 계산합니다.
 *
 * @param {string} userId - 사용자 ID
 * @param {Date} startDate - 계산 시작일
 * @param {Date} endDate - 계산 종료일
 * @return {number} 총 점수
 */
function calculateUserScore(userId, startDate, endDate) {
  // 날짜 범위 검증
  if (startDate >= endDate) {
    throw new Error('Invalid date range');
  }

  const activities = fetchUserActivities(userId, startDate, endDate);

  // 활동별 점수 합산 (활동 타입에 따라 가중치 적용)
  return activities.reduce((total, activity) => {
    const weight = ACTIVITY_WEIGHTS[activity.type] || 1;
    return total + (activity.score * weight);
  }, 0);
}
```

### ❌ 금지: 불필요한 주석

```javascript
// 명백한 주석
const total = a + b;  // ❌ a와 b를 더함

// 코드로 설명 가능한 것
// user의 active 상태 확인  // ❌
if (user.status === 'active') {
  // ...
}

// 대신 함수로 분리
if (isUserActive(user)) {  // ✅
  // ...
}
```

---

## 9. 네이밍 규칙

### ✅ 권장

```javascript
// 상수: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';

// 변수/함수: camelCase
const userName = 'John';
function getUserById(id) { }

// 클래스: PascalCase
class UserManager {
  constructor() { }
}

// Private 멤버: _ 접두사
const _internalCache = {};
function _privateHelper() { }

// Boolean: is/has/can 접두사
const isActive = true;
const hasPermission = user.checkPermission();
const canEdit = user.role === 'admin';

// 파일명: 소문자, kebab-case 또는 camelCase
// utils.js, config.js (권장)
// user-manager.js, api-client.js (권장)
```

**파일명 규칙:**
- ✅ 소문자 시작: `config.js`, `utils.js`, `helper.js`
- ✅ kebab-case: `user-manager.js`, `api-client.js`
- ⚠️ 예외: `Code.js` (Apps Script 메인 파일 관례)
- ❌ PascalCase: `Config.js`, `Utils.js` (클래스 파일이 아니라면 지양)

**이유:**
1. JavaScript 생태계 표준 관례
2. 대부분의 npm 패키지/프로젝트가 소문자 사용
3. `Code.js`는 Apps Script의 특수 케이스로 예외 허용

**미사용 변수 규칙:**

의도적으로 사용하지 않는 변수는 `_`로 시작하세요:

```javascript
// ✅ 권장: 미사용 변수는 _로 시작
const _unusedPassword = 'not-needed';
const { name, _id, _token } = apiResponse;  // id와 token은 사용 안 함

// 파라미터에도 적용
function handleEvent(event, _metadata) {  // metadata는 사용 안 함
  console.log(event.type);
}

// 구조 분해 할당에서도 활용
const [first, _second, third] = arr;  // second는 무시
```

**이유:**
1. 코드 리뷰 시 의도가 명확함 (실수가 아니라 의도적으로 안 씀)
2. ESLint `no-unused-vars` 규칙 예외 (현재는 off지만 향후 대비)
3. 다른 개발자가 보기에 혼란 방지

### ❌ 금지

```javascript
// 헝가리안 표기법
const strUserName = 'John';  // ❌
const arrData = [1, 2, 3];  // ❌

// 의미 없는 이름
const a = getUserData();  // ❌
function fn() { }  // ❌
const temp = calculateTotal();  // ❌

// 약어 남용
const usrMgr = new UserManager();  // ❌
```

---

## 10. Apps Script 특수 사항

### ⚠️ GAS 내장 API를 래핑하지 마세요

**문제:** GAS가 제공하는 전역 객체를 불필요하게 래핑하는 경우

```javascript
// ❌ 잘못된 예: 불필요한 래퍼 함수
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheetByName(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

// 사용
const sheet = getSheetByName("Users");  // ❌ 불필요한 추상화
```

**✅ 올바른 방법:**

```javascript
// GAS API를 직접 사용
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
const data = sheet.getDataRange().getValues();
```

**왜 문제인가?**
- `SpreadsheetApp`, `Logger`, `Utilities` 등은 **GAS가 전역으로 제공하는 내장 API**
- 이미 최적화되어 있고 스크립트 컨테이너와 바인딩됨
- 래핑하면 오히려 복잡도만 증가하고 성능 저하

**언제 유틸리티 함수를 만드나?**

```javascript
// ✅ 실제 비즈니스 로직이 있는 경우만
function formatSheetDate(dateCell) {
  if (!dateCell) return '';
  const date = dateCell instanceof Date ? dateCell : new Date(dateCell);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// ✅ 복잡한 로직을 재사용하는 경우
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

**핵심 원칙:**
- GAS 내장 API는 그대로 사용
- 실제 로직이 있거나 반복되는 복잡한 패턴만 유틸리티로 추출
- "래핑만 하는 함수"는 만들지 말 것

**GAS 내장 API 확인 방법:**

```bash
# 1. @types/google-apps-script로 확인 (가장 정확)
grep "^declare var" node_modules/@types/google-apps-script/*.d.ts \
  | awk '{print $3}' | sed 's/:$//' | sort -u

# 2. 특정 객체가 GAS 내장인지 확인
grep "^declare var SpreadsheetApp" node_modules/@types/google-apps-script/*.d.ts
# 출력 있음 → GAS 내장 API ✅
# 출력 없음 → 커스텀 함수 또는 메서드
```

**전체 GAS 내장 전역 객체 목록 (40개):**
```
Browser, CacheService, CalendarApp, CardService, Charset, Charts,
ConferenceDataService, console, ContactsApp, ContentService,
DataStudioApp, Date2, DigestAlgorithm, DocumentApp, DriveApp,
FormApp, GmailApp, GroupsApp, HtmlService, Jdbc, LanguageApp,
LinearOptimizationService, LockService, Logger, MacAlgorithm,
MailApp, Maps, MimeType, PropertiesService, RsaAlgorithm,
ScriptApp, ScriptProperties, Session, SitesApp, SlidesApp,
SpreadsheetApp, UrlFetchApp, UserProperties, Utilities, XmlService
```

---

### 전역 객체 사용

```javascript
// 전역 객체는 const로 재할당하지 마세요
const sheet = SpreadsheetApp.getActiveSheet();  // ✅
SpreadsheetApp = null;  // ❌ readonly 전역 변수

// 자주 사용하는 객체는 로컬 변수에 저장
function processSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();  // ✅
  const sheet = ss.getSheetByName('Data');

  // SpreadsheetApp.getActiveSpreadsheet() 반복 호출 피하기
}
```

---

### Date 객체 클라이언트 전달

**문제:** `google.script.run`은 Date 객체를 JSON 직렬화할 수 없음

**해결:** 서버에서 문자열로 변환 후 전달

```javascript
// ❌ 잘못된 방법
function getData() {
  const date = new Date();
  return date;  // 클라이언트에서 null 수신
}

// ✅ 올바른 방법
function getData() {
  const date = new Date();
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

// 배열/객체 내 Date 처리
function getSheetData() {
  const data = sheet.getDataRange().getValues();
  return data.map(row =>
    row.map(cell =>
      cell instanceof Date
        ? Utilities.formatDate(cell, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
        : cell
    )
  );
}
```

**포맷 옵션:**
```javascript
// 날짜만
'yyyy-MM-dd'                    // 2024-12-25

// 날짜 + 시간
'yyyy-MM-dd HH:mm:ss'           // 2024-12-25 14:30:45

// ISO 8601
'yyyy-MM-dd\'T\'HH:mm:ss\'Z\''  // 2024-12-25T14:30:45Z
```

---

### ⚠️ 스프레드시트 데이터 vs 웹 입력값 비교

**문제:** 스프레드시트에서 가져온 데이터와 웹 폼 입력값의 타입이 다를 수 있음

**원인:**
- 스프레드시트: 숫자는 `number` 타입, 문자는 `string` 타입
- 웹 폼 입력: **항상 `string` 타입** (HTML input의 `.value`는 문자열)
- `google.script.run`: 문자열을 그대로 전달

**실제 발생한 버그:**

```javascript
// ❌ 문제 상황
function checkLogin(email, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const [userEmail, userPassword] = data[i];

    // 스프레드시트에 123 (숫자)
    // 웹 폼에서 입력: "123" (문자열)
    if (userEmail === email && userPassword === password) {
      // 123 === "123" → false ❌ 로그인 실패!
      return { success: true };
    }
  }
  return { success: false };
}
```

**해결 방법:**

```javascript
// ✅ String()으로 변환 후 비교
function checkLogin(email, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const [userEmail, userPassword] = data[i];

    // 시트 데이터만 문자열로 변환 (웹 입력값은 이미 문자열)
    if (userEmail === email && String(userPassword) === password) {
      // String(123) === "123" → "123" === "123" → true ✅
      return { success: true };
    }
  }
  return { success: false };
}
```

**타입별 처리:**

```javascript
// ✅ 숫자 비교가 필요한 경우
const sheetAge = data[i][4];  // 시트: 25 (number)
const formAge = formData.age;  // 폼: "25" (string)

if (Number(sheetAge) === Number(formAge)) {  // 둘 다 숫자로 변환
  // ...
}

// ✅ 문자열 비교 (대부분의 경우)
const sheetEmail = data[i][0];
const formEmail = formData.email;

if (String(sheetEmail) === String(formEmail)) {  // 둘 다 문자열로 변환
  // ...
}
```

**왜 `==` 대신 `String()` + `===`를 사용하나?**

```javascript
// ⚠️ == 사용 (타입 자동 변환)
123 == "123"      // true
0 == ""           // true ← 의도하지 않은 동작
null == undefined // true ← 의도하지 않은 동작

// ✅ String() + === 사용 (명시적 변환)
String(123) === "123"  // "123" === "123" → true (웹 입력값은 이미 문자열)
String(0) === ""       // "0" === "" → false ✅
String(null) === undefined  // "null" === undefined → false ✅
```

**최적화 팁:**

```javascript
// ❌ 불필요한 변환
String(webInput) === String(sheetData)  // webInput은 이미 문자열

// ✅ 필요한 곳만 변환
webInput === String(sheetData)  // 시트 데이터만 변환
```

**체크리스트:**

- [ ] 스프레드시트 데이터와 웹 입력값 비교 시 타입 확인
- [ ] 숫자로 저장된 비밀번호/ID는 `String()` 변환 후 비교
- [ ] 웹 입력값(`google.script.run` 파라미터)은 이미 문자열임을 기억
- [ ] `===` 사용 시 타입 불일치 가능성 염두
- [ ] 불필요한 `String()` 변환 제거 (성능 최적화)

---

### Simple Triggers (진입점 함수)

```javascript
// 이 함수들은 반드시 전역 함수 선언이어야 함
function doGet(e) { }      // Web App GET
function doPost(e) { }     // Web App POST
function onOpen(e) { }     // Spreadsheet 열 때
function onEdit(e) { }     // Spreadsheet 편집 시
function onInstall(e) { }  // Add-on 설치 시

// ❌ const/let로 선언하면 Apps Script가 인식 못 함
const doGet = (e) => { };  // ❌
```

**ESLint 자동 제외:**
이 함수들은 `eslint.config.js`에서 자동으로 "unused" 경고 제외됩니다.

---

### 🔐 시크릿 정보 관리

**문제:** API 키, 토큰 등 민감 정보를 코드에 하드코딩하면 Git에 노출됨

**해결:** PropertiesService 사용

#### ✅ 권장: PropertiesService

```javascript
// ❌ 절대 금지: 하드코딩
const API_KEY = 'AIzaSyDxxx...';  // Git에 노출됨!
const DB_PASSWORD = 'secret123';  // 위험!

// ✅ 권장: PropertiesService
function callApi() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('API_KEY');
  const apiSecret = props.getProperty('API_SECRET');

  if (!apiKey) {
    throw new Error('API_KEY not configured');
  }

  const response = UrlFetchApp.fetch('https://api.example.com/data', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Secret': apiSecret
    }
  });

  return JSON.parse(response.getContentText());
}
```

#### 시크릿 설정 방법

**1. GAS 에디터에서 설정:**
```javascript
// 최초 1회 실행 (수동으로 실행)
function setupSecrets() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'API_KEY': 'your-api-key-here',
    'API_SECRET': 'your-secret-here',
    'DB_URL': 'https://db.example.com'
  });
  console.log('Secrets configured!');
}
```

**2. 스크립트에서 읽기:**
```javascript
function getConfig() {
  const props = PropertiesService.getScriptProperties();

  return {
    apiKey: props.getProperty('API_KEY'),
    apiSecret: props.getProperty('API_SECRET'),
    dbUrl: props.getProperty('DB_URL')
  };
}
```

#### PropertiesService 종류

| 타입 | 용도 | 범위 |
|------|------|------|
| **ScriptProperties** | 전역 설정 (추천) | 모든 사용자 공유 |
| **UserProperties** | 사용자별 설정 | 실행한 사용자만 |
| **DocumentProperties** | 문서별 설정 | Container-bound만 |

```javascript
// Script Properties (전역)
const scriptProps = PropertiesService.getScriptProperties();
scriptProps.setProperty('API_KEY', 'xxx');

// User Properties (사용자별)
const userProps = PropertiesService.getUserProperties();
userProps.setProperty('USER_TOKEN', 'yyy');

// Document Properties (Sheets/Docs/Forms 전용)
const docProps = PropertiesService.getDocumentProperties();
docProps.setProperty('SHEET_CONFIG', 'zzz');
```

#### 환경별 분리 (개발/프로덕션)

```javascript
// 환경 식별
function getEnvironment() {
  const scriptId = ScriptApp.getScriptId();
  // 개발 Script ID: 1abc...
  // 프로덕션 Script ID: 2xyz...
  return scriptId.startsWith('1') ? 'dev' : 'prod';
}

// 환경별 설정
function getApiKey() {
  const env = getEnvironment();
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(`API_KEY_${env.toUpperCase()}`);
}

// 설정 예시
function setupEnvironments() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'API_KEY_DEV': 'dev-key-xxx',
    'API_KEY_PROD': 'prod-key-yyy'
  });
}
```

#### ⚠️ 주의사항

1. **절대 Git에 커밋 금지:**
   - `.env` 파일 사용 시 `.gitignore`에 추가 필수
   - `config.js` 같은 설정 파일도 주의

2. **PropertiesService 제한:**
   - 최대 크기: 9KB per property
   - 최대 개수: 500개
   - 큰 데이터는 부적합 (Cache Service 사용)

3. **읽기 권한:**
   - Script Properties는 스크립트 소유자만 쓰기 가능
   - 배포된 Web App은 읽기만 가능

#### ❌ 피해야 할 패턴

```javascript
// ❌ 코드에 하드코딩
const API_KEY = 'AIzaSyDxxx...';

// ❌ 주석에 남김
// API_KEY: AIzaSyDxxx...

// ❌ 변수명으로 위장
const base64EncodedKey = 'QUl6YVN5RHh4eA==';  // 여전히 노출됨

// ❌ Git에 포함된 파일
// config.js를 Git에 커밋
```

---

### ⚠️ 시간 트리거가 옛 코드로 도는 경우 (재생성으로 해결)

시간 기반 트리거(`ScriptApp.newTrigger().timeBased()`)는 원칙적으로 **최신 저장 코드(HEAD)** 로 실행된다.
그러나 실측에서, `clasp push`로 HEAD를 여러 번 갱신했는데도 **트리거가 옛 버전 코드로 계속 실행**되는 현상이 있었다.

**증상:**

- 트리거 실행 로그의 **에러 메시지·스택 라인넘버가 현재 코드와 불일치**(옛 버전과 일치)
- 옛 코드가 이미 바뀐 환경(예: 이름이 바뀐 시트)을 못 찾아 **주기적으로 에러·부작용**(중복 시트 생성 등) 반복

**원인 추정:** 트리거가 특정 시점의 코드/배포 상태에 묶임(stale).

**해결: 트리거를 삭제하고 다시 만들면 현재 코드로 재바인딩된다.**

```text
GAS 에디터 → ⏰ 트리거 → 해당 트리거 삭제
  또는 토글형이면 OFF → ON (removeTrigger_ → installTrigger_) 으로 재생성
→ 재생성된 트리거는 HEAD(현재 코드)로 실행됨
```

**진단 팁:** 트리거가 남기는 로그 메시지에 **버전이 드러나는 텍스트**(번역된 문구·메뉴 이름 등)를 넣어두면,
"옛 코드냐 새 코드냐"를 **로그만 보고 즉시 판별**할 수 있다. (예: 메뉴명을 영→한 번역한 뒤, 로그에 옛 영어 문구가 보이면 옛 코드가 도는 것)

---

## ✅ 체크리스트

- [ ] `var` 대신 `const`/`let` 사용
- [ ] `Logger.log` 대신 `console.log` 사용
- [ ] Template literals (백틱) 사용
- [ ] Arrow function 적극 활용
- [ ] Destructuring과 spread operator 사용
- [ ] 의미 있는 변수명
- [ ] 에러 핸들링 추가
- [ ] JSDoc 주석 (공개 함수)
- [ ] 시크릿 정보는 PropertiesService 사용

---

## 📚 참고 문서

### 공식 가이드:
- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
- [Apps Script V8 Runtime](https://developers.google.com/apps-script/guides/v8-runtime)
- [Apps Script Logging](https://developers.google.com/apps-script/guides/logging)
- [Apps Script Best Practices](https://developers.google.com/apps-script/guides/support/best-practices)

### 커뮤니티:
- [Andrew Roberts - Best Practices](https://www.andrewroberts.net/google-apps-script/google-apps-script-development-best-practices/)
- [Ben Collins - V8 Runtime](https://www.benlcollins.com/apps-script/apps-script-v8-runtime/)
