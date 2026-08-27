// V-018 — 되짚는 자리. **기억하는 규칙**만 확인한다 (그리는 일은 기반의 몫이다).
//
// 지키는 것 넷.
//   · 같은 사건을 두 번 세지 않는다 (세계는 수명이 다할 때까지 다시 보낸다)
//   · 세계가 준 시각으로 세운다 — 넣은 차례가 아니다
//   · 오래된 것은 밀려난다 — 되짚는 자리이지 장부가 아니다
//   · 고른 줄의 경위는 타격에만 있다. 무산·끊김에는 **왜 없는지**가 선다

import { beforeEach, describe, expect, it } from 'vitest';
import {
  EXECUTION_LOG_SURFACE_ID,
  executionLogSurface,
  loggedCount,
  moveLogSelection,
  pickLogEntry,
  rememberExecutions,
  forgetExecutions,
} from '../execution-log';
import { closeSurface } from '../surface-state';
import type { GameViewSnapshot } from '../../protocol/gameview';

const breakdown = {
  damageType: 'physical',
  attackerAllocation: 'balanced',
  targetAllocation: 'balanced',
  offenseStat: { name: 'physical-attack', value: 40 },
  baseDamage: 6,
  attackContribution: 20,
  rawDamage: 26,
  defenseStat: { name: 'physical-defense', value: 50 },
  penetrationStat: { name: 'physical-penetration', value: 0 },
  effectiveDefense: 50,
  defenseMultiplier: 0.67,
  finalDamage: 17,
  critical: { occurred: false, chance: 0.25, multiplier: 2, damageBeforeCritical: 17 },
  appliedDamage: 17,
};

function snap(partial: Partial<GameViewSnapshot> = {}): GameViewSnapshot {
  return {
    specId: 'test',
    scene: 'field',
    entities: [
      { id: 'me', kind: 'wanderer', name: 'Player 1', position: { x: 0, z: 0 }, state: 'idle' },
      { id: 'npc', kind: 'wanderer', name: 'Wanderer 1', position: { x: 1, z: 0 }, state: 'idle' },
    ],
    observer: { id: 'o', characterId: 'me', acknowledgedMark: 0 },
    hud: [{ id: 'world.time', label: '세계 시간', value: 100 }],
    strikes: [],
    contacts: [],
    cancels: [],
    ...partial,
  } as unknown as GameViewSnapshot;
}

const strike = (since: number, amount: number) => ({
  attackerId: 'npc',
  targetId: 'me',
  skill: 'attack',
  amount,
  at: { x: 0, z: 0 },
  since,
  breakdown: { ...breakdown, appliedDamage: amount, finalDamage: amount },
});

const rowsOf = (surface: ReturnType<typeof executionLogSurface>, id: string) =>
  surface.sections.find((s) => s.id === id)?.rows ?? [];

beforeEach(() => {
  forgetExecutions();
  closeSurface(EXECUTION_LOG_SURFACE_ID);
});

describe('rememberExecutions — 본 것을 쌓는다', () => {
  it('같은 사건을 두 번 세지 않는다 — 세계는 수명이 다할 때까지 다시 보낸다', () => {
    const s = snap({ strikes: [strike(10, 17)] as never });
    rememberExecutions(s);
    rememberExecutions(s);
    rememberExecutions(s);
    expect(loggedCount()).toBe(1);
  });

  it('세계가 준 시각으로 세운다 — 한 관찰에 여럿이 실려 와도 새것이 위다', () => {
    // 일부러 뒤섞어 보낸다: 넣은 차례로 세우면 이 검사가 깨진다
    rememberExecutions(snap({ strikes: [strike(5, 1), strike(30, 3), strike(20, 2)] as never }));
    const rows = rowsOf(executionLogSurface(snap()), 'log');
    expect(rows.map((r) => r.hint)).toEqual(['70s 전', '80s 전', '95s 전']);
  });

  it('셋이 한 목록에 선다 — 타격 · 무산 · 끊김', () => {
    rememberExecutions(
      snap({
        strikes: [strike(30, 17)] as never,
        contacts: [
          { attackerId: 'me', targetId: 'npc', skill: 'attack', at: { x: 0, z: 0 }, since: 20, reason: 'not-hostile' },
        ] as never,
        cancels: [
          { attackerId: 'me', targetId: 'npc', skill: 'heavy-attack', at: { x: 0, z: 0 }, since: 10 },
        ] as never,
      }),
    );
    const rows = rowsOf(executionLogSurface(snap()), 'log');
    expect(rows).toHaveLength(3);
    expect(rows[0]!.text).toContain('타격');
    expect(rows[1]!.text).toContain('무산');
    expect(rows[2]!.text).toContain('끊김');
  });

  it('내가 낸 일과 내게 일어난 일이 갈린다', () => {
    rememberExecutions(snap({ strikes: [strike(10, 17)] as never }));
    expect(rowsOf(executionLogSurface(snap()), 'log')[0]!.text).toContain('Wanderer 1 가');
  });
});

