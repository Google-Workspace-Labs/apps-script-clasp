# 📌 Sidebar-UI 프로젝트 완전 분석

> **Google Apps Script Container-bound Script** - 스프레드시트 사이드바 자동 실행 시스템

---

## 📚 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [GAS 아키텍처](#2-gas-아키텍처)
3. [주요 기능](#3-주요-기능)
4. [권한 관리 시스템](#4-권한-관리-시스템)
5. [GAS API 사용](#5-gas-api-사용)
6. [파일 구조](#6-파일-구조)
7. [코드 상세 분석](#7-코드-상세-분석)
8. [배포 및 실행](#8-배포-및-실행)
9. [참고 자료](#9-참고-자료)

---

## 1. 프로젝트 개요

### 🎯 프로젝트 목적

**Container-bound Script 방식의 스프레드시트 사이드바 시스템**

- **스프레드시트를 열 때 자동으로 사이드바 표시**
- **소유자 전용 모드 지원** (공동 작업자 차단 가능)
- **사용자 정의 메뉴**를 통한 설정 관리
- **Installable Trigger**를 이용한 자동 실행

### 🔍 핵심 특징

| 특징 | 설명 |
|------|------|
| **프로젝트 타입** | Container-bound Script (스프레드시트 바인딩) |
| **UI 방식** | Sidebar (사이드바) |
| **자동 실행** | onOpen Installable Trigger |
| **권한 관리** | 소유자 vs 공동 작업자 구분 |
| **설정 저장** | PropertiesService (DocumentProperties) |
| **라이브러리** | 없음 (순수 HTML/CSS/JavaScript) |

### 🆚 Web App vs Container-bound Script 비교

| 구분 | Web App (user-permission) | Container-bound (sidebar-ui) |
|------|---------------------------|------------------------------|
| **실행 방식** | 독립 URL로 접근 | 스프레드시트/문서에 포함 |
| **UI** | 전체 화면 HTML | Sidebar/Dialog |
| **라우팅** | `doGet(e)` + URL 파라미터 | 함수 직접 호출 |
| **메뉴** | 직접 구현 | `SpreadsheetApp.getUi()` |
| **트리거** | 수동 설정 | `ScriptApp.newTrigger()` |
| **배포** | `clasp deploy` (Deployment ID) | 스크립트 저장만 필요 |

---

## 2. GAS 아키텍처

### 📊 시스템 구조

```
┌─────────────────────────────────────────────────────┐
│           Google Spreadsheet (Container)            │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │        Simple Trigger: onOpen()             │   │
│  │  ✅ 스프레드시트 열릴 때 자동 실행           │   │
│  │  → 사용자 정의 메뉴 생성                    │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │                               │
│  ┌─────────────────▼──────────────────────────┐   │
│  │    Custom Menu: "⚙ 사용자 설정"           │   │
│  │  1. 📌 사이드바 열기                       │   │
│  │  2. 🔄 사이드바 자동 실행 ON/OFF          │   │
│  │  3. 👤 소유자 전용 자동 실행 ON/OFF       │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │                               │
│  ┌─────────────────▼──────────────────────────┐   │
│  │   PropertiesService (Document Level)       │   │
│  │  - SidebarAutoTrigger: "true" / null       │   │
│  │  - ownerOnlySidebar: "true" / null         │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │                               │
│  ┌─────────────────▼──────────────────────────┐   │
│  │  Installable Trigger (if enabled)          │   │
│  │  ✅ onOpen → showSidebar()                 │   │
│  │  ⚠️ 소유자만 생성/삭제 가능                │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │                               │
│  ┌─────────────────▼──────────────────────────┐   │
│  │        showSidebar() 함수 실행             │   │
│  │  1. ownerOnlySidebar 설정 확인             │   │
│  │  2. isUserOwner() 권한 검사                │   │
│  │  3. sidebar.html 렌더링                    │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │                               │
│  ┌─────────────────▼──────────────────────────┐   │
│  │          Sidebar UI (우측)                 │   │
│  │  ┌────────────────────────────────────┐    │   │
│  │  │ 📊 사이드바                        │    │   │
│  │  │ 이 사이드바가 실행됩니다.          │    │   │
│  │  │ [ 닫기 ]                           │    │   │
│  │  └────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 🔄 실행 흐름

#### A. 최초 스프레드시트 열기 (트리거 OFF 상태)

```
1. 사용자가 스프레드시트 열기
   ↓
2. onOpen() 자동 실행 (Simple Trigger)
   ↓
3. "⚙ 사용자 설정" 메뉴 생성
   ↓
4. 사이드바 표시 안 함 (Installable Trigger 없음)
```

#### B. 자동 실행 설정 (소유자만 가능)

```
1. 메뉴: "🔄 사이드바 자동 실행 ON/OFF" 클릭
   ↓
2. toggleSidebarAutoTrigger() 함수 실행
   ↓
3. isUserOwner() 권한 검사
   │
   ├─ ❌ 공동 작업자 → 경고 알림
   │
   └─ ✅ 소유자
      ↓
4. createTriggerWithName("SidebarAutoTrigger")
   ↓
5. ScriptApp.newTrigger("showSidebar")
      .forSpreadsheet(...)
      .onOpen()
      .create()
   ↓
6. PropertiesService.setProperty("SidebarAutoTrigger", "true")
   ↓
7. 알림: "✅ 사이드바 자동 실행이 설정되었습니다."
```

#### C. 자동 실행 상태에서 스프레드시트 열기

```
1. 사용자가 스프레드시트 열기
   ↓
2. onOpen() 자동 실행 (Simple Trigger)
   ↓
3. "⚙ 사용자 설정" 메뉴 생성
   ↓
4. showSidebar() 자동 실행 (Installable Trigger)
   ↓
5. ownerOnlySidebar 설정 확인
   │
   ├─ ownerOnlySidebar = "true"
   │  ├─ isUserOwner() = true → 사이드바 표시
   │  └─ isUserOwner() = false → 아무것도 안 함 (공동 작업자 차단)
   │
   └─ ownerOnlySidebar = null (기본값)
      → 모든 사용자에게 사이드바 표시
   ↓
6. HtmlService.createHtmlOutputFromFile('sidebar')
   ↓
7. SpreadsheetApp.getUi().showSidebar(htmlOutput)
```

#### D. 소유자 전용 모드 설정

```
1. 메뉴: "👤 소유자 전용 자동 실행 ON/OFF" 클릭
   ↓
2. toggleOwnerOnlySidebar() 함수 실행
   ↓
3. isUserOwner() 권한 검사
   │
   ├─ ❌ 공동 작업자 → 경고 알림
   │
   └─ ✅ 소유자
      ↓
4. 현재 설정 확인
   │
   ├─ ownerOnlySidebar = "true" (현재 ON)
   │  ↓
   │  properties.deleteProperty('ownerOnlySidebar')
   │  ↓
   │  알림: "✅ 공동 작업자도 사이드바 자동 실행이 허용되었습니다."
   │
   └─ ownerOnlySidebar = null (현재 OFF)
      ↓
      properties.setProperty('ownerOnlySidebar', 'true')
      ↓
      알림: "👤 소유자 전용 모드가 활성화되었습니다."
```

---

## 3. 주요 기능

### ✅ 기능 목록

| 기능 | 함수 | 권한 | 설명 |
|------|------|------|------|
| **메뉴 생성** | `onOpen()` | 모든 사용자 | 스프레드시트 열릴 때 자동 실행 |
| **사이드바 열기** | `showSidebar()` | 소유자 전용 모드 여부에 따름 | 수동 또는 자동으로 사이드바 표시 |
| **자동 실행 설정** | `toggleSidebarAutoTrigger()` | 소유자만 | Installable Trigger 생성/삭제 |
| **소유자 전용 설정** | `toggleOwnerOnlySidebar()` | 소유자만 | 공동 작업자 차단 여부 설정 |
| **트리거 생성** | `createTriggerWithName()` | 소유자만 | onOpen 트리거 생성 |
| **트리거 삭제** | `deleteTriggerByName()` | 소유자만 | 기존 트리거 삭제 |
| **트리거 확인** | `isTriggerExists()` | 내부 함수 | 트리거 중복 방지 |
| **권한 검사** | `isUserOwner()` | 내부 함수 | 소유자 여부 확인 |

### 🎛️ 기능 1: 사용자 정의 메뉴 생성

**함수:** `onOpen()` (Code.js:2-9)

**실행 방식:** Simple Trigger (자동 실행, 권한 제한)

**코드:**
```javascript
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙ 사용자 설정')
    .addItem('📌 사이드바 열기', 'showSidebar')
    .addItem('🔄 사이드바 자동 실행 ON/OFF', 'toggleSidebarAutoTrigger')
    .addItem('👤 소유자 전용 자동 실행 ON/OFF', 'toggleOwnerOnlySidebar')
    .addToUi();
}
```

**설명:**

1. **Simple Trigger**: 스프레드시트를 열 때 자동으로 실행됩니다.
2. **SpreadsheetApp.getUi()**: 스프레드시트 UI 객체를 가져옵니다.
3. **createMenu()**: 사용자 정의 메뉴를 생성합니다.
4. **addItem()**: 메뉴 항목을 추가합니다.
   - 첫 번째 인자: 메뉴 이름
   - 두 번째 인자: 클릭 시 실행할 함수 이름 (문자열)

**Simple Trigger 제약사항:**

- ❌ **PropertiesService** 읽기만 가능 (쓰기 불가)
- ❌ **외부 서비스 접근 불가** (UrlFetchApp, GmailApp 등)
- ❌ **30초 이상 실행 불가**
- ✅ **UI 메뉴 생성 가능**
- ✅ **SpreadsheetApp 기본 작업 가능**

### 🖼️ 기능 2: 사이드바 표시

**함수:** `showSidebar()` (Code.js:12-23)

**권한:** 소유자 전용 모드 설정에 따름

**코드:**
```javascript
function showSidebar() {
  const properties = PropertiesService.getDocumentProperties();
  const ownerOnlyMode = properties.getProperty('ownerOnlySidebar') === 'true';

  if (ownerOnlyMode && !isUserOwner()) {
    return; // 소유자 전용 모드 + 공동 작업자 → 실행 안 함
  }

  const htmlOutput = HtmlService.createHtmlOutputFromFile('sidebar')
    .setTitle('📌 자동 실행 사이드바');
  SpreadsheetApp.getUi().showSidebar(htmlOutput);
}
```

**단계별 설명:**

1. **PropertiesService.getDocumentProperties()**
   - 문서 레벨 속성 저장소 가져오기
   - 스프레드시트를 복사하면 속성도 함께 복사됨
   - 다른 사용자에게는 독립적인 속성

2. **ownerOnlySidebar 설정 확인**
   - `"true"` → 소유자 전용 모드 ON
   - `null` → 모든 사용자에게 허용 (기본값)

3. **권한 검사**
   - `ownerOnlyMode && !isUserOwner()` → 공동 작업자 차단
   - `return` → 함수 종료 (사이드바 표시 안 함)

4. **HtmlService.createHtmlOutputFromFile('sidebar')**
   - `sidebar.html` 파일을 읽어서 HTML 출력 객체 생성
   - `.setTitle()` → 사이드바 제목 설정

5. **SpreadsheetApp.getUi().showSidebar()**
   - 스프레드시트 우측에 사이드바 표시

**sidebar.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 10px; }
    h2 { color: #4CAF50; }
    button { background-color: #4CAF50; color: white; border: none; padding: 10px; cursor: pointer; }
    button:hover { background-color: #45a049; }
  </style>
</head>
<body>
  <h2>📊 사이드바</h2>
  <p>이 사이드바가 실행됩니다.</p>

  <button onclick="google.script.host.close()">닫기</button>
</body>
</html>
```

**주요 API:**

- **google.script.host.close()**: 사이드바를 닫습니다.
- **google.script.run**: 서버 함수 호출 (현재 사용 안 함)

### 🔄 기능 3: 자동 실행 트리거 설정

**함수:** `toggleSidebarAutoTrigger()` (Code.js:45-64)

**권한:** 소유자만

**코드:**
```javascript
function toggleSidebarAutoTrigger() {
  const triggerName = "SidebarAutoTrigger";
  const properties = PropertiesService.getDocumentProperties();
  const isTriggerEnabled = properties.getProperty(triggerName);

  if (!isUserOwner()) {
    SpreadsheetApp.getUi().alert("❌ 자동 실행 트리거 설정은 문서 소유자만 가능합니다.");
    return;
  }

  if (isTriggerEnabled === 'true') {
    deleteTriggerByName(triggerName);
    properties.deleteProperty(triggerName);
    SpreadsheetApp.getUi().alert("❌ 사이드바 자동 실행이 해제되었습니다.");
  } else {
    createTriggerWithName(triggerName);
    properties.setProperty(triggerName, 'true');
    SpreadsheetApp.getUi().alert("✅ 사이드바 자동 실행이 설정되었습니다.");
  }
}
```

**동작 원리:**

1. **권한 검사**
   - `isUserOwner()` → 소유자가 아니면 경고 알림 후 종료

2. **현재 상태 확인**
   - `properties.getProperty("SidebarAutoTrigger")`
   - `"true"` → 트리거 활성화 상태
   - `null` → 트리거 비활성화 상태

3. **트리거 ON → OFF**
   - `deleteTriggerByName()` → 기존 트리거 삭제
   - `properties.deleteProperty()` → 설정 삭제
   - 알림: "사이드바 자동 실행이 해제되었습니다."

4. **트리거 OFF → ON**
   - `createTriggerWithName()` → 새 트리거 생성
   - `properties.setProperty()` → 설정 저장
   - 알림: "사이드바 자동 실행이 설정되었습니다."

### 🏗️ 기능 4: 트리거 생성

**함수:** `createTriggerWithName()` (Code.js:67-81)

**권한:** 소유자만

**코드:**
```javascript
function createTriggerWithName(triggerName) {
  if (!isUserOwner()) {
    SpreadsheetApp.getUi().alert("❌ 자동 실행 트리거 설정은 문서 소유자만 가능합니다.");
    return;
  }

  if (isTriggerExists(triggerName)) {
    return; // 이미 존재하면 새로 등록하지 않음
  }

  ScriptApp.newTrigger("showSidebar")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onOpen()
    .create();
}
```

**Installable Trigger 생성:**

1. **ScriptApp.newTrigger("showSidebar")**
   - `showSidebar` 함수를 트리거로 등록

2. **forSpreadsheet(...)**
   - 현재 스프레드시트에 바인딩

3. **onOpen()**
   - 스프레드시트를 열 때 실행

4. **create()**
   - 트리거 생성 완료

**Simple Trigger vs Installable Trigger:**

| 구분 | Simple Trigger | Installable Trigger |
|------|----------------|---------------------|
| **생성 방법** | 함수 이름만 있으면 자동 (`onOpen`, `onEdit`) | `ScriptApp.newTrigger()` |
| **권한** | 제한적 (PropertiesService 읽기만 가능) | 전체 권한 |
| **외부 서비스** | ❌ 접근 불가 | ✅ 접근 가능 |
| **실행 시간** | 최대 30초 | 최대 6분 |
| **사용자 인증** | 불필요 | 최초 1회 인증 필요 |
| **삭제** | 불가능 (자동) | `ScriptApp.deleteTrigger()` |

### 🗑️ 기능 5: 트리거 삭제

**함수:** `deleteTriggerByName()` (Code.js:84-94)

**권한:** 소유자만

**코드:**
```javascript
function deleteTriggerByName(triggerName) {
  if (!isUserOwner()) {
    SpreadsheetApp.getUi().alert("❌ 자동 실행 트리거 해제는 문서 소유자만 가능합니다.");
    return;
  }

  const triggers = ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === "showSidebar");

  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
}
```

**단계별 설명:**

1. **ScriptApp.getProjectTriggers()**
   - 현재 프로젝트의 모든 Installable Trigger 조회

2. **filter(...)**
   - `getHandlerFunction() === "showSidebar"` → `showSidebar` 함수만 필터링

3. **forEach(...)**
   - `ScriptApp.deleteTrigger(trigger)` → 트리거 삭제

**주의:**
- Simple Trigger (`onOpen()`)는 삭제할 수 없습니다.
- Installable Trigger만 삭제 가능합니다.

### 👤 기능 6: 소유자 전용 모드

**함수:** `toggleOwnerOnlySidebar()` (Code.js:26-42)

**권한:** 소유자만

**코드:**
```javascript
function toggleOwnerOnlySidebar() {
  if (!isUserOwner()) {
    SpreadsheetApp.getUi().alert("❌ 소유자 전용 설정 변경은 문서 소유자만 가능합니다.");
    return;
  }

  const properties = PropertiesService.getDocumentProperties();
  const ownerOnlyMode = properties.getProperty('ownerOnlySidebar') === 'true';

  if (ownerOnlyMode) {
    properties.deleteProperty('ownerOnlySidebar');
    SpreadsheetApp.getUi().alert("✅ 공동 작업자도 사이드바 자동 실행이 허용되었습니다.");
  } else {
    properties.setProperty('ownerOnlySidebar', 'true');
    SpreadsheetApp.getUi().alert("👤 소유자 전용 모드가 활성화되었습니다. 공동 작업자는 자동 실행되지 않습니다.");
  }
}
```

**사용 시나리오:**

**시나리오 1: 회사 내부용 스프레드시트**

1. 소유자(관리자)가 스프레드시트를 공유
2. 자동 실행 트리거를 설정 (모든 사용자에게 사이드바 표시)
3. **소유자 전용 모드 OFF** (기본값)
   - 모든 사용자가 스프레드시트를 열 때 사이드바 자동 표시

**시나리오 2: 민감한 정보가 있는 스프레드시트**

1. 소유자가 스프레드시트를 공유
2. 자동 실행 트리거를 설정
3. **소유자 전용 모드 ON**
   - 소유자만 스프레드시트를 열 때 사이드바 자동 표시
   - 공동 작업자는 사이드바가 표시되지 않음

---

## 4. 권한 관리 시스템

### 🔐 권한 레벨

| 사용자 타입 | 스프레드시트 열기 | 메뉴 보기 | 사이드바 수동 열기 | 자동 실행 설정 | 소유자 전용 설정 |
|------------|-------------------|-----------|-------------------|---------------|------------------|
| **소유자** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **공동 작업자 (편집 권한)** | ✅ | ✅ | 소유자 전용 모드에 따름 | ❌ | ❌ |
| **공동 작업자 (보기 권한)** | ✅ | ✅ | 소유자 전용 모드에 따름 | ❌ | ❌ |

### 🛡️ 권한 검사 함수

**함수:** `isUserOwner()` (Code.js:103-109)

**코드:**
```javascript
function isUserOwner() {
  const file = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const ownerEmail = file.getOwner().getEmail();
  const userEmail = Session.getActiveUser().getEmail();

  return ownerEmail === userEmail;
}
```

**단계별 설명:**

1. **SpreadsheetApp.getActiveSpreadsheet().getId()**
   - 현재 스프레드시트의 File ID 가져오기

2. **DriveApp.getFileById(...)**
   - Drive API로 파일 객체 가져오기

3. **file.getOwner().getEmail()**
   - 파일 소유자의 이메일 주소

4. **Session.getActiveUser().getEmail()**
   - 현재 스크립트를 실행 중인 사용자의 이메일 주소

5. **비교**
   - `ownerEmail === userEmail` → `true` (소유자) / `false` (공동 작업자)

**주의사항:**

- **익명 모드**: `Session.getActiveUser().getEmail()`이 빈 문자열을 반환할 수 있음
- **공유 설정**: "링크가 있는 모든 사용자" 권한일 경우 인증된 사용자만 가능

### 🔄 권한 검사 플로우

```
사용자가 메뉴 클릭 (예: "🔄 자동 실행 ON/OFF")
   ↓
toggleSidebarAutoTrigger() 함수 실행
   ↓
isUserOwner() 호출
   ├─ DriveApp.getFileById() → 스프레드시트 파일 객체
   ├─ file.getOwner().getEmail() → 소유자 이메일
   ├─ Session.getActiveUser().getEmail() → 현재 사용자 이메일
   └─ ownerEmail === userEmail
      ├─ true → 함수 계속 실행
      └─ false → alert("❌ 소유자만 가능") + return
```

---

## 5. GAS API 사용

### 📚 사용된 GAS API 목록

| API | 사용 위치 | 목적 |
|-----|----------|------|
| **SpreadsheetApp** | onOpen(), showSidebar() | UI 메뉴, 사이드바 표시 |
| **HtmlService** | showSidebar() | HTML 렌더링 |
| **ScriptApp** | createTriggerWithName(), deleteTriggerByName() | Installable Trigger 관리 |
| **PropertiesService** | toggleSidebarAutoTrigger(), toggleOwnerOnlySidebar() | 설정 저장 |
| **DriveApp** | isUserOwner() | 파일 소유자 확인 |
| **Session** | isUserOwner() | 현재 사용자 정보 |

---

### 1️⃣ SpreadsheetApp

**공식 문서:** https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app

**사용 예시:**

#### A. UI 객체 가져오기

**코드:**
```javascript
const ui = SpreadsheetApp.getUi();
```

**설명:**
- Container-bound Script에서만 사용 가능
- 스프레드시트의 UI 인터페이스 객체 반환

#### B. 사용자 정의 메뉴 생성

**코드:**
```javascript
ui.createMenu('⚙ 사용자 설정')
  .addItem('📌 사이드바 열기', 'showSidebar')
  .addItem('🔄 사이드바 자동 실행 ON/OFF', 'toggleSidebarAutoTrigger')
  .addToUi();
```

**설명:**
- `createMenu(name)` → 메뉴 빌더 반환
- `addItem(caption, functionName)` → 메뉴 항목 추가
  - caption: 메뉴에 표시될 텍스트
  - functionName: 클릭 시 실행할 함수 이름 (문자열)
- `addToUi()` → 메뉴를 UI에 추가

#### C. 현재 스프레드시트 가져오기

**코드:**
```javascript
const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
const spreadsheetId = spreadsheet.getId();
```

**설명:**
- `getActiveSpreadsheet()` → 현재 열린 스프레드시트 객체
- `getId()` → 스프레드시트 파일 ID

---

### 2️⃣ HtmlService

**공식 문서:** https://developers.google.com/apps-script/reference/html/html-service

**사용 예시:**

#### A. HTML 파일에서 출력 객체 생성

**코드:**
```javascript
const htmlOutput = HtmlService.createHtmlOutputFromFile('sidebar')
  .setTitle('📌 자동 실행 사이드바');
```

**설명:**
- `createHtmlOutputFromFile(filename)` → HTML 파일을 읽어서 HtmlOutput 객체 생성
- `setTitle(title)` → 사이드바/다이얼로그 제목 설정

#### B. 사이드바 표시

**코드:**
```javascript
SpreadsheetApp.getUi().showSidebar(htmlOutput);
```

**설명:**
- 스프레드시트 우측에 사이드바 표시
- 너비: 300px (기본값)
- 높이: 브라우저 높이에 맞춤

**다른 UI 표시 방법:**

```javascript
// 모달 다이얼로그 (중앙 팝업)
SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Title');

// 모달리스 다이얼로그 (스프레드시트 작업 가능)
SpreadsheetApp.getUi().showModelessDialog(htmlOutput, 'Title');
```

---

### 3️⃣ ScriptApp

**공식 문서:** https://developers.google.com/apps-script/reference/script/script-app

**사용 예시:**

#### A. Installable Trigger 생성

**코드:**
```javascript
ScriptApp.newTrigger("showSidebar")
  .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
  .onOpen()
  .create();
```

**설명:**
- `newTrigger(functionName)` → 트리거 빌더 반환
- `forSpreadsheet(spreadsheet)` → 스프레드시트 바인딩
- `onOpen()` → 스프레드시트를 열 때 실행
- `create()` → 트리거 생성

**다른 트리거 타입:**

```javascript
// 편집 시 실행
ScriptApp.newTrigger("onEditHandler")
  .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
  .onEdit()
  .create();

// 폼 제출 시 실행
ScriptApp.newTrigger("onFormSubmit")
  .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
  .onFormSubmit()
  .create();

// 시간 기반 트리거 (매일 오전 9시)
ScriptApp.newTrigger("dailyTask")
  .timeBased()
  .atHour(9)
  .everyDays(1)
  .create();
```

#### B. 모든 트리거 조회

**코드:**
```javascript
const triggers = ScriptApp.getProjectTriggers();
triggers.forEach(trigger => {
  Logger.log(trigger.getHandlerFunction()); // 함수 이름
  Logger.log(trigger.getTriggerSource()); // SPREADSHEETS, CLOCK, etc.
});
```

#### C. 트리거 삭제

**코드:**
```javascript
const triggers = ScriptApp.getProjectTriggers()
  .filter(trigger => trigger.getHandlerFunction() === "showSidebar");

triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
```

---

### 4️⃣ PropertiesService

**공식 문서:** https://developers.google.com/apps-script/reference/properties/properties-service

**사용 예시:**

#### A. Document Properties (문서 레벨 저장소)

**코드:**
```javascript
const properties = PropertiesService.getDocumentProperties();

// 저장
properties.setProperty('SidebarAutoTrigger', 'true');

// 읽기
const value = properties.getProperty('SidebarAutoTrigger'); // "true" 또는 null

// 삭제
properties.deleteProperty('SidebarAutoTrigger');

// 모두 삭제
properties.deleteAllProperties();
```

**특징:**
- 스프레드시트/문서에 바인딩된 저장소
- 스프레드시트를 복사하면 속성도 함께 복사됨
- 다른 사용자에게는 독립적인 저장소

#### B. User Properties (사용자 레벨 저장소)

**코드:**
```javascript
const userProperties = PropertiesService.getUserProperties();

// 현재 사용자만의 설정 저장
userProperties.setProperty('theme', 'dark');
```

**특징:**
- 현재 사용자(Google 계정)에 바인딩
- 다른 스프레드시트에서도 공유됨
- 다른 사용자는 접근 불가

#### C. Script Properties (프로젝트 레벨 저장소)

**코드:**
```javascript
const scriptProperties = PropertiesService.getScriptProperties();

// API 키 저장 (모든 사용자 공유)
scriptProperties.setProperty('API_KEY', 'abc123');
```

**특징:**
- 프로젝트 레벨 저장소
- 모든 사용자가 동일한 값을 공유
- 주로 API 키, 설정값 저장

**비교표:**

| 타입 | 범위 | 사용 예시 |
|------|------|----------|
| **Document Properties** | 문서마다 독립 | 트리거 설정, 문서별 옵션 |
| **User Properties** | 사용자마다 독립 | 개인 테마, 사용자 선호도 |
| **Script Properties** | 프로젝트 전체 공유 | API 키, 공통 설정 |

---

### 5️⃣ DriveApp

**공식 문서:** https://developers.google.com/apps-script/reference/drive/drive-app

**사용 예시:**

#### A. 파일 ID로 파일 가져오기

**코드:**
```javascript
const fileId = SpreadsheetApp.getActiveSpreadsheet().getId();
const file = DriveApp.getFileById(fileId);
```

**설명:**
- 스프레드시트도 Drive 파일로 관리됨
- `getFileById(id)` → File 객체 반환

#### B. 파일 소유자 확인

**코드:**
```javascript
const owner = file.getOwner();
const ownerEmail = owner.getEmail();
const ownerName = owner.getName();
```

**설명:**
- `getOwner()` → User 객체 반환
- `getEmail()` → 소유자 이메일 주소
- `getName()` → 소유자 이름

#### C. 파일 공유 설정

**코드:**
```javascript
// 링크가 있는 모든 사용자에게 보기 권한
file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

// 특정 사용자에게 편집 권한
file.addEditor('user@example.com');

// 특정 사용자에게 보기 권한
file.addViewer('viewer@example.com');
```

---

### 6️⃣ Session

**공식 문서:** https://developers.google.com/apps-script/reference/base/session

**사용 예시:**

#### A. 현재 사용자 정보

**코드:**
```javascript
const activeUser = Session.getActiveUser();
const userEmail = activeUser.getEmail();
```

**설명:**
- `getActiveUser()` → User 객체 반환
- `getEmail()` → 현재 스크립트를 실행 중인 사용자의 이메일

**주의사항:**
- **익명 모드**: 인증되지 않은 사용자는 빈 문자열 반환
- **공유 설정**: "링크가 있는 모든 사용자" 권한일 경우 작동 안 함

#### B. 스크립트 타임존

**코드:**
```javascript
const timeZone = Session.getScriptTimeZone();
// "Asia/Seoul"
```

#### C. 사용자 로케일

**코드:**
```javascript
const locale = Session.getActiveUserLocale();
// "ko" (한국어), "en" (영어)
```

---

## 6. 파일 구조

### 📂 프로젝트 구조

```
projects/sidebar-ui/
├── Code.js                 # 서버 사이드 로직 (109줄)
├── sidebar.html            # 사이드바 UI (18줄)
├── appsscript.json         # GAS 프로젝트 설정
└── .clasp.json             # Script ID
```

### 📄 파일별 설명

#### 1. Code.js (109줄)

**역할:** 서버 사이드 로직

**함수 목록:**

| 함수 | 줄 | 설명 |
|------|-----|------|
| `onOpen()` | 2-9 | Simple Trigger: 메뉴 생성 |
| `showSidebar()` | 12-23 | 사이드바 표시 (권한 검사 포함) |
| `toggleOwnerOnlySidebar()` | 26-42 | 소유자 전용 모드 토글 |
| `toggleSidebarAutoTrigger()` | 45-64 | 자동 실행 트리거 토글 |
| `createTriggerWithName()` | 67-81 | Installable Trigger 생성 |
| `deleteTriggerByName()` | 84-94 | Installable Trigger 삭제 |
| `isTriggerExists()` | 97-100 | 트리거 존재 여부 확인 |
| `isUserOwner()` | 103-109 | 소유자 여부 확인 |

**특징:**
- ✅ 모든 함수에 한글 주석
- ✅ 권한 검사 로직 포함
- ✅ PropertiesService로 설정 관리
- ✅ 이모지로 사용자 피드백 개선

#### 2. sidebar.html (18줄)

**역할:** 사이드바 UI

**구조:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* 인라인 CSS */
  </style>
</head>
<body>
  <h2>📊 사이드바</h2>
  <p>이 사이드바가 실행됩니다.</p>
  <button onclick="google.script.host.close()">닫기</button>
</body>
</html>
```

**특징:**
- ✅ 순수 HTML/CSS (외부 라이브러리 없음)
- ✅ `google.script.host.close()` 사용
- ❌ `google.script.run` 사용 안 함 (서버 통신 없음)

#### 3. appsscript.json (14줄)

**역할:** GAS 프로젝트 설정

**내용:**
```json
{
  "timeZone": "Asia/Seoul",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/drive"
  ]
}
```

**OAuth Scopes 설명:**

| Scope | 설명 |
|-------|------|
| `spreadsheets` | 스프레드시트 읽기/쓰기 |
| `script.container.ui` | UI 메뉴, 사이드바, 다이얼로그 |
| `script.scriptapp` | 트리거 생성/삭제 |
| `userinfo.email` | 사용자 이메일 조회 |
| `drive` | Drive 파일 메타데이터 조회 |

#### 4. .clasp.json (16줄)

**역할:** clasp 설정 및 Script ID

**내용:**
```json
{
  "scriptId": "1JkvfKWosiMTVEx_4uUZ0hlrPFrqrDU9v9qQXE6wcbX5i7D-osC6lR6Tv",
  "rootDir": "",
  "scriptExtensions": [".js", ".gs"],
  "htmlExtensions": [".html"],
  "jsonExtensions": [".json"],
  "filePushOrder": [],
  "skipSubdirectories": false
}
```

**중요:**
- **scriptId**: GAS 프로젝트 고유 ID (Git 포함 필수)
- **rootDir**: 빈 문자열 → 현재 디렉토리
- **filePushOrder**: 빈 배열 → GAS가 자동으로 의존성 해결

---

## 7. 코드 상세 분석

### 🔍 핵심 코드 패턴

#### 패턴 1: 토글 함수 (ON/OFF 전환)

**예시:** `toggleSidebarAutoTrigger()`, `toggleOwnerOnlySidebar()`

**공통 구조:**
```javascript
function toggleSetting() {
  // 1. 권한 검사
  if (!isUserOwner()) {
    alert("권한 없음");
    return;
  }

  // 2. 현재 상태 확인
  const properties = PropertiesService.getDocumentProperties();
  const isEnabled = properties.getProperty('settingName') === 'true';

  // 3. 상태 전환
  if (isEnabled) {
    // ON → OFF
    properties.deleteProperty('settingName');
    // 추가 작업 (트리거 삭제 등)
    alert("해제됨");
  } else {
    // OFF → ON
    properties.setProperty('settingName', 'true');
    // 추가 작업 (트리거 생성 등)
    alert("설정됨");
  }
}
```

**핵심 포인트:**
- `PropertiesService`로 상태 저장 (`"true"` 또는 `null`)
- `deleteProperty()`로 OFF 상태 표현 (메모리 절약)

#### 패턴 2: 권한 검사 패턴

**모든 소유자 전용 함수에 적용:**

```javascript
function someOwnerOnlyFunction() {
  if (!isUserOwner()) {
    SpreadsheetApp.getUi().alert("❌ 소유자 전용 기능입니다.");
    return;
  }

  // 실제 로직...
}
```

**장점:**
- 일관성 있는 권한 검사
- 명확한 에러 메시지

#### 패턴 3: 트리거 관리 패턴

**생성:**
```javascript
ScriptApp.newTrigger(functionName)
  .forSpreadsheet(spreadsheet)
  .onOpen()
  .create();
```

**삭제:**
```javascript
const triggers = ScriptApp.getProjectTriggers()
  .filter(trigger => trigger.getHandlerFunction() === functionName);

triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
```

**중복 방지:**
```javascript
function isTriggerExists(triggerName) {
  return ScriptApp.getProjectTriggers()
    .some(trigger => trigger.getHandlerFunction() === functionName);
}
```

---

### 🐛 잠재적 이슈

#### 이슈 1: 익명 모드에서 권한 검사 실패

**문제:**
```javascript
const userEmail = Session.getActiveUser().getEmail();
// 익명 모드 → 빈 문자열 ""
```

**해결책:**
```javascript
function isUserOwner() {
  const file = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const ownerEmail = file.getOwner().getEmail();
  const userEmail = Session.getActiveUser().getEmail();

  // 익명 모드 방어 코드 추가
  if (!userEmail) {
    return false; // 익명 사용자는 소유자가 아님
  }

  return ownerEmail === userEmail;
}
```

#### 이슈 2: 트리거 중복 생성

**문제:**
- `createTriggerWithName()`을 여러 번 호출하면 트리거가 중복 생성될 수 있음

**현재 방어 코드:**
```javascript
if (isTriggerExists(triggerName)) {
  return; // 이미 존재하면 새로 등록하지 않음
}
```

**개선 방안:**
```javascript
function createTriggerWithName(triggerName) {
  if (!isUserOwner()) {
    SpreadsheetApp.getUi().alert("❌ 소유자만 가능합니다.");
    return;
  }

  // 기존 트리거 삭제 후 재생성
  deleteTriggerByName(triggerName);

  ScriptApp.newTrigger("showSidebar")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onOpen()
    .create();
}
```

#### 이슈 3: Simple Trigger 권한 제약

**문제:**
- `onOpen()`은 Simple Trigger이므로 PropertiesService 쓰기 불가
- 현재 코드는 읽기만 수행하므로 문제없음

**주의사항:**
```javascript
function onOpen() {
  // ✅ 가능
  SpreadsheetApp.getUi().createMenu('메뉴').addToUi();

  // ❌ 불가능 (Simple Trigger 제약)
  PropertiesService.getDocumentProperties().setProperty('key', 'value');
  UrlFetchApp.fetch('https://api.example.com');
  GmailApp.sendEmail('user@example.com', 'Subject', 'Body');
}
```

---

## 8. 배포 및 실행

### 🚀 배포 방법

#### A. 스프레드시트에 바인딩

**Container-bound Script는 별도 배포 불필요**

1. **스프레드시트 생성**
   ```
   Google Sheets → 새 스프레드시트 생성
   ```

2. **Apps Script 에디터 열기**
   ```
   확장 프로그램 → Apps Script
   ```

3. **clasp으로 코드 푸시**
   ```bash
   cd projects/sidebar-ui
   clasp push
   ```

4. **스프레드시트 새로고침**
   - 브라우저에서 스프레드시트 페이지 새로고침
   - 자동으로 `onOpen()` 실행 → 메뉴 생성

#### B. 로컬 개발 워크플로우

```bash
# 1. 코드 수정
vim Code.js

# 2. GAS에 업로드
clasp push

# 3. 브라우저에서 테스트
# 스프레드시트 새로고침 → 메뉴 확인

# 4. 로그 확인
clasp logs
```

### 🧪 테스트 방법

#### 시나리오 1: 기본 메뉴 테스트

1. 스프레드시트 열기
2. 상단 메뉴에서 "⚙ 사용자 설정" 확인
3. "📌 사이드바 열기" 클릭
4. 우측에 사이드바 표시 확인

#### 시나리오 2: 자동 실행 테스트 (소유자)

1. "🔄 사이드바 자동 실행 ON/OFF" 클릭
2. 알림: "✅ 사이드바 자동 실행이 설정되었습니다."
3. 스프레드시트 닫기
4. 스프레드시트 다시 열기
5. **자동으로 사이드바 표시 확인**

#### 시나리오 3: 소유자 전용 모드 테스트

1. "👤 소유자 전용 자동 실행 ON/OFF" 클릭
2. 알림: "👤 소유자 전용 모드가 활성화되었습니다."
3. 스프레드시트를 다른 사용자와 공유
4. 다른 사용자가 스프레드시트 열기
5. **사이드바가 자동으로 표시되지 않음 확인**
6. 소유자가 스프레드시트 열기
7. **사이드바가 자동으로 표시됨 확인**

#### 시나리오 4: 공동 작업자 권한 테스트

1. 스프레드시트를 다른 사용자와 공유 (편집 권한)
2. 다른 사용자가 "🔄 자동 실행 ON/OFF" 클릭
3. 알림: "❌ 자동 실행 트리거 설정은 문서 소유자만 가능합니다."

---

### 🛠️ 디버깅

#### A. 로그 확인

**서버 사이드 로그:**
```javascript
function showSidebar() {
  console.log("showSidebar 실행");
  const properties = PropertiesService.getDocumentProperties();
  const ownerOnlyMode = properties.getProperty('ownerOnlySidebar');
  console.log("ownerOnlyMode:", ownerOnlyMode);

  // ...
}
```

**로그 확인:**
```bash
clasp logs
```

또는

```
Apps Script 에디터 → 실행 로그
```

#### B. 트리거 목록 확인

**GAS 에디터:**
```
Apps Script 에디터 → 트리거 (왼쪽 메뉴)
```

**코드로 확인:**
```javascript
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    console.log({
      handlerFunction: trigger.getHandlerFunction(),
      eventType: trigger.getEventType(),
      triggerSource: trigger.getTriggerSource()
    });
  });
}
```

#### C. PropertiesService 확인

**코드로 확인:**
```javascript
function checkProperties() {
  const properties = PropertiesService.getDocumentProperties();
  const allProperties = properties.getProperties();
  console.log(allProperties);
  // { SidebarAutoTrigger: "true", ownerOnlySidebar: "true" }
}
```

---

## 9. 참고 자료

### 📖 공식 문서

| 리소스 | URL |
|--------|-----|
| **Apps Script 공식 문서** | https://developers.google.com/apps-script |
| **SpreadsheetApp** | https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app |
| **HtmlService** | https://developers.google.com/apps-script/reference/html/html-service |
| **ScriptApp** | https://developers.google.com/apps-script/reference/script/script-app |
| **PropertiesService** | https://developers.google.com/apps-script/reference/properties/properties-service |
| **DriveApp** | https://developers.google.com/apps-script/reference/drive/drive-app |
| **Session** | https://developers.google.com/apps-script/reference/base/session |
| **Triggers** | https://developers.google.com/apps-script/guides/triggers |
| **Sidebar & Dialog** | https://developers.google.com/apps-script/guides/dialogs |

### 🔗 관련 프로젝트

- **user-permission**: Web App 방식의 CRM 시스템

### 📊 프로젝트 통계

| 항목 | 수치 |
|------|------|
| **총 파일 수** | 4개 |
| **JavaScript 파일** | 1개 (Code.js) |
| **HTML 파일** | 1개 (sidebar.html) |
| **총 코드 라인** | 127줄 |
| **함수 수** | 8개 |
| **사용된 GAS API** | 6개 |
| **외부 라이브러리** | 0개 (순수 GAS) |

---

## 🐛 트러블슈팅

### clasp clone 시 parentId 누락

**증상:**

이 프로젝트는 스프레드시트에 연결된 Container-bound script이지만, `clasp clone`으로 가져온 경우 `.clasp.json`에 `parentId` 필드가 없을 수 있습니다.

```json
// ❌ clasp clone 결과
{
  "scriptId": "1JkvfKWosiMTVEx_4uUZ0hlrPFrqrDU9v9qQXE6wcbX5i7D-osC6lR6Tv",
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
  "scriptId": "1JkvfKWosiMTVEx_4uUZ0hlrPFrqrDU9v9qQXE6wcbX5i7D-osC6lR6Tv",
  "rootDir": "",
  "parentId": "SPREADSHEET_ID_HERE"  // ✅ 스프레드시트 ID 추가
}
```

**스프레드시트 URL에서 ID 추출:**

```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
                                      ^^^^^^^^^^^^^^^^^^^
                                      이 부분이 parentId
```

**참고:** 루트 프로젝트 README.md의 트러블슈팅 섹션에 자세한 설명이 있습니다.

---

## 📝 마무리

이 프로젝트는 **Google Apps Script의 Container-bound Script 방식**을 활용한 간단하지만 실용적인 사이드바 시스템입니다.

**핵심 학습 포인트:**

1. **Simple Trigger vs Installable Trigger** 차이점
2. **PropertiesService**를 이용한 설정 관리
3. **권한 관리** (소유자 vs 공동 작업자)
4. **SpreadsheetApp.getUi()**를 이용한 UI 커스터마이징
5. **ScriptApp**을 이용한 트리거 동적 관리

**활용 가능한 시나리오:**

- 스프레드시트 열릴 때 자동으로 공지사항 표시
- 데이터 입력 가이드 사이드바
- 실시간 통계 대시보드
- 팀 협업 도구 (소유자 전용 관리 기능)

**확장 아이디어:**

- sidebar.html에 `google.script.run`으로 서버 함수 호출
- Chart.js 등 CDN 라이브러리 추가하여 시각화
- SpreadsheetApp으로 데이터 읽기/쓰기 기능 추가
- GmailApp으로 알림 이메일 발송

---

**작성일:** 2026-01-27
**프로젝트:** apps-script-clasp/projects/sidebar-ui
**GAS Runtime:** V8
**TimeZone:** Asia/Seoul
