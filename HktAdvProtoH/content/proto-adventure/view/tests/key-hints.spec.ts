// V-003 — 화면에 뜬 키가 실제로 눌리는 키인가 (UX 문서 §4.1).
//
// 표기가 코드에서 나오므로(`key-registry.ts`) "안내는 B 인데 듣는 것은 N" 이라는
// 어긋남은 **일어날 수 없다** — 적는 자리가 하나뿐이다. 그래서 여기서 재는 것은
// 남은 세 가지 어긋남이다.
//
//     ① 등록했는데 듣지 않는다      표에는 있고 KEY_BINDINGS 에는 없다
//     ② 듣는데 등록하지 않았다      KEY_BINDINGS 에는 있고 표에는 없다 (안내가 못 짓는다)
//     ③ 남이 먼저 가져간 키다        눌러도 아무 일이 없다 — C025 에서 실제로 있었다
//
// ③ 이 이 검사의 값어치다. 키가 있다는 것과 그 키가 **닿는다**는 것은 다르며,
// 표만 읽는 검사로는 잡히지 않는다 (skill-shape.spec.ts 가 interaction 쪽에 세운
// 같은 검사의 짝이다 — 그쪽은 세계가 실어 온 목록의 키, 이쪽은 팩 자신의 키다).

import { describe, expect, it } from 'vitest';
import { KEY_BINDINGS } from '../bindings';
import { boundKeys, RESERVED_KEY_CODES } from '../interaction-presentation';
import { hasLabel, keyLabel, packKeys, SLOT_KEY_LABELS } from '../key-registry';

const registered = packKeys();
const boundCodes = KEY_BINDINGS.map((b) => b.code);

describe('표기와 코드가 갈라지지 않는다', () => {
  it('모든 등록 키에 표기가 있다 — 없으면 화면이 코드를 그대로 뱉는다', () => {
    const naked = registered.filter((k) => !hasLabel(k.code));
    expect(naked).toEqual([]);
  });

  it('표기는 코드에서 나온다 — 같은 코드는 언제나 같은 표기다', () => {
    const byCode = new Map<string, Set<string>>();
    for (const k of registered) {
      const seen = byCode.get(k.code) ?? new Set<string>();
      seen.add(keyLabel(k.id as 'discard'));
      byCode.set(k.code, seen);
    }
    const split = [...byCode.entries()].filter(([, labels]) => labels.size > 1);
    expect(split).toEqual([]);
  });

  it('칸 번호 아홉이 순서대로 선다 — 소지품 띠와 걸어 둔 것이 같은 표를 읽는다', () => {
    expect(SLOT_KEY_LABELS).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });
});

describe('등록과 바인딩이 서로를 덮는다', () => {
  it('① 등록한 팩 키는 전부 실제로 듣는다', () => {
    const deaf = registered
      .filter((k) => k.boundBy !== 'engine')
      .filter((k) => !boundCodes.includes(k.code));
    expect(deaf).toEqual([]);
  });

  it('② 듣는 키는 전부 등록되어 있다 — 등록되지 않은 키는 안내를 지을 수 없다', () => {
    const codes = new Set(registered.map((k) => k.code));
    const unlisted = boundCodes.filter((code) => !codes.has(code));
    expect(unlisted).toEqual([]);
  });

  it('한 코드를 두 등록이 나눠 갖지 않는다 — Shift 좌우만 예외다 (같은 뜻이다)', () => {
    const byCode = new Map<string, string[]>();
    for (const k of registered) byCode.set(k.code, [...(byCode.get(k.code) ?? []), k.id]);
    expect([...byCode.entries()].filter(([, ids]) => ids.length > 1)).toEqual([]);
  });
});

describe('③ 남이 먼저 가져간 키를 쓰지 않는다', () => {
  it('이동·시점이 삼키는 키는 표면이 열린 동안에만 쓴다', () => {
    // 방향키는 예약된 자리지만 표면이 열리면 이동이 멈춰 팩까지 온다.
    // 그 사정을 표에 적지 않은 채 예약 키를 쓰면 여기서 잡힌다.
    const stolen = registered.filter(
      (k) => RESERVED_KEY_CODES.includes(k.code) && !k.whileSurfaceOpen,
    );
    expect(stolen).toEqual([]);
  });

  it('interaction 을 가리는 것은 가린다고 적은 것뿐이다', () => {
    const interactionCodes = new Set(boundKeys().map((b) => b.key));
    // 팩 규칙이 interaction 보다 먼저 불린다 (app/main.ts) — 적지 않은 가림은
    // "표에도 있고 안내에도 뜨는데 눌러도 아무 일이 없는" 조작을 낳는다
    const silent = registered
      .filter((k) => interactionCodes.has(k.code) && k.shadows === undefined)
      .map((k) => k.id);
    expect(silent).toEqual([]);
  });

  it('가린다고 적은 역할은 실제로 그 코드를 쓴다 — 옛 사실이 표에 남지 않는다', () => {
    const byRole = new Map(boundKeys().map((b) => [b.role, b.key]));
    const stale = registered
      .filter((k) => k.shadows !== undefined)
      .filter((k) => byRole.get(k.shadows!) !== k.code)
      .map((k) => ({ id: k.id, shadows: k.shadows }));
    expect(stale).toEqual([]);
  });
});

describe('화면 문구가 이 표에서 나온다', () => {
  it('소지품 안내의 여는 키가 표의 표기 그대로다', async () => {
    const { inventoryDetailLines } = await import('../inventory-presentation');
    const snapshot = {
      inventory: [
        {
          kind: 'stone',
          count: 2,
          category: 'material',
          stackable: true,
          actions: [{ id: 'discard-item', role: 'discard-item', available: true }],
        },
      ],
    };
    const lines = inventoryDetailLines(snapshot as never, (c) => c, (c) => c);
    expect(lines.join(' ')).toContain(`${keyLabel('discard')} → ${keyLabel('slot1')} → 확인`);
  });

  it('작업 공간의 안내 줄이 표의 표기 그대로다', async () => {
    const { inventoryWorkspace } = await import('../inventory-workspace');
    const surface = inventoryWorkspace({ inventory: [] } as never, (c) => c, (c) => c);
    expect(surface.footer).toContain(`닫기 ${keyLabel('close')}`);
    expect(surface.footer).toContain(`실행 ${keyLabel('invoke')}`);
  });
});
