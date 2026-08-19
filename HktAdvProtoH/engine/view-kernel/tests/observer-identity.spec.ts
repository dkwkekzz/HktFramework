// Observer Identity 단독 테스트 (C004) — 브라우저 없이 검증한다.
// 04-gameview.spec.yaml 의 identity 절: owner: observer · persists-across-links ·
// firstTime: observer-generates

import { describe, expect, it } from 'vitest';
import { IDENTITY_KEY, resolveObserverId, type IdentityStorage } from '../net/observer-identity';

function memoryStorage(initial?: string): IdentityStorage {
  const map = new Map<string, string>();
  if (initial) map.set(IDENTITY_KEY, initial);
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

describe('identity — 관찰자가 자기 식별을 보관한다', () => {
  it('밝힐 것이 없으면 스스로 하나 만들어 보관한다', () => {
    const storage = memoryStorage();
    const id = resolveObserverId(storage, () => 'observer-fresh');

    expect(id).toBe('observer-fresh');
    expect(storage.getItem(IDENTITY_KEY)).toBe('observer-fresh');
  });

  it('보관해 둔 것이 있으면 그것을 다시 밝힌다 — 새로 만들지 않는다', () => {
    const storage = memoryStorage('observer-old');
    const id = resolveObserverId(storage, () => 'observer-new');

    expect(id).toBe('observer-old');
  });

  it('같은 보관소를 쓰는 한 몇 번을 물어도 같은 나다', () => {
    const storage = memoryStorage();
    const first = resolveObserverId(storage);
    const second = resolveObserverId(storage);

    expect(second).toBe(first);
  });

  it('스스로 만든 식별은 비어 있지 않다 — 세계가 받아들일 수 있는 형태다', () => {
    const id = resolveObserverId(memoryStorage());

    expect(id.length).toBeGreaterThan(0);
    expect(id.length).toBeLessThanOrEqual(64); // 세계의 수용 한계 안
  });

  it('보관소가 다르면 다른 나다 — 다른 브라우저는 다른 관찰자다', () => {
    const a = resolveObserverId(memoryStorage());
    const b = resolveObserverId(memoryStorage());

    expect(a).not.toBe(b);
  });
});
