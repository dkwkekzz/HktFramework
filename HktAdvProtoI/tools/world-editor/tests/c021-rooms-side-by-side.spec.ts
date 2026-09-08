// C021 — 두 Region 이 한 보고에 나란히 선다 (spec SPEC-006).
//
// 도구를 **밖에서** 돌린다 — `npx tsx tools/world-editor/observe.ts --report` 를 자식
// 프로세스로 띄우고 그 글자와 저장소만 본다 (c007-observe.spec.ts 가 세운 그 짝).
//
// 이 파일이 다시 세는 수는 하나도 없다. 재는 것은 도구의 **행동** 넷이다:
//   ① 방 없이 `--report` 를 주면 **세계의 보고**가 나온다 — 검사와 방마다의 절
//   ② 방마다의 절이 REGION_SPECS 차례로 서고 **원천이 없는 방도** 적힌다
//   ③ 그 절의 값이 검사 ⑲ ⑳ 의 refs 그대로다 — 새로 세지 않는다
//   ④ 경계 ① 읽기 전용 · 경계 ② 두 번 돌리면 글자까지 같다
//
// 그리고 회귀 하나 — 방 하나의 보고(`<방> --report`)는 이 절이 얹히지 않아 그대로다.

import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REGION_SPECS } from '../../../content/regions';
import { runWorldCheck } from '../check';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const OBSERVE = 'tools/world-editor/observe.ts';

/** 이 절의 쓸모가 걸린 세 방 — 협곡 둘과, 그 둘과 견줄 백왕령 */
const SIDE_BY_SIDE = ['ICE_CANYON', 'FROST_CANYON', 'WHITE_KING_DOMAIN'] as const;

interface Run {
  status: number | null;
  out: string;
}

