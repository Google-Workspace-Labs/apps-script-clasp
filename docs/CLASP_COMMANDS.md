# clasp 명령어 완전 가이드

## 🎯 개요

이 문서는 clasp(Command Line Apps Script Projects) CLI의 모든 명령어를 상세히 설명합니다.

**중요 개념:**
- **Git 버전 ≠ GAS 스크립트 버전** (완전히 별개)
- **@HEAD = 현재 최신 코드** (테스트용)
- **Versioned Deployment = 프로덕션 배포** (특정 버전 고정)

> 💡 **Tip:** 모든 명령어 목록은 `clasp --help`로 확인할 수 있습니다.

---

## 📚 목차

1. [프로젝트 관리](#프로젝트-관리)
2. [코드 동기화](#코드-동기화)
3. [배포 관리](#배포-관리)
4. [버전 관리](#버전-관리)
5. [실행 및 로그](#실행-및-로그)

---

## 프로젝트 관리

### `clasp create-script` (구 `clasp create`)

**용도:** 새로운 Apps Script 프로젝트 생성

> ⚠️ **Note:** clasp 3.x부터 `clasp create`는 `clasp create-script`로 변경되었습니다.

**문법:**
```bash
clasp create-script [--type <type>] [--title <title>] [--rootDir <dir>]
```

**옵션:**
- `--type <type>` - 프로젝트 타입
  - `standalone` - 독립 실행형 (기본값)
  - `sheets` - Google Sheets 바인딩
  - `docs` - Google Docs 바인딩
  - `slides` - Google Slides 바인딩
  - `forms` - Google Forms 바인딩
- `--title <title>` - 프로젝트 이름
- `--rootDir <dir>` - 로컬 프로젝트 루트 디렉토리

**실행 결과:**
- `.clasp.json` 생성 (scriptId 포함)
- `appsscript.json` 생성
- GAS 서버에 프로젝트 생성

**예시:**
```bash
clasp create-script --type standalone --title "My Web App"
```

**주의사항:**
- `appsscript.json`의 `timeZone`이 항상 `"America/New_York"`로 생성됨
- 생성 후 `"Asia/Seoul"`로 수동 변경 필요

---

### `clasp clone-script` (구 `clasp clone`)

**용도:** 기존 Apps Script 프로젝트를 로컬로 복제

> ⚠️ **Note:** clasp 3.x부터 `clasp clone`은 `clasp clone-script`로 변경되었습니다.

**문법:**
```bash
clasp clone-script <scriptId> [--versionNumber <number>]
```

**옵션:**
- `<scriptId>` - GAS 프로젝트 ID (필수)
- `--versionNumber <number>` - 특정 GAS 스크립트 버전 복제

**예시:**
```bash
clasp clone-script 1B7YtHqSyS9Wq1H_hQ_r5x0fP4g3DcV4aBcDeFgH1234
```

**⚠️ 위험: 기존 파일 덮어쓰기**

`.clasp.json` 존재 여부에 따라 동작이 다릅니다:

| 상황 | 동작 | 결과 |
|------|------|------|
| `.clasp.json` 있음 | ❌ 에러: "Project file already exists" | 안전 (클론 안 됨) |
| `.clasp.json` 없음 | ✅ 클론 성공 | ⚠️ **기존 파일 경고 없이 덮어씀!** |

**위험 시나리오:**
```bash
# 로컬에 수정 사항이 있는 상태
projects/my-app/
├── Code.js (로컬 수정 있음)
├── index.html (로컬 수정 있음)
└── (no .clasp.json)

# .clasp.json 없이 clone 실행
clasp clone-script <scriptId>

# ❌ 결과: 로컬 수정 사항 손실!
# → GAS 서버 버전으로 덮어씌워짐
```

**안전한 클론 방법:**
```bash
# 방법 1: Git 커밋 후 클론
git status  # 수정 사항 확인
git add .
git commit -m "Before clone"
rm .clasp.json
clasp clone-script <scriptId>

# 방법 2: 백업 후 클론
cp Code.js Code.js.backup
rm .clasp.json
clasp clone-script <scriptId>
git diff  # 변경사항 확인
```

**체크리스트:**
- [ ] Git commit으로 현재 상태 저장
- [ ] 로컬 수정 사항 확인
- [ ] `.clasp.json`만 삭제 (다른 파일 유지)
- [ ] 클론 후 `git diff`로 변경사항 확인

---

### `clasp open-script` (구 `clasp open`)

**용도:** GAS 에디터를 브라우저에서 열기

> ⚠️ **Note:** clasp 3.x부터 `clasp open`은 `clasp open-script`로 변경되었습니다.

**문법:**
```bash
clasp open-script
```

**예시:**
```bash
clasp open-script    # GAS 에디터 열기
```

---

### `clasp open-web-app` (구 `clasp open --webapp`)

**용도:** 배포된 Web App URL을 브라우저에서 열기

> ⚠️ **Note:** clasp 3.x부터 `clasp open --webapp`은 별도 명령어 `clasp open-web-app`으로 분리되었습니다.

**문법:**
```bash
clasp open-web-app [--deploymentId <id>]
```

**옵션:**
- `--deploymentId <id>` - 특정 deployment URL 열기

**요구사항:**
- `doGet()` 또는 `doPost()` 함수 필요
- Versioned deployment 필요 (@HEAD는 불가)

**예시:**
```bash
# 최신 Web App 열기
clasp open-web-app

# 특정 deployment 열기
clasp open-web-app --deploymentId AKfycbzTFkh...
```

**에러 케이스:**
```bash
No web app entry point found. Please make sure you deployed the web app.
```

**원인:**
1. `doGet()` / `doPost()` 함수 없음
2. Versioned deployment 없음 (HEAD만 존재)
3. Web App으로 배포 안 됨

---

### `clasp open-container` (구 `clasp open --addon`)

**용도:** Container(Sheets, Docs 등)를 브라우저에서 열기

> ⚠️ **Note:** clasp 3.x부터 `clasp open --addon`은 `clasp open-container`로 변경되었습니다.

**문법:**
```bash
clasp open-container
```

**용도:**
- Container-bound 스크립트의 부모 파일 열기
- Sheets, Docs, Slides, Forms 등

**예시:**
```bash
clasp open-container    # Sheets/Docs 등 열기
```

---

## 코드 동기화

### `clasp push`

**용도:** 로컬 코드를 GAS 서버로 업로드

**문법:**
```bash
clasp push [--watch] [--force]
```

**옵션:**
- `--watch` - 파일 변경 감지 시 자동 push
- `--force` - 충돌 무시하고 강제 push

**동작:**
- 로컬 파일 → GAS `@HEAD`로 업로드
- `.claspignore` 패턴 적용
- Versioned deployment는 영향 없음 (별도 deploy 필요)

**예시:**
```bash
clasp push              # 한 번 업로드
clasp push --watch      # 변경 감지 자동 업로드
```

**주의사항:**
- `push`만으로는 배포 안 됨 (테스트용 @HEAD만 업데이트)
- 웹 앱 URL 변경 없음
- 프로덕션 반영하려면 `clasp deploy` 필요

**워크플로우:**
```
로컬 코드 수정
  ↓
clasp push (→ @HEAD 업데이트)
  ↓
clasp open-script (→ 에디터에서 테스트)
  ↓
clasp deploy (→ 프로덕션 반영)
```

---

### `clasp pull`

**용도:** GAS 서버 코드를 로컬로 다운로드

**문법:**
```bash
clasp pull [--versionNumber <number>] [--deleteUnusedFiles] [--force]
```

**옵션:**

#### `--versionNumber <number>`
**GAS 스크립트 버전을 지정하여 다운로드**

```bash
clasp pull --versionNumber 20
```

**중요:**
- 이 버전은 **Git 버전이 아님!**
- **GAS 내부 스냅샷 버전** (clasp versions로 확인)
- 용도: 과거 상태 복구, 디버깅, 포렌식

**GAS 스크립트 버전이란?**
- GAS 서버에만 존재하는 immutable snapshot
- `clasp deploy` 실행 시 자동 생성
- 또는 GAS UI에서 "새 버전 저장" 시 생성
- 번호: 1, 2, 3, 4... (순차 증가)

**확인 방법:**
```bash
clasp list-versions
# 출력:
# 1  - Initial version
# 2  - Fix auth bug
# 3  - Add logging
# 20 - CI deploy
```

**Git vs GAS Version 비교:**

| 항목 | Git | GAS Script Version |
|------|-----|-------------------|
| 저장 위치 | GitHub/Git | GAS 서버 |
| 생성 시점 | git commit | clasp deploy 또는 UI |
| 식별자 | hash (a1b2c3d) | 숫자 (1,2,3...) |
| clasp pull 기본 | ❌ 무관 | ✅ @HEAD (최신) |
| 연동 | ❌ 없음 | ❌ 없음 |

**실무 사용:**
```bash
# 일반 개발: 최신 상태 가져오기
clasp pull

# 디버깅: 과거 배포 버전 확인
clasp pull --versionNumber 20

# 롤백 조사: 특정 시점 코드 확인
clasp list-versions  # 버전 목록 확인
clasp pull --versionNumber 15  # 15번 버전 다운로드
```

**⚠️ 주의사항:**
- CI/CD에서는 거의 사용 안 함
- Git이 진실의 원천이므로 pull은 최소화
- 과거 버전 pull 시 Git과 불일치 발생 가능

---

#### `--deleteUnusedFiles`
**GAS에 없는 로컬 파일 삭제**

```bash
clasp pull --deleteUnusedFiles
```

- 기본: 로컬 파일 유지
- 이 옵션: GAS와 완전 동기화 (로컬 추가 파일 삭제)
- 프롬프트로 확인 요청

---

#### `--force`
**파일 삭제 프롬프트 자동 확인**

```bash
clasp pull --deleteUnusedFiles --force
```

- `--deleteUnusedFiles`와 함께 사용
- 확인 없이 바로 삭제

---

**동작:**
- GAS `@HEAD` → 로컬로 다운로드
- 기본적으로 덮어쓰기

**예시:**
```bash
clasp pull                              # 최신 코드 가져오기
clasp pull --versionNumber 20           # 20번 스크립트 버전 가져오기
clasp pull --deleteUnusedFiles          # GAS와 완전 동기화
clasp pull --deleteUnusedFiles --force  # 자동 확인
```

**⚠️ 위험:**
- 로컬 변경사항 덮어씌워짐
- Git 커밋되지 않은 작업 손실 가능
- **권장: Git 커밋 후 pull**

**사용 시점:**
1. **최초 배포 후 webapp 설정 가져오기**
   ```bash
   clasp push
   clasp open-script  # GUI에서 Web App 배포
   clasp pull  # webapp 설정 가져오기
   git add appsscript.json
   git commit -m "chore: Add webapp config"
   ```

2. **GAS UI에서 직접 수정한 경우** (비권장)
   ```bash
   clasp pull
   git diff  # 변경사항 확인
   git add .
   git commit -m "sync: Pull from GAS"
   ```

3. **타 개발자가 GAS에서 작업한 경우** (비권장)

---


### `clasp show-file-status` (구 `clasp status`)

**용도:** 로컬과 GAS 서버 간 차이 확인

> ⚠️ **Note:** clasp 3.x부터 `clasp status`는 `clasp show-file-status`로 변경되었습니다.

**문법:**
```bash
clasp show-file-status [--json]
```

**출력:**
- 수정된 파일 목록
- 추가/삭제된 파일

**예시:**
```bash
clasp show-file-status
# Not ignored files:
#  └─ Code.js
#  └─ appsscript.json
```

---

## 배포 관리

### `clasp deploy`

**용도:** 코드를 프로덕션으로 배포

**문법:**
```bash
clasp deploy [--deploymentId <id>] [--description <desc>] [-V <version>]
```

**옵션:**
- `--deploymentId <id>` - 기존 deployment 재배포 (URL 유지)
- `-d, --description <desc>` - 배포 설명
- `-V, --versionNumber <version>` - 특정 GAS 스크립트 버전 배포 (롤백용)

**동작:**

#### Case A: 신규 배포 (최초)
```bash
clasp deploy -d "Initial production deployment"
```

**결과:**
- 새 GAS 스크립트 버전 생성 (자동)
- 새 Deployment ID 생성
- 새 웹 앱 URL 생성 (doGet/doPost 있을 경우)
- `@1` 버전 생성

**출력:**
```
Deployed AKfycbzTFkhFau09LkAJzQBnQkJum3Vj3DMAzrZaXKu8Q2ZY6ACNyf43bfQZBdMyAwp90yXO @1
```

---

#### Case B: 재배포 (URL 유지)
```bash
clasp deploy --deploymentId AKfycbzTFkh... -d "Bug fix v2"
```

**결과:**
- **같은 Deployment ID** 유지
- 버전만 증가 (`@1` → `@2`)
- **URL 변경 없음** ← 핵심!
- 기존 사용자 영향 없음

**이게 CI/CD에서 사용하는 방식!**

---

#### Case C: 롤백 (특정 버전 재배포)
```bash
clasp deploy --deploymentId AKfycbzTFkh... -V 2 -d "Rollback to v2"
```

**결과:**
- 2번 스크립트 버전의 코드를 재배포
- 새 버전 번호로 배포 (`@4` 등)
- URL 유지

---

**예시:**
```bash
# 최초 배포
clasp deploy -d "Initial deployment"

# Deployment ID 확인
clasp deployments
# → AKfycbzTFkh... 복사

# 재배포 (URL 유지)
clasp deploy --deploymentId AKfycbzTFkh... -d "Update v2"

# 롤백
clasp deploy --deploymentId AKfycbzTFkh... -V 2 -d "Rollback"
```

**주의사항:**
- `clasp deploy`만으로는 **웹 앱 URL 생성 안 됨!**
- 최초 웹 앱 배포는 **GAS UI 필수** (Issue #63)
- `appsscript.json`에 `webapp` 설정 추가 필요:
  ```json
  {
    "webapp": {
      "executeAs": "USER_DEPLOYING",
      "access": "ANYONE_ANONYMOUS"
    }
  }
  ```
- 하지만 설정만으로는 부족, GUI 배포 1회 필수

---

### `clasp deployments`

**용도:** 현재 프로젝트의 모든 deployment 조회

**문법:**
```bash
clasp deployments
```

**출력:**
```bash
Found 3 deployments.
- AKfycbxr5s0Z... @HEAD
- AKfycbzTFkhF... @1 - Initial deployment
- AKfycbzTFkhF... @2 - Bug fix
```

**해석:**
- `@HEAD` - 테스트용, 읽기 전용, 삭제 불가
- `@1, @2` - 프로덕션 배포, 버전 번호

**Deployment ID 추출:**
```bash
# @HEAD 제외하고 첫 번째 deployment ID
clasp deployments | grep -v "@HEAD" | head -n1 | awk '{print $2}'
```

**CI/CD 활용:**
```bash
DEPLOYMENT_ID=$(clasp deployments | grep -v "@HEAD" | head -n1 | awk '{print $2}')

if [ -n "$DEPLOYMENT_ID" ]; then
  clasp deploy --deploymentId "$DEPLOYMENT_ID" -d "CI deploy"
else
  echo "No deployment found"
fi
```

---

### `clasp undeploy`

**용도:** Deployment 아카이브 (삭제 아님)

**문법:**
```bash
clasp undeploy [<deploymentId>]
```

**동작:**
- Interactive 선택 (deploymentId 없을 경우)
- Deployment 아카이브 (숨기기)
- URL 접근 불가 (404)

**제약:**
- `@HEAD`는 아카이브 불가
- 완전 삭제는 불가능 (GAS 제약)

**예시:**
```bash
clasp undeploy                     # Interactive 선택
clasp undeploy AKfycbzTFkh...      # 직접 지정
```

---

## 버전 관리

### `clasp list-versions` (구 `clasp versions`)

**용도:** GAS 스크립트 버전 목록 조회

> ⚠️ **Note:** clasp 3.x부터 `clasp versions`는 `clasp list-versions`로 변경되었습니다.

**문법:**
```bash
clasp list-versions
```

**출력:**
```bash
1  - Initial version
2  - Fix auth bug
3  - Add logging
20 - CI deploy
```

**GAS 스크립트 버전이란?**
- GAS 서버에만 존재하는 immutable snapshot
- `clasp deploy` 실행 시 자동 생성
- 또는 GAS UI에서 "파일 → 버전 관리 → 새 버전 저장"
- Git 버전과는 **완전히 별개**

**사용 시점:**
```bash
# 배포 전 버전 확인
clasp list-versions

# 특정 버전으로 롤백
clasp deploy --deploymentId <ID> -V 2 -d "Rollback"

# 디버깅: 과거 버전 코드 확인
clasp pull --versionNumber 2
```

---

### `clasp version`

**용도:** 새 GAS 스크립트 버전 수동 생성

**문법:**
```bash
clasp version [description]
```

**예시:**
```bash
clasp version "Stable release before major refactor"
```

**주의:**
- 일반적으로 `clasp deploy`가 자동으로 버전 생성
- 수동 생성은 특별한 경우만 (메이저 마일스톤 등)

---

## 실행 및 로그

### `clasp run-function` (구 `clasp run`)

**용도:** Apps Script 함수 원격 실행

> ⚠️ **Note:** clasp 3.x부터 `clasp run`은 `clasp run-function`으로 변경되었습니다.

**문법:**
```bash
clasp run-function <functionName>
```

**요구사항:**
- Apps Script API 활성화 필요
- OAuth 설정 필요

**예시:**
```bash
clasp run-function myFunction
```

---

### `clasp tail-logs` (구 `clasp logs`)

**용도:** 실행 로그 조회

> ⚠️ **Note:** clasp 3.x부터 `clasp logs`는 `clasp tail-logs`로 변경되었습니다.

**문법:**
```bash
clasp tail-logs [--json] [--open] [--setup] [--watch] [--simplified]
```

**옵션:**
- `--json` - JSON 형식 출력
- `--open` - 브라우저에서 Stackdriver 열기
- `--setup` - Stackdriver 설정
- `--watch` - 실시간 로그 감시
- `--simplified` - 간단한 형식으로 출력

**예시:**
```bash
clasp tail-logs              # 최근 로그 조회
clasp tail-logs --watch      # 실시간 로그
clasp tail-logs --open       # Stackdriver 열기
```

---

## 전역 옵션

모든 clasp 명령어에 적용 가능:

| 옵션 | 설명 |
|------|------|
| `-h, --help` | 도움말 표시 |
| `-P, --project <file>` | 특정 .clasp.json 경로 지정 |
| `-A, --auth <file>` | auth 파일 지정 |
| `-I, --ignore <file>` | .claspignore 파일 위치 지정 |

**예시:**
```bash
clasp push --project other-project/.clasp.json
clasp deploy --auth ~/.custom-clasp.json
```

---

## 핵심 개념 정리

### @HEAD vs Versioned Deployment

| 항목 | @HEAD | Versioned (@1, @2...) |
|------|-------|----------------------|
| 생성 | 자동 (프로젝트 생성 시) | 수동 (clasp deploy) |
| 코드 동기화 | 항상 (clasp push) | 고정 (생성 시점) |
| 개수 | 1개 | 여러 개 |
| URL | 없음 | 있음 (Web App 시) |
| 삭제 | 불가 | 아카이브 가능 |
| 용도 | 테스트 | 프로덕션 |
| 수정 | 가능 (clasp push) | 불가 (Read-only) |

---

### Git vs GAS Versions

| 항목 | Git | GAS Script Version |
|------|-----|-------------------|
| 저장 위치 | GitHub/Git | GAS 서버 |
| 생성 시점 | git commit | clasp deploy |
| 식별자 | hash (a1b2c3d) | 숫자 (1,2,3...) |
| 용도 | 코드 버전 관리 | 배포 스냅샷 |
| clasp와 연동 | ❌ 없음 | ✅ versions, pull |
| 자동 증가 | ❌ | ✅ |

**중요:**
- Git commit ≠ GAS version
- 완전히 별개의 시스템
- Git이 진실의 원천
- GAS version은 배포 기록용

---

### Deployment ID vs Script ID

| 항목 | Script ID | Deployment ID |
|------|-----------|--------------|
| 용도 | 프로젝트 식별 | 배포 식별 |
| 저장 위치 | .clasp.json | deployments 목록 |
| 개수 | 1개 | 여러 개 |
| 변경 | 불가 | 생성 가능 |
| URL | 에디터 URL | 웹 앱 URL (exec) |

---

## 워크플로우 예시

### 일반 개발

```bash
# 1. 코드 수정
vim Code.js

# 2. Git 커밋
git add .
git commit -m "feat: Update feature"

# 3. GAS에 업로드 (테스트)
clasp push

# 4. 에디터에서 테스트
clasp open-script

# 5. 프로덕션 배포
clasp deploy --deploymentId $(cat .deploymentId) -d "Update v2"
```

---

### 최초 Web App 배포

```bash
# 1. 프로젝트 생성
clasp create-script --type standalone --title "My Web App"

# 2. TimeZone 수정 (필수!)
vim appsscript.json  # "America/New_York" → "Asia/Seoul"

# 3. 코드 작성
vim Code.js  # doGet() 함수 작성

# 4. Git 커밋 후 업로드
git add .
git commit -m "feat: Add web app project"
clasp push

# 5. GUI에서 Web App 배포 (필수!)
clasp open-script
# → Deploy → New deployment → Web app → Deploy

# 6. webapp 설정 가져오기
clasp pull
git add appsscript.json
git commit -m "chore: Add webapp config from GAS"

# 7. Deployment ID 확인
clasp deployments

# 8. 이후 재배포 (URL 유지)
clasp push
clasp deploy --deploymentId <복사한 ID> -d "Update"
```

---

### 롤백

```bash
# 1. 버전 목록 확인
clasp list-versions
# 1 - Initial
# 2 - Feature A
# 3 - Bug (문제 발생!)

# 2. 2번 버전으로 롤백
clasp deploy --deploymentId $(cat .deploymentId) -V 2 -d "Rollback to v2"

# 3. 결과: @4로 배포 (2번 코드, 4번 deployment)
```

---


## 주의사항

### ⚠️ clasp pull 위험성

```bash
# 위험: 로컬 변경사항 덮어씌워짐
clasp pull

# 안전: Git 커밋 후 pull
git status
git add .
git commit -m "WIP"
clasp pull
```

---

### ⚠️ webapp 최초 배포는 GUI 필수

```bash
# 이것만으로는 웹 앱 URL 생성 안 됨!
clasp deploy -d "Web app"

# 반드시 GUI에서 1회 배포 필요
clasp open-script
# → Deploy → Web app
```

**이유:**
- Apps Script API 제한 (Issue #63)
- appsscript.json에 webapp 설정 추가해도 부족
- GUI 배포 시 추가 설정 적용됨

---

### ⚠️ @HEAD 재배포 불가

```bash
# 에러 발생
clasp deploy --deploymentId AKfycbxr... (HEAD)
# Error: Read-only deployments may not be modified.

# HEAD는 재배포 불가
# 항상 versioned deployment 사용
```

---

### ⚠️ TimeZone 항상 확인

```bash
# clasp create-script 후 항상 확인
cat appsscript.json
# "timeZone": "America/New_York" ← 기본값!

# Asia/Seoul로 변경
vim appsscript.json
```

---

## 트러블슈팅

### "No .clasp.json found"

```bash
# 원인: 잘못된 디렉토리
pwd

# 해결: 프로젝트 디렉토리로 이동
cd projects/my-app
```

---

### "Unknown command" 에러

```bash
# 원인: clasp 버전 불일치
clasp --version  # 전역 버전
npx clasp --version  # 로컬 버전

# 해결: 최신 버전으로 업데이트
npm install @google/clasp@latest
```

---

### Web App URL이 생성 안 됨

**체크리스트:**
1. `doGet()` 또는 `doPost()` 함수 있는가?
2. `appsscript.json`에 `webapp` 설정 있는가?
3. GUI에서 최소 1회 배포했는가?
4. Versioned deployment 생성했는가? (@HEAD 아님)

---

### Deployment가 웹 앱 반영 안 됨

```bash
# 증상: clasp deploy 성공했지만 웹 앱 변경 안 됨

# 원인: 새 deployment ID 생성 (URL 변경됨)
clasp deployments
# → 여러 개의 다른 deployment ID

# 해결: 항상 같은 deployment ID 재사용
clasp deploy --deploymentId <기존 ID> -d "Update"
```

---

## 참고 자료

- [clasp GitHub Repository](https://github.com/google/clasp)
- [Apps Script CLI 공식 가이드](https://developers.google.com/apps-script/guides/clasp)
- [Issue #63: Web App Deployment Problem](https://github.com/google/clasp/issues/63)
- [Web App Manifest Configuration](https://developers.google.com/apps-script/manifest/web-app-api-executable)
