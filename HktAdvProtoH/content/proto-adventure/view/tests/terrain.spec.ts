// 땅 표현 결정 Layer 단독 테스트 — World 미기동, Fixture 만으로
// 자리의 범위 지시(GroundZonePlan) · 지금 걸린 법칙의 줄 · 지닌 열의 표시를 검증한다.
//
// C-TERRAIN-002 — 자리에 시간이 생겼으므로 지시도 시간을 지닌다: 찬 만큼 진해지고,
// 뿜는 동안 맥동하고, 이름에 퍼센트가 붙는다. 그리고 self 의 `warming` 이 `sheltered`
// 와 갈린다.
//
// 이 Layer 가 **판정하지 않는다**는 것이 검사의 요점 하나다 — 안인지 밖인지도,
// 지금 걸려 있는지도 세계가 보낸 값 그대로 쓴다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import {
  groundHeldLines,
  groundLawLines,
  groundLawPresentation,
  groundZonePlans,
} from '../terrain-presentation';
import taking from './fixtures/ground-taking.fixture.json';
import sheltered from './fixtures/ground-sheltered.fixture.json';
import warming from './fixtures/ground-warming.fixture.json';
import plain from './fixtures/combat.fixture.json';

const takingView = taking as GameViewSnapshot;
const shelteredView = sheltered as GameViewSnapshot;
const warmingView = warming as GameViewSnapshot;
const plainView = plain as GameViewSnapshot;

describe('자리의 범위 — 엔진의 지면 구역 장치가 소비할 지시', () => {
  it('세계가 보낸 자리마다 지시가 하나씩 나온다', () => {
    const plans = groundZonePlans(takingView);

    expect(plans.map((p) => p.id)).toEqual([
      'zone-vein-1', 'zone-vein-2', 'zone-vein-3', 'zone-vein-4',
    ]);
  });

  it('범위는 세계가 보낸 값 그대로다 — 결정 Layer 가 자리를 옮기지 않는다', () => {
    const [first] = groundZonePlans(takingView);

    expect(first?.shape).toEqual({ kind: 'circle', center: { x: -13.5, z: 13.5 }, radius: 5 });
  });

  it('거두는 맥과 뿜는 맥이 한눈에 갈린다 — 색도 진하기도 다르다', () => {
    const [venting, binding] = groundZonePlans(takingView);

    expect(venting?.fill.color).not.toBe(binding?.fill.color);
    expect(venting!.edge.width).toBeGreaterThan(binding!.edge.width);
  });

  it('**찬 만큼 진해진다** — 차오르는 것이 눈에 보여야 넘침이 우연으로 보이지 않는다', () => {
    const plans = groundZonePlans(takingView);
    const full = plans.find((p) => p.id === 'zone-vein-2')!; // fill 0.75
    const empty = plans.find((p) => p.id === 'zone-vein-3')!; // fill 0.25

    expect(full.fill.opacity).toBeGreaterThan(empty.fill.opacity);
  });

  it('이름에 지금이 실린다 — 얼마나 찼는지 · 얼마나 남았는지', () => {
    const plans = groundZonePlans(takingView);

    expect(plans.find((p) => p.id === 'zone-vein-1')?.label).toBe('해숨구멍 · 남은 100%');
    expect(plans.find((p) => p.id === 'zone-vein-2')?.label).toBe('빙원 · 찬 75%');
    expect(plans.find((p) => p.id === 'zone-vein-4')?.label).toBe('빙원 · 찬 50%');
  });

  it('뿜는 동안만 맥동한다 — 거두는 것은 늘 일어나는 일이라 맥동할 이유가 없다', () => {
    const plans = groundZonePlans(takingView);

    expect(plans.find((p) => p.id === 'zone-vein-1')?.intensity).toBe(1);
    for (const p of plans.filter((x) => x.id !== 'zone-vein-1')) {
      expect(p.intensity).toBeUndefined();
    }
  });

  it('화면은 넘침을 스스로 판정하지 않는다 — 계약에 넘침 지점이 오지 않는다', () => {
    const zone = takingView.ground.zones[0] as unknown as Record<string, unknown>;

    expect(zone.saturation).toBeUndefined();
    expect(zone.kept).toBeUndefined();
  });

  it('모르는 법칙도 그려진다 — 표현 등록 누락이 게임을 멈추지 않는다', () => {
    const unknown = groundLawPresentation('some-future-law');

    expect(unknown.name).toBe('이름 없는 자리');
    expect(typeof unknown.lawColor).toBe('number');
  });

  it('자리가 없는 세계에서는 지시도 없다 — 그리지 않고 게임은 돈다', () => {
    expect(groundZonePlans(plainView)).toEqual([]);
  });
});

describe('자리가 화면 지시까지 실려 간다 — 07 NOTE 1 이 예고한 배선', () => {
  it('resolve 가 zones 를 그대로 실어 보낸다', () => {
    const zones = resolvePresentation(takingView).zones;

    expect(zones.map((z) => z.id)).toEqual([
      'zone-vein-1', 'zone-vein-2', 'zone-vein-3', 'zone-vein-4',
    ]);
    expect(zones[0]?.shape).toEqual({ kind: 'circle', center: { x: -13.5, z: 13.5 }, radius: 5 });
  });

  it('자리가 없는 세계에서는 빈 배열이다 — 엔진이 아무것도 그리지 않는다', () => {
    expect(resolvePresentation(plainView).zones).toEqual([]);
  });
});

