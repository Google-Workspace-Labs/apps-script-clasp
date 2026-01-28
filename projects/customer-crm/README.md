# User Permission CRM System

Google Apps Script 기반 고객 관계 관리(CRM) 웹 애플리케이션

---

## 📚 목차

1. [CDN이란? (초보자용 설명)](#cdn이란-초보자용-설명)
2. [프로젝트 개요](#프로젝트-개요)
3. [아키텍처](#아키텍처)
4. [데이터 모델](#데이터-모델)
5. [인증 및 권한](#인증-및-권한)
6. [주요 기능](#주요-기능)
7. [GAS API 사용](#gas-api-사용)
8. [보안 이슈](#보안-이슈)
9. [파일 구조](#파일-구조)

---

## CDN이란? (초보자용 설명)

### 🤔 CDN (Content Delivery Network) 기본 개념

**CDN**은 "콘텐츠 전송 네트워크"로, 전 세계에 분산된 서버에서 파일을 제공하는 시스템입니다.

### 📦 일반적인 라이브러리 사용 방법 비교

#### 방법 1: 로컬 파일 다운로드 (전통적 방식)

```
프로젝트/
├── index.html
├── js/
│   ├── jquery.min.js         ← 다운로드해서 저장
│   ├── bootstrap.min.js      ← 다운로드해서 저장
│   └── chart.js              ← 다운로드해서 저장
└── css/
    └── bootstrap.min.css     ← 다운로드해서 저장
```

**HTML에서 사용:**
```html
<!-- 내 프로젝트 폴더 안의 파일 참조 -->
<script src="js/jquery.min.js"></script>
<script src="js/bootstrap.min.js"></script>
```

**장점:**
- 인터넷 없이 작동 (오프라인 개발 가능)
- 파일 버전 완전 제어

**단점:**
- 프로젝트 크기 증가 (파일 수십 개 포함)
- 업데이트 번거로움 (새 버전 나올 때마다 다시 다운로드)
- Git 저장소 크기 증가

---

#### 방법 2: CDN 링크 사용 (현대적 방식) ✅ **이 프로젝트 방식**

**HTML에서 사용:**
```html
<!-- 인터넷 상의 서버에서 직접 로드 -->
<script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
```

**장점:**
- ✅ 프로젝트 파일 크기 감소 (URL만 있으면 됨)
- ✅ 자동 업데이트 가능 (URL만 바꾸면 최신 버전)
- ✅ 빠른 로딩 (전 세계 CDN 서버 활용)
- ✅ 브라우저 캐싱 (여러 사이트에서 같은 파일 사용 시 재사용)

**단점:**
- 인터넷 연결 필수
- CDN 서버 장애 시 영향

---

### 🌐 CDN 동작 원리

```
사용자 브라우저가 HTML 읽음
  ↓
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script> 발견
  ↓
브라우저: "https://cdn.jsdelivr.net 서버야, chart.js 파일 줘!"
  ↓
CDN 서버: "여기 있어요!" (chart.js 파일 전송)
  ↓
브라우저: 파일 다운로드 완료 → 메모리에 로드
  ↓
이제 JavaScript에서 Chart.js 라이브러리 사용 가능
```

**실제 예시:**

```html
<!-- dashboard.html -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<script>
  // CDN에서 로드한 Chart.js 사용
  new Chart(document.getElementById('myChart'), {
    type: 'bar',
    data: { ... }
  });
</script>
```

---

### 🔍 이 프로젝트에서 사용하는 CDN

#### 1. Chart.js (차트 그리기)

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

**용도:** dashboard.html, userdashboard.html에서 막대 그래프, 파이 차트 표시

**CDN 제공자:** jsDelivr

---

#### 2. Quill.js (리치 텍스트 에디터)

```html
<link href="https://cdn.quilljs.com/1.3.7/quill.snow.css" rel="stylesheet">
<script src="https://cdn.quilljs.com/1.3.7/quill.min.js"></script>
```

**용도:** consumerfollowup.html에서 메시지 작성 (볼드, 이탤릭, 링크 등)

**CDN 제공자:** Quill 공식

---

#### 3. Cropper.js (이미지 크롭)

```html
<link href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.css" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.js"></script>
```

**용도:** consumerentry.html, consumerlist.html에서 이미지 업로드 전 자르기

**CDN 제공자:** Cloudflare (cdnjs)

---

#### 4. DataTables.js (고급 테이블)

```html
<link href="https://cdn.datatables.net/1.10.24/css/dataTables.bootstrap4.min.css" rel="stylesheet">
<script src="https://cdn.datatables.net/1.10.24/js/jquery.dataTables.min.js"></script>
<script src="https://cdn.datatables.net/1.10.24/js/dataTables.bootstrap4.min.js"></script>
```

**용도:** consumerlist.html, consumerfollowup.html에서 검색/정렬/페이징 가능한 테이블

**CDN 제공자:** DataTables 공식

---

#### 5. Toastr.js (알림 메시지)

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js"></script>
```

**용도:** 모든 페이지에서 성공/에러 메시지 표시 (우측 상단 팝업)

**CDN 제공자:** Cloudflare (cdnjs)

---

### 📊 왜 Google Apps Script에서는 CDN을 사용할까?

**Google Apps Script의 제약사항:**

1. **npm 패키지 설치 불가**
   ```bash
   # ❌ 이런 명령어가 안 됨
   npm install chart.js
   npm install jquery
   ```

2. **서버에 파일 업로드 제한**
   - GAS는 `.js`, `.html`, `.json` 파일만 업로드 가능
   - `node_modules/` 같은 디렉토리 구조 불가

3. **빌드 과정 없음**
   - Webpack, Rollup 같은 번들러 사용 불가
   - `import`/`require` 문법 사용 불가

**따라서 해결책: CDN 링크로 외부 라이브러리 로드** ✅

---

### 🎯 정리

| 항목 | 로컬 파일 | CDN 링크 (이 프로젝트) |
|------|-----------|------------------------|
| **파일 다운로드** | 필요 | 불필요 |
| **프로젝트 크기** | 큼 | 작음 |
| **인터넷 연결** | 불필요 | 필요 |
| **업데이트** | 수동 | URL만 변경 |
| **GAS 호환성** | ❌ 업로드 제한 | ✅ 완벽 호환 |

**결론:** Google Apps Script 프로젝트에서는 **CDN 링크 사용이 필수적이고 권장되는 방식**입니다.

---

## 프로젝트 개요

### 🎯 프로젝트 정체

완전한 **CRM(Customer Relationship Management) 시스템**을 Google Apps Script로 구현한 웹 애플리케이션입니다.

### 주요 기능

- 👤 사용자 인증 및 역할 기반 권한 관리
- 📊 관리자/사용자 대시보드 (차트 시각화)
- 👥 고객 정보 관리 (CRUD)
- 🖼️ 고객 이미지 업로드 (최대 3장, Google Drive 저장)
- 📞 고객 팔로업 기록 (전화/이메일)
- 📧 이메일 발송 (Gmail API 연동)
- 🔐 사용자 권한 관리 (페이지별 접근 제어)
- 🔑 비밀번호 변경

### 기술 스택

**백엔드:**
- Google Apps Script (JavaScript)
- Google Sheets (데이터베이스)
- Google Drive (이미지 저장소)
- Gmail API (이메일 발송)

**프론트엔드:**
- HTML5
- Bootstrap 5 (UI 프레임워크)
- jQuery 3.7
- Chart.js (차트)
- Quill.js (리치 텍스트 에디터)
- Cropper.js (이미지 크롭)
- DataTables.js (테이블)
- Toastr.js (알림)

---

## 아키텍처

### Web App 구조

```
Client (Browser)
  ↓ URL: https://script.google.com/.../exec?page=dashboard
  ↓
GAS Web App (doGet)
  ↓ HtmlService.createTemplateFromFile(page)
  ↓ Evaluate & return HTML
  ↓
Client renders page
  ↓ User action (button click, form submit)
  ↓ google.script.run.functionName(params)
  ↓
GAS Server Function (Maincode.js / Customer.js)
  ↓ SpreadsheetApp / DriveApp / GmailApp
  ↓ Return JSON data
  ↓
Client success handler
  ↓ Update DOM / show toast
```

### 라우팅 시스템

**doGet() 함수 (Maincode.js):**

```javascript
function doGet(e) {
  const page = e.parameter.page;  // URL 파라미터 읽기

  // 페이지 없으면 login으로 기본 설정
  let template = HtmlService.createTemplateFromFile(page || 'login');

  // 템플릿 변수 주입
  template.urllink = ScriptApp.getService().getUrl().replace('/dev', '/exec');
  template.currentpage = page || null;

  return template.evaluate()
    .setTitle(page || 'Login')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

**URL 예시:**
- `https://script.google.com/.../exec` → login.html
- `https://script.google.com/.../exec?page=dashboard` → dashboard.html
- `https://script.google.com/.../exec?page=consumerentry` → consumerentry.html

### HTML 템플릿 시스템

**모든 페이지 구조:**

```html
<?!= include('header'); ?>  <!-- 공통 헤더: 사이드바, CSS, JS -->

<!-- 페이지별 고유 컨텐츠 -->
<div class="container">
  <!-- ... -->
</div>

<?!= include('footer'); ?>  <!-- 공통 푸터: 권한 체크, 스크립트 -->
```

**include() 함수 (Maincode.js):**

```javascript
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

---

## 데이터 모델

### Google Sheets 구조

**활성 스프레드시트:** `.clasp.json`에 지정된 scriptId에 연결

#### Sheet 1: Users

| 컬럼 | 필드명 | 타입 | 설명 |
|------|--------|------|------|
| A | email | String | 사용자 이메일 (고유 키) |
| B | password | String | 비밀번호 (**평문 저장** ⚠️) |
| C | role | String | `"admin"` 또는 `"user"` |
| D | allowedPages | String | 쉼표로 구분된 페이지 목록 (예: `"dashboard,consumerentry,consumerlist"`) |
| E | name | String | 사용자 이름 |
| F | status | String | `"active"` 또는 `"inactive"` |

**예시 데이터:**

| email | password | role | allowedPages | name | status |
|-------|----------|------|--------------|------|--------|
| admin@gmail.com | 123 | admin | dashboard,consumerentry,consumerlist,... | Admin User | active |
| user@gmail.com | 456 | user | userdashboard,consumerentry | Normal User | active |

---

#### Sheet 2: ConsumerDetails

| 컬럼 | 필드명 | 타입 | 설명 |
|------|--------|------|------|
| A | name | String | 고객 이름 |
| B | address | String | 주소 |
| C | mobileno | String | 휴대폰 번호 |
| D | email | String | 이메일 |
| E | age | Number | 나이 |
| F | gender | String | 성별 (Male/Female/Transgender/Others) |
| G | userid | String | 등록한 사용자 이메일 |
| H | image1 | Formula | `=IMAGE("https://drive.google.com/...", 4, 200, 200)` |
| I | image2 | Formula | `=IMAGE("https://drive.google.com/...", 4, 200, 200)` |
| J | image3 | Formula | `=IMAGE("https://drive.google.com/...", 4, 200, 200)` |

**예시 데이터:**

| name | address | mobileno | email | age | gender | userid | image1 | image2 | image3 |
|------|---------|----------|-------|-----|--------|--------|--------|--------|--------|
| John Doe | Seoul | 01012345678 | john@example.com | 30 | Male | admin@gmail.com | =IMAGE("...", 4, 200, 200) | =IMAGE("...", 4, 200, 200) | |

---

#### Sheet 3: ConsumerFollowUp

| 컬럼 | 필드명 | 타입 | 설명 |
|------|--------|------|------|
| A | mobileno | String | 고객 휴대폰 번호 (조회 키) |
| B | email | String | 고객 이메일 (조회 키) |
| C | message | String | 발송/기록한 메시지 내용 |
| D | response | String | 고객 응답 (전화 통화 시) |
| E | date | Date | 기록 날짜/시간 |
| F | user | String | 기록한 사용자 이메일 |
| G | messagemode | String | `"email"` 또는 `"phone call"` |

**예시 데이터:**

| mobileno | email | message | response | date | user | messagemode |
|----------|-------|---------|----------|------|------|-------------|
| 01012345678 | john@example.com | "안녕하세요..." | "긍정적 반응" | 2025-01-27 14:30 | admin@gmail.com | phone call |
| 01012345678 | john@example.com | "프로모션..." | | 2025-01-28 09:00 | admin@gmail.com | email |

---

### 이미지 저장 구조 (Google Drive)

**폴더 구조:**

```
My Drive/
└── CustomerImageFolder/
    ├── consumer_john_1.jpg
    ├── consumer_john_2.jpg
    ├── consumer_jane_1.jpg
    └── ...
```

**PropertiesService 캐싱:**

```javascript
// 폴더 ID를 스크립트 속성에 저장
PropertiesService.getScriptProperties()
  .setProperty('CustomerImageFolder', 'folder_id_12345')
```

**이미지 URL 형식:**

```
https://drive.google.com/thumbnail?id={fileId}
```

**시트에 저장되는 수식:**

```
=IMAGE("https://drive.google.com/thumbnail?id=1ABC...", 4, 200, 200)
```

- 파라미터 `4`: 원본 크기 유지
- `200, 200`: 너비, 높이 제한

---

## 인증 및 권한

### 로그인 플로우

```
1. 사용자가 login.html에서 email + password 입력
   ↓
2. google.script.run.checkLogin(email, password)
   ↓
3. Server (Maincode.js):
   - Users 시트에서 email로 검색
   - password 비교 (평문)
   - status 확인 (active/inactive)
   ↓
4. 성공 시 반환:
   {
     success: true,
     role: "admin" or "user",
     username: "Admin User",
     emailid: "admin@gmail.com",
     status: "active",
     pages: ["dashboard", "consumerentry", ...]
   }
   ↓
5. Client (login.html):
   - localStorage에 저장:
     * userRole: "admin"
     * username: "Admin User"
     * userid: "admin@gmail.com"
     * userPages: JSON.stringify(pages)
   ↓
6. 리다이렉트:
   - admin → ?page=dashboard
   - user → ?page=userdashboard
```

### 권한 체크 (footer.html에서 실행)

**페이지 로드 시마다 실행:**

```javascript
document.addEventListener("DOMContentLoaded", function () {
  const userRole = localStorage.getItem("userRole");
  const userPages = JSON.parse(localStorage.getItem("userPages") || "[]");
  const currentPage = document.getElementById("currentpage").value;

  // 1. 로그인 여부 확인
  if (!userRole) {
    toastr.error("Unauthorized Access! Redirecting to Login...");
    window.location.replace(deployLink + "?page=login");
    return;
  }

  // 2. 페이지 접근 권한 확인
  if (!userPages.includes(currentPage)) {
    toastr.error("Access Denied! Redirecting to Dashboard...");
    window.location.replace(deployLink + "?page=dashboard");
    return;
  }

  // 3. 메인 컨텐츠 표시
  document.getElementById("maincontent").style.display = "block";

  // 4. 사이드바 메뉴 필터링 (권한 없는 페이지 숨김)
  document.querySelectorAll(".menu-item").forEach(function (item) {
    if (!userPages.includes(item.dataset.page)) {
      item.style.display = "none";
    }
  });
});
```

### 역할별 접근 권한

**Admin (관리자):**
- ✅ dashboard (전체 통계)
- ✅ consumerentry (고객 등록)
- ✅ consumerlist (고객 목록)
- ✅ consumerfollowup (팔로업 기록)
- ✅ userpermission (권한 관리)
- ✅ changepassword (비밀번호 변경)
- ✅ report (리포트)

**User (일반 사용자):**
- ✅ userdashboard (본인 통계)
- ✅ changepassword (비밀번호 변경)
- ⚠️ 기타 페이지는 Users 시트의 allowedPages에 따라 결정

**예시:**

```
email: user@gmail.com
allowedPages: "userdashboard,consumerentry,consumerfollowup"

→ 접근 가능: userdashboard, consumerentry, consumerfollowup, changepassword
→ 접근 불가: dashboard, consumerlist, userpermission, report
```

---

## 주요 기능

### 1. 로그인 (login.html)

**UI:**
- 이메일 입력
- 비밀번호 입력
- 로그인 버튼

**로직:**

```javascript
function submitLoginForm() {
  const email = document.getElementById('userid').value;
  const password = document.getElementById('password').value;

  google.script.run
    .withSuccessHandler(function(response) {
      if (response.success && response.status === 'active') {
        // localStorage 저장
        localStorage.setItem('userRole', response.role);
        localStorage.setItem('username', response.username);
        localStorage.setItem('userid', response.emailid);
        localStorage.setItem('userPages', JSON.stringify(response.pages));

        // 리다이렉트
        if (response.role === 'admin') {
          redirectpage('dashboard');
        } else {
          redirectpage('userdashboard');
        }
      } else if (response.success && response.status === 'inactive') {
        toastr.error('User verified but User is Inactive. Please contact Admin.');
      } else {
        toastr.error(response.message);
      }
    })
    .checkLogin(email, password);
}
```

---

### 2. 대시보드 (dashboard.html - Admin)

**UI:**
- 4개 차트:
  1. Messages by User (막대 그래프)
  2. Follow-Up Statistics (Day Wise) (막대 그래프)
  3. Total Consumers (숫자)
  4. Message Sent Modes (파이 차트)

**데이터 로드:**

```javascript
google.script.run
  .withSuccessHandler(renderDashboard)
  .getDashboardData();
```

**서버 함수 (Customer.js):**

```javascript
function getDashboardData() {
  const consumerSheet = ss.getSheetByName('ConsumerDetails');
  const followUpSheet = ss.getSheetByName('ConsumerFollowUp');

  // 전체 고객 데이터
  const consumerData = consumerSheet.getDataRange().getValues().slice(1);

  // 팔로업 통계 집계
  const followUps = followUpSheet.getDataRange().getValues().slice(1);

  return {
    consumers: consumerData.map(...),
    totalConsumers: consumerData.length,
    followUpStats: { labels: [...], data: [...] },
    messageModes: { labels: [...], data: [...] },
    messageCounts: { labels: [...], data: [...] }
  };
}
```

---

### 3. 사용자 대시보드 (userdashboard.html - User)

**UI:**
- 3개 차트:
  1. My Follow-Up Statistics (Day Wise) (막대 그래프)
  2. My Message Sent Modes (파이 차트)
  3. Total Messages Sent (숫자)

**데이터 로드:**

```javascript
const userId = localStorage.getItem('userid');

google.script.run
  .withSuccessHandler(renderUserDashboard)
  .getUserDashboardData(userId);
```

**서버 함수 (Customer.js):**

```javascript
function getUserDashboardData(userId) {
  const followUpSheet = ss.getSheetByName('ConsumerFollowUp');
  const followUps = followUpSheet.getDataRange().getValues().slice(1);

  // 본인 데이터만 필터링
  const userFollowUps = followUps.filter(row => row[5] === userId);

  return {
    followUpStats: { labels: [...], data: [...] },
    messageModes: { labels: [...], data: [...] },
    totalMessages: userFollowUps.length
  };
}
```

---

### 4. 고객 등록 (consumerentry.html)

**UI:**
- 폼 입력: name, address, mobile, email, age, gender
- 이미지 업로드 (최대 3장)
- Cropper.js로 이미지 크롭
- Submit 버튼

**이미지 업로드 플로우:**

```
1. 사용자가 파일 선택
   ↓
2. FileReader로 이미지 읽기 → Base64 인코딩
   ↓
3. Cropper.js 모달 열림
   ↓
4. 사용자가 자르기/회전
   ↓
5. Crop 완료 → Base64 데이터 저장
   ↓
6. Submit 클릭
   ↓
7. google.script.run.submitForm({
     name: "...",
     images: [base64_1, base64_2, base64_3],
     ...
   })
   ↓
8. Server:
   - 각 이미지를 uploadFile(base64, filename)로 Drive 업로드
   - ConsumerDetails 시트에 행 추가
   - H, I, J 열에 IMAGE() 수식 삽입
```

**서버 함수 (Customer.js):**

```javascript
function uploadFile(base64Data, fileName) {
  // Base64 디코드
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    'image/jpeg',
    fileName
  );

  // Drive 폴더에 업로드
  const folder = getOrCreateFolder('CustomerImageFolder');
  const file = folder.createFile(blob);

  // 공유 설정
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Thumbnail URL 반환
  return `https://drive.google.com/thumbnail?id=${file.getId()}`;
}
```

---

### 5. 고객 목록 (consumerlist.html)

**UI:**
- DataTables.js 테이블 (검색, 정렬, 페이징)
- 각 행에 Edit, Delete 버튼
- 이미지 슬라이드쇼 (3초 자동 넘김)

**Edit 플로우:**

```
1. Edit 버튼 클릭
   ↓
2. google.script.run.getConsumerRecord(rowIndex)
   ↓
3. 모달에 데이터 채우기
   ↓
4. 이미지 변경 가능 (새 이미지 크롭)
   ↓
5. Update 클릭
   ↓
6. google.script.run.submitForm({
     rowIndex: rowIndex,
     oldImages: [old_url_1, old_url_2],
     images: [new_url_1, new_url_2],
     ...
   })
   ↓
7. Server:
   - deleteImages(oldImages) → Drive에서 삭제
   - 행 데이터 업데이트
   - 새 이미지 수식 삽입
```

**Delete 플로우:**

```
1. Delete 버튼 클릭
   ↓
2. 확인 메시지
   ↓
3. google.script.run.submitForm({
     rowIndex: rowIndex + "del",  // "5del" 형식
     oldImages: [...]
   })
   ↓
4. Server:
   - rowIndex.includes('del') 체크
   - deleteImages(oldImages)
   - reportSheet.deleteRow(rowIndex + 1)
```

---

### 6. 고객 팔로업 (consumerfollowup.html)

**UI:**
- 고객 목록 테이블
- 각 행에 "Follow-ups" 버튼
- 모달:
  - 탭 1: Phone Call (전화 통화)
  - 탭 2: Email
- Quill.js 에디터 (메시지 작성)
- 이전 팔로업 기록 표시

**Phone Call 탭:**

```
1. Message 입력 (Quill.js)
2. Response 입력 (textarea)
3. Save 클릭
   ↓
4. google.script.run.saveMessage(
     mobileNo, messageContent, "phone call", response, userId, email
   )
   ↓
5. Server:
   - ConsumerFollowUp 시트에 행 추가
```

**Email 탭:**

```
1. Message 입력 (Quill.js)
2. Send Email 클릭
   ↓
3. google.script.run.sendEmail(
     email, messageContent, "email", userId, mobileNo
   )
   ↓
4. Server:
   - GmailApp.sendEmail() 발송
   - ConsumerFollowUp 시트에 행 추가
```

**서버 함수 (Customer.js):**

```javascript
function sendEmail(email, messageContent, messagemode, user, mobileNo) {
  // Gmail로 이메일 발송
  GmailApp.sendEmail(email, 'Follow-Up Message', '', {
    htmlBody: messageContent
  });

  // 팔로업 기록
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('ConsumerFollowUp');
  sheet.appendRow([mobileNo, email, messageContent, '', new Date(), user, messagemode]);

  return 'Email sent';
}
```

---

### 7. 권한 관리 (userpermission.html - Admin only)

**UI:**
- 사용자 선택 (드롭다운)
- User Name 입력
- Status 토글 (Active/Inactive)
- 페이지 접근 권한 체크박스 (9개)

**권한 업데이트:**

```javascript
function updateUser() {
  const email = document.getElementById('userSelect').value;
  const name = document.getElementById('userName').value;
  const status = document.getElementById('statusToggle').checked ? 'active' : 'inactive';

  // 체크박스에서 선택된 페이지들 수집
  const allowedPages = [];
  document.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
    allowedPages.push(cb.value);
  });

  google.script.run
    .withSuccessHandler(function(result) {
      toastr.success(result.message);
    })
    .updateUserDetails(email, allowedPages.join(','), name, status);
}
```

**서버 함수 (Maincode.js):**

```javascript
function updateUserDetails(email, allowedPages, name, status) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      sheet.getRange(i + 1, 4).setValue(allowedPages);  // Column D
      sheet.getRange(i + 1, 5).setValue(name);          // Column E
      sheet.getRange(i + 1, 6).setValue(status);        // Column F
      return { message: 'User details updated successfully!' };
    }
  }

  return { message: 'User not found!' };
}
```

---

### 8. 비밀번호 변경 (changepassword.html)

**UI:**
- Current Password 입력
- New Password 입력
- Confirm New Password 입력
- Change Password 버튼

**로직:**

```javascript
function changePassword() {
  const email = localStorage.getItem('userid');
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // 클라이언트 검증
  if (newPassword !== confirmPassword) {
    toastr.error('New passwords do not match!');
    return;
  }

  google.script.run
    .withSuccessHandler(function(result) {
      if (result.success) {
        toastr.success(result.message);
        // 폼 초기화
      } else {
        toastr.error(result.message);
      }
    })
    .changeUserPassword(email, currentPassword, newPassword);
}
```

**서버 함수 (Maincode.js):**

```javascript
function changeUserPassword(email, currentPassword, newPassword) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const [userEmail, userPassword] = data[i];

    if (userEmail === email) {
      // 현재 비밀번호 확인
      if (String(userPassword) !== currentPassword) {
        return { success: false, message: 'Incorrect current password!' };
      }

      // 비밀번호 업데이트
      sheet.getRange(i + 1, 2).setValue(newPassword);
      return { success: true, message: 'Password changed successfully!' };
    }
  }

  return { success: false, message: 'User not found!' };
}
```

---

## GAS API 사용

### SpreadsheetApp (시트 읽기/쓰기)

**사용처:** 모든 데이터 CRUD

```javascript
// 시트 가져오기
const sheet = SpreadsheetApp.getActiveSpreadsheet()
  .getSheetByName('Users');

// 전체 데이터 읽기
const data = sheet.getDataRange().getValues();
// → 2차원 배열 반환: [[row1], [row2], ...]

// 특정 셀 쓰기
sheet.getRange(rowIndex + 1, columnIndex).setValue(value);

// 행 추가
sheet.appendRow([value1, value2, value3]);

// 행 삭제
sheet.deleteRow(rowIndex + 1);

// 수식 설정
sheet.getRange(rowIndex, columnIndex)
  .setFormula('=IMAGE("https://...", 4, 200, 200)');
```

---

### DriveApp (파일/폴더 관리)

**사용처:** 이미지 업로드 및 관리

```javascript
// 루트 폴더
const rootFolder = DriveApp.getRootFolder();

// 폴더 검색
const folders = rootFolder.getFoldersByName('CustomerImageFolder');
if (folders.hasNext()) {
  const folder = folders.next();
}

// 폴더 생성
const newFolder = rootFolder.createFolder('CustomerImageFolder');

// 파일 업로드
const blob = Utilities.newBlob(data, 'image/jpeg', 'filename.jpg');
const file = folder.createFile(blob);

// 파일 공유 설정
file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

// 파일 ID
const fileId = file.getId();

// 파일 삭제 (휴지통으로)
const file = DriveApp.getFileById(fileId);
file.setTrashed(true);
```

---

### GmailApp (이메일 발송)

**사용처:** 고객 팔로업 이메일

```javascript
// HTML 이메일 발송
GmailApp.sendEmail(
  'customer@example.com',  // 받는 사람
  'Follow-Up Message',     // 제목
  '',                      // 텍스트 본문 (비움)
  {
    htmlBody: messageContent  // HTML 본문
  }
);
```

---

### HtmlService (HTML 템플릿)

**사용처:** doGet() 라우팅, include() 함수

```javascript
// 템플릿 생성
const template = HtmlService.createTemplateFromFile('dashboard');

// 템플릿 변수 주입
template.urllink = 'https://...';
template.currentpage = 'dashboard';

// HTML 평가 및 반환
return template.evaluate()
  .setTitle('Dashboard')
  .addMetaTag('viewport', 'width=device-width, initial-scale=1')
  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

// 파일 내용 가져오기 (include용)
const content = HtmlService.createHtmlOutputFromFile('header').getContent();
```

---

### UrlFetchApp (HTTP 요청)

**사용처:** Drive 이미지 다운로드

```javascript
// URL에서 파일 다운로드
const response = UrlFetchApp.fetch('https://drive.google.com/thumbnail?id=...');
const blob = response.getBlob();
```

---

### Utilities (유틸리티 함수)

**사용처:** Base64 인코딩/디코딩, 날짜 포맷팅

```javascript
// Base64 디코딩
const decodedData = Utilities.base64Decode(base64String);

// Base64 인코딩
const base64String = Utilities.base64Encode(bytes);

// Blob 생성
const blob = Utilities.newBlob(data, 'image/jpeg', 'filename.jpg');

// 날짜 포맷팅
const formattedDate = Utilities.formatDate(
  new Date(),
  Session.getScriptTimeZone(),
  'yyyy-MM-dd HH:mm:ss'
);
```

---

### PropertiesService (키-값 저장소)

**사용처:** 폴더 ID 캐싱

```javascript
// 스크립트 속성 가져오기
const properties = PropertiesService.getScriptProperties();

// 값 저장
properties.setProperty('CustomerImageFolder', 'folder_id_12345');

// 값 읽기
const folderId = properties.getProperty('CustomerImageFolder');
```

---

### ScriptApp (스크립트 정보)

**사용처:** 배포 URL 가져오기

```javascript
// 웹 앱 URL
const url = ScriptApp.getService().getUrl();
// → https://script.google.com/.../dev

// 프로덕션 URL로 변환
const execUrl = url.replace('/dev', '/exec');
// → https://script.google.com/.../exec
```

---

## 보안 이슈

### 🔴 치명적 (Critical)

#### 1. 평문 비밀번호 저장

**현재 상태:**

```javascript
// Users 시트
| email | password | role |
|-------|----------|------|
| admin@gmail.com | 123 | admin |  // ← 평문!
```

**위험:**
- 시트 접근 권한이 있는 모든 사용자가 비밀번호 확인 가능
- 스크립트 소유자(개발자)가 모든 비밀번호 확인 가능
- 데이터 유출 시 즉시 악용 가능

**권장 해결책:**

```javascript
// 비밀번호 해싱 (SHA-256)
function hashPassword(password) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(digest);
}

// 로그인 시
function checkLogin(email, password) {
  const passwordHash = hashPassword(password);
  // passwordHash와 시트의 해시 비교
}
```

---

### 🟡 중간 (Medium)

#### 2. localStorage에 민감 정보 저장

**현재 상태:**

```javascript
localStorage.setItem('userRole', 'admin');
localStorage.setItem('userid', 'admin@gmail.com');
localStorage.setItem('userPages', JSON.stringify(pages));
```

**위험:**
- XSS 공격 시 localStorage 내용 탈취 가능
- 브라우저 개발자 도구에서 수정 가능 (권한 우회 시도)

**완화:**
- 민감한 작업은 서버에서 권한 재확인 필요
- 현재는 페이지 로드 시 권한 체크만 수행 (클라이언트 측)

---

#### 3. CSRF 보호 없음

**현재 상태:**

```javascript
google.script.run.updateUserDetails(email, allowedPages, name, status);
// CSRF 토큰 없음
```

**위험:**
- 악성 사이트에서 사용자가 로그인한 상태를 악용 가능

**완화:**
- GAS는 `google.script.run`을 통한 호출만 허용
- 외부 사이트에서 직접 호출 불가 (Same-Origin Policy)

---

#### 4. 로그인 시도 제한 없음

**현재 상태:**

```javascript
// 무제한 로그인 시도 가능
function checkLogin(email, password) {
  // 실패 카운트 없음
}
```

**위험:**
- 브루트 포스 공격 가능

**권장 해결책:**
- PropertiesService에 실패 카운트 저장
- 5회 실패 시 5분간 로그인 차단

---

### 🟢 경고 (Low)

#### 5. 이미지 공유 설정

**현재 상태:**

```javascript
file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
// URL만 알면 누구나 접근 가능
```

**위험:**
- URL이 노출되면 외부인도 이미지 조회 가능

**완화:**
- 고객 이미지는 일반적으로 공개 정보
- 민감한 이미지는 다른 방식 사용 필요

---

## 파일 구조

```
projects/user-permission/
├── .clasp.json                 # clasp 설정 (Script ID)
├── appsscript.json             # GAS 설정 (TimeZone, Runtime, WebApp)
│
├── Maincode.js                 # 서버: 인증, 라우팅, 사용자 관리 (7 함수)
│   ├── doGet()                 # 라우팅
│   ├── checkLogin()            # 로그인 검증
│   ├── include()               # HTML 템플릿 include
│   ├── getUsers()              # 사용자 목록
│   ├── updateUserDetails()     # 사용자 정보 업데이트
│   ├── getUserByEmail()        # 사용자 조회
│   └── changeUserPassword()    # 비밀번호 변경
│
├── Customer.js                 # 서버: 고객 관리, 이미지, 대시보드 (18 함수)
│   ├── getDashboardData()      # 관리자 대시보드 데이터
│   ├── getUserDashboardData()  # 사용자 대시보드 데이터
│   ├── uploadFile()            # 이미지 업로드 (Drive)
│   ├── getOrCreateFolder()     # 폴더 생성/조회
│   ├── submitForm()            # 고객 CRUD
│   ├── deleteImages()          # 이미지 삭제
│   ├── getConsumerData()       # 고객 목록
│   ├── getConsumerRecord()     # 고객 단건 조회
│   ├── extractImageUrl()       # IMAGE 수식에서 URL 추출
│   ├── extractAllImageUrls()   # 3개 이미지 URL 추출
│   ├── imageBase64Urls()       # Drive URL → Base64 변환
│   ├── getFollowUps()          # 팔로업 기록 조회
│   ├── formatDate()            # 날짜 포맷팅
│   ├── sendEmail()             # 이메일 발송 (Gmail)
│   └── saveMessage()           # 팔로업 기록 저장
│
├── header.html                 # 공통 헤더 (사이드바, 로고, CSS/JS)
├── footer.html                 # 공통 푸터 (권한 체크, 스크립트)
│
├── login.html                  # 로그인 페이지
├── dashboard.html              # 관리자 대시보드
├── userdashboard.html          # 사용자 대시보드
├── consumerentry.html          # 고객 등록
├── consumerlist.html           # 고객 목록/수정/삭제
├── consumerfollowup.html       # 고객 팔로업 기록
├── userpermission.html         # 사용자 권한 관리
└── changepassword.html         # 비밀번호 변경

총 14개 파일
- JavaScript: 2개 (서버)
- HTML: 10개 (클라이언트)
- JSON: 2개 (설정)
```

---

## 배포 정보

**Web App 설정 (appsscript.json):**

```json
{
  "timeZone": "Asia/Seoul",
  "webapp": {
    "executeAs": "USER_DEPLOYING",       // 스크립트 소유자 권한으로 실행
    "access": "ANYONE_ANONYMOUS"         // 인증 없이 접근 가능
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

**배포 명령어:**

```bash
# 코드 업로드
clasp push

# 재배포 (기존 URL 유지)
clasp deploy --deploymentId <ID> -d "Update description"

# 배포 목록 확인
clasp deployments
```

**웹 앱 URL 형식:**

```
https://script.google.com/macros/s/{deploymentId}/exec?page=dashboard
```

---

## 통계

| 항목 | 수치 |
|------|------|
| **JavaScript 파일** | 2개 (Maincode.js, Customer.js) |
| **HTML 파일** | 10개 (8 페이지 + header + footer) |
| **서버 함수** | 25개 (Maincode 7 + Customer 18) |
| **데이터 시트** | 3개 (Users, ConsumerDetails, ConsumerFollowUp) |
| **사용자 역할** | 2개 (admin, user) |
| **최대 이미지** | 고객당 3장 |
| **총 코드 라인** | ~1,200줄 (JS + HTML) |
| **GAS API** | 8개 (SpreadsheetApp, DriveApp, GmailApp, 등) |
| **CDN 라이브러리** | 7개 (Bootstrap, jQuery, Chart.js, 등) |

---

## 개발 워크플로우

### 로컬 개발

```bash
# 1. 코드 수정
vim Maincode.js

# 2. GAS 서버로 업로드
clasp push

# 3. 에디터에서 테스트
clasp open-script

# 4. 웹 앱에서 테스트
# https://script.google.com/.../dev?page=dashboard
```

### 프로덕션 배포

```bash
# 1. Git 커밋
git add .
git commit -m "feat: Add new feature"

# 2. GAS 업로드
clasp push

# 3. 재배포 (URL 유지)
clasp deploy --deploymentId <ID> -d "Production update"

# 4. 웹 앱 확인
# https://script.google.com/.../exec?page=dashboard
```

### 코드 품질

```bash
# Prettier 포맷팅 (JavaScript만)
npm run format

# ESLint 검사
npm run lint

# Git commit (자동으로 lint-staged 실행)
git commit
```

---

## 참고 자료

- [Google Apps Script 공식 문서](https://developers.google.com/apps-script)
- [clasp CLI 가이드](https://github.com/google/clasp)
- [SpreadsheetApp Reference](https://developers.google.com/apps-script/reference/spreadsheet)
- [DriveApp Reference](https://developers.google.com/apps-script/reference/drive)
- [HtmlService Reference](https://developers.google.com/apps-script/reference/html)

---

## 라이선스

MIT License

---

## 작성자

프로젝트 분석: Claude Code (Anthropic)
작성일: 2025-01-27
