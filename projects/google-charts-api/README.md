# 📊 Google Charts API 프로젝트 완전 분석

> **Google Apps Script Web App** - Google Sheets 데이터를 Google Charts로 시각화

---

## 📚 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [Google Charts API 이해하기 (초보자용)](#2-google-charts-api-이해하기-초보자용)
3. [GAS 아키텍처](#3-gas-아키텍처)
4. [주요 기능](#4-주요-기능)
5. [Google Charts API 사용](#5-google-charts-api-사용)
6. [GAS API 사용](#6-gas-api-사용)
7. [파일 구조](#7-파일-구조)
8. [코드 상세 분석](#8-코드-상세-분석)
9. [보안 및 권한](#9-보안-및-권한)
10. [배포 및 실행](#10-배포-및-실행)
11. [참고 자료](#11-참고-자료)

---

## 1. 프로젝트 개요

### 🎯 프로젝트 목적

**Google Sheets 데이터를 Google Charts로 시각화하는 Web App**

- **Google Sheets에서 데이터 가져오기** (부서별 급여)
- **Pie Chart (Donut)로 시각화**
- **자동 새로고침** (5분마다)
- **수동 새로고침** 버튼
- **반응형 디자인** (창 크기 변경 시 차트 자동 조정)

### 🔍 핵심 특징

| 특징 | 설명 |
|------|------|
| **프로젝트 타입** | Web App (독립 URL) |
| **데이터 소스** | Google Sheets |
| **차트 라이브러리** | Google Charts API (CDN) |
| **자동 새로고침** | setInterval (5분) |
| **수동 새로고침** | google.script.run |
| **외부 라이브러리** | 1개 (Google Charts) |

### 🆚 프로젝트 비교

| 구분 | user-permission | geo-location | google-charts-api |
|------|-----------------|--------------|-------------------|
| **데이터 소스** | Google Sheets | Geolocation API | Google Sheets |
| **시각화** | HTML 테이블 | 텍스트 | Google Charts |
| **외부 CDN** | 5개 | 0개 | 1개 (Google Charts) |
| **자동 새로고침** | 없음 | 30초 (watchPosition) | 5분 (setInterval) |
| **차트 타입** | 없음 | 없음 | Pie Chart (Donut) |

---

## 2. Google Charts API 이해하기 (초보자용)

### 🤔 Google Charts API란?

**Google Charts**는 Google이 제공하는 **무료 JavaScript 차트 라이브러리**입니다.

**공식 사이트:** https://developers.google.com/chart

**주요 차트 종류:**
- Pie Chart (원형 차트)
- Bar Chart (막대 차트)
- Line Chart (선 차트)
- Column Chart (세로 막대 차트)
- Table (테이블)
- Geo Chart (지도)
- 등 28가지 차트

### 📡 Google Charts는 CDN인가요?

**네, CDN입니다!**

```html
<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
```

**CDN (Content Delivery Network):**
- 구글 서버에서 직접 로드
- 로컬 파일 다운로드 불필요
- 항상 최신 버전 사용
- 전 세계 빠른 속도

**vs 다른 CDN 차트 라이브러리:**

| 라이브러리 | 무료 | 차트 종류 | 라이센스 | 사용 난이도 |
|-----------|------|----------|---------|-----------|
| **Google Charts** | ✅ | 28개 | Apache 2.0 | 쉬움 |
| Chart.js | ✅ | 8개 | MIT | 쉬움 |
| D3.js | ✅ | 무제한 | BSD | 어려움 |
| Highcharts | ⚠️ 상업용 유료 | 많음 | 조건부 무료 | 중간 |

**이 프로젝트는 Google Charts를 사용합니다!**

---

### 🎨 Pie Chart (Donut) 예시

**이 프로젝트의 차트:**

```
┌─────────────────────────────────────────────┐
│         부서별 급여 합계                      │
├─────────────────────────────────────────────┤
│                                             │
│            ╭───────╮                        │
│          ╱           ╲        ┌───────┐   │
│        ╱    영업      ╲       │ 영업   │   │
│       │   40,000,000  │       │ 개발   │   │
│       │               │       │ 인사   │   │
│        ╲    개발     ╱        └───────┘   │
│          ╲ 60,000,000╱                     │
│            ╰───────╯                        │
│              인사                           │
│           20,000,000                        │
│                                             │
└─────────────────────────────────────────────┘
```

**특징:**
- **Donut 차트** (가운데 구멍 있음)
- **퍼센트 표시** (각 슬라이스에 %)
- **색상 자동 할당**
- **툴팁** (마우스 오버 시 상세 정보)
- **반응형** (창 크기 변경 시 자동 조정)

---

## 3. GAS 아키텍처

### 📊 시스템 구조

```
┌─────────────────────────────────────────────────────┐
│              Google Sheets                          │
│  (ID: 15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4) │
├─────────────────────────────────────────────────────┤
│  Sheet: "급여 데이터"                                │
│  ┌────────────┬──────────┐                         │
│  │   부서     │   급여   │                         │
│  ├────────────┼──────────┤                         │
│  │   영업     │ 5,000,000│                         │
│  │   영업     │ 4,500,000│                         │
│  │   개발     │ 6,000,000│                         │
│  │   개발     │ 5,500,000│                         │
│  │   인사     │ 4,000,000│                         │
│  └────────────┴──────────┘                         │
└─────────────────────────────────────────────────────┘
                     ↓ SpreadsheetApp.openById()
┌─────────────────────────────────────────────────────┐
│           Google Apps Script (서버)                 │
├─────────────────────────────────────────────────────┤
│  1. doGet() 함수 실행                               │
│     - getData() 호출 → Sheets 데이터 읽기           │
│     - JSON 변환: [{department, salary}, ...]        │
│     - XSS 방지: < → \\u003c                         │
│     - Index.html 템플릿에 데이터 주입               │
│     ↓                                               │
│  2. HTML 렌더링 & 반환                              │
└─────────────────────────────────────────────────────┘
                     ↓ HTML Response
┌─────────────────────────────────────────────────────┐
│              사용자 브라우저                         │
├─────────────────────────────────────────────────────┤
│  1. Web App URL 접근                                │
│     https://script.google.com/macros/s/.../exec     │
│     ↓                                               │
│  2. HTML + JavaScript 로드                          │
│     - Google Charts CDN 로드                        │
│     - 초기 데이터 파싱 (<?= initialData ?>)         │
│     ↓                                               │
│  3. google.charts.load() 실행                       │
│     - 'corechart' 패키지 로드                       │
│     ↓                                               │
│  4. setOnLoadCallback() → drawChart() 실행          │
│     - 부서별 급여 합산 (salaryMap)                  │
│     - DataTable 생성                                │
│     - PieChart 그리기                               │
│     ↓                                               │
│  5. 자동 새로고침 시작 (5분마다)                     │
│     - setInterval() 등록                            │
│     - google.script.run.getData() 호출              │
│     - 차트 업데이트                                 │
│     ↓                                               │
│  6. 사용자 인터랙션                                  │
│     - "데이터 새로고침" 버튼 클릭                    │
│     - "자동 새로고침 중지/시작" 버튼 클릭            │
│     - 창 크기 변경 → 차트 자동 리사이즈              │
└─────────────────────────────────────────────────────┘
```

### 🔄 실행 흐름

#### A. Web App 최초 접근

```
1. 사용자가 Web App URL 접근
   ↓
2. doGet() 함수 실행 (서버)
   ↓
3. getData() 호출
   ├─ SpreadsheetApp.openById("...")
   ├─ getSheetByName("급여 데이터")
   ├─ getDataRange().getValues()
   └─ JSON 변환: [{department, salary}, ...]
   ↓
4. Index.html 템플릿 로드
   ↓
5. <?= initialData ?> scriptlet 처리
   - JSON.stringify(data)
   - XSS 방지: < → \\u003c
   ↓
6. HTML 렌더링 & 클라이언트로 전송
   ↓
7. 브라우저에서 JavaScript 실행
   ├─ Google Charts CDN 로드
   ├─ initialData 파싱
   └─ drawChart() 실행
   ↓
8. Pie Chart 표시 ✅
```

#### B. 자동 새로고침 (5분마다)

```
1. setInterval() 타이머 실행 (5분 경과)
   ↓
2. google.script.run.getData() 호출 (클라이언트 → 서버)
   ↓
3. getData() 함수 실행 (서버)
   ├─ 스프레드시트 데이터 다시 읽기
   └─ JSON 반환
   ↓
4. withSuccessHandler() 콜백 실행 (클라이언트)
   ↓
5. drawChart(data) 호출
   ↓
6. 차트 업데이트 ✅
   ↓
7. 마지막 업데이트 시간 표시
```

#### C. 수동 새로고침 (버튼 클릭)

```
1. "데이터 새로고침" 버튼 클릭
   ↓
2. refreshData() 함수 실행
   ├─ 버튼 비활성화
   └─ 버튼 텍스트 "로딩 중..."
   ↓
3. google.script.run.getData() 호출
   ↓
4. getData() 함수 실행 (서버)
   ↓
5. 데이터 반환
   ↓
6. withSuccessHandler() 콜백
   ├─ drawChart(data)
   ├─ 버튼 활성화
   └─ 버튼 텍스트 "데이터 새로고침"
   ↓
7. 차트 업데이트 ✅
```

#### D. 자동 새로고침 토글

```
1. "자동 새로고침 중지" 버튼 클릭
   ↓
2. toggleAutoRefresh() 함수 실행
   ↓
3. refreshIntervalId 확인
   ├─ null이 아니면 (실행 중) → stopAutoRefresh()
   │  ├─ clearInterval(refreshIntervalId)
   │  ├─ refreshIntervalId = null
   │  ├─ 상태: "비활성화됨"
   │  └─ 버튼: "자동 새로고침 시작"
   │
   └─ null이면 (중지됨) → startAutoRefresh()
      ├─ setInterval(..., 5분)
      ├─ 상태: "활성화됨"
      └─ 버튼: "자동 새로고침 중지"
```

---

## 4. 주요 기능

### ✅ 기능 목록

| 기능 | 함수/API | 위치 | 설명 |
|------|---------|------|------|
| **Web App 라우팅** | `doGet()` | Code.js:1-14 | HTML 렌더링 |
| **데이터 가져오기** | `getData()` | Code.js:16-26 | Sheets → JSON |
| **차트 그리기** | `drawChart()` | Index.html:21-67 | Google Charts |
| **수동 새로고침** | `refreshData()` | Index.html:70-87 | 버튼 클릭 시 |
| **자동 새로고침** | `startAutoRefresh()` | Index.html:90-110 | 5분마다 |
| **자동 새로고침 중지** | `stopAutoRefresh()` | Index.html:113-122 | clearInterval |
| **토글** | `toggleAutoRefresh()` | Index.html:125-131 | ON/OFF |
| **반응형** | `window.resize` | Index.html:61-63 | 창 크기 변경 |

---

### 🎛️ 기능 1: Web App 라우팅

**함수:** `doGet()` (Code.js:1-14)

**코드:**
```javascript
function doGet() {
  // 스프레드시트 데이터 가져오기
  const data = getData();

  // HTML 템플릿 로드
  const template = HtmlService.createTemplateFromFile('Index');

  // 데이터를 JSON 형태로 변환하여 템플릿에 전달 (보안 이슈 방지)
  template.initialData = JSON.stringify(data).replace(/</g, '\\u003c');

  return template.evaluate()
    .setTitle("부서별 급여 차트")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

**단계별 설명:**

1. **getData() 호출**
   - 스프레드시트에서 데이터 읽기
   - JSON 배열 반환: `[{department, salary}, ...]`

2. **HtmlService.createTemplateFromFile('Index')**
   - `Index.html` 템플릿 로드
   - scriptlet 처리 가능 (`<?= ... ?>`)

3. **template.initialData 설정**
   - `JSON.stringify(data)` → JSON 문자열
   - `.replace(/</g, '\\u003c')` → XSS 방지
   - `<script>` 태그 삽입 방지

4. **.evaluate()**
   - 템플릿을 실제 HTML로 변환
   - `<?= initialData ?>` → JSON 문자열로 치환

5. **.setTitle()**
   - 브라우저 탭 제목 설정

6. **.setXFrameOptionsMode()**
   - iframe 허용 설정
   - `ALLOWALL` → 모든 도메인에서 iframe 가능

---

### 📊 기능 2: 데이터 가져오기

**함수:** `getData()` (Code.js:16-26)

**코드:**
```javascript
function getData() {
  const ss = SpreadsheetApp.openById("15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4");
  const sheet = ss.getSheetByName("급여 데이터");
  const data = sheet.getDataRange().getValues();

  // 첫 번째 행(헤더) 제외 후 JSON 변환
  return data.slice(1).map(row => ({
    department: row[0],  // 부서명
    salary: row[1]       // 급여
  }));
}
```

**단계별 설명:**

1. **SpreadsheetApp.openById()**
   - 스프레드시트 ID로 열기
   - ID: `15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4`

2. **getSheetByName("급여 데이터")**
   - 특정 시트 가져오기
   - 시트 이름: "급여 데이터"

3. **getDataRange().getValues()**
   - 모든 데이터 읽기
   - 2차원 배열 반환: `[["부서", "급여"], ["영업", 5000000], ...]`

4. **data.slice(1)**
   - 첫 번째 행(헤더) 제거
   - `[["영업", 5000000], ["개발", 6000000], ...]`

5. **.map()**
   - 각 행을 객체로 변환
   - `{department: "영업", salary: 5000000}`

**반환값 예시:**
```javascript
[
  { department: "영업", salary: 5000000 },
  { department: "영업", salary: 4500000 },
  { department: "개발", salary: 6000000 },
  { department: "개발", salary: 5500000 },
  { department: "인사", salary: 4000000 }
]
```

---

### 📈 기능 3: 차트 그리기

**함수:** `drawChart()` (Index.html:21-67)

**코드:**
```javascript
function drawChart(data) {
  if (!data || data.length === 0) {
    console.error("❌ 차트 데이터가 없습니다.");
    document.getElementById("chart_div").innerHTML =
        "<p style='text-align:center;color:#999'>표시할 데이터가 없습니다.</p>";
    return;
  }

  let dataTable = new google.visualization.DataTable();
  dataTable.addColumn("string", "부서");
  dataTable.addColumn("number", "총 급여");

  let salaryMap = {};
  data.forEach(row => {
    if (!salaryMap[row.department]) {
      salaryMap[row.department] = 0;
    }
    salaryMap[row.department] += row.salary;
  });

  console.log("📊 변환된 차트 데이터:", salaryMap);
  Object.keys(salaryMap).forEach(dept => {
    dataTable.addRow([dept, salaryMap[dept]]);
  });

  const options = {
    title: "부서별 급여 합계",
    titleTextStyle: { fontSize: 18, bold: true },
    colors: ['#4285F4', '#DB4437', '#F4B400', '#0F9D58', '#AB47BC', '#33A02C'],
    is3D: false,
    pieHole: 0.4,  // Donut 차트
    pieSliceText: 'percentage',
    tooltip: { showColorCode: true },
    legend: { position: 'right', alignment: 'center' },
    chartArea: { width: '80%', height: '80%' }
  };

  const chart = new google.visualization.PieChart(document.getElementById("chart_div"));
  chart.draw(dataTable, options);

  window.addEventListener('resize', function() {
    chart.draw(dataTable, options);
  });

  updateLastRefreshTime();
}
```

**단계별 설명:**

1. **데이터 유효성 검사**
   - 데이터가 없으면 에러 메시지 표시

2. **DataTable 생성**
   - `new google.visualization.DataTable()`
   - 컬럼 추가: "부서" (string), "총 급여" (number)

3. **부서별 급여 합산**
   - `salaryMap` 객체 사용
   - 같은 부서의 급여를 합산
   - 예: `{ 영업: 9500000, 개발: 11500000, 인사: 4000000 }`

4. **DataTable에 데이터 추가**
   - `dataTable.addRow([dept, salaryMap[dept]])`

5. **차트 옵션 설정**
   - `pieHole: 0.4` → Donut 차트 (40% 구멍)
   - `pieSliceText: 'percentage'` → 퍼센트 표시
   - `colors` → 색상 팔레트

6. **PieChart 생성 및 그리기**
   - `new google.visualization.PieChart()`
   - `chart.draw(dataTable, options)`

7. **반응형 처리**
   - `window.addEventListener('resize', ...)`
   - 창 크기 변경 시 차트 자동 조정

---

### 🔄 기능 4: 자동 새로고침

**함수:** `startAutoRefresh()` (Index.html:90-110)

**코드:**
```javascript
function startAutoRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
  }

  refreshIntervalId = setInterval(function() {
    console.log("🔄 자동 새로고침 실행 중...");
    google.script.run
      .withSuccessHandler(function(data) {
        drawChart(data);
      })
      .withFailureHandler(function(error) {
        console.error("자동 새로고침 실패:", error);
      })
      .getData();
  }, REFRESH_INTERVAL);

  document.getElementById("auto-refresh-status").textContent = "활성화됨";
  document.getElementById("auto-refresh-toggle").textContent = "자동 새로고침 중지";
}
```

**단계별 설명:**

1. **기존 타이머 중지**
   - `clearInterval(refreshIntervalId)`
   - 중복 실행 방지

2. **setInterval() 등록**
   - 5분마다 실행 (300,000ms)
   - `REFRESH_INTERVAL = 5 * 60 * 1000`

3. **getData() 호출 (서버)**
   - `google.script.run.getData()`
   - 비동기 RPC

4. **성공 콜백**
   - `withSuccessHandler(function(data) { ... })`
   - `drawChart(data)` → 차트 업데이트

5. **실패 콜백**
   - `withFailureHandler(function(error) { ... })`
   - 콘솔 에러 로그

6. **UI 업데이트**
   - 상태: "활성화됨"
   - 버튼: "자동 새로고침 중지"

---

## 5. Google Charts API 사용

### 📚 Google Charts API 핵심 개념

#### A. 라이브러리 로드

**CDN 로드:**
```html
<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
```

**JavaScript에서 패키지 로드:**
```javascript
google.charts.load('current', { packages: ['corechart'] });
google.charts.setOnLoadCallback(drawChart);
```

**패키지 종류:**

| 패키지 | 포함 차트 |
|--------|----------|
| **corechart** | Pie, Bar, Column, Line, Area |
| **table** | Table |
| **gauge** | Gauge |
| **geochart** | Geo Chart |
| **timeline** | Timeline |

---

#### B. DataTable 생성

**방법 1: addColumn + addRow**
```javascript
const dataTable = new google.visualization.DataTable();
dataTable.addColumn('string', '부서');
dataTable.addColumn('number', '급여');
dataTable.addRow(['영업', 5000000]);
dataTable.addRow(['개발', 6000000]);
```

**방법 2: arrayToDataTable**
```javascript
const dataTable = google.visualization.arrayToDataTable([
  ['부서', '급여'],
  ['영업', 5000000],
  ['개발', 6000000],
  ['인사', 4000000]
]);
```

---

#### C. Pie Chart 옵션

**이 프로젝트의 옵션:**
```javascript
const options = {
  title: "부서별 급여 합계",           // 차트 제목
  titleTextStyle: {                     // 제목 스타일
    fontSize: 18,
    bold: true
  },
  colors: [                             // 슬라이스 색상
    '#4285F4',  // Google Blue
    '#DB4437',  // Google Red
    '#F4B400',  // Google Yellow
    '#0F9D58',  // Google Green
    '#AB47BC',  // Purple
    '#33A02C'   // Dark Green
  ],
  is3D: false,                          // 3D 효과 (false)
  pieHole: 0.4,                         // Donut 차트 (0.4 = 40% 구멍)
  pieSliceText: 'percentage',           // 슬라이스에 % 표시
  tooltip: {                            // 툴팁 설정
    showColorCode: true
  },
  legend: {                             // 범례 설정
    position: 'right',
    alignment: 'center'
  },
  chartArea: {                          // 차트 영역 크기
    width: '80%',
    height: '80%'
  }
};
```

**다른 옵션들:**

```javascript
// 3D 효과
is3D: true

// Donut 차트 구멍 크기 (0-1)
pieHole: 0.5  // 50%

// 슬라이스 텍스트
pieSliceText: 'value'       // 값 표시
pieSliceText: 'label'       // 라벨 표시
pieSliceText: 'none'        // 표시 안 함

// 범례 위치
legend: { position: 'bottom' }
legend: { position: 'top' }
legend: { position: 'none' }  // 범례 숨김

// 시작 각도 (0-360)
pieStartAngle: 90
```

---

#### D. 차트 그리기

**코드:**
```javascript
const chart = new google.visualization.PieChart(
  document.getElementById("chart_div")
);
chart.draw(dataTable, options);
```

**다른 차트 타입:**

```javascript
// Bar Chart (가로 막대)
const chart = new google.visualization.BarChart(element);

// Column Chart (세로 막대)
const chart = new google.visualization.ColumnChart(element);

// Line Chart (선 그래프)
const chart = new google.visualization.LineChart(element);

// Table
const chart = new google.visualization.Table(element);
```

---

## 6. GAS API 사용

### 📚 사용된 GAS API 목록

| API | 사용 위치 | 목적 |
|-----|----------|------|
| **SpreadsheetApp** | getData() | 스프레드시트 데이터 읽기 |
| **HtmlService** | doGet() | HTML 렌더링 |
| **google.script.run** | Index.html | 클라이언트-서버 통신 |

---

### 1️⃣ SpreadsheetApp

**공식 문서:** https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app

#### A. 스프레드시트 열기

**ID로 열기:**
```javascript
const ss = SpreadsheetApp.openById("스프레드시트_ID");
```

**스프레드시트 ID 찾기:**
```
URL: https://docs.google.com/spreadsheets/d/15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4/edit
                                          ↑
                                    이 부분이 ID
```

**활성 스프레드시트 (Container-bound):**
```javascript
const ss = SpreadsheetApp.getActiveSpreadsheet();
```

#### B. 시트 가져오기

**이름으로 가져오기:**
```javascript
const sheet = ss.getSheetByName("급여 데이터");
```

**인덱스로 가져오기 (0부터 시작):**
```javascript
const sheet = ss.getSheets()[0];  // 첫 번째 시트
```

#### C. 데이터 읽기

**전체 데이터:**
```javascript
const data = sheet.getDataRange().getValues();
// [[헤더1, 헤더2], [값1, 값2], ...]
```

**범위 지정:**
```javascript
const data = sheet.getRange("A1:B10").getValues();
const data = sheet.getRange(1, 1, 10, 2).getValues(); // 시작행, 시작열, 행수, 열수
```

**특정 셀:**
```javascript
const value = sheet.getRange("A1").getValue();
```

---

### 2️⃣ HtmlService

**공식 문서:** https://developers.google.com/apps-script/reference/html/html-service

#### A. 템플릿 사용

**템플릿 생성:**
```javascript
const template = HtmlService.createTemplateFromFile('Index');
```

**데이터 주입:**
```javascript
template.initialData = JSON.stringify(data);
template.userName = "홍길동";
```

**HTML에서 사용:**
```html
<script>
  const data = JSON.parse('<?= initialData ?>');
</script>
<p>안녕하세요, <?= userName ?>님!</p>
```

#### B. XSS 방지

**문제 코드:**
```javascript
template.data = '<script>alert("XSS")</script>';
```

**해결:**
```javascript
template.data = JSON.stringify(data).replace(/</g, '\\u003c');
```

---

### 3️⃣ google.script.run

**공식 문서:** https://developers.google.com/apps-script/guides/html/reference/run

#### A. 기본 사용

**클라이언트 (Index.html):**
```javascript
google.script.run.getData();
```

**서버 (Code.js):**
```javascript
function getData() {
  return [1, 2, 3];
}
```

#### B. 콜백 사용

**성공 콜백:**
```javascript
google.script.run
  .withSuccessHandler(function(data) {
    console.log('성공:', data);
  })
  .getData();
```

**실패 콜백:**
```javascript
google.script.run
  .withFailureHandler(function(error) {
    console.error('실패:', error);
  })
  .getData();
```

**둘 다 사용:**
```javascript
google.script.run
  .withSuccessHandler(onSuccess)
  .withFailureHandler(onFailure)
  .getData();

function onSuccess(data) {
  drawChart(data);
}

function onFailure(error) {
  alert('데이터 로드 실패: ' + error.message);
}
```

---

## 7. 파일 구조

### 📂 프로젝트 구조

```
projects/google-charts-api/
├── Code.js                 # 서버 로직 (27줄)
├── Index.html              # 클라이언트 UI (198줄)
├── appsscript.json         # 프로젝트 설정
└── .clasp.json             # Script ID
```

### 📄 파일별 설명

#### 1. Code.js (27줄)

**역할:** 서버 사이드 로직

**함수:**
- `doGet()` (1-14줄) - Web App 진입점
- `getData()` (16-26줄) - Sheets 데이터 읽기

**특징:**
- ✅ 간결한 코드 (27줄)
- ✅ 명확한 주석
- ✅ XSS 방지 처리
- ❌ 에러 핸들링 없음 (try-catch)

#### 2. Index.html (198줄)

**역할:** 클라이언트 UI + JavaScript

**구조:**
```html
<!DOCTYPE html>
<html>
<head>
  <!-- Google Charts CDN -->
  <script src="https://www.gstatic.com/charts/loader.js"></script>

  <!-- JavaScript 로직 (140줄) -->
  <script>
    // - drawChart()
    // - refreshData()
    // - startAutoRefresh()
    // - stopAutoRefresh()
    // - toggleAutoRefresh()
  </script>

  <!-- CSS 스타일 (41줄) -->
  <style>
    /* 반응형 디자인 */
  </style>
</head>
<body>
  <!-- 차트 컨테이너 -->
  <div id="chart_div"></div>

  <!-- 버튼 & 상태 -->
  <button id="refresh-btn">데이터 새로고침</button>
  <button id="auto-refresh-toggle">자동 새로고침 중지</button>
</body>
</html>
```

**특징:**
- ✅ 외부 라이브러리: Google Charts CDN 1개
- ✅ 자동/수동 새로고침
- ✅ 반응형 디자인
- ✅ 에러 핸들링 (withFailureHandler)

#### 3. appsscript.json (10줄)

**역할:** GAS 프로젝트 설정

**내용:**
```json
{
  "timeZone": "Asia/Seoul",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

**특징:**
- ✅ Web App 모드
- ✅ 누구나 접근 가능
- ✅ 배포자 권한으로 실행

---

## 8. 코드 상세 분석

### 🔍 핵심 패턴

#### 패턴 1: 부서별 데이터 합산

**문제:**
- Sheets에는 같은 부서가 여러 행에 존재
- 차트에는 부서별 총합을 표시해야 함

**해결:**
```javascript
let salaryMap = {};
data.forEach(row => {
  if (!salaryMap[row.department]) {
    salaryMap[row.department] = 0;
  }
  salaryMap[row.department] += row.salary;
});

// 결과: { 영업: 9500000, 개발: 11500000, 인사: 4000000 }
```

**개선 가능 (reduce):**
```javascript
const salaryMap = data.reduce((acc, row) => {
  acc[row.department] = (acc[row.department] || 0) + row.salary;
  return acc;
}, {});
```

#### 패턴 2: XSS 방지

**문제:**
- HTML 템플릿에 JSON 데이터 주입 시
- `<script>` 태그가 있으면 실행됨

**해결:**
```javascript
template.initialData = JSON.stringify(data).replace(/</g, '\\u003c');
```

**설명:**
- `<` → `\u003c` (유니코드 이스케이프)
- `<script>` → `\u003cscript>` (실행 안 됨)

#### 패턴 3: setInterval 관리

**문제:**
- 자동 새로고침 ON/OFF 시 타이머 관리 필요

**해결:**
```javascript
let refreshIntervalId = null;

// 시작
function startAutoRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);  // 기존 타이머 중지
  }
  refreshIntervalId = setInterval(..., REFRESH_INTERVAL);
}

// 중지
function stopAutoRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}
```

---

### 🐛 개선 제안

#### 이슈 1: 서버 함수 에러 핸들링 없음

**현재:**
```javascript
function getData() {
  const ss = SpreadsheetApp.openById("...");
  const sheet = ss.getSheetByName("급여 데이터");
  // 스프레드시트가 없거나 시트가 없으면?
}
```

**개선:**
```javascript
function getData() {
  try {
    const ss = SpreadsheetApp.openById("15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4");
    const sheet = ss.getSheetByName("급여 데이터");

    if (!sheet) {
      throw new Error('"급여 데이터" 시트를 찾을 수 없습니다.');
    }

    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];  // 헤더만 있으면 빈 배열
    }

    return data.slice(1).map(row => ({
      department: row[0],
      salary: row[1]
    }));
  } catch (error) {
    console.error('getData 에러:', error);
    throw error;  // withFailureHandler로 전달
  }
}
```

#### 이슈 2: 스프레드시트 ID 하드코딩

**현재:**
```javascript
const ss = SpreadsheetApp.openById("15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4");
```

**개선 방안 1: PropertiesService**
```javascript
function getData() {
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty('SPREADSHEET_ID');

  if (!spreadsheetId) {
    throw new Error('스프레드시트 ID가 설정되지 않았습니다.');
  }

  const ss = SpreadsheetApp.openById(spreadsheetId);
  // ...
}
```

**개선 방안 2: 상수로 분리**
```javascript
const CONFIG = {
  SPREADSHEET_ID: "15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4",
  SHEET_NAME: "급여 데이터"
};

function getData() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  // ...
}
```

#### 이슈 3: 자동 새로고침 5분 고정

**현재:**
```javascript
const REFRESH_INTERVAL = 5 * 60 * 1000;  // 5분 고정
```

**개선:**
```javascript
// 사용자가 직접 설정 가능하도록
<select id="refresh-interval-select">
  <option value="60000">1분</option>
  <option value="300000" selected>5분</option>
  <option value="600000">10분</option>
</select>

<script>
function startAutoRefresh() {
  const intervalMs = parseInt(
    document.getElementById('refresh-interval-select').value
  );

  refreshIntervalId = setInterval(..., intervalMs);
}
</script>
```

---

## 9. 보안 및 권한

### 🔐 XSS (Cross-Site Scripting) 방지

**위험한 코드:**
```javascript
// ❌ 위험!
template.data = userInput;
```

**HTML에서:**
```html
<script>
  const data = '<?= data ?>';  // <script>alert("XSS")</script>
</script>
```

**해결:**
```javascript
// ✅ 안전
template.data = JSON.stringify(userInput).replace(/</g, '\\u003c');
```

---

### 🛡️ Web App 접근 제어

**현재 설정:**
```json
{
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

**executeAs 옵션:**

| 값 | 설명 | 권한 |
|----|------|------|
| **USER_DEPLOYING** | 배포자 권한 | 배포자의 Drive, Sheets 접근 |
| **USER_ACCESSING** | 접근자 권한 | 각 사용자의 Drive, Sheets 접근 |

**access 옵션:**

| 값 | 설명 |
|----|------|
| **ANYONE_ANONYMOUS** | 누구나 (익명 포함) |
| **ANYONE** | 인증된 사용자만 |
| **DOMAIN** | 같은 도메인만 |

**이 프로젝트:**
- 배포자 권한 + 누구나 접근
- 배포자의 스프레드시트 읽기만 가능

---

## 10. 배포 및 실행

### 🚀 배포 방법

#### A. 웹 앱 배포

```bash
cd projects/google-charts-api

# 1. 코드 업로드
clasp push

# 2. 웹 앱 배포 (최초)
clasp deploy --description "v1.0.0"

# 3. 배포 URL 확인
clasp deployments
```

---

### 🧪 테스트 방법

#### 시나리오 1: 차트 표시 확인

1. Web App URL 접근
2. Pie Chart (Donut) 표시 확인
3. 부서별 급여 합계 확인

#### 시나리오 2: 수동 새로고침

1. 스프레드시트에서 데이터 수정
2. "데이터 새로고침" 버튼 클릭
3. 차트 업데이트 확인

#### 시나리오 3: 자동 새로고침

1. "자동 새로고침 중지" 버튼 클릭
2. 상태: "비활성화됨" 확인
3. "자동 새로고침 시작" 버튼 클릭
4. 5분 후 자동 업데이트 확인 (콘솔 로그)

#### 시나리오 4: 반응형

1. 브라우저 창 크기 변경
2. 차트 자동 조정 확인

---

## 11. 참고 자료

### 📖 공식 문서

| 리소스 | URL |
|--------|-----|
| **Google Charts** | https://developers.google.com/chart |
| **Pie Chart 가이드** | https://developers.google.com/chart/interactive/docs/gallery/piechart |
| **Apps Script 공식 문서** | https://developers.google.com/apps-script |
| **SpreadsheetApp** | https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app |
| **HtmlService** | https://developers.google.com/apps-script/reference/html/html-service |
| **google.script.run** | https://developers.google.com/apps-script/guides/html/reference/run |

### 🔗 관련 프로젝트

- **user-permission**: Web App + Google Sheets
- **geo-location**: Web App + Geolocation API

### 📊 프로젝트 통계

| 항목 | 수치 |
|------|------|
| **총 파일 수** | 4개 |
| **JavaScript 파일** | 1개 (Code.js) |
| **HTML 파일** | 1개 (Index.html) |
| **총 코드 라인** | 225줄 |
| **함수 수** | 8개 (서버 2개, 클라이언트 6개) |
| **사용된 GAS API** | 3개 (SpreadsheetApp, HtmlService, google.script.run) |
| **외부 CDN** | 1개 (Google Charts) |

---

## 🐛 트러블슈팅

### clasp clone 시 parentId 누락

**증상:**

이 프로젝트는 스프레드시트에 연결된 Container-bound script이지만, `clasp clone`으로 가져온 경우 `.clasp.json`에 `parentId` 필드가 없을 수 있습니다.

```json
// ❌ clasp clone 결과
{
  "scriptId": "1UtNweLwFg5CD2bBdJuacBanEDc7o5UjQHkPr4riSh0efYr0Us-v5b9Za",
  "rootDir": ""
  // parentId 없음!
}
```

**원인:**

`clasp clone`은 스크립트 코드만 가져오며, **부모 컨테이너(스프레드시트) 정보는 가져오지 못합니다.** 이것은 clasp의 알려진 제약사항입니다.

**해결 방법:**

1. **GAS 에디터에서 부모 스프레드시트 ID 확인:**
   - 프로젝트 설정(⚙️) → "Container" 필드 확인
   - 또는 스프레드시트 URL에서 ID 추출

2. **`.clasp.json`에 수동으로 추가:**

```json
{
  "scriptId": "1UtNweLwFg5CD2bBdJuacBanEDc7o5UjQHkPr4riSh0efYr0Us-v5b9Za",
  "rootDir": "",
  "parentId": "15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4"  // ✅ 스프레드시트 ID 추가
}
```

**이 프로젝트의 스프레드시트 ID:**

Code.js에서 사용 중인 스프레드시트 ID는 `15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4`입니다:

```javascript
// Code.js Line 17
const ss = SpreadsheetApp.openById("15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4");
```

**스프레드시트 URL에서 ID 추출:**

```
https://docs.google.com/spreadsheets/d/15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4/edit
                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                      이 부분이 parentId
```

**참고:** 루트 프로젝트 README.md의 트러블슈팅 섹션에 자세한 설명이 있습니다.

---

## 📝 마무리

이 프로젝트는 **Google Sheets 데이터를 Google Charts로 시각화하는 실용적인 예시**입니다.

**핵심 학습 포인트:**

1. **Google Charts API** - CDN 기반 차트 라이브러리
2. **SpreadsheetApp** - 스프레드시트 데이터 읽기
3. **google.script.run** - 클라이언트-서버 비동기 통신
4. **setInterval** - 자동 새로고침 구현
5. **XSS 방지** - HTML 템플릿 보안

**활용 가능한 시나리오:**

- 실시간 판매 대시보드
- 부서별 KPI 모니터링
- 프로젝트 진행률 시각화
- 재고 현황 차트
- 월별 매출 그래프

**확장 아이디어:**

- 다양한 차트 타입 추가 (Bar, Line, Column)
- 필터 기능 (부서, 기간 선택)
- 데이터 다운로드 (CSV, Excel)
- 여러 시트 데이터 결합
- Chart.js, D3.js 등 다른 라이브러리 비교

---

**작성일:** 2026-01-28
**프로젝트:** apps-script-clasp/projects/google-charts-api
**GAS Runtime:** V8
**TimeZone:** Asia/Seoul
**차트 라이브러리:** Google Charts API
