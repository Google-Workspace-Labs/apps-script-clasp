# clasp + Git 안전한 워크플로우 가이드

> **이 문서는 실제 테스트를 통해 검증된 핵심 지식을 담고 있습니다.**
> - ✅ 실제 테스트 기반 검증 완료
> - ✅ clasp API vs 실제 구현 차이 확인
> - ✅ 파일 삭제 동작 실제 테스트로 검증
> - ✅ 5가지 시나리오별 워크플로우 정립

---

## 📋 목차

1. [clasp 동작 원리 이해](#clasp-동작-원리-이해)
2. [Git vs clasp 차이점](#git-vs-clasp-차이점)
3. [파일 삭제 문제](#파일-삭제-문제)
4. [안전한 워크플로우](#안전한-워크플로우)
5. [위험한 패턴](#위험한-패턴)
6. [Best Practices](#best-practices)
7. [절대 금지 사항](#-절대-금지-사항)
8. [체크리스트](#-체크리스트)
9. [문제 해결 플로우차트](#-문제-해결-플로우차트)
10. [핵심 원칙 요약](#-핵심-원칙-요약)

---

## clasp 동작 원리 이해

### 📡 Google Apps Script API vs clasp 구현

**왜 혼란이 있었나?**

많은 문서에서 "clasp push는 전체 파일을 대체한다"고 설명하지만, 실제로는 **파일 삭제가 안 됩니다**. 이유는:

#### Google Apps Script API (Low-level, 이론)

```javascript
// projects.updateContent API
{
  "files": [
    { "name": "Code.js", "source": "..." },
    { "name": "index.html", "source": "..." }
  ]
}
// ⚠️ 이 리스트가 서버의 전체 파일을 대체함
// → 리스트에 없는 파일은 삭제됨 (API 스펙)
```

Google 공식 문서: "Files not updated by the request are **REMOVED**"

#### clasp 실제 구현 (High-level, 현실)

```javascript
// clasp push 내부 동작 (추정)
async function claspPush() {
  // 1. 서버 현재 파일 가져오기 (중요!)
  const serverFiles = await projects.getContent();

  // 2. 로컬 파일 스캔 (.claspignore 제외)
  const localFiles = scanLocalFiles();

  // 3. 병합 (서버 파일 보존!)
  const merged = {
    ...serverFiles,  // ← 기존 서버 파일 유지
    ...localFiles    // ← 로컬 파일로 덮어쓰기
  };

  // 4. 업로드
  await projects.updateContent(merged);
}
```

**핵심 차이:**
- **API 스펙**: 전체 대체 (리스트에 없으면 삭제)
- **clasp 구현**: 서버 파일을 먼저 읽어서 보호

이것이 바로 "로컬에서 파일을 삭제해도 서버에서 삭제되지 않는" 이유입니다!

---

### clasp push 실제 동작

**테스트 검증 결과:**

```bash
# 시나리오 1: 변경 없음
clasp push
→ "Script is already up to date."

# 시나리오 2: 파일 추가/수정
clasp push
→ "Pushed 6 files."
→ 로컬 파일 전체를 서버로 덮어씀
→ ⚠️ 단, 서버에만 있는 파일은 건드리지 않고 유지됨
```

**핵심:**
- `clasp push`는 **서버 파일을 먼저 읽어서 병합**
- 로컬 파일로 덮어쓰지만, **서버 전용 파일은 유지**
- **파일 삭제 기능 없음**

---

### clasp pull 실제 동작

```bash
clasp pull
→ 서버 파일을 로컬로 다운로드
→ 로컬 전용 파일은 삭제하지 않음 (병합)
```

**문제:**

```bash
# 서버에서 파일 이름 변경 (old.js → new.js)
clasp pull
→ 로컬에 old.js + new.js 둘 다 존재! ⚠️
```

---

## Git vs clasp 차이점

| 기능 | Git | clasp |
|------|-----|-------|
| **파일 삭제 반영** | ✅ `git rm` + push → 서버에서 삭제 | ❌ 로컬 삭제 + push → 서버에 유지 |
| **변경 감지** | ✅ Diff 기반 | ✅ 전체 스캔 |
| **부분 업데이트** | ✅ 변경된 파일만 | ❌ 항상 전체 업로드 |
| **충돌 해결** | ✅ Merge, Rebase | ❌ 수동 해결 |
| **히스토리** | ✅ 완전한 이력 관리 | ❌ 버전만 존재 |
| **단방향/양방향** | ✅ 양방향 | ⚠️ 사실상 단방향 (병합 이슈) |

**결론:**
- **Git = Source of Truth** (코드 이력 관리)
- **clasp = Deployment Tool** (GAS 서버 배포용)

---

## 파일 삭제 문제

### ❌ 안 되는 것들 (테스트 검증)

#### 1. 로컬 삭제 → push

```bash
# 로컬에서 파일 삭제
rm test.html

# Push
clasp push
→ "Pushed 5 files." (test.html 제외)

# 서버 확인
clasp open-script
→ ❌ test.html이 여전히 존재!
```

**이유:** clasp은 서버 파일을 병합하므로 삭제하지 않음

---

#### 2. .claspignore 추가

```bash
# .claspignore에 파일 추가
echo "test.html" >> .claspignore

# Push
clasp push
→ test.html은 업로드에서 제외됨

# 서버 확인
clasp open-script
→ ❌ test.html이 여전히 존재!
```

**이유:** `.claspignore`는 **업로드 제외용**이지 삭제용 아님

---

### ✅ 유일한 해결책: GAS 에디터 수동 삭제

```bash
# 1. GAS 에디터 열기
clasp open-script

# 2. 파일 우클릭 → Delete

# 3. 로컬 동기화
clasp pull

# 4. Git 커밋
git add .
git commit -m "Remove test.html"
git push
```

---

## 안전한 워크플로우

### 시나리오 1: 일반 개발 (로컬 우선)

**권장 흐름:**

```bash
# 1. 로컬 개발
vim Code.js

# 2. Git 커밋 (pre-commit hook 자동 실행)
git add .
git commit -m "feat: Add feature"
# → prettier + eslint 자동 실행

# 3. 코드 검증 (선택사항)
npm run lint
npm run format:check

# 4. GAS 배포
clasp push

# 5. Git push
git push origin develop
```

**안전성:**
- ✅ Pre-commit hook 자동 검증 (prettier + eslint)
- ✅ Git 이력 보존
- ✅ GAS 서버와 동기화

---

### 시나리오 2: GAS 에디터에서 급수정

**문제 상황:**
- 프로덕션 버그 발견
- GAS 에디터에서 긴급 수정
- 로컬과 서버가 불일치

**안전한 해결 방법:**

```bash
# 1. 로컬 작업 중이었다면 먼저 커밋
git add .
git commit -m "WIP: Local work in progress"

# 2. Pull 전에 변경사항 확인
git status
# → uncommitted changes 있는지 확인

# 3. Pull 진행 (변경사항 없는 경우만)
clasp pull
# → GAS 서버 내용이 로컬로 다운로드됨

# 4. 차이 확인
git diff

# 5. 로컬 변경사항과 병합 (필요시)
# 수동으로 코드 병합 또는 선택

# 6. 최종 커밋
git add .
git commit -m "merge: Sync from GAS emergency fix"

# 7. 다시 배포 (검증 후)
clasp push

# 8. Git push
git push origin develop
```

**주의사항:**
- Pull 전에 반드시 `git status`로 uncommitted changes 확인
- 변경사항이 있는 상태에서 pull하면 **로컬 변경사항이 덮어써짐!**

---

### 시나리오 3: 파일 삭제

#### ✅ 올바른 방법

```bash
# 1. GAS 에디터에서 삭제
clasp open-script
# → 파일 우클릭 → Delete

# 2. 로컬 동기화
clasp pull
# → 삭제된 파일이 로컬에서도 제거됨

# 3. Git 커밋
git add .
git commit -m "remove: Delete old-file.html"

# 4. Git push
git push origin develop
```

#### ❌ 잘못된 방법 (동작하지 않음)

```bash
# 로컬에서만 삭제
rm old-file.html
git commit -m "remove: Delete old-file.html"
clasp push
# → ❌ GAS 서버에 여전히 존재!

# → 결과: Git과 GAS 서버가 불일치
```

---

### 시나리오 4: 충돌 발생 시

**상황:**
- 로컬과 GAS 서버 모두 수정됨
- 같은 파일을 다르게 편집

**해결 방법:**

```bash
# 1. 로컬 변경사항 커밋
git add .
git commit -m "feat: Local changes"

# 2. 백업 브랜치 생성 (안전장치)
git checkout -b backup/before-pull
git checkout develop

# 3. Pull 전 상태 확인
git status
# → uncommitted changes 확인

# 4. Pull 진행 (주의!)
clasp pull
# → GAS 서버 내용으로 덮어써짐

# 5. 차이 확인
git diff HEAD~1

# 6. 수동 병합
# - 중요한 로컬 변경사항 복구
# - GAS 서버 변경사항 반영

# 7. 최종 상태 커밋
git add .
git commit -m "merge: Resolve clasp pull conflict"

# 8. 검증 후 배포
clasp push

# 9. 백업 브랜치 삭제
git branch -D backup/before-pull
```

---

### 시나리오 5: 브랜치 전환 시

**상황:**
- Feature 브랜치에서 개발 중
- Main 브랜치로 전환 필요
- 파일 구성이 브랜치마다 다를 수 있음

**위험:**
```bash
# feature 브랜치에서 개발 중
git checkout feature/new-ui
vim Code.js  # 새 UI 코드 작성

# main 브랜치로 전환
git checkout main

# ⚠️ 실수로 push
clasp push
# → main 브랜치 내용이 GAS에 배포됨
# → 하지만 로컬에는 feature 브랜치 작업물이 남아있을 수 있음

# feature 브랜치로 다시 전환
git checkout feature/new-ui

# ⚠️ 다시 push
clasp push
# → ❌ 개발 중인 코드가 프로덕션(GAS)에 배포됨!
```

**안전한 방법:**

```bash
# 1. Feature 브랜치에서 작업
git checkout feature/new-ui
vim Code.js
git commit -am "WIP: New UI"

# 2. Main 브랜치로 전환 (배포용)
git checkout main
git pull origin main

# 3. 배포
clasp push
# → Main 브랜치 내용만 GAS에 배포

# 4. Feature 브랜치로 복귀
git checkout feature/new-ui
# ❌ clasp push 하지 말 것!
# → 개발 중인 코드가 프로덕션에 배포됨
```

**원칙:**
- ✅ **Main/Production 브랜치에서만 배포**
- ❌ Feature/Development 브랜치에서 절대 push 금지
- ✅ CI/CD 파이프라인 권장 (자동화)

**추천 workflow:**
```bash
# Feature 개발
git checkout -b feature/new-feature
# ... 개발 ...
git push origin feature/new-feature

# Pull Request → 코드 리뷰 → Merge

# Main 브랜치 배포
git checkout main
git pull origin main
clasp push  # 검증된 코드만 배포
```

---

## 위험한 패턴

### ❌ 패턴 1: 동시 편집

```bash
# 로컬에서 Code.js 수정 중
vi Code.js

# 동시에 팀원이 GAS 에디터에서 Code.js 수정
# → 나중에 push/pull하는 쪽이 변경사항 덮어씀!
```

**해결:**
- ✅ **로컬 우선 원칙** 확립
- ✅ GAS 에디터는 읽기 전용으로 사용
- ✅ 긴급 수정 시 즉시 팀원에게 알림

---

### ❌ 패턴 2: pull 없이 push

```bash
# GAS 에디터에서 수정

# 로컬에서 pull 없이 바로 push
clasp push
# → GAS 에디터 수정사항이 덮어써짐! ⚠️
```

**해결:**
- ✅ 항상 `clasp pull` 먼저 실행
- ✅ Git diff로 변경사항 확인

---

### ❌ 패턴 3: 로컬 삭제 후 push

```bash
# 로컬에서 파일 삭제
rm old-file.html

# Push
clasp push
# → ❌ GAS 서버에 여전히 존재

# 나중에 pull하면
clasp pull
# → old-file.html이 다시 로컬에 생김!
```

**해결:**
- ✅ GAS 에디터에서 먼저 삭제
- ✅ 그 다음 `clasp pull`

---

### ❌ 패턴 4: .claspignore 오용

```bash
# .claspignore에 중요한 파일 추가
echo "Code.js" >> .claspignore

# Push
clasp push
# → Code.js가 업로드되지 않음
# → 서버에 Code.js가 있었다면 유지됨
# → 서버에 Code.js가 없었다면... 앱 동작 안 함! ⚠️
```

**해결:**
- ✅ `.claspignore`는 테스트 파일, 로컬 전용 파일만
- ✅ GAS에 필요한 파일은 절대 추가하지 말 것

---

## Best Practices

### ✅ 1. 단일 진실 공급원 (Single Source of Truth)

```bash
Git (로컬) = Source of Truth
  ↓ push
GAS 서버 = Deployment Target
```

**원칙:**
- 코드 작성은 **항상 로컬**에서
- GAS 에디터는 **읽기/디버깅 전용**
- 긴급 수정만 예외 (즉시 pull 필수)

---

### ✅ 2. Pull Before Push 원칙

```bash
# 나쁜 예
clasp push  # 위험!

# 좋은 예
clasp pull  # 먼저 동기화
git diff      # 변경사항 확인
clasp push  # 배포
```

---

### ✅ 3. 파일 삭제는 GAS 우선

```bash
# 파일 삭제 순서
1. GAS 에디터에서 삭제
2. clasp pull
3. git commit
4. git push
```

**이유:**
- clasp은 파일 삭제를 서버로 전파하지 못함
- GAS 에디터가 유일한 삭제 방법

---

### ✅ 4. Pull 전 Git 상태 확인

**권장 워크플로우:**

```bash
# 1. Pull 전 반드시 상태 확인
git status

# 2. Uncommitted changes 있으면 커밋 또는 stash
git add .
git commit -m "WIP: Before pull"
# 또는
git stash

# 3. 깨끗한 상태에서 Pull
clasp pull

# 4. 변경사항 확인
git diff
```

**주의:**
- `clasp pull`은 경고 없이 로컬 파일을 덮어씁니다
- 반드시 `git status`로 변경사항 확인 후 실행
- 중요한 작업 중이라면 백업 브랜치 생성 권장

---

### ✅ 5. 코드 품질 자동화 활용

**Pre-commit Hook (자동):**

```bash
# git commit 시 자동 실행
git commit
→ pre-commit hook (staged 파일만)
  → prettier --write
  → eslint --fix
```

**배포 전 검증 (선택):**

```bash
# 전체 프로젝트 검증 (수동)
npm run lint
npm run format:check

# 문제 없으면 배포
clasp push
```

**장점:**
- Staged 파일은 자동 검증 (커밋 시점)
- 배포 전 전체 검증 가능 (수동)
- Git 이력에 불량 코드 커밋 방지

---

### ✅ 6. Git 브랜치 전략

```bash
# Feature 개발
git checkout -b feature/new-feature
# ... 개발 ...
git commit -m "feat: Add feature"
clasp push  # GAS에 바로 배포하지 말고

# Pull Request 생성
git push origin feature/new-feature
# → GitHub에서 코드 리뷰

# Merge 후 배포
git checkout develop
git pull origin develop
clasp push  # 이제 GAS에 배포
```

---

### ✅ 7. .claspignore 관리

**권장 설정:**

```bash
# .claspignore
node_modules/
.git/
.env
*.test.js
*.spec.js
README.md
.claspignore
.gitignore
```

**주의:**
- GAS에 필요한 파일은 **절대 추가하지 말 것**
- 테스트 파일, 문서, 로컬 설정만

---

### ✅ 8. 정기적인 동기화

```bash
# 작업 시작 전 항상
clasp pull
git diff  # 변경사항 확인

# 작업 완료 후
git commit -m "..."
clasp push

# 하루 작업 종료 시
git push origin develop
```

---

## 📋 빠른 참조 (Cheat Sheet)

### 일반 개발

```bash
vim Code.js
git add . && git commit -m "feat: ..."
clasp push
git push origin develop
```

### GAS 에디터 급수정 후

```bash
git add . && git commit -m "WIP"
clasp pull
git diff
git commit -m "merge: Sync from GAS"
clasp push
git push origin develop
```

### 파일 삭제

```bash
clasp open-script  # GAS 에디터에서 삭제
clasp pull
git add . && git commit -m "remove: ..."
git push origin develop
```

### 충돌 발생 시

```bash
git commit -m "WIP"
git checkout -b backup/before-pull
git checkout develop
clasp pull  # 경고 확인 후 승인
git diff HEAD~1  # 차이 확인
# 수동 병합
git commit -m "merge: Resolve conflict"
clasp push
```

---

## 🚫 절대 금지 사항

### ❌ 1. 커밋 없이 pull
```bash
# ❌ 위험!
clasp pull  # 로컬 작업 날아감

# ✅ 올바른 방법
git add .
git commit -m "WIP"
clasp pull
```

**결과**: 로컬 변경사항 손실 😱

---

### ❌ 2. 로컬 삭제로 서버 파일 삭제 시도
```bash
# ❌ 동작하지 않음
rm file.js
clasp push  # 서버에 여전히 존재

# ✅ 올바른 방법
clasp open-script  # GAS 에디터에서 삭제
clasp pull
```

**결과**: Git과 GAS 서버 불일치

---

### ❌ 3. .claspignore로 프로젝트 파일 제외
```bash
# ❌ 위험!
echo "Code.js" >> .claspignore
clasp push  # 서버 파일은 유지되지만 업데이트 안 됨

# ✅ .claspignore는 개발 파일만
echo "*.test.js" >> .claspignore
```

**결과**: 서버와 로컬 불일치, 배포 안 됨

---

### ❌ 4. 개발 브랜치에서 배포
```bash
# ❌ 위험!
git checkout feature/test
clasp push  # 테스트 코드가 프로덕션에!

# ✅ main 브랜치에서만
git checkout main
clasp push
```

**결과**: 미완성 코드가 프로덕션에 배포

---

### ❌ 5. Pull/Push 동시 사용
```bash
# ❌ 충돌 위험
clasp pull && vim Code.js && clasp push

# ✅ 단계별 진행
clasp pull
git diff  # 확인
vim Code.js
git commit -m "..."
clasp push
```

**결과**: 예측 불가능한 충돌

---

## ✅ 체크리스트

### Pull 전 체크리스트
- [ ] `git status`로 로컬 변경사항 확인?
- [ ] Uncommitted changes 커밋 또는 stash 완료?
- [ ] 정말 GAS 서버가 최신인가?
- [ ] 백업 완료? (중요한 작업일 경우)

### Push 전 체크리스트
- [ ] Prettier 포맷팅 완료?
- [ ] ESLint 검사 통과?
- [ ] Git 커밋 완료?
- [ ] Main/Production 브랜치에서 작업 중?
- [ ] 배포해도 되는 코드인가?

### 파일 삭제 시 체크리스트
- [ ] GAS 에디터에서 먼저 삭제?
- [ ] `clasp pull`로 동기화?
- [ ] Git 커밋 완료?
- [ ] 로컬에도 파일 삭제됨 확인?

---

## 🔧 문제 해결 플로우차트

```
로컬 변경사항이 날아갔다?
├─ 커밋했었나?
│  ├─ Yes → git log로 복구 (git reset --hard HEAD~1)
│  └─ No → VSCode 로컬 히스토리 확인
│         (File > Open > Timeline)
│         복구 어려움 😢

서버 파일이 안 지워진다?
├─ GAS 에디터에서 삭제했나?
│  ├─ No → 에디터에서 삭제 후 clasp pull
│  └─ Yes → 이미 삭제됨 (clasp pull로 확인)

.claspignore 파일이 업로드 안 됨?
├─ .claspignore에 있나?
│  ├─ Yes → .claspignore에서 제거 후 push
│  └─ No → .gitignore 확인
│         Git tracked 파일인지 확인

변경 안 했는데 전체 push?
└─ clasp은 변경 감지 시 전체 업로드
   (정상 동작)

GAS 에디터와 로컬이 다르다?
├─ 최근 pull 했나?
│  ├─ No → clasp pull로 동기화
│  └─ Yes → 로컬 변경사항 있나?
│            git status 확인
│            commit 후 push

브랜치 전환 후 이상한 코드?
└─ 어느 브랜치에서 push 했나?
   feature에서 push → main으로 전환
   → 혼란 발생
   → main에서 다시 push
```

---

## ⚠️ 핵심 원칙 요약

1. **Git = Source of Truth**, clasp = Deployment Tool
2. **로컬 우선 개발**, GAS 에디터는 읽기 전용
3. **Pull Before Push** 항상 먼저 동기화
4. **파일 삭제는 GAS 에디터**에서 먼저
5. **Pull 전 git status** 확인 필수
6. **Pre-commit hook** 자동 검증 활용
7. **.claspignore 신중히** 사용
8. **정기적인 동기화** 습관화

---

## 📚 관련 문서

- [GitHub Issue #762](https://github.com/google/clasp/issues/762) - clasp 파일 삭제 제한사항
