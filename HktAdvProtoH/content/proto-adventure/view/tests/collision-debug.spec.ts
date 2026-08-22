// 충돌체 디버그 관찰 결정 Layer 단독 테스트 (C006 / R1) — World 미기동, Fixture 만으로
// debugObserve 계약(bodies 캡슐 / 칼끝 구 / struck / velocity)의 표현 결정을 검증한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import fixture from './fixtures/collision-debug.fixture.json';

const snapshot = fixture as GameViewSnapshot;

describe('collision debug (Semantic → Render Plan)', () => {
  // C024 CHANGED — 이 계약을 두 자리가 나눠 쓰게 되었다. 꺼져 있어도 **칼끝은**
  // 실린다: 기술마다 다른 모양이 닿는 것을 가르므로 그것이 보이지 않으면 이 세계의
  // 차이가 화면에 존재하지 않는다 (04 VIEW NOTE ①). 진단 셋(몸 캡슐 · 속도 화살표 ·
  // 맞은 몸 표시)은 여전히 켜야만 나온다.
  it('토글이 꺼져 있으면(기본) 진단 표시는 실리지 않고 칼끝만 실린다 — C024', () => {
    for (const plan of [resolvePresentation(snapshot), resolvePresentation(snapshot, undefined, {})]) {
      const debug = plan.colliderDebug!;
      expect(debug.capsules).toEqual([]); // 몸 부피도 맞은 몸 표시도 없다
      expect(debug.vectors).toEqual([]); // 속도 화살표도 없다
      expect(debug.spheres.map((s) => s.id)).toEqual(['swing:player-1']);
    }
  });

  it('꺼진 칼끝은 켠 칼끝과 같은 자리·같은 굵기·같은 높이다 — 켜고 끌 때 물체가 뛰지 않는다', () => {
    const plain = resolvePresentation(snapshot).colliderDebug!.spheres[0]!;
    const debugged = resolvePresentation(snapshot, undefined, { debugObserve: true })
      .colliderDebug!.spheres.find((s) => s.id === 'swing:player-1')!;
    expect(plain.center).toEqual(debugged.center);
    expect(plain.radius).toBe(debugged.radius);
    expect(plain.elevation).toBe(debugged.elevation);
  });

  it('켜면 모든 몸이 캡슐 부피(반경·높이)로 실린다 — R1', () => {
    const plan = resolvePresentation(snapshot, undefined, { debugObserve: true });

    const bodies = plan.colliderDebug!.capsules.filter((c) => c.id.startsWith('body:'));
    expect(bodies.map((c) => c.id)).toEqual(['body:player-1', 'body:npc-1']);
    expect(bodies[0]).toMatchObject({ center: { x: 0, z: 0 }, radius: 0.5, height: 1.7 });
    expect(bodies[1]).toMatchObject({ center: { x: 1.4, z: 0 }, radius: 0.5, height: 1.7 });
  });

  it('칼끝 충돌체가 몸 밖 그 자리에 구체로 실리고, 활성/비활성이 다른 표현을 받는다 — R1', () => {
    const active = resolvePresentation(snapshot, undefined, { debugObserve: true })
      .colliderDebug!.spheres.find((s) => s.id === 'swing:player-1');
    // center 는 spec 의 ActionCollider.Center — 몸 중심(0,0)이 아니라 칼끝(1.3,0)이다
    expect(active).toMatchObject({ center: { x: 1.3, z: 0 }, radius: 0.7 });
    expect(active!.elevation).toBeGreaterThan(0); // 지면이 아니라 몸통 높이에서 휘두른다

    const idleSnapshot = structuredClone(snapshot);
    idleSnapshot.entities[0]!.swing!.active = false;
    const idle = resolvePresentation(idleSnapshot, undefined, { debugObserve: true })
      .colliderDebug!.spheres.find((s) => s.id === 'swing:player-1');

    expect(idle!.color).not.toBe(active!.color); // 지금 닿으면 맞는 상태가 구분되어야 한다
  });

  it('이번 휘두름에 맞은 몸이 그 몸의 자리에 표시된다', () => {
    const plan = resolvePresentation(snapshot, undefined, { debugObserve: true });

    const mark = plan.colliderDebug!.capsules.find((c) => c.id === 'struck:player-1:npc-1');
    expect(mark).toMatchObject({ center: { x: 1.4, z: 0 } });
  });

  it('맞은 몸이 관찰에 없으면 표시하지 않는다 (표시할 자리가 없다)', () => {
    const gone = structuredClone(snapshot);
    gone.entities[0]!.swing!.struck = ['npc-없음'];
    const plan = resolvePresentation(gone, undefined, { debugObserve: true });

    expect(plan.colliderDebug!.capsules.some((c) => c.id.startsWith('struck:'))).toBe(false);
  });

  it('밀리고 있는 몸에만 속도 화살표가 실리고, 길이는 속도에 비례한다', () => {
    const plan = resolvePresentation(snapshot, undefined, { debugObserve: true });

    const vectors = plan.colliderDebug!.vectors;
    expect(vectors.map((v) => v.id)).toEqual(['velocity:npc-1']); // 정지한 몸에는 없다
    expect(vectors[0]!.from).toEqual({ x: 1.4, z: 0 });
    expect(vectors[0]!.to.x).toBeCloseTo(1.4 + 6.4 * 0.35); // 속도 × 배율
    expect(vectors[0]!.to.z).toBeCloseTo(0);
  });

  it('swing 이 없는 관찰(공격 중이 아님)도 몸 캡슐만으로 그려진다', () => {
    const calm = structuredClone(snapshot);
    delete calm.entities[0]!.swing;
    const plan = resolvePresentation(calm, undefined, { debugObserve: true });

    expect(plan.colliderDebug!.capsules.map((c) => c.id)).toEqual([
      'body:player-1',
      'body:npc-1',
    ]);
    expect(plan.colliderDebug!.spheres).toEqual([]);
  });
});
