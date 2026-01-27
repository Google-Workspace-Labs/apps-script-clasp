import fs from 'node:fs';
import { globSync } from 'glob';
import eslintConfigPrettier from 'eslint-config-prettier';

/**
 * 모든 프로젝트의 appsscript.json에서 라이브러리 심볼 추출
 *
 * 이 함수는 ESLint 실행 시마다 호출되지만,
 * - 파일 개수가 적고 (프로젝트 수만큼)
 * - JSON 파싱은 빠르므로
 * - 성능 이슈 없음
 */
function extractLibrarySymbols() {
  const symbols = {};

  try {
    // projects/**/appsscript.json 파일들 찾기
    const appsscriptFiles = globSync('projects/**/appsscript.json', {
      ignore: ['**/node_modules/**'],
    });

    appsscriptFiles.forEach((filePath) => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const config = JSON.parse(content);

        // libraries 배열에서 userSymbol 추출
        const libraries = config.dependencies?.libraries || [];
        libraries.forEach((lib) => {
          if (lib.userSymbol) {
            symbols[lib.userSymbol] = 'readonly';
          }
        });
      } catch (error) {
        console.warn(`⚠️  Failed to parse ${filePath}:`, error.message);
      }
    });
  } catch (error) {
    console.warn('⚠️  Failed to extract library symbols:', error.message);
  }

  return symbols;
}

/**
 * Apps Script 표준 전역 객체
 *
 * 이들은 모든 Apps Script 프로젝트에서 기본 제공되므로
 * 명시적으로 정의합니다.
 *
 * 참고: https://developers.google.com/apps-script/reference
 */
const APPS_SCRIPT_GLOBALS = {
  // 기본 서비스
  Logger: 'readonly',
  console: 'readonly', // V8 런타임

  // Google Apps 서비스
  SpreadsheetApp: 'readonly',
  DocumentApp: 'readonly',
  SlidesApp: 'readonly',
  FormApp: 'readonly',
  GmailApp: 'readonly',
  CalendarApp: 'readonly',
  DriveApp: 'readonly',

  // 유틸리티
  HtmlService: 'readonly',
  ScriptApp: 'readonly',
  Utilities: 'readonly',
  Session: 'readonly',
  UrlFetchApp: 'readonly',
  ContentService: 'readonly',

  // 고급 서비스 (자주 사용)
  PropertiesService: 'readonly',
  CacheService: 'readonly',
  LockService: 'readonly',
};

/**
 * 커스텀 예약 함수 (선택 사항)
 *
 * appsscript.json에서 자동 감지되지 않는 함수들을
 * 수동으로 추가할 수 있습니다.
 *
 * 예시:
 * - 클라이언트 호출 함수 (google.script.run)
 * - 외부 라이브러리 함수
 *
 * 참고: include()는 각 프로젝트에서 정의하는 함수이므로 여기에 추가하지 않습니다.
 */
const CUSTOM_RESERVED_FUNCTIONS = {
  // 필요시 여기에 추가
};

// appsscript.json에서 동적으로 추출한 라이브러리 심볼
const dynamicLibrarySymbols = extractLibrarySymbols();

// 모든 전역 객체 통합
const allGlobals = {
  ...APPS_SCRIPT_GLOBALS,
  ...CUSTOM_RESERVED_FUNCTIONS,
  ...dynamicLibrarySymbols,
};

/**
 * Apps Script 특성
 *
 * Apps Script에서는 모든 최상위 함수가 잠재적으로 외부에서 호출 가능합니다:
 * - Simple Triggers (onOpen, doGet, doPost 등)
 * - GAS 에디터에서 직접 실행
 * - google.script.run으로 클라이언트 호출
 * - HTML 템플릿에서 <?!= include() ?>로 호출
 *
 * 따라서 no-unused-vars 규칙을 끄고, 실제 미사용 함수는 수동으로 관리합니다.
 */

/**
 * ESLint Flat Config (ESM)
 *
 * ESLint 8.x Flat Config 형식 (실험적 기능)
 * "type": "module" 환경에서 동작
 */
export default [
  {
    // 전역 무시 설정
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', 'scripts/**'],
  },
  {
    // 프로젝트 파일들에 적용
    files: ['projects/**/*.js'],

    languageOptions: {
      ecmaVersion: 2020, // Apps Script V8 런타임 지원
      sourceType: 'script',
      globals: allGlobals,
    },

    rules: {
      // 🔴 Error (반드시 지켜야 함)
      'no-var': 'error', // var 사용 금지
      'no-undef': 'error', // 정의되지 않은 변수 사용 금지
      'no-redeclare': 'error', // 변수 재선언 금지
      eqeqeq: ['error', 'always'], // === 사용 강제 (타입 안전성)
      curly: ['error', 'all'], // if 문에 중괄호 강제
      'no-eval': 'error', // eval() 사용 금지 (보안)
      'no-throw-literal': 'error', // Error 객체만 throw
      'no-implied-eval': 'error', // setTimeout 문자열 금지

      // 🟡 Warning (권장사항)
      'prefer-const': 'warn', // 재할당 없는 변수는 const 사용
      'prefer-arrow-callback': 'warn', // 익명 콜백 함수는 화살표 함수 권장

      // ⚪ Off (Apps Script 특성상 제외)
      'no-unused-vars': 'off', // 최상위 함수는 외부 호출 가능하므로 제외

      // Prettier와 충돌 방지
      ...eslintConfigPrettier.rules,
    },
  },
];
