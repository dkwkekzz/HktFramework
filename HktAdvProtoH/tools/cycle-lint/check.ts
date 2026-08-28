// Cycle Lint — Cycle artifact 의 명세형 표기법 검사. 아무것도 쓰지 않는다.
//
//   npm run cycle:lint -- <CycleId>        해당 Cycle 디렉터리 검사 (부분 일치 허용)
//   npm run cycle:lint -- --all            cycles/ 전부 (과거 Cycle 은 참고용 — History 는 고치지 않는다)
//
// 근거 규칙 (.claude/skills/advprotoh-cycle/references/artifact-format.md "표기법"):
//   ERROR  골격에 없는 절 · 금지된 절(02 의 DESIGN TRACE — 인라인 Trace 로 흡수됨)
//   WARN   파일이 경보 길이를 넘는다 — 게이트가 아니라 형식 이탈의 연기 감지기다.
//          길이 자체는 위반이 아니다: 실측·경계·부정형 발견이 길어진 것이면 정상이고,
//          수사·재설명이 길어진 것이면 표기법 위반이 이미 ERROR 로 잡혔어야 한다.
//
// 종료 코드: ERROR 있으면 1, WARN 만 있으면 0.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activePackDir } from '../active-pack';

function projectRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

// 파일별 허용 절 — artifact-format.md 골격의 `## ` 절 이름. 절 제목의 " — 부제" 는 무시한다.
const SECTIONS: Record<string, { allowed: string[]; banned?: Record<string, string>; warnLines: number }> = {
  '01-cycle.md': {
    allowed: ['MASTER TRACE', 'TYPE', 'TARGET CAPABILITY', 'GOAL', 'INCLUDED', 'EXCLUDED',
      'RELATED EXISTING CAPABILITY'],
    warnLines: 130,
  },
  '02-intent.md': {
    allowed: ['GOAL / POSSIBILITY', 'INTENT SET', 'EXISTING INTENT DELTA'],
    banned: { 'DESIGN TRACE': 'Trace 는 INTENT SET 항목 인라인이다 (표기법 4)' },
    warnLines: 150,
  },
  '03-world-semantic.md': {
    allowed: ['SEMANTIC DELTA', 'WORLD STATE', 'WORLD RULE', 'OBSERVABLE SEMANTIC', 'SEMANTIC CLOSURE'],
    warnLines: 200,
  },
  '06-world-implementation.md': {
    allowed: ['IMPLEMENTED', 'REUSED', 'AFFECTED UPDATED', 'PROJECTION', 'TESTS', 'NOTES'],
    warnLines: 100,
  },
  '07-view-implementation.md': {
    allowed: ['SPEC CONSUMED', 'ASSET MAPPING', 'INPUT → ACTION REQUEST', 'FIXTURE TESTS', 'NOTES'],
    warnLines: 100,
  },
  '08-verification.md': {
    allowed: ['NEW BEHAVIOR', 'WORLD SCENARIO', 'VIEW FIXTURE', 'PLAYABLE', 'REGRESSION',
      'MASTER FEEDBACK', 'FAILURES', 'STATUS', '부채', 'MERGE'],
    warnLines: 160,
  },
};
// 어느 파일에서든 허용 — 막힘의 기록
const ALWAYS_ALLOWED = ['GAP', 'MASTER GAP'];

type Finding = { level: 'ERROR' | 'WARN'; file: string; message: string };

function lintCycle(cycleDir: string, cycleId: string): Finding[] {
  const findings: Finding[] = [];
  for (const [fileName, spec] of Object.entries(SECTIONS)) {
    const path = join(cycleDir, fileName);
    if (!existsSync(path)) continue; // 아직 그 Stage 전 — lint 의 일이 아니다
    const text = readFileSync(path, 'utf8');
    const lines = text.split('\n');

    for (const line of lines) {
      const m = /^## (.+)$/.exec(line);
      if (!m) continue;
      const title = (m[1] ?? '').split('—')[0]?.trim() ?? ''; // "PLAYABLE — 실제 게임 실측" → "PLAYABLE"
      if (spec.banned?.[title]) {
        findings.push({ level: 'ERROR', file: `${cycleId}/${fileName}`,
          message: `금지된 절 "## ${title}" — ${spec.banned[title]}` });
      } else if (!spec.allowed.includes(title) && !ALWAYS_ALLOWED.some((g) => title.startsWith(g))) {
        findings.push({ level: 'ERROR', file: `${cycleId}/${fileName}`,
          message: `골격에 없는 절 "## ${title}" — 허용: ${spec.allowed.join(' · ')} (표기법 2)` });
      }
    }

    if (lines.length > spec.warnLines) {
      findings.push({ level: 'WARN', file: `${cycleId}/${fileName}`,
        message: `${lines.length}줄 — 경보 기준 ${spec.warnLines}줄. 수사·재설명이 아닌지 훑어볼 것 (기준 예시: notation-example/)` });
    }
  }
  return findings;
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const packDir = activePackDir(projectRoot());
  const cyclesDir = join(packDir, 'cycles');
  const all = readdirSync(cyclesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  let targets: string[];
  if (args.includes('--all')) {
    targets = all;
  } else if (args.length > 0) {
    targets = all.filter((name) => args.some((a) => name === a || name.startsWith(a) || name.includes(a)));
    if (targets.length === 0) {
      console.error(`cycle:lint — "${args.join(' ')}" 에 맞는 Cycle 이 없다. cycles/ 의 디렉터리 이름으로 지정할 것.`);
      process.exit(1);
    }
  } else {
    console.log('사용법: npm run cycle:lint -- <CycleId>   또는   npm run cycle:lint -- --all');
    console.log(`Cycle ${all.length}개: ${all.slice(-5).join(' · ')} …`);
    return;
  }

  let errors = 0;
  let warns = 0;
  for (const name of targets) {
    for (const f of lintCycle(join(cyclesDir, name), name)) {
      if (f.level === 'ERROR') errors += 1;
      else warns += 1;
      console.log(`[${f.level}] ${f.file} — ${f.message}`);
    }
  }
  console.log(`cycle:lint — 대상 ${targets.length} · ERROR ${errors} · WARN ${warns}`);
  if (errors > 0) process.exit(1);
}

main();
