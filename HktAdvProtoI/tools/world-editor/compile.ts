// World Compile — 같은 방을 **두 번** 컴파일해 hash 가 같은지 읊는다 (C007 ADDED · SPEC-006 경계).
//
//   npm run world:compile -- <REGION_ID>
//
// 완료 조건 1("두 번 컴파일하면 같은 hash")이 요구하는 것은 이것뿐이다 — **파일을 쓰지 않는다.**
// 컴파일 산출을 파일로 굽는 것(*.compiled.generated.ts)은 spec 의 Out of Scope 다: 그것을 읽을
// 소비처가 아직 없고, 굽기는 생성물의 낡음(stale) 문제를 함께 데려온다.
//
// 읽기 전용이고 판정하지 않는다 — 두 hash 가 같은지를 **적을** 뿐이고, 그것이 무엇을 뜻하는지는
// 읽는 사람의 몫이다. 종료 코드도 바꾸지 않는다.

import { resolve } from 'node:path';
import { COMPILE_RULES, REGION_SPECS, regionSpec } from '../../content/regions';
import { compileRegion } from '../../engine/world-authoring/compile';
import { summarize } from '../../engine/world-authoring/observe';

export function renderCompile(regionId: string): string {
  const spec = regionSpec(regionId);
  if (!spec) return renderUsage([regionId]);

  // 두 번 — 같은 입력에서 같은 값이 나오는지 보는 것이 이 도구의 전부다.
  // 두 번째를 첫 번째의 복사가 아니라 **다시 컴파일**해야 뜻이 있다.
  const first = compileRegion(spec.space, COMPILE_RULES);
  const second = compileRegion(spec.space, COMPILE_RULES);
  const s = summarize(first);

  const lines: string[] = [];
  lines.push('');
  lines.push(`  World Compile — ${spec.id} (두 번 컴파일 · 파일을 쓰지 않는다)`);
  lines.push('  ' + '-'.repeat(100));
  lines.push(`    hash 1  ${first.hash}`);
  lines.push(`    hash 2  ${second.hash}`);
  lines.push(`    같은가  ${first.hash === second.hash ? '같다' : '다르다'}`);
  lines.push('  ' + '-'.repeat(100));
  lines.push(`    격자      ${s.cols}×${s.rows} (resolution ${s.resolution}) · vertex ${s.vertices}`);
  lines.push(`    높이      ${s.height.min.toFixed(2)} ~ ${s.height.max.toFixed(2)}`);
  lines.push(`    표면      ${s.surface.map((row) => `${row.tag} ${row.cells}`).join(' · ')}`);
  lines.push(
    `    막힘      ${s.blocked.length === 0 ? '없다' : s.blocked.map((row) => `${row.tag} ${row.cells}`).join(' · ')}`,
  );
  lines.push(`    통행/막힘 ${s.traversableCells} / ${s.blockedCells}`);
  lines.push(`    area ${s.areas.length} · point ${s.points.length}`);
  lines.push(`    chunk ${s.chunks} (chunkSize ${s.chunkSize}) · instance ${s.instances}`);
  lines.push('');
  return lines.join('\n');
}

/** 모르는 것을 받았을 때 — 아는 것을 밝히고 아무것도 하지 않는다 (SPEC-007 경계) */
export function renderUsage(unknown: readonly string[]): string {
  return [
    '',
    `  모르는 인자: ${unknown.join(' ')}`,
    '  사용: npm run world:compile -- <REGION_ID>',
    `  아는 방: ${REGION_SPECS.map((spec) => spec.id).join(' · ')}`,
    '  아무것도 하지 않았다. 세계도 파일도 그대로다.',
    '',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const args = process.argv.slice(2);
  const regions = args.filter((arg) => !arg.startsWith('-'));
  const flags = args.filter((arg) => arg.startsWith('-'));
  if (flags.length > 0 || regions.length !== 1) {
    console.log(renderUsage(flags.length > 0 ? flags : regions.length === 0 ? ['(방 이름이 없다)'] : regions.slice(1)));
  } else {
    console.log(renderCompile(regions[0]!));
  }
}