describe('지금 걸린 법칙 — 값이 줄어드는 것만 보이면 버그와 구분되지 않는다', () => {
  it('거두어 가는 중이면 무엇을 거두는지가 실린다 — 조사가 이름에 맞게 붙는다', () => {
    expect(groundLawLines(takingView)).toEqual(['빙원 — 열을 거두어 가는 중']);
  });

  it('멎어 있으면 그 사실이 실린다 — 자리 밖과 구분된다', () => {
    // C-TERRAIN-002 — 멎게 하는 것은 놓인 예외가 아니라 **뿜는 중인 맥**이므로
    // 그 자리를 그 일로 부른다
    expect(groundLawLines(shelteredView)).toEqual(['해숨구멍 — 여기서는 멎는다']);
  });

  it('돌려받는 중이면 그 사실이 실린다 — 멎기만 하는 것과 갈린다', () => {
    // 한 줄로 묶이면 플레이어는 자기 열이 **왜 늘었는지** 알 수 없다.
    expect(groundLawLines(warmingView)).toEqual(['해숨구멍 — 열을 돌려받는 중']);
    expect(groundLawLines(warmingView)).not.toEqual(groundLawLines(shelteredView));
  });

  it('미등록 상태 코드도 그려진다 — 표현 누락이 게임을 멈추지 않는다', () => {
    const future = {
      ...warmingView,
      ground: { ...warmingView.ground, self: { law: 'heat-binding', state: 'some-future-state' } },
    };

    expect(groundLawLines(future)).toEqual(['빙원 — some-future-state']);
  });

  it('자리 밖이면 법칙의 줄이 없다', () => {
    expect(groundLawLines(plainView)).toEqual([]);
  });

  it('`sheltered` 와 자리 밖이 같은 화면이 되지 않는다', () => {
    // 법칙이 멎어서 조용한 것과 애초에 조용한 것이 다르다는 것이 이 Cycle 의 요점이다.
    expect(groundLawLines(shelteredView)).not.toEqual(groundLawLines(plainView));
  });
});

describe('지닌 열 — 자리 밖에서도 늘 보인다', () => {
  it('온기가 남은 양과 최대와 함께 실린다', () => {
    expect(groundHeldLines(takingView)).toEqual(['온기 62/100']);
  });

  it('되채워지지 않으므로 자리 밖에서도 보여야 한다 — 다시 들어갈지를 고를 재료다', () => {
    // 빙원에서 44 만 남기고 나온 사람이 그것을 볼 수 없다면 판단할 재료가 없다.
    const left = { ...shelteredView, ground: { ...shelteredView.ground, self: { state: 'none' } } };

    expect(groundLawLines(left)).toEqual([]); // 법칙의 줄은 사라진다
    expect(groundHeldLines(left)).toEqual(['온기 44/100']); // 지닌 것은 남는다
  });

  it('온기를 아직 모르는 세계에서는 줄이 없다 — 옛 스냅샷도 그려진다', () => {
    expect(groundHeldLines(plainView)).toEqual([]);
  });
});

describe('self 패널 조립 — 땅이 가장 먼저 온다', () => {
  it('땅의 줄이 self 패널에 실린다', () => {
    const plan = resolvePresentation(takingView);

    expect(plan.self?.lines).toContain('빙원 — 열을 거두어 가는 중');
  });

  it('지금 무언가 빠져나가는 중이라면 그것이 가장 급한 줄이다', () => {
    const lines = resolvePresentation(takingView).self?.lines ?? [];
    const ground = lines.findIndex((l) => l.startsWith('빙원'));

    expect(ground).toBeGreaterThanOrEqual(0);
    // 세계가 보낸 self.lines(템포·배율) 뒤, 결정 Layer 가 더하는 것들 중에는 첫째다
    const target = lines.findIndex((l) => l.includes('고른 대상'));
    if (target >= 0) expect(ground).toBeLessThan(target);
  });

  it('자리 밖에서는 법칙의 줄이 self 패널에 오르지 않는다', () => {
    const before = resolvePresentation(plainView).self?.lines ?? [];

    expect(before.some((l) => l.startsWith('빙원'))).toBe(false);
  });
});

describe('온기는 가로 띠가 아니라 self 패널에 있다', () => {
  it('`self.*` 는 가로 띠로 가지 않는다 — 같은 값을 두 번 그리지 않는다 (C007 규율)', () => {
    const hud = resolvePresentation(takingView).hud;

    expect(hud.find((h) => h.id === 'self.warmth')).toBeUndefined();
  });

  it('self 패널에 온기 줄이 있다', () => {
    expect(resolvePresentation(takingView).self?.lines).toContain('온기 62/100');
  });
});

describe('세계 씨앗 — 진단 표면에서만 보인다 (C-TERRAIN-003)', () => {
  it('진단 표면(C)을 켜면 self 패널에 씨앗이 한 줄로 온다', () => {
    const plan = resolvePresentation(takingView, undefined, { debugObserve: true });
    expect(plan.self?.lines).toContain('세계 씨앗 1');
  });

  it('평시 표면은 이 값을 그리지 않는다 — 플레이어에게 씨앗은 세계 밖의 사실이다', () => {
    const plan = resolvePresentation(takingView);
    expect(plan.self?.lines.some((l) => l.includes('세계 씨앗'))).toBe(false);
  });
});

