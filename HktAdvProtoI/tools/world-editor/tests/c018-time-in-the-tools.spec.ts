// C018 — 도구가 시간을 읽는다 (SPEC-009 검사 넷 · SPEC-010 `--at <철>`).
//
// 도구가 하는 일은 여전히 둘뿐이다 — **게임 명사를 계약으로 건네는 것**과 **그 결과를 사람이
// 읽을 줄로 옮기는 것**. 판정은 전부 기반이 한다 (engine/world-authoring/check.ts). 그래서 이
// 파일이 다시 세는 수는 하나도 없고, 재는 것은 도구의 **행동** 셋이다:
//
//   ① 검사 넷이 스물둘 뒤에 이어 붙고 그 어느 것도 끊긴 참조로 걸리지 않는다
//   ② `--at` 을 밝히지 않으면 보고가 **한 글자도** 달라지지 않는다
//   ③ `--at` 은 보고에만 얹힌다 — **그림은 한 값도 달라지지 않는다** (spec 기본형 ⑪)

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMPILE_RULES, SETTLEMENT_LAYER, regionSpec } from '../../../content/regions';
import { compileRegion } from '../../../engine/world-authoring/compile';
import { runWorldCheck } from '../check';
import { observeRegion, parseArgs, renderRegionReport, renderUsage } from '../observe';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const OBSERVE = 'tools/world-editor/observe.ts';

/** 이 시험이 보는 방 — 철의 덧씌움과 원천을 다 가진 자리 */
const ROOM = 'FOREST_EDGE';
const SPEC = regionSpec(ROOM)!;
const COMPILED = compileRegion(SPEC.space, COMPILE_RULES);

/**
 * ㉓~㉖ — 계통 열셋 뒤에 이어 붙은 넷이다.
 *
 * C029 CHANGED — 보고의 **맨 뒤**가 아니게 되었다 (요구와 가능성 아홉 ㉞~㊷ 이 그 뒤에 붙는다).
 * 재는 것은 그대로다: 이 넷이 **이 차례로 이어 붙어** 있는가 — 자리를 뒤에서 세지 않고
 * 열쇠로 찾아 그 차례를 본다.
 */
const TIME_IDS = ['time-phase-refs', 'time-route-refs', 'time-season-summary', 'time-reachable'];

describe('SPEC-009 — 검사 넷이 스물둘 뒤에 선다', () => {
  const report = runWorldCheck();

  it('번호 ㉓~㉖ 이 이 차례로 이어 붙고 열쇠가 표 그대로다', () => {
    const first = report.items.findIndex((item) => item.id === TIME_IDS[0]);
    expect(first).toBeGreaterThanOrEqual(0);
    const four = report.items.slice(first, first + 4);
    expect(four.map((item) => item.mark)).toEqual(['㉓', '㉔', '㉕', '㉖']);
    expect(four.map((item) => item.id)).toEqual(TIME_IDS);
  });

  it('넷 다 끊긴 참조로 걸리지 않는다 — 이 세계의 시간 데이터는 성립한다 (경계 ③)', () => {
    for (const id of TIME_IDS) {
      const item = report.items.find((i) => i.id === id)!;
      expect({ id, status: item.status }).not.toEqual({ id, status: 'fail' });
      // 한 줄 답에 **수**가 실린다 — 검사는 세는 것이다
      expect({ id, counted: /\d/.test(item.answer) }).toEqual({ id, counted: true });
    }
  });

  it('㉕ 는 판정하지 않는다 — 철마다 한 줄씩 적고 ok 를 거짓으로 만들지 않는다', () => {
    const summary = report.items.find((i) => i.id === 'time-season-summary')!;
    expect(summary.status).toBe('report');
    expect(summary.refs.length).toBeGreaterThan(0);
  });
});

/** 보고에서 위상 묶음(가로줄 + 그 아래 줄들)을 걷어 낸다 */
function withoutPhaseBlock(text: string): string {
  const lines = text.split('\n');
  const head = lines.findIndex((line) => line.startsWith('  위상 — '));
  if (head < 0) return text;
  const rule = lines[head - 1]!;
  const tail = lines.indexOf(rule, head);
  return [...lines.slice(0, head - 1), ...lines.slice(tail)].join('\n');
}

