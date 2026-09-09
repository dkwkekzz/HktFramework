// C025 E18 — world:run 이 **아무도 없는 세계**를 굴려 값의 궤적을 낸다 (SPEC-009).
//
// 도구를 **밖에서** 돌린다 — `npx tsx tools/world-editor/run.ts` 를 자식 프로세스로 띄우고
// 그 글자와 종료 코드만 본다. 그래야 "두 번 돌리면 글자까지 같다 · 저장소에 쓰지 않는다" 를
// 실제로 잴 수 있다 (c007-observe.spec.ts 의 S-029 가 그런 그대로).
//
// 이 파일이 다시 세는 수는 하나도 없다 — 개체군의 이름도 상한도 세계 데이터에서 온다.

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REGION_SPECS } from '../../../content/regions';
import { SEASONS_PER_CYCLE } from '../../../content/world/semantic/clock';
import { WATCHED_POPULATIONS, parseArgs, runWorld } from '../run';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const RUN = 'tools/world-editor/run.ts';

function run(args: readonly string[]) {
  const result = spawnSync('npx', ['tsx', RUN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return { status: result.status, out: result.stdout ?? '', err: result.stderr ?? '' };
}

/** 도구가 손댈 수 있는 자리의 지금 — 커밋된 것과 견준다 (c007-observe.spec.ts 의 어법) */
const trackedChanges = () =>
  execFileSync(
    'git',
    ['status', '--porcelain', '-uall', '--', 'engine', 'content', 'app', 'server', 'tools', 'package.json'],
    { cwd: ROOT, encoding: 'utf8' },
  );

describe('world:run — 관찰자가 하나도 없는 채로 세계를 굴린다', () => {
  const before = trackedChanges();
  // 인자를 하나도 주지 않아도 돈다 — 기본이 두 바퀴다 (Play 완료 확인 ⑥)
  const first = run([]);
  const second = run([]);
  const after = trackedChanges();

  it('인자 없이 돌고, 같은 인자로 두 번 돌리면 글자까지 같다 (SPEC-009 ②)', () => {
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(second.out).toBe(first.out);
    expect(first.out).toContain('개체군의 궤적');
  });

  it('저장소에 한 값도 쓰지 않는다 (SPEC-009 경계 ③)', () => {
    expect(after).toBe(before);
    // 쓸 손조차 없다 — 이 도구는 파일 쓰기를 아예 부르지 않는다
    expect(readFileSync(join(ROOT, RUN), 'utf8')).not.toContain('node:fs');
  });

  it('관찰자가 하나도 없다 — 굴리는 동안 아무도 들어오지 않았다 (SPEC-009 ①)', () => {
    const report = runWorld({ cycles: 1, dt: 60 });
    expect(report.observers).toBe(0);
    expect(first.out).toContain('관찰자 0');
  });

  it('철이 바뀔 때마다 한 줄이다 — 한 바퀴면 처음 한 줄 + 철 넷', () => {
    const report = runWorld({ cycles: 1, dt: 60 });
    expect(report.trajectory.length).toBe(SEASONS_PER_CYCLE + 1);
    // 철의 수는 0 에서 시작해 한 바퀴에 넷이 는다 (시계가 세는 그 수 그대로)
    expect(report.trajectory.map((step) => step.seasonIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('무엇을 낼지는 세계에서 읽어 온다 — 개체군 이름을 도구가 적지 않는다', () => {
    const ids = REGION_SPECS.flatMap((spec) =>
      (spec.ecology?.populations ?? []).map((population) => population.id),
    );
    expect(WATCHED_POPULATIONS.map((population) => population.id)).toEqual(ids);
    for (const id of ids) expect(first.out).toContain(id);
  });

  it('모르는 인자에는 무엇이 틀렸는지 밝히고 아무것도 하지 않는다', () => {
    for (const args of [['--rainbow'], ['--cycles', '0'], ['--dt', 'x'], ['--cycles']]) {
      const attempt = run(args);
      expect({ args, status: attempt.status }).toEqual({ args, status: 2 });
      expect({ args, said: attempt.out.includes('아무것도 하지 않았다') }).toEqual({
        args,
        said: true,
      });
    }
    expect(trackedChanges()).toBe(before);
  });

  it('인자를 밝히면 그대로 받는다 — 기본은 두 바퀴다', () => {
    expect(parseArgs([])).toMatchObject({ kind: 'run', options: { cycles: 2 } });
    expect(parseArgs(['--cycles', '3', '--dt', '1'])).toMatchObject({
      kind: 'run',
      options: { cycles: 3, dt: 1 },
    });
  });
});