describe('고른 줄의 경위', () => {
  it('타격이면 산정 경위가 선다 — 타격 표시가 쓰는 그 한 줄이다', () => {
    rememberExecutions(snap({ strikes: [strike(10, 17)] as never }));
    const first = rowsOf(executionLogSurface(snap()), 'log')[0]!;
    pickLogEntry(first.id);
    const why = rowsOf(executionLogSurface(snap()), 'why');
    expect(why[0]!.text).toContain('6+20=26');
    expect(why[0]!.text).toContain('= 17');
  });

  it('무산이면 **왜 산정이 없는지**가 선다 — 없는 것과 못 읽은 것은 다르다', () => {
    rememberExecutions(
      snap({
        contacts: [
          { attackerId: 'me', targetId: 'npc', skill: 'attack', at: { x: 0, z: 0 }, since: 20, reason: 'not-hostile' },
        ] as never,
      }),
    );
    const first = rowsOf(executionLogSurface(snap()), 'log')[0]!;
    pickLogEntry(first.id);
    expect(rowsOf(executionLogSurface(snap()), 'why')[0]!.text).toContain('산정이 없다');
  });

  it('아직 고르지 않았으면 고르는 법이 선다', () => {
    rememberExecutions(snap({ strikes: [strike(10, 17)] as never }));
    const why = executionLogSurface(snap()).sections.find((s) => s.id === 'why');
    expect(why?.rows).toHaveLength(0);
    expect(why?.emptyText).toContain('고른다');
  });
});

describe('moveLogSelection — 줄 사이를 걷는다', () => {
  it('아직 고른 것이 없으면 맨 위에서 시작한다 — 되짚는 사람이 먼저 보려는 것이다', () => {
    rememberExecutions(snap({ strikes: [strike(10, 1), strike(20, 2)] as never }));
    moveLogSelection(1);
    expect(executionLogSurface(snap()).focusId).toBe(
      rowsOf(executionLogSurface(snap()), 'log')[0]!.id,
    );
  });

  it('양 끝에서 멈춘다 — 감기면 어디가 처음이고 끝인지 알 수 없다', () => {
    rememberExecutions(snap({ strikes: [strike(10, 1), strike(20, 2)] as never }));
    moveLogSelection(1); // 맨 위
    moveLogSelection(-1); // 위로 더 — 멈춘다
    const rows = rowsOf(executionLogSurface(snap()), 'log');
    expect(executionLogSurface(snap()).focusId).toBe(rows[0]!.id);
    moveLogSelection(1);
    moveLogSelection(1); // 아래로 더 — 멈춘다
    expect(executionLogSurface(snap()).focusId).toBe(rows[1]!.id);
  });

  it('목록이 비었으면 아무 일도 없다', () => {
    moveLogSelection(1);
    expect(executionLogSurface(snap()).focusId).toBeUndefined();
  });
});

describe('열림', () => {
  it('닫혀 있어도 표면은 실린다 — 열림은 표면 자신이 지닌 값이다', () => {
    expect(executionLogSurface(snap()).open).toBe(false);
  });
});
