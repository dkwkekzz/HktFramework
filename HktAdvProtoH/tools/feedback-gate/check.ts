// Feedback Gate — Master Feedback / Master 작업 시작 전 검사. 아무것도 쓰지 않는다.
//
//   npm run feedback:gate              실행 위치(최신 main) + 미처리 MASTER FEEDBACK 검사
//   npm run feedback:gate -- --pending 미처리 목록만 본다 (git 검사 생략 — 어디서든 안전)
//
// 근거 규칙 (guides/master-feedback.md "Where"):
//   Feedback 은 공유 파일(overlay 원천 · capabilities.yaml)을 고치므로 그 Cycle 이
//   main 에 병합된 뒤, 최신 main 위에서만 돈다. 밀린 Cycle 은 배치로 처리한다.
//
// 검사 대상은 트랙 번호공간(C-<TRACK>-NNN-*)의 Cycle 뿐이다 — C001~C023 은 feedback/
// 도입 전에 닫혔고 그 경위는 HISTORY.md 가 이미 소유한다.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activePackDir } from '../active-pack';

function projectRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

const TRACK_CYCLE = /^C-[A-Z]+-\d+/;

function git(root: string, cmd: string): string | null {
  try {
    return execSync(`git ${cmd}`, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

/** 미처리 = 08-verification 에 MASTER FEEDBACK 이 있는데 feedback/<CycleId>.md 가 없다 */
function pendingCycles(packDir: string): string[] {
  const cyclesDir = join(packDir, 'cycles');
  const feedbackDir = join(packDir, 'master', 'feedback');
  if (!existsSync(cyclesDir)) return [];
  const pending: string[] = [];
  for (const entry of readdirSync(cyclesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !TRACK_CYCLE.test(entry.name)) continue;
    const verification = join(cyclesDir, entry.name, '08-verification.md');
    if (!existsSync(verification)) continue; // 아직 닫히지 않았다
    if (!readFileSync(verification, 'utf8').includes('MASTER FEEDBACK')) continue;
    if (!existsSync(join(feedbackDir, `${entry.name}.md`))) pending.push(entry.name);
  }
  return pending.sort();
}

export function run(argv: string[]): number {
  const pendingOnly = argv.includes('--pending');
  const root = projectRoot();
  const packDir = activePackDir(root);
  let failed = false;

  if (!pendingOnly) {
    // 1) 실행 위치 — 최신 main 위인가. fetch 가 안 되는 환경이면 로컬 origin/main 으로 검사한다.
    const fetched = git(root, 'fetch origin main --quiet') !== null;
    if (!fetched) console.log('· origin fetch 실패 — 로컬에 있는 origin/main 기준으로 검사한다');
    const head = git(root, 'rev-parse HEAD');
    const originMain = git(root, 'rev-parse origin/main');
    if (!head || !originMain) {
      console.error('✗ git 상태를 읽을 수 없다 — 저장소 루트에서 실행할 것');
      return 1;
    }
    if (head !== originMain) {
      const branch = git(root, 'rev-parse --abbrev-ref HEAD');
      console.error(`✗ HEAD(${branch} · ${head.slice(0, 7)}) 가 origin/main(${originMain.slice(0, 7)}) 이 아니다`);
      console.error('  Feedback 과 Master 작업은 병합 뒤 최신 main 위에서만 돈다 (guides/master-feedback.md Where)');
      failed = true;
    } else {
      console.log(`· 실행 위치 통과 — 최신 main (${head.slice(0, 7)})`);
    }
  }

  // 2) 미처리 MASTER FEEDBACK — 이것부터 돌린다 (다른 Master 작업보다 먼저)
  const pending = pendingCycles(packDir);
  if (pending.length === 0) {
    console.log('· 미처리 MASTER FEEDBACK 없음');
  } else {
    console.log(`· 미처리 MASTER FEEDBACK ${pending.length}건 — Feedback 을 먼저 돌릴 것:`);
    for (const id of pending) console.log(`    ${id}  →  master/feedback/${id}.md 없음`);
  }

  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(run(process.argv.slice(2)));
}
