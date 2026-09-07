// World Admit — 후보 하나를 세계에 들인다 (T6 ADDED).
//
//   npm run world:admit -- <후보이름>            승인 — brief 를 굳히고 방을 굳힌다
//   npm run world:admit -- <후보이름> --reject   반려 — 머무는 자리에서 지운다
//   쓸 수 있는 것: --out <디렉터리> (후보가 머무는 자리)
//
// **승인만 `content/regions/` 에 들어간다** (Tool-Scale §4 · T6). 그 문장을 코드로 옮긴 자리가
// 여기다. 초안기도 목록 돌리기도 세계를 만지지 않는다 — 세계에 방이 들어오는 길은 이 명령 하나뿐이고,
// 그 명령은 사람이 친다.
//
// 서지 못한 방은 들이지 않는다. 등급 B·C 는 애초에 서지 못한 것으로 돌아오므로(T5 의 고리가
// 그렇게 가른다) 이 자리에서 다시 판정할 것이 없다 — 그것들은 Cycle 의 것이다 (§5).
//
// 반려는 세계를 되돌리는 일이 아니다. 후보는 처음부터 세계가 아니었으므로 지우면 그만이다.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorBrief, renderSeams, writeRegionModule } from './author';
import {
  CANDIDATES_DIR,
  readCandidates,
  removeCandidate,
  type Candidate,
} from './candidates';
import { briefPathOf } from './draft';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * 굳힐 자리 둘. 기본값이 곧 세계다 — 시험만이 다른 자리를 준다 (저장소를 만지지 않으려고).
 * 자리를 인자로 받는다고 해서 쓰는 자가 늘지는 않는다: 부르는 자리는 여전히 이 명령 하나다.
 */
export interface AdmitDirs {
  briefs?: string;
  regions?: string;
}

/** 승인 — 굳힌 자리 둘과 손으로 옮길 줄들을 돌려준다 */
export function admit(
  candidate: Candidate,
  dirs: AdmitDirs = {},
): { brief: string; region: string; seams: string } {
  if (candidate.judgement.outcome !== 'passed' || !candidate.brief) {
    throw new Error(
      `${candidate.key} 는 서지 못한 방이다 (${candidate.judgement.outcome}) — 세계에 들일 수 없다`,
    );
  }
  // brief 가 원본이다. 방 파일은 여기서 다시 낼 수 있는 것이고, brief 는 그렇지 않다
  const briefPath = dirs.briefs
    ? `${dirs.briefs}/${candidate.brief.id}.json`
    : briefPathOf(candidate.brief);
  const out = resolve(ROOT, briefPath);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(candidate.brief, null, 2)}\n`, 'utf8');

  const authored = authorBrief(candidate.brief);
  return {
    brief: briefPath,
    region: dirs.regions ? writeRegionModule(authored, dirs.regions) : writeRegionModule(authored),
    seams: renderSeams(authored),
  };
}

function main(argv: readonly string[]): number {
  const valueOf = (name: string): string | undefined => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const known = ['--reject', '--out'];
  const unknownFlags = argv.filter((arg) => arg.startsWith('--') && !known.includes(arg));
  const values = ['out'].map(valueOf).filter((v) => v !== undefined);
  const names = argv.filter((arg) => !arg.startsWith('--') && !values.includes(arg));

  if (names.length !== 1 || unknownFlags.length > 0) {
    process.stderr.write(
      [
        '  world:admit — 후보 하나를 세계에 들인다 (또는 반려한다)',
        unknownFlags.length > 0
          ? `    모르는 인자: ${unknownFlags.join(' ')}`
          : '    후보 이름을 하나만 밝힌다',
        '    사용: npm run world:admit -- <후보이름> [--reject] [--out 디렉터리]',
        '',
      ].join('\n'),
    );
    return 2;
  }

  const dir = valueOf('out') ?? CANDIDATES_DIR;
  const name = names[0]!;
  const candidate = readCandidates(dir).find((c) => c.key === name);
  if (!candidate) {
    process.stderr.write(`  그런 후보가 없다: ${name} (${dir})\n`);
    return 1;
  }

  if (argv.includes('--reject')) {
    removeCandidate(dir, name);
    process.stdout.write(`  반려했다: ${name} — 세계는 만진 적이 없다.\n`);
    return 0;
  }

  let written: { brief: string; region: string; seams: string };
  try {
    written = admit(candidate);
  } catch (error) {
    process.stderr.write(`  ${(error as Error).message}\n`);
    return 1;
  }
  // 들였으므로 머무는 자리에 남을 이유가 없다
  removeCandidate(dir, name);
  process.stdout.write(
    [
      `  들였다: ${name}`,
      `    brief   ${written.brief}`,
      `    방      ${written.region}`,
      '',
      written.seams,
      '',
      '  이어 붙인 뒤 검사한다:',
      '    npm run world:check',
      '',
    ].join('\n'),
  );
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  process.exitCode = main(process.argv.slice(2));
}
