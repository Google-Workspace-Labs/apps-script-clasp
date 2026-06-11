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
