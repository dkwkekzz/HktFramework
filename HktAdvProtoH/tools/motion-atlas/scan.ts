// Motion Atlas Scan — 원클릭 정적 분석 진입점.
//
//   npm run motions:scan          분석하고 결과를 보고한다
//   npm run motions:scan -- --check   생성물이 최신인지만 확인한다 (CI/빌드 검사용, 쓰지 않는다)
//
// 배치 파일: scan-motions.bat (Windows) · scan-motions.sh (macOS/Linux)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { activePackDir } from '../active-pack';
import { buildAtlas, type SheetReport } from './build-atlas';
import { renderAtlasModule, writeIfChanged } from './emit';

/** 생성물이 놓이는 자리 — 활성 팩의 view/ 다 (P4: 모션 데이터는 팩 소유) */
export function atlasModulePath(root: string): string {
  return join(activePackDir(root), 'view', 'motion-atlas.generated.ts');
}

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
  const changed = writeIfChanged(atlasModulePath(root), renderAtlasModule(atlas, inputHash));
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
  const checkOnly = process.argv.includes('--check');
  const root = projectRoot();
  const atlasPath = relative(root, atlasModulePath(root));

  if (checkOnly) {
    // 쓰지 않고 최신인지만 본다 — 생성물을 커밋해 두었으므로 어긋나면 알려야 한다.
    const { atlas, reports, inputHash } = buildAtlas(root);
    const expected = renderAtlasModule(atlas, inputHash);
    const current = readFileSync(atlasModulePath(root), 'utf8').toString();
    console.log(formatReport(reports));
    if (current !== expected) {
      console.error(`\n  [오류] ${atlasPath} 가 motions/ 와 어긋난다 — npm run motions:scan 을 실행하라.`);
      process.exit(1);
    }
    console.log(`\n  ${atlasPath} 는 motions/ 와 일치한다.`);
    process.exit(0);
  }

  const { changed, reports, warnings } = scanMotions(root);
  console.log('');
  console.log('  Motion Atlas — motions/ 정적 분석');
  console.log('  ' + '-'.repeat(96));
  console.log(formatReport(reports));
  console.log('  ' + '-'.repeat(96));
  console.log(
    `  시트 ${reports.length}장 · 경고 ${warnings}건 · ${atlasPath} ${
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
