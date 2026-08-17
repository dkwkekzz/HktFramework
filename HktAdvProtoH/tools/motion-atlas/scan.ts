// Motion Atlas Scan — 원클릭 정적 분석 진입점.
//
//   npm run motions:scan   분석하고 결과를 보고한다
//
// 배치 파일: scan-motions.bat (Windows) · scan-motions.sh (macOS/Linux)
//
// 생성물은 커밋하지 않는다 (.gitignore). 그것을 읽는 모든 진입점이 먼저 여기를 부른다 —
// 개발 서버·빌드는 vite plugin 이, 테스트는 vitest globalSetup 이. 따라서 손으로 돌릴 일은
// 결과를 눈으로 확인하고 싶을 때뿐이다.

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildAtlas, type SheetReport } from './build-atlas';
import { renderAtlasModule, writeIfChanged } from './emit';

export const ATLAS_MODULE_PATH = join('view', 'motion', 'motion-atlas.generated.ts');

export function projectRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

/** 분석 → 생성물 기록. 이미 최신이면 쓰지 않고 changed=false 를 돌려준다. */
export function scanMotions(root = projectRoot()): {
  changed: boolean;
  reports: SheetReport[];
  warnings: number;
} {
  const { atlas, reports, inputHash } = buildAtlas(root);
  const changed = writeIfChanged(join(root, ATLAS_MODULE_PATH), renderAtlasModule(atlas, inputHash));
  const warnings = reports.reduce(
    (n, r) => n + (r.geometry?.warnings.length ?? 0) + (r.skipped ? 1 : 0),
    0,
  );
  return { changed, reports, warnings };
}

function formatReport(reports: SheetReport[]): string {
  const lines: string[] = [];
  for (const r of reports) {
    if (!r.geometry) {
      lines.push(`  ${r.id.padEnd(28)}  건너뜀 — ${r.skipped}`);
      continue;
    }
    const g = r.geometry;
    const bleed = r.detected?.bleed ?? [];
    const mark = bleed.length === 0 ? 'OK ' : '!! ';
    const method = r.detected ? `${r.detected.method.x}/${r.detected.method.y}` : '-';
    const sizes = new Set(g.frames.map((f) => `${f.rect[2]}x${f.rect[3]}`));

    lines.push(
      `  ${mark}${r.id.padEnd(28)} ${String(g.sheet[0]).padStart(5)}x${String(g.sheet[1]).padEnd(5)}` +
        ` 격자 ${r.cols}x${r.rows}  절단 ${method.padEnd(14)}` +
        ` 프레임 ${[...sizes].join(' ')}  대표높이 ${g.refHeightPx}px`,
    );
    for (const w of g.warnings) lines.push(`      경고: ${w}`);
  }
  return lines.join('\n');
}

// CLI 로 직접 실행될 때만 동작한다 (import 로는 조용하다)
if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const { changed, reports, warnings } = scanMotions(projectRoot());
  console.log('');
  console.log('  Motion Atlas — motions/ 정적 분석');
  console.log('  ' + '-'.repeat(96));
  console.log(formatReport(reports));
  console.log('  ' + '-'.repeat(96));
  console.log(
    `  시트 ${reports.length}장 · 경고 ${warnings}건 · ${ATLAS_MODULE_PATH} ${
      changed ? '갱신됨' : '이미 최신'
    }`,
  );
  if (warnings > 0) {
    console.log('');
    console.log('  경고가 있는 시트는 프레임끼리 맞닿아 있어 어떤 슬라이서로도 완전히 나눌 수 없다.');
    console.log('  칸 사이에 빈 줄(투명 여백)을 두고 다시 내보내면 사라진다.');
  }
  console.log('');
}
