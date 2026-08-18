// Observer Identity — 관찰자의 자기 식별 (C004).
//
// 04-gameview.spec.yaml 의 identity 절(owner: observer)을 구현한다.
//   stability: persists-across-links   같은 관찰자는 다시 이을 때 같은 것을 밝힌다
//   firstTime: observer-generates      밝힐 것이 없으면 스스로 하나 만든다
//
// 세계는 이것이 참인지 따지지 않는다 — 이번 Cycle 의 "인증"은 누구인지 가리는 것까지다.
// 보관 수단은 주입받는다 — 브라우저 없이 검증할 수 있어야 하기 때문이다.

export interface IdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const IDENTITY_KEY = 'hkt.observer.id';

// 사람이 읽을 수 있고 충분히 겹치지 않을 정도의 짧은 식별.
// 세계는 형식만 볼 뿐이므로 모양은 관찰자 쪽 자유다.
function generateObserverId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `observer-${random}`;
}

export function resolveObserverId(
  storage: IdentityStorage,
  generate: () => string = generateObserverId,
): string {
  const stored = storage.getItem(IDENTITY_KEY);
  if (stored) return stored; // 다시 이을 때 같은 나를 밝힌다 → 같은 몸으로 돌아온다

  const fresh = generate();
  storage.setItem(IDENTITY_KEY, fresh);
  return fresh;
}

// 브라우저 저장소 어댑터. 저장소를 쓸 수 없으면(사생활 모드 등) 이번 세션만 사는
// 식별을 쓴다 — 그 경우 새로고침하면 새 몸을 받는다.
export function browserIdentityStorage(): IdentityStorage {
  try {
    const probe = '__hkt_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
    };
  }
}
