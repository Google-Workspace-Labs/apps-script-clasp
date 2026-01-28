# 📚 Study-doGet 프로젝트 분석

> **Google Apps Script Web App** - doGet() URL 구조 학습용 프로젝트

---

## 📚 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [GAS 아키텍처](#2-gas-아키텍처)
3. [dev vs exec URL](#3-dev-vs-exec-url)
4. [파일 구조](#4-파일-구조)
5. [코드 상세 분석](#5-코드-상세-분석)
6. [배포 및 실행](#6-배포-및-실행)
7. [참고 자료](#7-참고-자료)

---

## 1. 프로젝트 개요

### 🎯 프로젝트 목적

**Apps Script Web App의 URL 구조를 이해하기 위한 학습용 프로젝트**

- **dev URL vs exec URL 차이점 학습**
- **ScriptApp.getService().getUrl() 사용법**
- **서버 → 클라이언트 데이터 전달 방법**
- **템플릿 변수 활용 방법**

### 🔍 핵심 특징

| 특징 | 설명 |
|------|------|
| **프로젝트 타입** | Standalone Web App |
| **목적** | 교육/학습 |
| **복잡도** | 🟢 매우 낮음 (기초 개념) |
| **UI** | 단순한 정보 표시 페이지 |
| **서버 통신** | ❌ 없음 |
| **라이브러리** | 없음 (순수 GAS) |

### 🆚 다른 프로젝트와 비교

| 구분 | study-do-get | what-to-eat | user-permission |
|------|--------------|-------------|-----------------|
| **목적** | 학습/교육 | 실용 도구 | 실무 시스템 |
| **복잡도** | 🟢 매우 낮음 | 🟡 낮음 | 🔴 높음 |
| **UI** | 단순 텍스트 | Glassmorphism | 다중 페이지 |
| **기능** | URL 정보 표시 | 랜덤 선택 | 인증, 권한 관리 |
| **학습 가치** | URL 구조, 템플릿 | 애니메이션, DOM | SpreadsheetApp, 인증 |

---

## 2. GAS 아키텍처

### 📊 시스템 구조

```
┌─────────────────────────────────────────────────────┐
│              GAS Server                             │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐ │
│  │  doGet() 함수 실행                           │ │
│  │  1. ScriptApp.getService().getUrl() 호출    │ │
│  │     → deployLinkA (dev URL)                  │ │
│  │  2. .replace('/dev', '/exec')                │ │
│  │     → deployLinkB (exec URL)                 │ │
│  │  3. console.log로 서버 로그 출력             │ │
│  └─────────────────┬─────────────────────────────┘ │
│                    │                                 │
│  ┌─────────────────▼─────────────────────────────┐ │
│  │  HtmlTemplate 생성                           │ │
│  │  - createTemplateFromFile('index')           │ │
│  │  - template.urllinkA = deployLinkA           │ │
│  │  - template.urllinkB = deployLinkB           │ │
│  │  - template.evaluate() → HTML 반환          │ │
│  └─────────────────┬─────────────────────────────┘ │
└────────────────────┼─────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              Browser (Client)                       │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐ │
│  │  index.html 렌더링                           │ │
│  │  - <?= urllinkA; ?> → deployLinkA 삽입      │ │
│  │  - <?= urllinkB; ?> → deployLinkB 삽입      │ │
│  └─────────────────┬─────────────────────────────┘ │
│                    │                                 │
│  ┌─────────────────▼─────────────────────────────┐ │
│  │  JavaScript 실행                             │ │
│  │  - console.log('Base URL A: ', baseUrlA)     │ │
│  │  - console.log('Base URL B: ', baseUrlB)     │ │
│  │  - document.getElementById('urlA').textContent │ │
│  │  - document.getElementById('urlB').textContent │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 🔄 실행 흐름

```
1. 사용자가 Web App URL 접속
   ↓
2. GAS 서버: doGet() 함수 자동 실행
   ↓
3. ScriptApp.getService().getUrl()
   - 결과: https://script.google.com/macros/s/AKfycbz.../dev
   ↓
4. .replace('/dev', '/exec')
   - 결과: https://script.google.com/macros/s/AKfycbz.../exec
   ↓
5. console.log() - Apps Script 서버 로그
   - "A: https://.../dev"
   - "B: https://.../exec"
   ↓
6. HtmlTemplate 생성
   - createTemplateFromFile('index')
   - template.urllinkA = deployLinkA
   - template.urllinkB = deployLinkB
   ↓
7. template.evaluate() - 템플릿 렌더링
   - <?= urllinkA; ?> → 실제 URL로 치환
   - <?= urllinkB; ?> → 실제 URL로 치환
   ↓
8. HTML을 브라우저에 반환
   ↓
9. 클라이언트 JavaScript 실행
   - console.log() - 브라우저 콘솔 로그
   - document.getElementById() - 화면에 URL 표시
```

---

## 3. dev vs exec URL

### 🔗 URL 구조 이해

#### A. 기본 URL 형식

```
https://script.google.com/macros/s/{SCRIPT_ID}/{MODE}
```

**구성 요소:**
- `script.google.com` - Apps Script 도메인
- `/macros/s/` - Web App 경로
- `{SCRIPT_ID}` - 배포된 스크립트의 고유 ID
- `{MODE}` - 실행 모드 (`dev` 또는 `exec`)

#### B. dev URL (개발/테스트용)

**형식:**
```
https://script.google.com/macros/s/AKfycbzIpaq.../dev
```

**특징:**

| 항목 | 설명 |
|------|------|
| **목적** | 개발 및 테스트 |
| **접근 권한** | 로그인한 사용자만 |
| **코드 버전** | 최신 저장된 코드 (실시간 반영) |
| **인증** | Google 계정 필요 |
| **사용 시나리오** | 개발자가 테스트할 때 |
| **배포 필요 여부** | ❌ 불필요 (자동 생성) |

**장점:**
- ✅ 코드 수정 후 즉시 테스트 가능
- ✅ 별도 배포 없이 clasp push 후 바로 확인

**단점:**
- ❌ 익명 사용자 접근 불가
- ❌ 외부 공유 불가

#### C. exec URL (배포/프로덕션용)

**형식:**
```
https://script.google.com/macros/s/AKfycbzIpaq.../exec
```

**특징:**

| 항목 | 설명 |
|------|------|
| **목적** | 프로덕션 배포 |
| **접근 권한** | 설정에 따라 다름 (익명 가능) |
| **코드 버전** | 배포 시점의 스냅샷 |
| **인증** | 설정에 따라 다름 |
| **사용 시나리오** | 실제 서비스 운영 |
| **배포 필요 여부** | ✅ 필요 (clasp deploy) |

**장점:**
- ✅ 익명 사용자도 접근 가능 (설정 시)
- ✅ 외부 공유 가능
- ✅ 안정적인 버전 관리

**단점:**
- ❌ 코드 수정 후 재배포 필요
- ❌ 배포 과정 추가 필요

### 📊 dev vs exec 비교표

| 항목 | dev | exec |
|------|-----|------|
| **URL 형식** | `.../dev` | `.../exec` |
| **생성 방법** | 자동 생성 | `clasp deploy` 필요 |
| **코드 버전** | 최신 저장 | 배포 시점 스냅샷 |
| **접근 권한** | 로그인 필수 | 익명 가능 (설정 시) |
| **테스트 용도** | ✅ 적합 | ❌ 부적합 |
| **프로덕션 용도** | ❌ 부적합 | ✅ 적합 |
| **코드 변경 반영** | 즉시 | 재배포 후 |
| **외부 공유** | ❌ 불가능 | ✅ 가능 |

### 🎯 사용 시나리오

#### 시나리오 1: 개발 중

```bash
# 1. 코드 수정
vim Code.js

# 2. GAS 업로드
clasp push

# 3. dev URL로 즉시 테스트
open https://script.google.com/macros/s/.../dev
```

**장점:** 빠른 피드백 루프

#### 시나리오 2: 배포

```bash
# 1. 개발 완료 후 배포
clasp deploy -d "v1.0.0"

# 2. exec URL 생성됨
# https://script.google.com/macros/s/.../exec

# 3. exec URL 공유
# 외부 사용자도 접근 가능
```

**장점:** 안정적인 버전 관리

#### 시나리오 3: 버전 관리

```bash
# dev URL: 항상 최신 코드
clasp push
# → dev URL에 즉시 반영

# exec URL: 배포된 버전 유지
clasp deploy -d "v1.0.1"
# → 새 exec URL 생성 (기존 URL도 유지)
```

**장점:** 여러 버전 동시 운영 가능

---

## 4. 파일 구조

### 📂 프로젝트 구조

```
projects/study-do-get/
├── Code.js              # 서버 사이드 로직 (30줄)
├── index.html           # 클라이언트 UI (76줄)
├── appsscript.json      # GAS 프로젝트 설정
└── .clasp.json          # Script ID
```

### 📄 파일별 설명

#### 1. Code.js (30줄)

**역할:** 서버 사이드 진입점

**코드:**
```javascript
function doGet() {
  // 현재 스크립트의 배포 URL(dev 환경 기준)을 가져옵니다.
  const deployLinkA = ScriptApp.getService().getUrl(); // 예: /dev
  // dev → exec 으로 치환한 실제 사용자 실행용 URL을 만듭니다.
  const deployLinkB = ScriptApp.getService().getUrl().replace('/dev', '/exec');

  // 콘솔 로그 (개발자 확인용, 브라우저 console.log() 아님. 이건 Apps Script의 로그)
  console.log('A: ' + deployLinkA);
  console.log('B: ' + deployLinkB);

  // HTML 템플릿 파일(index.html)을 불러옵니다.
  const template = HtmlService.createTemplateFromFile('index');

  // 템플릿 내에서 사용할 변수 값을 전달합니다 (서버에서 클라이언트로 데이터 전달)
  template.urllinkA = deployLinkA; // index.html에서 <?= urllinkA ?> 로 참조 가능
  template.urllinkB = deployLinkB; // index.html에서 <?= urllinkB ?> 로 참조 가능

  // HTMLTemplate 객체를 실제 HTML로 렌더링해서 브라우저에 반환합니다.
  return template.evaluate();
}
```

**핵심 개념:**

1. **ScriptApp.getService().getUrl()**
   - 현재 Web App의 URL 반환
   - 항상 `/dev`로 끝남

2. **.replace('/dev', '/exec')**
   - 문자열 치환
   - dev URL → exec URL 변환

3. **console.log()**
   - Apps Script 서버 로그
   - `clasp logs` 또는 GAS 에디터에서 확인 가능
   - 브라우저 콘솔 아님!

4. **HtmlService.createTemplateFromFile()**
   - HTML 템플릿 파일 로드
   - 템플릿 변수 사용 가능

5. **template.변수명 = 값**
   - 서버 → 클라이언트 데이터 전달
   - HTML에서 `<?= 변수명 ?>` 으로 접근

6. **template.evaluate()**
   - 템플릿 렌더링
   - `<?= ... ?>` 치환 실행

#### 2. index.html (76줄)

**역할:** 클라이언트 UI

**구조:**
```html
<!doctype html>
<html>
  <head>
    <base target="_top" />
    <title>Study: doGet() URL</title>
    <style>
      /* 인라인 CSS */
    </style>
  </head>
  <body>
    <h1>📚 Study: doGet() URL</h1>

    <div class="url-section">
      <div class="url-label">Dev URL (테스트용):</div>
      <div class="url-value" id="urlA"></div>
      <div class="description">로그인된 사용자가 실행, 테스트용</div>
    </div>

    <div class="url-section">
      <div class="url-label">Exec URL (배포용):</div>
      <div class="url-value" id="urlB"></div>
      <div class="description">최종 배포된 실행 URL, 익명 사용자도 접근 가능</div>
    </div>

    <script>
      // 서버(GAS)에서 전달한 배포 링크를 클라이언트 측 JS에서 사용
      const baseUrlA = '<?= urllinkA; ?>'; // ScriptApp.getService().getUrl() 결과
      const baseUrlB = '<?= urllinkB; ?>'; // /dev → /exec 치환된 URL

      // 브라우저 콘솔에서 URL 확인용 출력
      console.log('Base URL A: ', baseUrlA);
      console.log('Base URL B: ', baseUrlB);

      // 화면에 URL 표시
      document.getElementById('urlA').textContent = baseUrlA;
      document.getElementById('urlB').textContent = baseUrlB;
    </script>
  </body>
</html>
```

**핵심 개념:**

1. **템플릿 변수 사용**
   ```html
   const baseUrlA = '<?= urllinkA; ?>';
   ```
   - `<?= ... ?>` - 서버 변수를 클라이언트 JavaScript에 삽입
   - 렌더링 시 실제 값으로 치환

2. **console.log() (클라이언트)**
   ```javascript
   console.log('Base URL A: ', baseUrlA);
   ```
   - 브라우저 개발자 도구 콘솔에 출력
   - Code.js의 console.log()와 다름!

3. **DOM 조작**
   ```javascript
   document.getElementById('urlA').textContent = baseUrlA;
   ```
   - 화면에 URL 표시

#### 3. appsscript.json (9줄)

**역할:** GAS 프로젝트 설정

**내용:**
```json
{
  "timeZone": "Asia/Seoul",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

**설정 설명:**
- `webapp.executeAs`: "USER_DEPLOYING" - 배포자 권한으로 실행
- `webapp.access`: "ANYONE_ANONYMOUS" - 익명 접근 허용

#### 4. .clasp.json (9줄)

**역할:** clasp 설정

**내용:**
```json
{
  "scriptId": "1BvX-9PlxkOR212_s2aiIGPuz7AdpiOcT4ndJebrRRmNI4D80zVG1dY1j",
  "rootDir": "",
  "scriptExtensions": [".js", ".gs"],
  "htmlExtensions": [".html"],
  "jsonExtensions": [".json"],
  "filePushOrder": [],
  "skipSubdirectories": false
}
```

---

## 5. 코드 상세 분석

### 🔍 핵심 개념

#### 개념 1: 서버 → 클라이언트 데이터 전달

**방법 1: 템플릿 변수 (현재 프로젝트 사용)**

**서버 (Code.js):**
```javascript
const template = HtmlService.createTemplateFromFile('index');
template.urllinkA = deployLinkA;
template.urllinkB = deployLinkB;
return template.evaluate();
```

**클라이언트 (index.html):**
```html
<script>
  const baseUrlA = '<?= urllinkA; ?>';
  const baseUrlB = '<?= urllinkB; ?>';
</script>
```

**렌더링 결과:**
```javascript
const baseUrlA = 'https://script.google.com/macros/s/AKfycbz.../dev';
const baseUrlB = 'https://script.google.com/macros/s/AKfycbz.../exec';
```

**방법 2: google.script.run (다른 프로젝트에서 사용)**

**서버 (Code.js):**
```javascript
function getUrls() {
  return {
    devUrl: ScriptApp.getService().getUrl(),
    execUrl: ScriptApp.getService().getUrl().replace('/dev', '/exec')
  };
}
```

**클라이언트 (index.html):**
```html
<script>
  google.script.run
    .withSuccessHandler(function(result) {
      console.log(result.devUrl);
      console.log(result.execUrl);
    })
    .getUrls();
</script>
```

**비교:**

| 방법 | 템플릿 변수 | google.script.run |
|------|------------|-------------------|
| **실행 시점** | 페이지 로드 시 (동기) | 페이지 로드 후 (비동기) |
| **속도** | 빠름 | 느림 (서버 요청) |
| **로딩 표시** | 불필요 | 필요 |
| **사용 시나리오** | 초기 데이터 전달 | 사용자 인터랙션 후 |

#### 개념 2: console.log() 차이점

**서버 console.log() (Code.js):**
```javascript
console.log('A: ' + deployLinkA);
```

**확인 방법:**
```bash
# 터미널
clasp logs

# 또는 GAS 에디터
Apps Script 에디터 → 실행 로그
```

**클라이언트 console.log() (index.html):**
```javascript
console.log('Base URL A: ', baseUrlA);
```

**확인 방법:**
```
브라우저 → F12 → Console 탭
```

**비교:**

| 구분 | 서버 console.log | 클라이언트 console.log |
|------|-----------------|----------------------|
| **실행 위치** | GAS 서버 | 브라우저 |
| **확인 위치** | clasp logs, GAS 에디터 | 브라우저 개발자 도구 |
| **사용 시나리오** | 서버 로직 디버깅 | 클라이언트 로직 디버깅 |

#### 개념 3: URL 문자열 치환

**코드:**
```javascript
const deployLinkA = ScriptApp.getService().getUrl();
// "https://script.google.com/macros/s/AKfycbz.../dev"

const deployLinkB = deployLinkA.replace('/dev', '/exec');
// "https://script.google.com/macros/s/AKfycbz.../exec"
```

**String.replace() 설명:**
```javascript
// 기본 사용법
const str = "Hello World";
str.replace("World", "JavaScript"); // "Hello JavaScript"

// Apps Script URL 변환
const devUrl = "https://script.google.com/macros/s/ABC/dev";
const execUrl = devUrl.replace('/dev', '/exec');
// "https://script.google.com/macros/s/ABC/exec"
```

**주의사항:**
- `replace()`는 첫 번째 매칭만 치환
- URL에 `/dev`가 여러 번 나오면 의도하지 않은 결과 발생 가능
- 이 프로젝트에서는 `/dev`가 URL 끝에만 나오므로 문제없음

---

## 6. 배포 및 실행

### 🚀 배포 방법

#### A. dev URL 테스트 (배포 불필요)

```bash
# 1. 코드 푸시
cd projects/study-do-get
clasp push

# 2. GAS 에디터 열기
clasp open

# 3. 배포 → 웹 앱으로 배포 (최초 1회)
# 또는 직접 URL 접속
```

**dev URL 형식:**
```
https://script.google.com/macros/s/{SCRIPT_ID}/dev
```

#### B. exec URL 배포

```bash
# 1. 배포
clasp deploy -d "Study doGet v1.0"

# 2. 배포 URL 확인
clasp deployments

# 출력 예시:
# - AKfycbz... @1 - Study doGet v1.0
```

**exec URL 형식:**
```
https://script.google.com/macros/s/{SCRIPT_ID}/exec
```

### 🧪 테스트 방법

#### 시나리오 1: dev URL 확인

1. Web App에 접속 (dev URL)
2. 화면에 표시된 "Dev URL" 확인
3. URL이 `/dev`로 끝나는지 확인
4. 브라우저 콘솔 확인 (`F12` → Console)
   ```
   Base URL A: https://script.google.com/macros/s/AKfycbz.../dev
   Base URL B: https://script.google.com/macros/s/AKfycbz.../exec
   ```

#### 시나리오 2: exec URL 확인

1. `clasp deploy` 실행
2. 새 탭에서 exec URL 접속
3. 화면에 표시된 "Exec URL" 확인
4. URL이 `/exec`로 끝나는지 확인

#### 시나리오 3: 코드 수정 반영 확인

**dev URL 테스트:**
```bash
# 1. Code.js 수정
vim Code.js

# 2. 푸시
clasp push

# 3. dev URL 새로고침
# → 즉시 변경사항 반영됨 ✅
```

**exec URL 테스트:**
```bash
# 1. Code.js 수정
vim Code.js

# 2. 푸시
clasp push

# 3. exec URL 새로고침
# → 변경사항 반영 안 됨 ❌ (이전 배포 버전)

# 4. 재배포
clasp deploy -d "v1.1"

# 5. exec URL 새로고침
# → 변경사항 반영됨 ✅
```

### 🛠️ 디버깅

#### A. 서버 로그 확인

**Code.js 로그:**
```javascript
console.log('A: ' + deployLinkA);
console.log('B: ' + deployLinkB);
```

**확인 방법:**
```bash
clasp logs
```

**출력 예시:**
```
A: https://script.google.com/macros/s/AKfycbz.../dev
B: https://script.google.com/macros/s/AKfycbz.../exec
```

#### B. 클라이언트 로그 확인

**index.html 로그:**
```javascript
console.log('Base URL A: ', baseUrlA);
console.log('Base URL B: ', baseUrlB);
```

**확인 방법:**
```
브라우저 → F12 → Console 탭
```

#### C. 템플릿 변수 확인

**렌더링된 HTML 소스 보기:**
```
브라우저 → 우클릭 → 페이지 소스 보기
```

**확인:**
```html
<script>
  const baseUrlA = 'https://script.google.com/macros/s/AKfycbz.../dev';
  const baseUrlB = 'https://script.google.com/macros/s/AKfycbz.../exec';
</script>
```

---

## 7. 참고 자료

### 📖 공식 문서

| 리소스 | URL |
|--------|-----|
| **Apps Script 공식 문서** | https://developers.google.com/apps-script |
| **Web Apps** | https://developers.google.com/apps-script/guides/web |
| **ScriptApp** | https://developers.google.com/apps-script/reference/script/script-app |
| **HtmlService** | https://developers.google.com/apps-script/reference/html/html-service |
| **Templated HTML** | https://developers.google.com/apps-script/guides/html/templates |

### 🔗 관련 프로젝트

- **what-to-eat**: 순수 프론트엔드 Web App
- **user-permission**: 복잡한 인증/권한 시스템

### 📊 프로젝트 통계

| 항목 | 수치 |
|------|------|
| **총 파일 수** | 4개 |
| **JavaScript 파일** | 1개 (Code.js) |
| **HTML 파일** | 1개 (index.html) |
| **총 코드 라인** | 106줄 |
| **함수 수** | 1개 (doGet) |
| **템플릿 변수** | 2개 (urllinkA, urllinkB) |
| **외부 라이브러리** | 0개 |

---

## 📝 마무리

이 프로젝트는 **Apps Script Web App의 URL 구조를 이해하기 위한 최소한의 예제**입니다.

**핵심 학습 포인트:**

1. **dev vs exec URL 차이점**
   - dev: 테스트용, 로그인 필요, 최신 코드
   - exec: 배포용, 익명 가능, 배포 시점 코드

2. **ScriptApp.getService().getUrl()**
   - 현재 Web App URL 가져오기
   - 항상 `/dev`로 끝남

3. **템플릿 변수 사용**
   - 서버 → 클라이언트 데이터 전달
   - `<?= 변수명 ?>` 구문

4. **console.log() 차이**
   - 서버: `clasp logs`로 확인
   - 클라이언트: 브라우저 콘솔

**활용 가능한 시나리오:**

- Apps Script Web App 학습
- URL 구조 이해
- 템플릿 변수 사용법 학습
- 배포 프로세스 이해

**확장 아이디어:**

- 여러 배포 버전 비교
- 쿼리 파라미터 처리 추가
- POST 요청 처리 (doPost)
- 인증 토큰 전달 예제

---

**작성일:** 2026-01-28
**프로젝트:** apps-script-clasp/projects/study-do-get
**GAS Runtime:** V8
**TimeZone:** Asia/Seoul
