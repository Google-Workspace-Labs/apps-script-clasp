# Apps Script Clasp

[![CI](https://github.com/YOUR_USERNAME/apps-script-clasp/actions/workflows/check.yml/badge.svg)](https://github.com/YOUR_USERNAME/apps-script-clasp/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

clasp을 활용한 Google Apps Script 모노레포

---

## ⚡ 빠른 시작

```bash
# 1. 초기화
git clone https://github.com/Google-Workspace-Labs/apps-script-clasp.git
cd apps-script-clasp
npm install
clasp login  # clasp 인증 (최초 1회)
```

> **Note:** `npm install` 실행 시 `prepare` 스크립트가 자동으로 Husky Git hooks를 설정합니다.

```bash
# 2. 새 프로젝트 생성
mkdir projects/my-app
cd projects/my-app
clasp create-script --type standalone --title "My App"

# 3. 코드 작성 & 배포
vim Code.js
clasp push
clasp open-script
```

---

## 📁 프로젝트 구조

```
root/
├── projects/              # Apps Script 프로젝트들
│   └── <project-name>/
│       ├── *.js
│       ├── appsscript.json
│       └── .clasp.json
├── docs/                  # 가이드 문서
└── package.json
```

---

## 🔧 주요 명령어

**루트:**
```bash
# 포맷팅
npm run format          # 모든 코드 자동 포맷팅
npm run format:check    # 포맷팅 검사만 (CI용)

# 린팅
npm run lint            # 린트 검사
npm run lint:fix        # 린트 문제 자동 수정
```

**개별 프로젝트:**
```bash
clasp push          # GAS 업로드
clasp open-script   # 에디터 열기
clasp deploy        # 웹앱 배포
```

---

## ⚠️ 주의사항

### TimeZone 필수 수정

`clasp create-script` 후 항상 확인:

```json
// appsscript.json
{
  "timeZone": "Asia/Seoul"  // 기본값 "America/New_York"에서 변경
}
```

### npm 패키지 사용 불가

Apps Script는 npm 패키지를 런타임에 사용할 수 없습니다.

**대안:**
- 순수 JavaScript 작성
- apps-script-library 사용
- Google API 활용

### IDE 자동완성 (중요!)

**`@types/google-apps-script`는 필수입니다:**

```json
// package.json
{
  "devDependencies": {
    "@types/google-apps-script": "^1.0.83"  // ✅ 반드시 필요
  }
}
```

**이유:**
- ✅ VS Code, WebStorm 등 IDE에서 Apps Script API 자동완성 제공
- ✅ `SpreadsheetApp`, `Logger`, `UrlFetchApp` 등 타입 정의
- ✅ 개발 생산성 향상 (API 문서 없이도 개발 가능)
- ⚠️ 런타임에는 사용되지 않음 (devDependencies)

**효과:**
```javascript
// @types/google-apps-script 있을 때
SpreadsheetApp.   // ← IDE가 자동완성 제공 (getActiveSheet, openById, etc.)

// @types/google-apps-script 없을 때
SpreadsheetApp.   // ← 아무것도 안 나옴
```

### Git 파일 관리 (중요!)

clasp 관련 파일은 Git 추적 여부가 다릅니다:

| 파일 | Git 추적 | 설명 | 이유 |
|------|---------|------|------|
| `.clasp.json` | ✅ **포함** | Script ID 저장 | 팀 협업 및 CI/CD 필수 |
| `.clasprc.json` | ❌ **제외** | 개인 OAuth 토큰 | 보안상 절대 공유 금지 |

**보안 주의:**
- `.clasprc.json`은 `.gitignore`에 포함되어 자동으로 제외됩니다
- 실수로 커밋하면 OAuth 토큰이 노출되므로 주의

**예시:**
```bash
# ✅ 올바른 파일 상태
git status
  modified:   projects/my-app/.clasp.json      # Script ID (추적 O)
  .clasprc.json                                # OAuth 토큰 (추적 X, 표시 안 됨)
```

---

## 🐛 트러블슈팅

### ESLint: `'functionName' is not defined`

**증상:**
```javascript
// Code.js
const config = getConfig();  // 'getConfig' is not defined.eslintno-undef
```

**원인:**

Apps Script에서는 모든 `.js` 파일이 글로벌 스코프로 병합되어 서로 함수를 호출할 수 있지만, ESLint는 각 파일을 독립적으로 분석하므로 다른 파일의 함수를 인식하지 못합니다.

**해결 방법:**

함수를 호출하는 파일 상단에 `/* global ... */` 주석을 추가합니다:

```javascript
/* global getConfig */

function sendSolapiSMS() {
  const config = getConfig();  // ✅ 경고 사라짐
  // ...
}
```

**여러 함수를 사용하는 경우:**
```javascript
/* global getConfig, processData, formatDate */

function myFunction() {
  const config = getConfig();
  const data = processData();
  const formatted = formatDate(new Date());
}
```

### clasp clone: Container-bound 스크립트의 parentId 누락

**증상:**

Container-bound 스크립트(스프레드시트, 문서 등에 연결된 스크립트)를 `clasp clone`으로 가져오면 `.clasp.json`에 `parentId` 필드가 없습니다.

```json
// ❌ clasp clone 결과
{
  "scriptId": "1UtNweLwFg5CD2bBdJuacBanEDc7o5UjQHkPr4riSh0efYr0Us-v5b9Za",
  "rootDir": ""
  // parentId 없음!
}
```

**원인:**

`clasp clone`은 스크립트 코드만 가져오며, **부모 컨테이너(스프레드시트, 문서 등) 정보는 가져오지 못합니다.** 이것은 clasp의 알려진 제약사항입니다.

**`parentId`가 있어야 하는 이유:**

- Container-bound 스크립트임을 명시적으로 표시
- CI/CD 파이프라인에서 컨테이너 정보 활용
- 프로젝트 구조 파악 용이

**해결 방법:**

1. **GAS 에디터에서 부모 컨테이너 ID 확인:**
   - 프로젝트 설정(⚙️) → "Container" 필드
   - 또는 스프레드시트 URL에서 ID 추출

2. **`.clasp.json`에 수동으로 추가:**

```json
{
  "scriptId": "1UtNweLwFg5CD2bBdJuacBanEDc7o5UjQHkPr4riSh0efYr0Us-v5b9Za",
  "rootDir": "",
  "parentId": "15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4"  // ✅ 추가
}
```

**스프레드시트 URL에서 ID 추출:**

```
https://docs.google.com/spreadsheets/d/15fqobxagJu70Ue37TJYyzielxPvD4j_Kuz_4UbPUjb4/edit
                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                      이 부분이 parentId
```

**비교: `clasp create`로 새로 만들 때는 자동 생성됨**

```bash
clasp create --type sheets --title "New Project"
# ✅ .clasp.json에 parentId 자동 포함
```

**Note:** Standalone 스크립트는 원래 `parentId`가 없는 것이 정상입니다.

---

## 🔗 참고

- [Apps Script 공식 문서](https://developers.google.com/apps-script)
- [clasp 공식 문서](https://github.com/google/clasp)
