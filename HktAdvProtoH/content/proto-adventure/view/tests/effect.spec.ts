// F1 이펙트 표현 결정 Layer 단독 테스트 — World 미기동, Fixture 만으로
// "어떤 사건이 어떤 이펙트를 얼마나 세게 켜는가" 를 검증한다.
//
// 그림 자체(방사인가 · 링인가 · 꺼지는가)는 여기서 재지 않는다 — 그것은 게놈의 성질이고
// tools/fx-lab/test/fx-shot.js 가 픽셀로 판정한다. 여기서 지키는 것은 *배선*이다:
// 세계의 의미(damageType · guard · critical · 잔량 · acquainted)가 이펙트 이름과 세기로
// 정확히 옮겨지는가, 그리고 같은 사건이 두 번 실리지 않는가.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import {
  EFFECT_SET,
  EMPTY_EFFECT_MEMORY,
  rememberForEffects,
  type EffectMemory,
} from '../effect-presentation';
import criticalFixture from './fixtures/critical.fixture.json';
import damageTypeFixture from './fixtures/damage-type.fixture.json';
import guardFixture from './fixtures/guard.fixture.json';
import miningFixture from './fixtures/mining-available.fixture.json';
import observeFixture from './fixtures/observe.fixture.json';

const critical = criticalFixture as GameViewSnapshot;
const damageType = damageTypeFixture as GameViewSnapshot;
const guarding = guardFixture as GameViewSnapshot;
const mining = miningFixture as GameViewSnapshot;
const observing = observeFixture as GameViewSnapshot;

const effects = (snapshot: GameViewSnapshot, since: EffectMemory = EMPTY_EFFECT_MEMORY) =>
  resolvePresentation(snapshot, undefined, { effectsSince: since }).effects;

const forStrike = (snapshot: GameViewSnapshot, targetId: string) =>
  effects(snapshot).filter((e) => e.id.includes(`->${targetId}@`));

describe('예산 — 화면에 올릴 수 있는 이펙트는 정해져 있다', () => {
  it('슬라이스가 8개이고 기반 개체가 하나를 쓰므로 7개를 넘지 않는다', () => {
    expect(EFFECT_SET.length).toBeLessThanOrEqual(7);
  });

  it('결정 Layer 가 고르는 이펙트는 모두 그 예산 안에 있다 — 켤 수 없는 것을 지시하지 않는다', () => {
    const chosen = [
      ...effects(guarding),
      ...effects(critical),
      ...effects(damageType),
    ].map((e) => e.effect);
    expect(chosen.length).toBeGreaterThan(0);
    for (const name of chosen) expect(EFFECT_SET).toContain(name);
  });
});

describe('C012 — 무엇으로 쳤는가가 이펙트를 고른다', () => {
  it('아우라 타격은 방전이다', () => {
    expect(forStrike(damageType, 'npc-1').map((e) => e.effect)).toEqual(['전격']);
  });

  it('물리 타격은 가시별이다', () => {
    expect(forStrike(guarding, 'npc-1')[0]?.effect).toBe('타격');
  });
});

describe('C010 · C013 — 한 방의 크기가 이펙트의 세기다', () => {
  it('센 타격이 약한 타격보다 세게 켜진다', () => {
    // 같은 fixture 안: 55 를 맞은 npc-1 vs 9 만 들어간 player-1 (막았다)
    const heavy = forStrike(guarding, 'npc-1')[0]!;
    const light = forStrike(guarding, 'player-1')[0]!;
    expect(heavy.strength).toBeGreaterThan(light.strength * 1.5);
  });

  it('세기는 화면을 뒤덮지 않도록 위가 막혀 있다', () => {
    for (const effect of [...effects(guarding), ...effects(critical)]) {
      expect(effect.strength).toBeGreaterThanOrEqual(0.4);
      expect(effect.strength).toBeLessThanOrEqual(2.6);
    }
  });
});

describe('C011 — 막힘과 무너짐은 서로 다르게 켜진다', () => {
  it('막힌 타격에는 튕겨 낸 파문이 함께 켜진다', () => {
    const blocked = effects(guarding).filter((e) => e.id.startsWith('blocked:'));
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.effect).toBe('물결파');
  });

  it('막아 낸 파문의 세기는 *덜 들어간 만큼*이다 — 막지 않은 값이 아니다', () => {
    // guard.fixture: prevented 8 (17 → 9)
    const blocked = effects(guarding).find((e) => e.id.startsWith('blocked:'))!;
    expect(blocked.strength).toBeCloseTo(0.4 + 8 / 18, 5);
  });

  it('무너진 타격은 막힌 타격과 다른 이펙트다', () => {
    const broken = effects(guarding).filter((e) => e.id.startsWith('broken:'));
    expect(broken.map((e) => e.effect)).toEqual(['삼중 파문']);
  });
});

