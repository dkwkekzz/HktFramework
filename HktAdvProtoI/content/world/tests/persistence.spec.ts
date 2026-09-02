// 세계 영속 — 저장된 세계가 실제로 이어지는가 (design/Design-World-Persistence.md).
//
// **JSON 을 지나간다.** 실제 저장 경로(server/world-store.ts)가 스냅샷을 파일에
// JSON 으로 쓰기 때문이다. 메모리 안에서만(structuredClone) 왕복시키면 Map 이 살아남아
// 검사가 통과하고, 정작 파일로 저장된 세계는 복구 직후 첫 Tick 에 죽는다 —
// 그 구멍이 실제로 있었다. 그래서 이 검사는 팩 State 가 **plain JSON 인가**를 함께 본다
// (engine/world-kernel/persistence.ts 의 "함수·클래스·Map 금지" 계약).

import { describe, expect, it } from 'vitest';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import { createWorld, restoreWorld, type World } from '../index';
import { TICK_INTERVAL, type WorldState } from '../semantic/world-state';

const OBSERVER = 'observer-a';

/** server/world-store.ts 가 하는 일 그대로 — 파일에 쓰고 다시 읽는다 */
function throughFile(snapshot: WorldSnapshot): WorldSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as WorldSnapshot;
}

function livedWorld(): World {
  const world = createWorld({ npcs: [] });
  world.join(OBSERVER);
  world.tick(0);
  for (let i = 0; i < 5; i++) world.tick(TICK_INTERVAL);
  return world;
}

describe('저장된 세계가 파일을 지나 되살아난다', () => {
  it('스냅샷은 JSON 으로 온전히 오간다 — 되살린 State 가 저장 직전과 같다', () => {
    const saved = throughFile(livedWorld().snapshot());
    const restored = restoreWorld(saved);

    expect(restored).not.toBeNull();
    // 되살린 State 를 다시 뜨면 저장된 것과 같은 데이터다.
    // 기반이 손대는 자리는 하나뿐이다 — 기동 직후에는 아무도 보고 있지 않으므로
    // 모든 관찰자가 present=false 다 (이어짐은 과정이지 사실이 아니다).
    const again = JSON.parse(JSON.stringify(createWorld({}, restored!).snapshot().state));
    const expected = JSON.parse(JSON.stringify(saved.state)) as WorldState;
    for (const observer of expected.observers) observer.present = false;
    expect(again).toEqual(expected);
  });

  it('되살린 세계가 그 관찰자를 다시 받아도 돈다 — 영속의 본래 목적이다', () => {
    const saved = throughFile(livedWorld().snapshot());
    const revived = createWorld({}, restoreWorld(saved)!);

    // 같은 관찰자가 돌아온다 — 몸은 새로 만들어지지 않고 저장된 그 몸이다
    revived.join(OBSERVER);
    expect(() => revived.tick(0)).not.toThrow();

    const observed = revived.latestObservation(OBSERVER);
    expect(observed).not.toBeNull();
    expect(observed!.observer.characterId).toBe('player-1');
    expect(revived.snapshot().state as WorldState).toMatchObject({ observers: [{ id: OBSERVER }] });
  });

  it('지니고 있던 것이 저장을 건너도 남는다 — 소지품이 비어 오지 않는다', () => {
    const world = createWorld({ npcs: [], actorItems: { pickaxe: 1, stone: 3 } });
    world.join(OBSERVER);
    world.tick(0);

    const revived = createWorld({}, restoreWorld(throughFile(world.snapshot()))!);
    revived.join(OBSERVER);
    revived.tick(0);

    const state = revived.snapshot().state as WorldState;
    const body = state.actors.find((a) => a.id === 'player-1')!;
    expect(body.inventory.items).toEqual({ pickaxe: 1, stone: 3 });
    // 곡괭이가 살아남았으므로 캘 수 있다는 판정도 그대로다
    const mine = revived.latestObservation(OBSERVER)!.interactions.find((i) => i.id === 'mine');
    expect(mine?.reason).not.toBe('no-mining-tool');
  });

  it('팩 State 에 JSON 이 담지 못하는 것이 없다 — Map · Set · 함수', () => {
    const state = livedWorld().snapshot().state;
    const offenders: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (value === null || typeof value !== 'object') {
        if (typeof value === 'function') offenders.push(path);
        return;
      }
      if (value instanceof Map || value instanceof Set) {
        offenders.push(`${path} (${value.constructor.name})`);
        return;
      }
      for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
    };
    walk(state, 'state');
    expect(offenders).toEqual([]);
  });

  it('버전이 다른 스냅샷은 복구하지 않는다 — 새 세계로 시작한다', () => {
    const saved = throughFile(livedWorld().snapshot());
    expect(restoreWorld({ ...saved, version: 'other-pack/1' })).toBeNull();
  });
});
