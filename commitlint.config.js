/**
 * Commitlint 설정
 *
 * Conventional Commits 규칙을 강제합니다.
 * https://www.conventionalcommits.org/
 *
 * 형식: <type>(<scope>): <subject>
 *
 * 예시:
 * - feat: Add new feature
 * - fix: Fix bug in API
 * - docs: Update README
 * - refactor: Refactor code structure
 * - test: Add unit tests
 * - chore: Update dependencies
 */

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Type 검증
    'type-enum': [
      2,
      'always',
      [
        'feat', // 새 기능
        'fix', // 버그 수정
        'docs', // 문서 변경
        'style', // 코드 포맷팅 (기능 변경 없음)
        'refactor', // 리팩토링
        'test', // 테스트 추가/수정
        'chore', // 빌드/설정 변경
        'ci', // CI 설정 변경
        'perf', // 성능 개선
        'revert', // 되돌리기
      ],
    ],
    // Subject 길이 제한
    'subject-max-length': [2, 'always', 100],
    // Subject는 소문자로 시작
    'subject-case': [2, 'always', 'sentence-case'],
  },
};