describe('C015 — 크게 터진 한 방은 화구가 얹힌다', () => {
  it('터진 타격에는 폭발이 더해진다', () => {
    const marks = forStrike(critical, 'npc-2');
    expect(marks.map((e) => e.effect)).toContain('파이어볼 폭발');
  });

  it('터지지 않은 타격에는 더해지지 않는다 — 가능성만으로는 켜지지 않는다', () => {
    const marks = forStrike(critical, 'npc-1');
    expect(marks.map((e) => e.effect)).not.toContain('파이어볼 폭발');
  });

  it('터진 한 방은 같은 값이라도 더 세게 켜진다', () => {
    // critical.fixture: npc-1 은 20 (안 터짐), npc-2 는 40 (터져서 20 → 40)
    const plain = forStrike(critical, 'npc-1')[0]!;
    const burst = forStrike(critical, 'npc-2')[0]!;
    expect(burst.strength).toBeGreaterThan(plain.strength);
  });
});

describe('C001 — 세계가 사건으로 내지 않는 것은 관찰의 차이로 읽는다', () => {
  it('광맥의 잔량이 줄면 그 자리에서 터진다', () => {
    const before: EffectMemory = { labels: { 'deposit-1': 5 }, acquainted: {} };
    const marks = effects(mining, before).filter((e) => e.id.startsWith('mine:'));
    expect(marks).toHaveLength(0); // 아직 줄지 않았다 (fixture 는 5 그대로다)

    const dug = {
      ...mining,
      entities: mining.entities.map((e) =>
        e.id === 'deposit-1' ? { ...e, labelValue: 4 } : e,
      ),
    } as GameViewSnapshot;
    const after = effects(dug, before).filter((e) => e.id.startsWith('mine:'));
    expect(after).toHaveLength(1);
    expect(after[0]?.effect).toBe('타격');
    expect(after[0]?.position).toEqual(
      mining.entities.find((e) => e.id === 'deposit-1')?.position,
    );
  });

  it('기억이 없으면 켜지 않는다 — 처음 본 세계가 통째로 터지지 않는다', () => {
    expect(effects(mining).filter((e) => e.id.startsWith('mine:'))).toHaveLength(0);
  });

  it('잔량이 늘어난 것은 사건이 아니다', () => {
    const before: EffectMemory = { labels: { 'deposit-1': 3 }, acquainted: {} };
    expect(effects(mining, before).filter((e) => e.id.startsWith('mine:'))).toHaveLength(0);
  });
});

describe('C014 · C016 — 알게 된 순간이 드러난다', () => {
  it('모르던 존재를 알게 되면 그 몸에서 오라가 오른다', () => {
    const before = rememberForEffects(observing); // npc-2 는 아직 모른다
    expect(before.acquainted['npc-2']).toBe(false);

    const learned = {
      ...observing,
      entities: observing.entities.map((e) =>
        e.id === 'npc-2' && e.attributes
          ? { ...e, attributes: { ...e.attributes, acquainted: true, concealed: [] } }
          : e,
      ),
    } as GameViewSnapshot;
    const marks = effects(learned, before).filter((e) => e.id.startsWith('acquaint:'));
    expect(marks).toHaveLength(1);
    expect(marks[0]?.effect).toBe('회복 오라');
  });

  it('이미 알던 존재에는 켜지지 않는다', () => {
    const before = rememberForEffects(observing);
    expect(effects(observing, before).filter((e) => e.id.startsWith('acquaint:'))).toHaveLength(0);
  });
});

describe('사건은 한 번이다 — 같은 관찰이 여러 프레임 실려도 키가 같다', () => {
  it('같은 관찰 결과를 두 번 풀면 같은 id 가 나온다 (그리는 쪽이 두 번째를 흘린다)', () => {
    const first = effects(guarding).map((e) => e.id);
    const second = effects(guarding).map((e) => e.id);
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length); // 한 프레임 안에서도 겹치지 않는다
  });

  it('칼날 각도는 사건마다 정해져 있다 — 프레임마다 흔들리지 않는다', () => {
    const a = forStrike(guarding, 'npc-1')[0]?.roll;
    const b = forStrike(guarding, 'npc-1')[0]?.roll;
    expect(a).toBe(b);
    expect(typeof a).toBe('number');
  });
});

describe('자리 — 맞은 몸의 크기를 따른다', () => {
  it('타격은 그 몸의 가슴께에서 터진다', () => {
    const target = critical.entities.find((e) => e.id === 'npc-2')!;
    const mark = forStrike(critical, 'npc-2')[0]!;
    expect(mark.elevation).toBeCloseTo((target.body?.height ?? 0) * 0.55, 5);
    expect(mark.position).toEqual({
      x: critical.strikes.find((s) => s.targetId === 'npc-2')!.at.x,
      z: critical.strikes.find((s) => s.targetId === 'npc-2')!.at.z,
    });
  });

  it('축은 때린 쪽에서 맞은 쪽으로 향한다 — 파면이 공격자를 마주 본다', () => {
    const strike = damageType.strikes[0]!;
    const attacker = damageType.entities.find((e) => e.id === strike.attackerId)!;
    const mark = forStrike(damageType, 'npc-1')[0]!;
    const dx = strike.at.x - attacker.position.x;
    const dz = strike.at.z - attacker.position.z;
    const length = Math.hypot(dx, dz);
    expect(mark.direction?.x).toBeCloseTo(dx / length, 5);
    expect(mark.direction?.z).toBeCloseTo(dz / length, 5);
  });
});