describe('SPEC-010 — 방 하나를 그 시각의 위상으로 읽는다', () => {
  const plain = renderRegionReport(SPEC, COMPILED, SETTLEMENT_LAYER);
  const at = renderRegionReport(SPEC, COMPILED, SETTLEMENT_LAYER, 'SEEP');

  it('(경계 ①) 밝히지 않으면 지금까지의 보고와 한 글자도 다르지 않다', () => {
    expect(plain).not.toContain('위상 — ');
    // 밝힌 보고에서 그 묶음만 걷어 내면 밝히지 않은 보고 그대로다
    expect(withoutPhaseBlock(at)).toBe(plain);
  });

  it('그 시각의 덧씌움 · 그때 열리는 문 · 그때 서는 원천이 적힌다', () => {
    expect(at).toContain('위상 — SEEP');
    // 이 방이 스밈에 밝힌 것 — 자락 하나가 깊어지고 그 자락이 위험으로 읽힌다
    expect(at).toContain('depth-edge-deep-trail');
    expect(at).toContain('hazard-edge-deep-trail');
    // 그 철에만 서는 원천은 그 철에 선다
    expect(at).toMatch(/SEEP_CRUST\s+선다/);
  });

  it('철이 다르면 답이 다르다 — 그 철이 아닌 원천은 서지 않는다고 적힌다', () => {
    const still = renderRegionReport(SPEC, COMPILED, SETTLEMENT_LAYER, 'STILL');
    expect(still).toContain('위상 — STILL');
    expect(still).toMatch(/SEEP_CRUST\s+서지 않는다/);
    expect(still).not.toContain('depth-edge-deep-trail');
  });

  it('(경계 ③) 그림은 한 값도 달라지지 않는다 — 컴파일러는 시각을 모른다', () => {
    const options = {
      pictures: ['height', 'surface', 'traversable', 'semantic', 'top'] as const,
      semanticLayer: SETTLEMENT_LAYER,
      report: false,
      outDir: 'tools/world-editor/out',
      scale: 1,
    };
    const bare = observeRegion(SPEC, { ...options, pictures: [...options.pictures] });
    const timed = observeRegion(SPEC, {
      ...options,
      pictures: [...options.pictures],
      season: 'SEEP',
    });
    expect(timed.pictures.map((p) => p.file)).toEqual(bare.pictures.map((p) => p.file));
    for (let i = 0; i < bare.pictures.length; i++) {
      expect(timed.pictures[i]!.png.equals(bare.pictures[i]!.png)).toBe(true);
    }
  });

  it('아는 철은 그대로 받고, 모르는 철은 무엇이 없는지 밝히고 멈춘다 (경계 ②)', () => {
    const good = parseArgs([ROOM, '--report', '--at', 'SEEP']);
    expect(good.kind === 'region' && good.options.season).toBe('SEEP');

    const bad = parseArgs([ROOM, '--report', '--at', 'SPRING']);
    expect(bad.kind).toBe('usage');
    expect(bad.kind === 'usage' && bad.unknown).toEqual(['--at SPRING']);
    // 무엇이 없는지 — 아는 철을 밝힌다
    const usage = renderUsage(['--at SPRING']);
    expect(usage).toContain('아는 철: STILL · SEEP · LONG_NIGHT · TURN');
    expect(usage).toContain('아무것도 하지 않았다');
  });

  it('(경계 ②) 밖에서 돌려도 멈춘다 — 종료 코드 2 이고 보고를 내지 않는다', () => {
    const result = spawnSync('npx', ['tsx', OBSERVE, ROOM, '--report', '--at', 'SPRING'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    expect(result.status).toBe(2);
    expect(result.stdout).toContain('--at SPRING');
    expect(result.stdout).not.toContain('World Observe — FOREST_EDGE 의 땅');
  });
});
