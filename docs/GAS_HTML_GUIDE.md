# HTML/CSS 코딩 가이드 (Apps Script)

Apps Script 프로젝트에서 권장하는 HTML/CSS 코딩 스타일입니다.

**핵심 제약사항:** Apps Script HTML은 외부 CSS 파일을 import할 수 없습니다. 모든 스타일은 `<style>` 태그 내부에 인라인으로 작성해야 합니다.

---

## 📚 목차

1. [기본 구조](#1-기본-구조)
2. [CSS 변수 패턴](#2-css-변수-패턴)
3. [GAS 템플릿 문법](#3-gas-템플릿-문법)
4. [include() 패턴](#4-include-패턴)
5. [반응형 디자인](#5-반응형-디자인)
6. [다크모드 지원](#6-다크모드-지원)
7. [실전 컴포넌트](#7-실전-컴포넌트)
8. [베스트 프랙티스](#8-베스트-프랙티스)
9. [인터랙티브 피드백 (권장)](#9-인터랙티브-피드백-권장)

---

## 1. 기본 구조

### ✅ 권장: 표준 HTML5 구조

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <base target="_top" />
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Web App</title>

    <style>
      /* CSS 변수 정의 */
      :root {
        --primary-color: #667eea;
        --secondary-color: #764ba2;
        --text-color: #333;
        --bg-color: #fff;
        --border-radius: 8px;
        --spacing: 16px;
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          sans-serif;
        color: var(--text-color);
        background: var(--bg-color);
        padding: var(--spacing);
      }
    </style>
  </head>
  <body>
    <div id="app">
      <h1>Hello, Apps Script!</h1>
    </div>

    <script>
      // JavaScript 코드
      console.log('App loaded');
    </script>
  </body>
</html>
```

### ⚠️ 필수: base target="_top"

```html
<base target="_top" />
```

**이유:**
- Apps Script Web App은 iframe 내부에서 실행
- `<a>` 태그 클릭 시 기본적으로 iframe 내부에서 열림
- `target="_top"` 설정으로 부모 윈도우에서 열림

---

## 2. CSS 변수 패턴

### ✅ 권장: CSS 변수로 테마 관리

```html
<style>
  :root {
    /* Colors */
    --primary-color: #667eea;
    --primary-hover: #5568d3;
    --secondary-color: #764ba2;
    --success-color: #48bb78;
    --error-color: #f56565;
    --warning-color: #ed8936;

    /* Text */
    --text-primary: #2d3748;
    --text-secondary: #718096;
    --text-muted: #a0aec0;

    /* Background */
    --bg-primary: #ffffff;
    --bg-secondary: #f7fafc;
    --bg-tertiary: #edf2f7;

    /* Border */
    --border-color: #e2e8f0;
    --border-radius: 8px;

    /* Spacing */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;

    /* Shadow */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
    --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  }

  /* 사용 예시 */
  .button {
    background: var(--primary-color);
    color: white;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-sm);
  }

  .button:hover {
    background: var(--primary-hover);
    box-shadow: var(--shadow-md);
  }
</style>
```

### ❌ 금지: 하드코딩된 색상/값

```html
<style>
  .button {
    background: #667eea; /* ❌ 하드코딩 */
    padding: 8px 16px; /* ❌ 하드코딩 */
  }
</style>
```

---

## 3. GAS 템플릿 문법

### Scriptlet 태그

Apps Script HTML은 서버 측 템플릿 문법을 지원합니다.

```html
<!DOCTYPE html>
<html>
  <head>
    <title><?= title ?></title>
  </head>
  <body>
    <!-- HTML 이스케이프 출력 (XSS 방지) -->
    <h1><?= userName ?></h1>

    <!-- Raw HTML 출력 (신중하게 사용) -->
    <div><?!= htmlContent ?></div>

    <!-- 반복문 -->
    <? for (let i = 0; i < items.length; i++) { ?>
    <div class="item">
      <h3><?= items[i].name ?></h3>
      <p><?= items[i].description ?></p>
    </div>
    <? } ?>

    <!-- 조건문 -->
    <? if (isLoggedIn) { ?>
    <p>Welcome back!</p>
    <? } else { ?>
    <p>Please log in</p>
    <? } ?>
  </body>
</html>
```

### Code.js에서 템플릿 렌더링

```javascript
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('index');

  // 템플릿 변수 설정
  template.title = 'My App';
  template.userName = 'John Doe';
  template.htmlContent = '<strong>Bold text</strong>';
  template.items = [
    { name: 'Item 1', description: 'First item' },
    { name: 'Item 2', description: 'Second item' },
  ];
  template.isLoggedIn = true;

  return template.evaluate().setTitle('My Web App');
}
```

---

## 4. include() 패턴

### 공통 스타일 재사용

**Code.js:**

```javascript
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('My App');
}

/**
 * 다른 HTML 파일을 포함합니다.
 * @param {string} filename - 포함할 파일명
 * @return {string} 파일 내용
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

**styles.html:**

```html
<style>
  :root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
</style>
```

**index.html:**

```html
<!DOCTYPE html>
<html>
  <head>
    <base target="_top" />
    <?!= include('styles') ?>
  </head>
  <body>
    <h1>Hello!</h1>
  </body>
</html>
```

### 장점

- ✅ 공통 스타일 중앙 관리
- ✅ 여러 HTML 페이지에서 재사용
- ✅ 유지보수 용이

---

## 5. 반응형 디자인

### ✅ 권장: 모바일 우선 (Mobile First)

```html
<style>
  /* 모바일 기본 */
  .container {
    width: 100%;
    padding: var(--spacing-md);
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }

  /* 태블릿 (768px 이상) */
  @media (min-width: 768px) {
    .container {
      max-width: 720px;
      margin: 0 auto;
    }

    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* 데스크톱 (1024px 이상) */
  @media (min-width: 1024px) {
    .container {
      max-width: 960px;
    }

    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
```

### viewport 설정 필수

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

### ⚠️ iOS 입력 포커스 자동 줌 방지

iOS Safari·카카오 인앱 등 WebKit 브라우저는 **`<input>`·`<textarea>`의 `font-size`가 16px 미만이면, 그 칸을 탭(포커스)할 때 자동으로 확대(zoom)**한다.
→ 페이지가 살짝 넓어지며 **여백이 흔들리는** 것처럼 보인다 (위치마다 줌 정도가 달라 들쭉날쭉).

```css
/* ❌ 15px → 칸 탭하면 화면 확대 */
input {
  font-size: 15px;
}

/* ✅ 16px 이상 → 줌 안 일어남 */
input,
textarea {
  font-size: 16px;
}
```

- **편집 가능한 모든 칸**(text·password·search·textarea)에 16px 이상 적용
- placeholder 폰트는 작아도 무관 (줌 판정은 입력칸 _본문_ `font-size` 기준)
- 디자인상 더 작게 보이고 싶어도 **16px가 하한선** — 그 아래는 줌 발생

---

## 6. 다크모드 지원

### ✅ 권장: CSS 변수 + prefers-color-scheme

```html
<style>
  /* 라이트 모드 (기본) */
  :root {
    --bg-primary: #ffffff;
    --bg-secondary: #f7fafc;
    --text-primary: #2d3748;
    --text-secondary: #718096;
    --border-color: #e2e8f0;
  }

  /* 다크 모드 */
  @media (prefers-color-scheme: dark) {
    :root {
      --bg-primary: #1a202c;
      --bg-secondary: #2d3748;
      --text-primary: #f7fafc;
      --text-secondary: #cbd5e0;
      --border-color: #4a5568;
    }
  }

  body {
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
  }
</style>
```

### 수동 토글 (선택사항)

```html
<style>
  [data-theme='light'] {
    --bg-primary: #ffffff;
    --text-primary: #2d3748;
  }

  [data-theme='dark'] {
    --bg-primary: #1a202c;
    --text-primary: #f7fafc;
  }
</style>

<button id="theme-toggle">🌙 다크모드</button>

<script>
  const toggle = document.getElementById('theme-toggle');
  const root = document.documentElement;

  toggle.addEventListener('click', () => {
    const currentTheme = root.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', newTheme);
    toggle.textContent = newTheme === 'dark' ? '☀️ 라이트모드' : '🌙 다크모드';
  });
</script>
```

---

## 7. 실전 컴포넌트

### 버튼 컴포넌트

```html
<style>
  .btn {
    display: inline-block;
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    border-radius: var(--border-radius);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--primary-color);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-hover);
    box-shadow: var(--shadow-md);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

<button class="btn btn-primary">저장</button>
<button class="btn btn-secondary">취소</button>
<button class="btn btn-primary" disabled>로딩 중...</button>
```

### 카드 컴포넌트

```html
<style>
  .card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-sm);
  }

  .card-header {
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
  }

  .card-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .card-body {
    color: var(--text-secondary);
  }
</style>

<div class="card">
  <div class="card-header">
    <h2 class="card-title">카드 제목</h2>
  </div>
  <div class="card-body">
    <p>카드 내용입니다.</p>
  </div>
</div>
```

### 입력 폼 컴포넌트

```html
<style>
  .form-group {
    margin-bottom: var(--spacing-md);
  }

  .form-label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .form-input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: 14px;
    color: var(--text-primary);
    background: var(--bg-primary);
    transition: border-color 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .form-input::placeholder {
    color: var(--text-muted);
  }

  .form-error {
    margin-top: var(--spacing-xs);
    font-size: 12px;
    color: var(--error-color);
  }
</style>

<div class="form-group">
  <label class="form-label" for="email">이메일</label>
  <input
    type="email"
    id="email"
    class="form-input"
    placeholder="your@email.com"
  />
  <div class="form-error">유효한 이메일 주소를 입력하세요</div>
</div>
```

### 로딩 스피너

```html
<style>
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--bg-tertiary);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
  }
</style>

<div class="loading-container">
  <div class="spinner"></div>
</div>
```

### 결과 메시지 깜빡임(플래시) 효과

상태 메시지가 갱신될 때 **잠깐 하이라이트로 번쩍**여 주목을 유도하는 패턴.

#### ⚠️ CSS @keyframes 재발화는 불안정

`class` 제거→추가 + reflow 로 keyframe 을 재시작하는 흔한 트릭은,
**같은 메시지를 연속으로 띄울 때 재시작이 안 되는** 경우가 있다 (실측: GAS 웹앱에서 전혀 안 보임).

```javascript
// ❌ 불안정: keyframe 재발화 트릭
el.classList.remove('flash');
void el.offsetWidth; // reflow
el.classList.add('flash'); // 가끔/특정 환경서 재시작 안 됨
```

#### ✅ 권장: JS inline transition

배경을 **즉시 켜고(transition:none) → reflow 로 확정 → transition 으로 투명 페이드**.
transition 은 reflow 후 속성 변경에 **항상 발화**하므로 매번 확실히 깜빡인다.

```javascript
function flash(el, msg) {
  el.textContent = msg;
  if (!msg) return;
  el.style.transition = 'none';
  el.style.background = 'rgba(184,134,11,0.6)'; // 즉시 하이라이트
  el.style.borderRadius = '8px';
  void el.offsetWidth; // reflow 로 금색 확정
  el.style.transition = 'background 1.8s ease 0.3s'; // 0.3s 유지 후 1.8s 페이드
  el.style.background = 'transparent';
}
```

- `transition: background <duration> ease <delay>` — `delay` 로 "잠깐 유지 후 천천히 사라짐" 연출
- 연속 호출해도 매번 깜빡임 (transition 재발화 보장)
- `@keyframes` 불필요 → CSS 의존 없이 JS 만으로 동작

---

## 8. 베스트 프랙티스

### ✅ DO

**1. CSS 변수 사용**

```html
<style>
  :root {
    --primary-color: #667eea;
  }
  .button {
    background: var(--primary-color);
  }
</style>
```

**2. 시맨틱 HTML 사용**

```html
<header>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>제목</h1>
    <p>내용</p>
  </article>
</main>

<footer>
  <p>&copy; 2026 My App</p>
</footer>
```

**3. 접근성 고려**

```html
<!-- 버튼에 명확한 텍스트 -->
<button aria-label="메뉴 열기">☰</button>

<!-- 이미지에 alt 속성 -->
<img src="logo.png" alt="회사 로고" />

<!-- 폼 요소에 label 연결 -->
<label for="email">이메일</label>
<input type="email" id="email" />
```

**4. box-sizing: border-box**

```html
<style>
  * {
    box-sizing: border-box;
  }
</style>
```

**5. 트랜지션 효과**

```html
<style>
  .button {
    transition: all 0.2s ease;
  }

  .button:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
</style>
```

### ❌ DON'T

**1. 외부 CSS 파일 import (불가능)**

```html
<!-- ❌ 작동 안 함 -->
<link rel="stylesheet" href="styles.css" />
```

**2. 인라인 스타일 남용**

```html
<!-- ❌ 유지보수 어려움 -->
<div style="background: #667eea; padding: 16px; border-radius: 8px;">
  Content
</div>

<!-- ✅ CSS 클래스 사용 -->
<style>
  .card {
    background: var(--primary-color);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
  }
</style>
<div class="card">Content</div>
```

**3. !important 남용**

```html
<style>
  /* ❌ 최후의 수단으로만 */
  .override {
    color: red !important;
  }

  /* ✅ 명시도 관리로 해결 */
  .parent .child {
    color: red;
  }
</style>
```

**4. ID 선택자 과용**

```html
<style>
  /* ❌ 재사용 불가 */
  #header {
    background: #667eea;
  }

  /* ✅ 클래스 사용 */
  .header {
    background: var(--primary-color);
  }
</style>
```

**5. 하드코딩된 색상**

```html
<style>
  /* ❌ */
  .button {
    background: #667eea;
    color: #ffffff;
  }

  /* ✅ */
  .button {
    background: var(--primary-color);
    color: var(--text-on-primary);
  }
</style>
```

---

## 9. 인터랙티브 피드백 (권장)

> ⚠️ 이건 **규칙이 아니라 추천**이다. kingshot-coupon 에서 자리잡은 패턴이고 "이럴 땐 보통 이게
> 잘 맞더라" 수준. 프로젝트 성격에 맞게 골라 쓰거나 다른 방식을 택해도 된다.

기본값으로 깔아두면 편한 흐름:
**터치 확인(press) → 중복 차단(작업중) → 진행(별도 영역) → 결과(맥락별)**

### 9-1. 누름(press) — 거의 항상 추천

터치엔 hover 가 없어서 "탭이 먹혔다"는 물리 확인이 중요하다. `button:active` 에 `translateY` +
그림자 소멸 + 살짝 어둡게가 잘 먹힌다.

```css
button:active {
  transform: translateY(3px); /* 바닥까지 눌림 */
  box-shadow: none;
  filter: brightness(0.9);
}
```

- 주 액션은 강하게(예: 3px), 보조(칩 등)는 약하게(1px)로 **위계**를 줄 수도, 통일해도 무방.
- 전역 `button:active` 로 깔고 **개별 클래스에서 약하게 덮어쓰지 않도록** 주의 — 의도치 않게
  피드백이 약해진다(실제로 겪은 함정).

### 9-2. 작업 중(서버 왕복) — `disabled` 추천

서버 액션은 중복 클릭 = 중복 호출/쓰기라 위험. 응답까지 `disabled`(칩이면 `opacity`↓ +
`pointer-events:none`)로 막으면 "도는 중"도 함께 전달된다.

### 9-3. 진행 표시(⏳) — 버튼 _위_ 보다 별도 영역 추천

`⏳ 처리 중…` 같은 로딩 텍스트는 **버튼 라벨을 흔들기보다 별도 결과/상태 영역**에 두는 게 깔끔하다
(버튼은 `disabled` 로 충분). 버튼 라벨은 정체성이라 안정적인 편이 좋다.
→ 단, 결과 영역이 _없는_ 작은 즉시액션 버튼이면 9-4 처럼 버튼 텍스트를 잠깐 바꿔도 된다.

### 9-4. 완료 확인 — 맥락별

- **결과 영역 있음**: 거기에 성공/실패 메시지.
- **결과 영역 없는 즉시액션**(복사·다운로드 등): 버튼 텍스트를 잠깐 `✓ …`(예: `✓ Copied`)로 바꿨다
  복원. 그 자리가 유일한 확인 지점이라 잘 맞는다. (로딩 ⏳ 와 구분 — 이건 "끝났다" 신호)
- **상태 토글(on/off)**: 낙관적(클릭 즉시 반영) + 실패 시 원복이 보통 가장 자연스럽다.

### 9-5. 비가역/위험 — 한 단계 더

삭제처럼 되돌리기 어려운 동작은 `confirm()` 한 단계를 두는 편이 안전하다.

### 9-6. 설정 저장 버튼 — 무변경 시 비활성 (+ no-op 가드)

설정값(숫자·드롭다운 등)을 저장하는 버튼은 **입력값이 저장값과 같으면 비활성**으로 두면, 같은 값을
또 저장하는 무의미 서버 호출·알림을 원천 차단한다. 9-2(작업 중 `disabled`)의 보완 — "도는 중"이
아니라 "바뀐 게 없음"을 막는다.

- **stage**: 입력 `oninput` 에서 `현재값 === 저장값` 이면 저장 버튼 `disabled`, 다르면 활성. 저장값은
  로드 시 `data-prev` 같은 속성에 박아두고 저장 성공 시 갱신.
- **저장 후 유지**: 저장 성공 → 입력값 == 저장값이 되므로 버튼은 **계속 비활성**(타이머로 다시 켜지 말
  것). 값을 또 바꿔야만 켜짐 → "저장 후 연타"가 구조적으로 불가능 — 시간지연(디바운스)보다 강하고 깔끔.
- **no-op 가드**: Enter 등으로 버튼을 우회할 수 있으니, 저장 함수 첫 줄에서 `값===저장값`이면 즉시 `return`.
- "선택 → 적용"형(드롭다운+저장 버튼)에도 동일 적용 — **명시적 저장**이 텍스트/선택 중간값 오저장을 막아
  자동 적용(디바운스)보다 안전(실제로 디바운스에서 이 방식으로 선회).

### 9-7. 다국어 버튼 — 가장 긴 라벨로 폭 고정

EN/KO 등 언어 전환 시 라벨 길이가 달라지면(`저장`↔`Save`, `조회`↔`Look up`) 버튼 크기가 들쭉날쭉
바뀌고 옆 입력칸까지 흔들린다. **`min-width` 를 가장 긴 라벨 기준으로** 잡아두면 전환해도 폭이 고정된다.

```css
.save-btn {
  min-width: 76px;
} /* '저장' / 'Save' 둘 다 안 잘리는 최소폭 */
```

- 전폭 버튼(`width:100%`)은 영향 없음 — `width` 가 `min-width` 보다 우선.
- 짧은 액션 버튼(저장·적용·조회)만 대상. 라벨을 i18n 으로 바꾸기 _전에_ 폭부터 고정해두면 깜빡임 없음.

### 요지

> **꼭 이대로 해야 하는 건 아니다.** 위 흐름을 _기본 추천_ 으로 깔되, 프로젝트 톤·규모에 맞게
> 가감하면 된다. 특정 방식을 선호하면 그걸로 가도 무방 — 일관성만 유지하면 충분하다.

---

## ✅ 체크리스트

### 새 HTML 파일 작성 시:

- [ ] `<!DOCTYPE html>` 선언
- [ ] `<base target="_top" />` 추가
- [ ] `<meta name="viewport">` 추가
- [ ] CSS 변수 정의 (`:root`)
- [ ] `box-sizing: border-box` 설정
- [ ] 모바일 우선 반응형 디자인
- [ ] 다크모드 지원 (선택)

### 스타일 작성 시:

- [ ] CSS 변수 사용
- [ ] 시맨틱 HTML 태그 사용
- [ ] 접근성 속성 추가 (aria-label, alt 등)
- [ ] 트랜지션 효과 추가
- [ ] 인라인 스타일 최소화
- [ ] !important 사용 자제
- [ ] ID 선택자 최소화

### GAS 템플릿 사용 시:

- [ ] `<?= ?>` (이스케이프 출력) vs `<?!= ?>` (Raw HTML) 구분
- [ ] `include()` 함수로 공통 스타일 재사용
- [ ] 템플릿 변수 Code.js에서 설정

---

## 📚 참고 문서

### 공식 가이드:

- [Apps Script HTML Service](https://developers.google.com/apps-script/guides/html)
- [Apps Script Templates](https://developers.google.com/apps-script/guides/html/templates)
- [CSS Variables (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
