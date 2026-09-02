// 몸 방향 → 그림 방향 결정 테스트.
// 04-gameview.spec.yaml 의 entities.character.facing.read · spriteOrientation 이 검증 대상이다.
// World 미기동 — Semantic Fixture 와 시점 각만으로 "어느 쪽을 보이는가" 를 검증한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  AMBIGUOUS_BAND,
  DEFAULT_SPRITE_BASELINE,
  facingDecision,
  readSide,
} from '../../../engine/view-kernel/presentation/facing-presentation';
import { kindPresentation } from '../kind-presentation';

// 종류 → 그림 기준 방향 — 팩의 kind 표가 정한다 (P3: 엔진은 baseline 을 인자로 받는다)
const spriteBaseline = (kind: string | undefined) => kindPresentation(kind).spriteBaseline;
import { screenSideValue } from '../../../engine/view-kernel/camera/orientation';
import { resolvePresentation } from '../resolve';
import facing from './fixtures/facing.fixture.json';

const QUARTER = Math.PI / 2;
const snapshot = facing as GameViewSnapshot;

describe('그림의 기준 방향 (spriteOrientation)', () => {
  it('rabbit-swordsman 의 원본은 오른쪽을 본다', () => {
    expect(spriteBaseline('rabbit-swordsman')).toBe('right');
  });

  it('종류마다 따로 정해진다 — 등록되지 않은 종류는 기본값을 쓴다', () => {
    expect(spriteBaseline('wanderer')).toBe('right');
    expect(spriteBaseline('알-수-없는-종류')).toBe(DEFAULT_SPRITE_BASELINE);
    expect(spriteBaseline(undefined)).toBe(DEFAULT_SPRITE_BASELINE);
  });

  it('읽힌 쪽이 기준 방향과 같으면 원본 그대로, 다르면 뒤집는다', () => {
    expect(facingDecision(spriteBaseline('rabbit-swordsman'), 1, undefined)).toEqual({ side: 'right', flip: false });
    expect(facingDecision(spriteBaseline('rabbit-swordsman'), -1, undefined)).toEqual({ side: 'left', flip: true });
  });
});

describe('좌우가 흐려지는 구간 (ambiguous: keep-previous)', () => {
  it('모호 구간에서는 직전에 읽힌 쪽을 유지한다 — 깜빡이지 않는다', () => {
    const tiny = AMBIGUOUS_BAND / 2;
    expect(readSide(tiny, 'left', 'right')).toBe('left');
    expect(readSide(-tiny, 'left', 'right')).toBe('left');
    expect(readSide(tiny, 'right', 'right')).toBe('right');
    expect(readSide(-tiny, 'right', 'right')).toBe('right');
  });

  it('부호가 오가도 직전 쪽이 이긴다 — 정면을 향한 몸이 떨리지 않는다', () => {
    let side = readSide(0.01, 'left', 'right');
    for (const value of [-0.02, 0.03, -0.01, 0.02]) side = readSide(value, side, 'right');
    expect(side).toBe('left');
  });

  it('구간을 벗어나면 그때는 읽은 대로 바뀐다', () => {
    expect(readSide(AMBIGUOUS_BAND + 0.01, 'left', 'right')).toBe('right');
    expect(readSide(-(AMBIGUOUS_BAND + 0.01), 'right', 'right')).toBe('left');
  });

  it('직전이 없으면 그림 원본 쪽으로 둔다 — 첫 프레임이 뒤집힌 채 나타나지 않는다', () => {
    expect(readSide(0, undefined, 'right')).toBe('right');
    expect(readSide(0, undefined, 'left')).toBe('left');
  });
});

