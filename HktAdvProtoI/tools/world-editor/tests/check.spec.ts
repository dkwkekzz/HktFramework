// T1 — world:check 가 검사 아홉을 명령 하나로 내고, 그 결과를 기계가 읽는다.
//
// 도구를 **밖에서** 돌린다 — `npx tsx tools/world-editor/check.ts` 를 자식 프로세스로 띄우고
// 그 글자와 종료 코드만 본다. 그래야 "JSON 을 낸다 · npm test 에 붙는다" 를 실제로 잴 수 있다.
//
// 기대값은 도구가 아니라 기반이 낸 보고에서 온다 — 이 파일이 다시 세는 수는 하나도 없다.
// **전체 개수를 단언하지 않는다** — 이 단계가 더한 것의 존재와 행동만 본다.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkRegions, type CheckReport } from '../../../engine/world-authoring/check';
import { REGION_GRAPH } from '../../../content/regions';
import { WORLD_CHECK_CONTRACT, WORLD_CHECK_REGIONS, runWorldCheck } from '../check';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CHECK = 'tools/world-editor/check.ts';

function run(args: readonly string[]) {
  const result = spawnSync('npx', ['tsx', CHECK, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return { status: result.status, out: result.stdout ?? '', err: result.stderr ?? '' };
}

describe('world:check — 명령 하나가 JSON 을 낸다', () => {
  const plain = run([]);

  it('stdout 이 통째로 JSON 이다 — 사람이 읽을 머리말이 섞이지 않는다', () => {
    const parsed = JSON.parse(plain.out) as CheckReport;
    expect(parsed).toMatchObject({
      ok: expect.any(Boolean),
      counts: { pass: expect.any(Number), fail: expect.any(Number) },
      items: expect.any(Array),
    });
    // 항목마다 기계가 잡을 것이 다 있다 — 번호 · 열쇠 · 판정 · 참조
    for (const item of parsed.items) {
      expect(item).toMatchObject({
        mark: expect.any(String),
        id: expect.any(String),
        status: expect.stringMatching(/^(pass|fail|absent|report)$/),
        answer: expect.any(String),
        refs: expect.any(Array),
      });
    }
  });

  it('낸 것이 기반의 보고 그대로다 — 도구가 고쳐 적지 않는다', () => {
    expect(JSON.parse(plain.out)).toEqual(JSON.parse(JSON.stringify(runWorldCheck())));
  });

  it('--pretty 는 같은 것을 들여쓸 뿐이다', () => {
    const pretty = run(['--pretty']);
    expect(pretty.status).toBe(plain.status);
    expect(JSON.parse(pretty.out)).toEqual(JSON.parse(plain.out));
    expect(pretty.out.split('\n').length).toBeGreaterThan(plain.out.split('\n').length);
  });

  it('두 번 돌리면 글자까지 같다 — 읽기 전용 관찰이다', () => {
    expect(run([]).out).toBe(plain.out);
  });

  it('종료 코드가 판정이다 — fail 이 없으면 0', () => {
    const report = JSON.parse(plain.out) as CheckReport;
    expect({ ok: report.ok, status: plain.status }).toEqual({ ok: report.ok, status: report.ok ? 0 : 1 });
  });

  it('(경계) 모르는 인자에는 아는 것을 밝히고 아무것도 내지 않는다', () => {
    const bad = run(['--nope']);
    expect(bad.status).toBe(2);
    expect(bad.out).toBe('');
    expect(bad.err).toContain('--nope');
    expect(bad.err).toContain('--pretty');
  });
});

describe('world:check — 일부러 만든 실패가 이 세계에서도 잡힌다 (T1 완료 조건)', () => {
  // 시나리오가 아니라 **이 세계의 명사 그대로** 하나만 깨 본다 —
  // 검사가 헛돌지 않는다는 것을 이 세계에서 재려면 이 세계의 계약으로 재야 한다.
  const broken = (regions: typeof WORLD_CHECK_REGIONS) =>
    checkRegions({ regions, graph: REGION_GRAPH, contract: WORLD_CHECK_CONTRACT });

  it('지금 이 세계는 통과한다 — 그래야 깨뜨린 것이 뜻을 갖는다', () => {
    expect(runWorldCheck().ok).toBe(true);
  });

  it('첫 방의 depth 를 지우면 ② 가 그 방을 집어내고 ok 가 false 가 된다', () => {
    const victim = WORLD_CHECK_REGIONS[0]!;
    const report = broken([{ ...victim, depth: '' }, ...WORLD_CHECK_REGIONS.slice(1)]);
    expect(report.ok).toBe(false);
    const item = report.items.find((i) => i.id === 'region-depth')!;
    expect(item.status).toBe('fail');
    expect(item.refs.map((ref) => ref.where)).toEqual([victim.id]);
    // 나머지 여덟은 깨진 것이 없다 — 하나를 깨면 하나가 걸린다
    expect(report.counts.fail).toBe(1);
  });

  it('방 하나를 그래프에서 떼면 ⑦⑧ 이 함께 집어낸다', () => {
    const orphan = { ...WORLD_CHECK_REGIONS[0]!, id: 'ORPHAN_ROOM' };
    const report = checkRegions({
      regions: [...WORLD_CHECK_REGIONS, orphan],
      graph: { ...REGION_GRAPH, regions: [...REGION_GRAPH.regions, 'ORPHAN_ROOM'] },
      contract: WORLD_CHECK_CONTRACT,
    });
    expect(report.ok).toBe(false);
    for (const id of ['region-exit', 'region-reachable']) {
      const item = report.items.find((i) => i.id === id)!;
      expect({ id, status: item.status, refs: item.refs.map((r) => r.where) }).toEqual({
        id,
        status: 'fail',
        refs: ['ORPHAN_ROOM'],
      });
    }
  });
});
