# 🍽️ What-to-Eat 프로젝트 분석

> **Google Apps Script Web App** - 랜덤 음식 선택 도구

---

## 📚 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [GAS 아키텍처](#2-gas-아키텍처)
3. [주요 기능](#3-주요-기능)
4. [UI/UX 디자인](#4-uiux-디자인)
5. [파일 구조](#5-파일-구조)
6. [코드 상세 분석](#6-코드-상세-분석)
7. [배포 및 실행](#7-배포-및-실행)
8. [참고 자료](#8-참고-자료)

---

## 1. 프로젝트 개요

### 🎯 프로젝트 목적

**점심 메뉴 고민 해결을 위한 랜덤 선택 도구**

- **메뉴 추가/삭제** - 최대 5개까지 고민 메뉴 등록
- **랜덤 선택** - Roll 버튼으로 하나를 무작위 선택
- **애니메이션 효과** - 롤링 애니메이션으로 재미 요소 추가
- **Glassmorphism UI** - 투명 유리 질감의 모던한 디자인

### 🔍 핵심 특징

| 특징 | 설명 |
|------|------|
| **프로젝트 타입** | Standalone Web App |
| **UI 스타일** | Glassmorphism (유리 질감) |
| **애니메이션** | CSS3 + JavaScript |
| **데이터 저장** | 클라이언트 메모리 (새로고침 시 초기화) |
| **라이브러리** | 없음 (순수 HTML/CSS/JavaScript) |
| **배포 방식** | Web App (익명 접근 가능) |

### 🆚 다른 프로젝트와 비교

| 구분 | what-to-eat | sidebar-ui | user-permission |
|------|-------------|------------|-----------------|
| **프로젝트 타입** | Standalone Web App | Container-bound Script | Standalone Web App |
| **UI 위치** | 브라우저 전체 화면 | 스프레드시트 사이드바 | 브라우저 전체 화면 |
| **데이터 저장** | 클라이언트 메모리 | PropertiesService | SpreadsheetApp |
| **서버 통신** | ❌ 없음 | ✅ google.script.run | ✅ google.script.run |
| **복잡도** | 🟢 낮음 (순수 프론트엔드) | 🟡 중간 (트리거 관리) | 🔴 높음 (인증, 권한) |

---

## 2. GAS 아키텍처

### 📊 시스템 구조

```
┌─────────────────────────────────────────────────────┐
│              Browser (Client)                       │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐ │
│  │  doGet() → index.html 반환                   │ │
│  └─────────────────┬─────────────────────────────┘ │
│                    │                                 │
│  ┌─────────────────▼─────────────────────────────┐ │
│  │  index.html (메인 UI)                        │ │
│  │  - 제목: "오늘 뭐 먹지?"                     │ │
│  │  - 입력 폼 (Add 버튼)                       │ │
│  │  - 메뉴 리스트 (최대 5개)                   │ │
│  │  - Roll 버튼                                 │ │
│  └─────────────────┬─────────────────────────────┘ │
│                    │                                 │
│  ┌─────────────────▼─────────────────────────────┐ │
│  │  style.html (CSS)                            │ │
│  │  - Glassmorphism 스타일                      │ │
│  │  - 그라데이션 배경                           │ │
│  │  - 롤링 애니메이션                           │ │
│  └──────────────────────────────────────────────┘ │
│                    │                                 │
│  ┌─────────────────▼─────────────────────────────┐ │
│  │  script.html (JavaScript)                    │ │
│  │  - addMenu(): 메뉴 추가                      │ │
│  │  - deleteMenu(): 메뉴 삭제                   │ │
│  │  - rollMenu(): 랜덤 선택                     │ │
│  │  - 이벤트 리스너 등록                        │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 🔄 실행 흐름

#### A. 최초 페이지 로드

```
1. 사용자가 Web App URL 접속
   ↓
2. GAS 서버: doGet() 함수 실행
   ↓
3. HtmlService.createTemplateFromFile('index')
   ↓
4. index.html 렌더링
   - include('style') → style.html 포함
   - include('script') → script.html 포함
   ↓
5. 브라우저에 HTML 전송
   ↓
6. 클라이언트에서 JavaScript 실행
   - 이벤트 리스너 등록
   - data = [] 배열 초기화
```

#### B. 메뉴 추가

```
1. 사용자가 메뉴명 입력 (예: "김치찌개")
   ↓
2. "Add" 버튼 클릭 또는 Enter 키
   ↓
3. addMenu(data) 함수 실행
   ↓
4. 입력값 검증
   ├─ 빈 문자열 → emptyAlert()
   ├─ 5개 초과 → maxAlert()
   └─ 정상 → add(data)
      ↓
      data.push(inputValue)
      ↓
      <li> 요소 생성 및 화면에 추가
      ↓
      입력 필드 초기화
```

#### C. 메뉴 삭제

```
1. 사용자가 메뉴 항목에 마우스 오버
   ↓
2. "x" 버튼 표시 (opacity: 0 → 1)
   ↓
3. "x" 버튼 클릭
   ↓
4. deleteMenu(data, index) 함수 실행
   ↓
5. data.splice(index, 1) - 배열에서 제거
   ↓
6. reloadMenu(data) - 전체 리스트 재렌더링
   ↓
7. 인덱스 번호 재정렬 (1, 2, 3, ...)
```

#### D. 랜덤 선택 (Roll)

```
1. 사용자가 "Roll" 버튼 클릭
   ↓
2. rollMenu(data) 함수 실행
   ↓
3. 메뉴 개수 검증
   ├─ 0개 → minAlert() (최소 1개 필요)
   └─ 1개 이상 → 계속
      ↓
4. 롤링 애니메이션 시작
   - list.classList.add('rolling')
   - 모든 <li> 높이 0으로 축소 + 회전 애니메이션
   ↓
5. 1200ms 후 selectMenu(data) 실행
   ↓
6. Math.floor(Math.random() * data.length)
   - 랜덤 인덱스 선택
   ↓
7. 선택된 메뉴만 표시
   - 'selected' 클래스 추가 (회전 2번)
   ↓
8. Roll 버튼 → "Clear" 버튼으로 변경
```

#### E. 초기화 (Clear)

```
1. 사용자가 "Clear" 버튼 클릭
   ↓
2. clearMenu(data) 함수 실행
   ↓
3. data.splice(0) - 배열 비우기
   ↓
4. list.innerHTML = '' - 화면 초기화
   ↓
5. Roll 버튼으로 원복
```

---

## 3. 주요 기능

### ✅ 기능 목록

| 기능 | 함수 | 설명 |
|------|------|------|
| **HTML 포함** | `include()` | style.html, script.html 파일 포함 |
| **메뉴 추가** | `addMenu()` | 입력 검증 + 추가 로직 |
| **메뉴 삭제** | `deleteMenu()` | 배열에서 제거 + 재렌더링 |
| **메뉴 리로드** | `reloadMenu()` | 전체 리스트 재생성 |
| **랜덤 선택** | `rollMenu()` | 롤링 애니메이션 + 무작위 선택 |
| **결과 표시** | `selectMenu()` | 선택된 메뉴 강조 표시 |
| **초기화** | `clearMenu()` | 배열 및 화면 초기화 |

### 🎛️ 기능 1: HTML 파일 포함

**함수:** `include()` (Code.js:5-8)

**역할:** HTML 템플릿에서 다른 HTML 파일을 포함

**코드:**
```javascript
function include(filename) {
  // 'filename'에 확장자를 제외한 파일 이름을 전달~!
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

**사용 예시:**
```html
<!-- index.html -->
<?!= include('style'); ?>
<?!= include('script'); ?>
```

**설명:**
- `<?!= ... ?>` - 서버 사이드 템플릿 태그 (HTML 이스케이프 안 함)
- `HtmlService.createHtmlOutputFromFile()` - HTML 파일을 HtmlOutput 객체로 변환
- `.getContent()` - 순수 HTML 문자열 반환

**왜 이 방식을 사용하나요?**

Apps Script는 별도 CSS/JS 파일을 직접 import할 수 없습니다. 따라서:
- ❌ `<link rel="stylesheet" href="style.css">` - 불가능
- ❌ `<script src="script.js"></script>` - 불가능
- ✅ `<?!= include('style'); ?>` - 가능 (서버 사이드에서 결합)

### 🍜 기능 2: 메뉴 추가

**함수:** `addMenu()` (script.html:34-44)

**코드:**
```javascript
function addMenu(data) {
  const inputValue = addInput.value;

  if (inputValue === '') {
    emptyAlert();
  } else if (data.length > 4) {
    maxAlert();
  } else {
    add(data);
  }
}
```

**검증 규칙:**

1. **빈 문자열 체크**
   ```javascript
   if (inputValue === '') {
     alert('고민되는 메뉴를 입력해 주세요.');
     addInput.focus();
   }
   ```

2. **최대 개수 제한 (5개)**
   ```javascript
   if (data.length > 4) {
     alert('메뉴는 최대 5개까지만 고민할 수 있습니다.');
     addInput.value = '';
   }
   ```

3. **정상 추가**
   ```javascript
   function add(data) {
     const inputValue = addInput.value;
     const index = data.length;

     const li = document.createElement('li');
     li.classList.add('item');
     li.innerHTML = `<b>${index + 1}</b>${inputValue}<button class="del-btn" data-index="${index}">x</button>`;
     list.append(li);

     data.push(inputValue);

     addInput.value = '';
     addInput.focus();
   }
   ```

**DOM 조작:**
- `document.createElement('li')` - 새 리스트 항목 생성
- `innerHTML` - 내부 HTML 설정
  - `<b>` - 인덱스 번호 (동그라미 배지)
  - 메뉴명 텍스트
  - `<button>` - 삭제 버튼 (data-index 속성)
- `list.append(li)` - 리스트에 추가

### 🗑️ 기능 3: 메뉴 삭제

**함수:** `deleteMenu()` (script.html:58-61)

**코드:**
```javascript
function deleteMenu(data, index) {
  data.splice(index, 1);
  reloadMenu(data);
}
```

**재렌더링 함수:**
```javascript
function reloadMenu(data) {
  list.innerHTML = '';

  data.forEach((title, index) => {
    const li = document.createElement('li');
    li.classList.add('item');
    li.innerHTML = `<b>${index + 1}</b>${title}<button class="del-btn" data-index="${index}">x</button>`;
    list.append(li);
  });
}
```

**왜 재렌더링이 필요한가요?**

메뉴 삭제 시 인덱스 번호가 틀어집니다:
```
삭제 전: [1] 김치찌개, [2] 된장찌개, [3] 순두부
         ↓ [2] 삭제
삭제 후: [1] 김치찌개, [3] 순두부 ← 인덱스 건너뜀!
```

`reloadMenu()`는 전체 리스트를 재생성하여 인덱스를 재정렬합니다:
```
재렌더링 후: [1] 김치찌개, [2] 순두부 ← 올바른 인덱스
```

### 🎲 기능 4: 랜덤 선택

**함수:** `rollMenu()` (script.html:89-98)

**코드:**
```javascript
function rollMenu(data) {
  if (data.length === 0) {
    minAlert();
  } else if (rollBtn.textContent === 'Clear') {
    clearMenu(data);
  } else {
    list.classList.add('rolling');
    setTimeout(() => selectMenu(data), 1200);
  }
}
```

**단계별 동작:**

1. **메뉴 개수 검증**
   ```javascript
   if (data.length === 0) {
     alert('최소 1개 이상의 메뉴를 입력해 주세요.');
     addInput.focus();
   }
   ```

2. **롤링 애니메이션 시작**
   ```javascript
   list.classList.add('rolling');
   // CSS: .rolling .item { height: 0; animation: roll 0.5s infinite }
   ```

3. **1.2초 후 결과 표시**
   ```javascript
   setTimeout(() => selectMenu(data), 1200);
   ```

**선택 로직:**
```javascript
function selectMenu(data) {
  list.classList.remove('rolling');
  list.innerHTML = '';

  const selectedIndex = Math.floor(Math.random() * data.length);

  const li = document.createElement('li');
  li.classList.add('item', 'selected');
  li.innerHTML = `<b>${selectedIndex + 1}</b>${data[selectedIndex]}`;
  list.append(li);

  rollBtn.textContent = 'Clear';
}
```

**애니메이션 효과:**
- **롤링 중**: 모든 항목이 회전하며 높이 0으로 축소
- **선택 후**: 선택된 항목만 표시 + 회전 2번 (selected 애니메이션)

---

## 4. UI/UX 디자인

### 🎨 디자인 컨셉

**Glassmorphism (유리 질감 디자인)**

- **투명한 배경** - `rgba(255, 255, 255, 0.7)`
- **블러 효과** - `backdrop-filter: blur(10px)` (CSS에는 없지만 컨셉)
- **그라데이션** - `linear-gradient(to right top, #ffc9c9, #8cd3f9)`
- **부드러운 그림자** - 최소한의 그림자 효과

### 🌈 색상 팔레트

| 요소 | 색상 | 설명 |
|------|------|------|
| **배경 그라데이션** | `#ffc9c9 → #8cd3f9` | 핑크에서 블루로 |
| **원형 장식** | `rgba(255, 255, 255, 0.5)` | 투명한 흰색 원 |
| **메인 카드** | `rgba(255, 255, 255, 0.7)` | 반투명 흰색 |
| **메뉴 항목** | `rgba(255, 255, 255, 0.7)` | 반투명 흰색 |
| **인덱스 배지** | `#ffc9c9` (핑크) | 핑크 동그라미 |
| **버튼** | `#8cd3f9` (블루) | 하늘색 버튼 |
| **텍스트** | `#658ec6`, `#426696` | 블루 계열 |

### 📐 레이아웃

**메인 카드 크기:**
- Width: `360px`
- Height: `530px`
- Border radius: `15px`

**구조:**
```
┌────────────────────────────────┐
│  🍽️ 오늘 뭐 먹지?           │ ← 헤더
├────────────────────────────────┤
│  [입력 필드] [Add 버튼]        │ ← 입력 폼
├────────────────────────────────┤
│  [1] 김치찌개            [x]  │
│  [2] 된장찌개            [x]  │ ← 메뉴 리스트
│  [3] 순두부              [x]  │   (최대 5개)
│                                │
├────────────────────────────────┤
│         [ Roll ]               │ ← 액션 버튼
└────────────────────────────────┘
```

### ✨ 애니메이션

#### 1. 롤링 애니메이션

**CSS:**
```css
@keyframes roll {
  0% { transform: rotateX(0deg); }
  50% { transform: rotateX(180deg); }
  100% { transform: rotateX(0deg); }
}

.rolling .item {
  height: 0;
  margin: 0;
  padding: 0 5px;
  animation: roll 0.5s infinite linear;
}
```

**효과:**
- 모든 메뉴 항목이 X축 기준으로 회전 (뒤집기)
- 높이가 0으로 축소
- 0.5초마다 반복

#### 2. 선택 애니메이션

**CSS:**
```css
.item.selected {
  animation: roll 0.4s 2 linear;
}
```

**효과:**
- 선택된 항목만 0.4초 회전 × 2번
- "당첨" 느낌 연출

#### 3. 삭제 버튼 호버 효과

**CSS:**
```css
.del-btn {
  opacity: 0;
  transition: all 0.3s ease-in-out;
}

.item:hover .del-btn {
  opacity: 1;
}
```

**효과:**
- 평소: 삭제 버튼 숨김
- 마우스 오버: 부드럽게 나타남

---

## 5. 파일 구조

### 📂 프로젝트 구조

```
projects/what-to-eat/
├── Code.js              # 서버 사이드 로직 (9줄)
├── index.html           # 메인 HTML (27줄)
├── style.html           # CSS 스타일 (205줄)
├── script.html          # JavaScript 로직 (108줄)
├── appsscript.json      # GAS 프로젝트 설정
└── .clasp.json          # Script ID
```

### 📄 파일별 설명

#### 1. Code.js (9줄)

**역할:** 서버 사이드 진입점

**함수:**
- `doGet()` - Web App 진입점, index.html 반환
- `include()` - HTML 파일 포함 헬퍼 함수

**특징:**
- ✅ 최소한의 서버 로직
- ✅ 순수 프론트엔드 앱
- ❌ 데이터베이스 연동 없음
- ❌ 서버 통신 없음

#### 2. index.html (27줄)

**역할:** 메인 HTML 구조

**구조:**
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>오늘 뭐 먹지?</title>
    <?!= include('style'); ?>
  </head>
  <body>
    <div class="circle1"></div>
    <div class="circle2"></div>
    <div class="main">
      <div class="container">
        <h2 class="title">오늘 뭐 먹지?</h2>
        <div class="add-column">
          <input class="add-input" type="text" />
          <button class="add-btn">Add</button>
        </div>
      </div>
      <ul class="list"></ul>
      <button class="roll-btn">Roll</button>
    </div>
    <?!= include('script'); ?>
  </body>
</html>
```

**주요 요소:**
- `.circle1`, `.circle2` - 장식용 반투명 원
- `.main` - 메인 카드
- `.container` - 헤더 + 입력 폼
- `.list` - 메뉴 리스트 (동적 생성)
- `.roll-btn` - 롤/클리어 버튼

#### 3. style.html (205줄)

**역할:** CSS 스타일

**주요 섹션:**

1. **전역 스타일** (1-7줄)
   ```css
   * {
     margin: 0;
     padding: 0;
     box-sizing: border-box;
     font-family: sans-serif;
   }
   ```

2. **배경 그라데이션** (9-15줄)
   ```css
   body {
     display: flex;
     justify-content: center;
     align-items: center;
     min-height: 100vh;
     background-image: linear-gradient(to right top, #ffc9c9, #8cd3f9);
   }
   ```

3. **장식 원** (17-38줄)
   ```css
   .circle1, .circle2 {
     width: 200px;
     height: 200px;
     position: absolute;
     border-radius: 50%;
     background-image: linear-gradient(...);
   }
   ```

4. **메인 카드** (40-54줄)
   ```css
   .main {
     width: 360px;
     height: 530px;
     border-radius: 15px;
     background-image: linear-gradient(...);
   }
   ```

5. **메뉴 아이템** (111-142줄)
   ```css
   .item {
     width: 80%;
     height: 48px;
     margin: 7px;
     background-image: linear-gradient(...);
     border-radius: 45px;
   }
   ```

6. **애니메이션** (182-204줄)
   ```css
   @keyframes roll { ... }
   .rolling .item { ... }
   .item.selected { ... }
   ```

#### 4. script.html (108줄)

**역할:** JavaScript 로직

**전역 변수:**
```javascript
const addBtn = document.querySelector('.add-btn');
const addInput = document.querySelector('.add-input');
const list = document.querySelector('.list');
const rollBtn = document.querySelector('.roll-btn');
const data = []; // 메뉴 데이터 배열
```

**함수 목록:**

| 함수 | 줄 | 설명 |
|------|-----|------|
| `add()` | 9-22 | 메뉴 추가 (DOM 조작) |
| `emptyAlert()` | 24-27 | 빈 문자열 경고 |
| `maxAlert()` | 29-32 | 최대 개수 경고 |
| `addMenu()` | 34-44 | 메뉴 추가 (검증 포함) |
| `reloadMenu()` | 47-56 | 전체 리스트 재렌더링 |
| `deleteMenu()` | 58-61 | 메뉴 삭제 |
| `selectMenu()` | 64-76 | 선택된 메뉴 표시 |
| `minAlert()` | 78-81 | 최소 개수 경고 |
| `clearMenu()` | 83-87 | 배열 초기화 |
| `rollMenu()` | 89-98 | 랜덤 선택 |

**이벤트 리스너:**
```javascript
// Add 버튼 클릭
addBtn.addEventListener('click', () => addMenu(data));

// Enter 키 입력
addInput.addEventListener('keypress', (e) => e.code === 'Enter' && addMenu(data));

// 삭제 버튼 클릭 (이벤트 위임)
list.addEventListener(
  'click',
  ({ target }) => target.tagName === 'BUTTON' && deleteMenu(data, target.dataset.index),
);

// Roll 버튼 클릭
rollBtn.addEventListener('click', () => list.classList.contains('rolling') || rollMenu(data));
```

**특징:**
- ✅ 이벤트 위임 패턴 (list에서 버튼 클릭 감지)
- ✅ 짧은 조건식 활용 (`&&`, `||`)
- ✅ Arrow Function 사용
- ✅ ES6 구문 (const, let, template literal)

#### 5. appsscript.json (9줄)

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

**주요 설정:**
- `webapp.executeAs`: "USER_DEPLOYING" - 배포자 권한으로 실행
- `webapp.access`: "ANYONE_ANONYMOUS" - 익명 접근 허용

#### 6. .clasp.json (9줄)

**역할:** clasp 설정

**내용:**
```json
{
  "scriptId": "1-QbYfzLp5ELTd8o4Yi6FDz-It1yQf5lVYbRu_iR-czOiYiVVfoQEJhgz",
  "rootDir": "",
  "scriptExtensions": [".js", ".gs"],
  "htmlExtensions": [".html"],
  "jsonExtensions": [".json"],
  "filePushOrder": [],
  "skipSubdirectories": false
}
```

**중요:**
- `scriptId` - GAS 프로젝트 고유 ID (Git 포함 필수)
- `filePushOrder` - 빈 배열 (파일 순서 무관)

---

## 6. 코드 상세 분석

### 🔍 핵심 코드 패턴

#### 패턴 1: 이벤트 위임

**일반적인 방법 (비효율적):**
```javascript
// ❌ 모든 삭제 버튼에 개별 리스너 추가
document.querySelectorAll('.del-btn').forEach(btn => {
  btn.addEventListener('click', () => { ... });
});
```

**이벤트 위임 (효율적):**
```javascript
// ✅ 부모 요소에 리스너 하나만 추가
list.addEventListener('click', ({ target }) => {
  if (target.tagName === 'BUTTON') {
    deleteMenu(data, target.dataset.index);
  }
});
```

**장점:**
- 동적 생성된 요소에도 자동 적용
- 메모리 효율적 (리스너 1개만 사용)

#### 패턴 2: 조건부 실행 (Short-circuit)

**일반적인 방법:**
```javascript
// ❌ if 문 사용
addBtn.addEventListener('click', () => {
  if (!list.classList.contains('rolling')) {
    rollMenu(data);
  }
});
```

**Short-circuit 평가:**
```javascript
// ✅ || 연산자 활용
rollBtn.addEventListener('click', () =>
  list.classList.contains('rolling') || rollMenu(data)
);
```

**동작:**
- `list.classList.contains('rolling')` → `true` 이면 rollMenu() 실행 안 함
- `list.classList.contains('rolling')` → `false` 이면 rollMenu() 실행

#### 패턴 3: 상태 기반 토글

**Roll ↔ Clear 버튼 전환:**

```javascript
// Roll 상태
rollBtn.textContent === 'Roll'
  → rollMenu() 실행 → 선택 후 'Clear'로 변경

// Clear 상태
rollBtn.textContent === 'Clear'
  → clearMenu() 실행 → 초기화 후 'Roll'로 변경
```

**코드:**
```javascript
function rollMenu(data) {
  if (rollBtn.textContent === 'Clear') {
    clearMenu(data); // Roll → Clear
  } else {
    // 롤링 로직
    setTimeout(() => {
      selectMenu(data);
      rollBtn.textContent = 'Clear'; // Clear → Roll
    }, 1200);
  }
}

function clearMenu(data) {
  data.splice(0);
  list.innerHTML = '';
  rollBtn.textContent = 'Roll'; // Clear → Roll
}
```

---

### 🐛 잠재적 이슈

#### 이슈 1: 데이터 영속성 없음

**문제:**
- 메뉴 데이터가 클라이언트 메모리에만 저장
- 새로고침하면 모든 데이터 손실

**해결책 (추후 개선):**

**Option A: LocalStorage 사용**
```javascript
// 저장
function addMenu(data) {
  add(data);
  localStorage.setItem('menuData', JSON.stringify(data));
}

// 불러오기
window.addEventListener('load', () => {
  const savedData = localStorage.getItem('menuData');
  if (savedData) {
    const data = JSON.parse(savedData);
    reloadMenu(data);
  }
});
```

**Option B: SpreadsheetApp 사용**
```javascript
// Code.js (서버)
function saveMenu(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Menu');
  sheet.clearContents();
  data.forEach(menu => sheet.appendRow([menu]));
}

function loadMenu() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Menu');
  return sheet.getDataRange().getValues().flat();
}
```

#### 이슈 2: 롤링 중 버튼 클릭 방지

**문제:**
- 롤링 애니메이션 중 Roll 버튼 클릭 가능
- 여러 번 클릭 시 의도하지 않은 동작

**현재 방어 코드:**
```javascript
rollBtn.addEventListener('click', () =>
  list.classList.contains('rolling') || rollMenu(data)
);
```

**설명:**
- `list.classList.contains('rolling')` → `true` 이면 rollMenu() 실행 안 함
- 롤링 중에는 버튼 클릭 무시

**추가 개선:**
```javascript
function rollMenu(data) {
  if (list.classList.contains('rolling')) {
    return; // 명시적으로 종료
  }

  // 롤링 로직...
}
```

#### 이슈 3: 삭제 버튼 인덱스 오류

**문제:**
- 메뉴 삭제 후 인덱스가 틀어짐
- 삭제 버튼의 `data-index`가 배열 인덱스와 불일치

**현재 해결 방법:**
```javascript
function deleteMenu(data, index) {
  data.splice(index, 1);
  reloadMenu(data); // ← 전체 재렌더링으로 인덱스 재정렬
}
```

**왜 재렌더링이 필요한가?**

```
초기 상태:
[1] 김치찌개 (data-index="0")
[2] 된장찌개 (data-index="1")
[3] 순두부 (data-index="2")

[2] 삭제 후 (재렌더링 없이):
[1] 김치찌개 (data-index="0") ✅
[3] 순두부 (data-index="2") ❌ 인덱스가 1이 되어야 함

재렌더링 후:
[1] 김치찌개 (data-index="0") ✅
[2] 순두부 (data-index="1") ✅ 올바른 인덱스
```

---

## 7. 배포 및 실행

### 🚀 배포 방법

#### A. clasp으로 배포

```bash
# 1. 프로젝트 디렉토리 이동
cd projects/what-to-eat

# 2. 코드 푸시
clasp push

# 3. 웹앱 배포
clasp deploy

# 4. 배포 URL 확인
clasp deployments
```

#### B. GAS 에디터에서 배포

```
1. Apps Script 에디터 열기
   - clasp open

2. 배포 → 웹 앱으로 배포

3. 설정
   - 실행 권한: 나 (배포자)
   - 액세스 권한: 익명 포함 모든 사용자

4. 배포 URL 복사
```

### 🧪 테스트 방법

#### 시나리오 1: 기본 기능 테스트

1. Web App URL 접속
2. 메뉴 입력 (예: "김치찌개") → Add 클릭
3. 메뉴 추가 확인
4. 5개까지 추가 시도
5. 6번째 추가 시 경고 메시지 확인
6. Roll 버튼 클릭
7. 랜덤 선택 결과 확인
8. Clear 버튼 클릭
9. 초기화 확인

#### 시나리오 2: 삭제 기능 테스트

1. 3개 메뉴 추가 (김치찌개, 된장찌개, 순두부)
2. 가운데 메뉴에 마우스 오버
3. "x" 버튼 표시 확인
4. "x" 버튼 클릭
5. 메뉴 삭제 + 인덱스 재정렬 확인

#### 시나리오 3: Enter 키 입력 테스트

1. 메뉴명 입력 후 Enter 키
2. Add 버튼 클릭과 동일하게 추가되는지 확인

#### 시나리오 4: 에지 케이스 테스트

1. 빈 문자열 입력 → Add → 경고 메시지
2. 메뉴 없이 Roll 클릭 → 경고 메시지
3. 롤링 중 Roll 버튼 연타 → 무시되는지 확인

### 🛠️ 디버깅

#### A. 브라우저 개발자 도구

**콘솔 로그 추가:**
```javascript
function addMenu(data) {
  console.log('addMenu 호출:', data);
  const inputValue = addInput.value;
  console.log('입력값:', inputValue);

  // ...
}
```

**개발자 도구 열기:**
- Chrome: `F12` 또는 `Cmd+Option+I`
- Firefox: `F12` 또는 `Cmd+Option+I`

#### B. 배열 상태 확인

```javascript
// 콘솔에서 직접 실행
console.log(data); // 현재 메뉴 배열
```

#### C. CSS 애니메이션 디버깅

```css
/* 애니메이션 속도 느리게 */
.rolling .item {
  animation: roll 5s infinite linear; /* 0.5s → 5s */
}
```

---

## 8. 참고 자료

### 📖 공식 문서

| 리소스 | URL |
|--------|-----|
| **Apps Script 공식 문서** | https://developers.google.com/apps-script |
| **HtmlService** | https://developers.google.com/apps-script/reference/html/html-service |
| **Web Apps** | https://developers.google.com/apps-script/guides/web |

### 🎨 디자인 참고

| 리소스 | 설명 |
|--------|------|
| **Glassmorphism** | https://glassmorphism.com/ |
| **CSS Gradient** | https://cssgradient.io/ |
| **CSS Animations** | https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations |

### 🔗 관련 프로젝트

- **sidebar-ui**: Container-bound Script 예제
- **google-charts-api**: 차트 시각화 예제

### 📊 프로젝트 통계

| 항목 | 수치 |
|------|------|
| **총 파일 수** | 6개 |
| **JavaScript 파일** | 1개 (Code.js) |
| **HTML 파일** | 3개 (index, style, script) |
| **총 코드 라인** | 349줄 |
| **함수 수** | 11개 |
| **CSS 클래스** | 12개 |
| **애니메이션** | 2개 (roll, selected) |
| **외부 라이브러리** | 0개 |

---

## 📝 마무리

이 프로젝트는 **순수 HTML/CSS/JavaScript**로 구현된 간단하지만 실용적인 랜덤 선택 도구입니다.

**핵심 학습 포인트:**

1. **Glassmorphism UI 디자인** - 투명 유리 질감
2. **CSS 애니메이션** - 롤링, 회전 효과
3. **이벤트 위임 패턴** - 동적 요소 이벤트 처리
4. **배열 조작** - push, splice, forEach
5. **DOM 조작** - createElement, innerHTML, append

**활용 가능한 시나리오:**

- 점심 메뉴 선택
- 팀 빌딩 게임 (랜덤 과제 선택)
- 추첨 시스템
- 의사 결정 도구

**확장 아이디어:**

- LocalStorage로 데이터 영속성 추가
- 카테고리별 메뉴 관리 (한식, 중식, 일식)
- 선택 히스토리 저장
- 공유 기능 (URL 파라미터로 메뉴 전달)
- SpreadsheetApp 연동하여 메뉴 DB 관리

---

**작성일:** 2026-01-28
**프로젝트:** apps-script-clasp/projects/what-to-eat
**GAS Runtime:** V8
**TimeZone:** Asia/Seoul