describe('결정 Layer 통합 — 시점을 돌리면 그림이 뒤집힌다', () => {
  it('기본 시점: +x 를 향한 몸은 원본 그대로, -x 를 향한 몸은 뒤집힌다', () => {
    const plan = resolvePresentation(snapshot, undefined, { viewTurn: 0 });
    const player = plan.entities.find((e) => e.id === 'player'); // facing +x
    const npc1 = plan.entities.find((e) => e.id === 'npc-1'); // facing -x
    expect(player?.facingSide).toBe('right');
    expect(player?.flip).toBe(false);
    expect(npc1?.facingSide).toBe('left');
    expect(npc1?.flip).toBe(true);
  });

  it('시점을 반대로 돌리면 같은 몸이 반대로 보인다 — 세계는 그대로다', () => {
    const plan = resolvePresentation(snapshot, undefined, { viewTurn: Math.PI });
    const player = plan.entities.find((e) => e.id === 'player');
    const npc1 = plan.entities.find((e) => e.id === 'npc-1');
    expect(player?.facingSide).toBe('left');
    expect(player?.flip).toBe(true);
    expect(npc1?.facingSide).toBe('right');
    expect(npc1?.flip).toBe(false);
  });

  it('시점을 90° 돌리면 정면이던 몸이 좌우를 갖는다', () => {
    const straight = resolvePresentation(snapshot, undefined, {
      viewTurn: 0,
      facingSides: { 'npc-2': 'left' },
    });
    // -z 를 향한 몸은 기본 시점에서 좌우가 흐리다 → 직전 쪽(left)을 유지한다
    expect(straight.entities.find((e) => e.id === 'npc-2')?.facingSide).toBe('left');

    const turned = resolvePresentation(snapshot, undefined, {
      viewTurn: QUARTER,
      facingSides: { 'npc-2': 'left' },
    });
    // 시점이 90° 돌면 같은 몸이 또렷하게 오른쪽이 된다 — 직전 쪽을 덮는다
    expect(turned.entities.find((e) => e.id === 'npc-2')?.facingSide).toBe('right');
    expect(turned.entities.find((e) => e.id === 'npc-2')?.flip).toBe(false);
  });

  it('몸 방향이 없는 대상은 이 결정을 받지 않는다 — 광맥은 뒤집히지 않는다', () => {
    const plan = resolvePresentation(snapshot, undefined, { viewTurn: 1.0 });
    const deposit = plan.entities.find((e) => e.id === 'deposit-1');
    expect(deposit?.facingSide).toBeUndefined();
    expect(deposit?.flip).toBeUndefined();
  });

  it('시점 각을 주지 않아도 결정된다 — 기본 시점(0)으로 읽는다 (회귀)', () => {
    const plan = resolvePresentation(snapshot);
    expect(plan.entities.find((e) => e.id === 'player')?.flip).toBe(false);
    expect(plan.entities.find((e) => e.id === 'npc-1')?.flip).toBe(true);
  });

  it('보이는 쪽과 칼끝이 지나는 쪽이 어긋나지 않는다 — 어느 시점에서도 (핵심)', () => {
    // npc-1 은 휘두르는 중이다. 세계가 보내 준 칼끝 자리(swing.center)는 몸 방향에서
    // 유도된 값이고, 그림의 좌우도 같은 몸 방향에서 유도된다.
    // 시점을 어떻게 돌려도 둘이 같은 쪽을 가리켜야 한다 — 다르면 "보이는 대로 맞는다" 가 깨진다.
    for (const turn of [-3.0, -2.0, -1.0, -0.4, 0, 0.4, 1.0, 2.0, 3.0]) {
      const plan = resolvePresentation(snapshot, undefined, { viewTurn: turn });
      const npc = plan.entities.find((e) => e.id === 'npc-1')!;
      const source = snapshot.entities.find((e) => e.id === 'npc-1')!;
      const blade = {
        x: source.swing!.center.x - source.position.x,
        z: source.swing!.center.z - source.position.z,
      };
      const bladeSide = screenSideValue(turn, blade);
      // 칼끝이 화면 좌우 어느 쪽에도 치우치지 않는 각(정면·정후면)은 판정 대상이 아니다
      if (Math.abs(bladeSide) < AMBIGUOUS_BAND) continue;
      expect(npc.facingSide).toBe(bladeSide > 0 ? 'right' : 'left');
    }
  });

  it('보이는 쪽은 몸 방향에서만 나온다 — 같은 시점이면 몇 번을 읽어도 같다', () => {
    const once = resolvePresentation(snapshot, undefined, { viewTurn: 0.7 });
    const sides = Object.fromEntries(
      once.entities.filter((e) => e.facingSide).map((e) => [e.id, e.facingSide!]),
    );
    const twice = resolvePresentation(snapshot, undefined, { viewTurn: 0.7, facingSides: sides });
    for (const entity of twice.entities) {
      if (entity.facingSide) expect(entity.facingSide).toBe(sides[entity.id]);
    }
  });
});
