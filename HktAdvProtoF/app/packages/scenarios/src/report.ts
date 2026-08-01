// V2 실패 보고 — 사람이 읽고 바로 고칠 수 있는 형태로 결과를 쓴다.
// V3 Lab 의 "기대 vs 실제 + 분기 경로 하이라이트" diff 뷰가 이 텍스트를 그대로 화면으로 옮긴다.

import { preview } from './diff.ts';
import type { ScenarioResult, SuiteResult } from './runner.ts';

const PASS = '✔';
const FAIL = '✘';

/** 시나리오 한 건의 보고. 실패 시 원문 V2 요구 5요소를 모두 출력한다. */
export function formatResult(result: ScenarioResult): string {
  const lines: string[] = [];
  const mark = result.passed ? PASS : FAIL;
  lines.push(`${mark} [${result.module}/${result.kind}] ${result.scenarioId} — ${result.purpose}`);

  for (const assertion of result.assertions) {
    lines.push(`    ${assertion.passed ? PASS : FAIL} ${assertion.label}`);
  }

  if (result.passed) return lines.join('\n');

  const failure = result.failure;
  lines.push('    ─ 실패 보고 ───────────────────────────────────');
  lines.push(`    사유          ${failure?.reason ?? 'unknown'} — ${failure?.label ?? ''}`);
  lines.push(`    초기 상태     ${preview(result.initialState)}`);
  lines.push(`    실행된 입력   ${preview(result.input)}`);
  lines.push(`    기대 결과     ${preview(failure?.expected)}`);
  lines.push(`    실제 결과     ${preview(failure?.actual)}`);
  lines.push(`    최초 분기 경로 ${failure?.firstDivergentPath ?? '(특정 불가)'}`);
  return lines.join('\n');
}

/** 스위트 전체 보고 — 결과 목록 + 모듈별 커버리지 표. */
export function formatSuite(suite: SuiteResult): string {
  const lines = suite.results.map((result) => formatResult(result));
  lines.push('');
  lines.push('모듈  정상 실패 경계  판정');
  for (const coverage of suite.coverage) {
    lines.push(
      `${coverage.module.padEnd(5)} ${String(coverage.normal).padStart(4)} ${String(coverage.failure).padStart(4)} ${String(coverage.boundary).padStart(4)}  ${
        coverage.complete ? `${PASS} 3종 전부 통과` : `${FAIL} 미충족`
      }`,
    );
  }
  lines.push('');
  lines.push(
    `합계: ${String(suite.passed)}/${String(suite.total)} 통과${suite.failed > 0 ? ` · ${String(suite.failed)} 실패` : ''}`,
  );
  return lines.join('\n');
}