function run(args: readonly string[]): Run {
  const result = spawnSync('npx', ['tsx', OBSERVE, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const WORLD = run(['--report']);

/** 방마다의 절 — 그 머리글부터 끝까지 */
function roomSection(text: string): string {
  const at = text.search(/^ {2}방마다 /m);
  return at < 0 ? '' : text.slice(at);
}

/** 그 방의 묶음 — 방 이름 줄부터 다음 방 이름 줄 앞까지 */
function block(text: string, regionId: string): string {
  const section = roomSection(text);
  const from = section.indexOf(`\n    ${regionId}\n`);
  if (from < 0) return '';
  const rest = section.slice(from + 1);
  const next = rest.search(/\n {4}[A-Z][A-Z_]*\n/);
  return next < 0 ? rest : rest.slice(0, next);
}

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-006 — 두 Region 이 한 보고에 나란히 선다', () => {
  it('S-001 방 없이 --report 를 주면 세계의 보고가 나온다 — 검사와 방마다의 절', () => {
    expect(WORLD.status).toBe(0);
    // 검사 절이 먼저, 방마다의 절이 그 뒤다
    const check = WORLD.out.search(/^ {2}검사 /m);
    const rooms = WORLD.out.search(/^ {2}방마다 /m);
    expect({ check: check >= 0, rooms: rooms > check }).toEqual({ check: true, rooms: true });
    // 검사는 도구가 세지 않는다 — 기반이 낸 만큼 실린다
    const items = runWorldCheck().items;
    expect(WORLD.out).toContain(`  검사 ${items.length} `);
    for (const item of items) expect(WORLD.out).toContain(item.answer);
  });

  it('S-002 방이 REGION_SPECS 차례로 서고 원천이 없는 방도 적힌다', () => {
    const section = roomSection(WORLD.out);
    expect(section).toContain(`  방마다 ${REGION_SPECS.length} `);
    let cursor = -1;
    for (const spec of REGION_SPECS) {
      const at = section.indexOf(`\n    ${spec.id}\n`);
      expect({ id: spec.id, inOrder: at > cursor }).toEqual({ id: spec.id, inOrder: true });
      cursor = at;
    }
    // 방마다 세 줄이 다 선다 — 원천이 없는 방도 빠지지 않는다 ("원천 0" 도 사실이다)
    for (const spec of REGION_SPECS) {
      const mine = block(WORLD.out, spec.id);
      for (const label of ['기회 자리 분포', '붙잡는 것 분포', '흐름과 고립']) {
        expect({ id: spec.id, label, has: mine.includes(label) }).toEqual({
          id: spec.id,
          label,
          has: true,
        });
      }
    }
    // 이 세계에는 실제로 원천이 없는 방이 있다 — 검사가 헛돌지 않는다
    const empty = REGION_SPECS.filter((spec) => (spec.resourceEcology?.sources ?? []).length === 0);
    expect(empty.length).toBeGreaterThan(0);
    for (const spec of empty) expect(block(WORLD.out, spec.id)).toContain('원천 0');
  });

  it('S-003 그 값이 검사 ⑲ ⑳ 의 refs 그대로다 — 이 절이 새로 세는 수는 없다', () => {
    const items = runWorldCheck().items;
    const refs = (id: string) => items.find((item) => item.id === id)?.refs ?? [];
    // ⑳ 은 이미 방마다로 적힌 줄이다 — 그 글자가 그대로 실린다
    for (const ref of refs('ecology-carrier')) {
      expect({ where: ref.where, has: block(WORLD.out, ref.where).includes(ref.detail) }).toEqual({
        where: ref.where,
        has: true,
      });
    }
    // ⑲ 는 원천마다의 줄이다 — 그 방 몫의 자리 유형이 그 방 묶음에 남김없이 실린다
    for (const ref of refs('ecology-opportunity')) {
      const kind = ref.detail.slice(ref.detail.lastIndexOf(' ') + 1);
      expect({ where: ref.where, kind, has: block(WORLD.out, ref.where).includes(kind) }).toEqual({
        where: ref.where,
        kind,
        has: true,
      });
    }
  });

  it('S-004 협곡 둘이 백왕령과 나란히 읽힌다 — 고립의 이유까지 그 자리에 있다', () => {
    for (const id of SIDE_BY_SIDE) {
      const mine = block(WORLD.out, id);
      const reason = REGION_SPECS.find((spec) => spec.id === id)?.resourceEcology?.isolationReason;
      expect({ id, stands: mine.length > 0 }).toEqual({ id, stands: true });
      expect({ id, said: mine.includes(String(reason)) }).toEqual({ id, said: true });
      // 흐름은 방마다 적힌다 — 이 셋은 밖에서 받지도 보내지도 않는다 (C020 SPEC-009)
      expect(mine).toContain('유입 0 · 유출 0');
    }
  });

  it('S-005 (경계 ②) 두 번 돌리면 글자까지 같다', () => {
    expect(run(['--report']).out).toBe(WORLD.out);
  });

  it('S-006 (경계 ①) 돌린 앞뒤로 저장소에 는 것이 없다 — 읽기 전용이다', () => {
    // 기반 · 조립 · 이 도구의 자리를 통째로 견준다. content 는 이 보고가 **읽기만** 하는 자리이고
    // 다른 레인이 함께 쓰는 곳이므로 그 자리는 c007 의 S-029 가 소유한다 (겹쳐 돌아도 흔들리지 않게)
    const tracked = () =>
      execFileSync('git', ['status', '--porcelain', '-uall', '--', 'engine', 'app', 'server', 'tools/world-editor'], {
        cwd: ROOT,
        encoding: 'utf8',
      });
    const before = tracked();
    expect(run(['--report']).status).toBe(0);
    expect(tracked()).toBe(before);
  });
});

// ── 회귀 — 앞의 표면이 그대로인가 ────────────────────────────────────
describe('회귀', () => {
  it('R-001 방 하나의 보고에는 이 절이 얹히지 않는다 — C007 의 보고 그대로다', () => {
    const one = run(['WHITE_KING_DOMAIN', '--report']);
    expect(one.status).toBe(0);
    expect(one.out).toContain('  검사 아홉');
    expect(roomSection(one.out)).toBe('');
  });

  it('R-002 --graph 는 인자 없이 돌린 것과 글자까지 같다 (C004)', () => {
    expect(run(['--graph']).out).toBe(run([]).out);
  });

  it('R-003 (경계) 방 없이 그림을 밝히면 여전히 아무것도 하지 않는다', () => {
    const attempt = run(['--height']);
    expect(attempt.out).toContain('아무것도 하지 않았다');
    expect(attempt.status).toBe(2);
  });
});
