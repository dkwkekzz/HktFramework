// C013 Penetration — View 단독 테스트 (World 미기동, Fixture 만으로 돈다)
//
// 계약 출처: cycles/C013-penetration-devalues-the-wall/04-gameview.spec.yaml
//   entities.character.attributes.combatStats (여섯 값) · attributes.versusObserver
//   strikeEvents.breakdown.penetrationStat / effectiveDefense · hud.self.combatStats
//
// fixture 는 관찰자가 자율 존재(wanderer, Resistance 90)를 오라 스킬로 한 번 친 순간이다.
//   관찰자 rabbit-swordsman  AuraAtk 40 · Armor 50 · Resist 20 · 관통 0 / 60 (종류가 정한 값)
//   자율 존재 wanderer       AuraAtk 15 · Armor 30 · Resist 90 · 관통 0 / 0

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../presentation/resolve';
import fixture from './fixtures/penetration.fixture.json';
import noPenetrationFixture from './fixtures/damage-type.fixture.json';

const snapshot = fixture as unknown as GameViewSnapshot;
const plan = (inspect = false) => resolvePresentation(snapshot, undefined, { inspect });
const strike = (targetId: string, inspect = false) =>
  plan(inspect).strikes.find((s) => s.id.includes(`->${targetId}@`));
const inspectLines = (entityId: string) =>
  plan(true).entities.find((e) => e.id === entityId)?.inspect;

describe('strikeEvents.breakdown — 상대 방어가 얼마나 통하지 않았는가', () => {
  it('맞은 자리의 값은 관통이 작용한 결과다', () => {
    // 관통이 없었다면 14 이다 (Resistance 90 그대로)
    expect(strike('npc-1')?.text).toBe('-17');
  });

  it('관찰을 켜면 걷히기 전 · 관통 · 걷힌 뒤 세 값이 함께 나온다', () => {
    // 걷힌 뒤 값이 감쇄율의 근거다 — 걷히기 전 값으로 검산하면 어긋난다
    // (04 DEFENSE STAT NOTE)
    expect(strike('npc-1', true)?.detail).toBe(
      '오라 · 6+20=26 (오라 공격 40) ×64%(오라 방어 90 · 관통 60 → 56.25) = 17',
    );
  });

  it('관통이 0 인 타격에서도 세 값이 모두 읽힌다', () => {
    // 두 값이 같은 것이 "이 상대에게는 통하지 않았다" 의 관찰이다.
    // 항목을 감추면 그 사실을 볼 수 없다 (04 strikeEvents.meaning)
    const other = resolvePresentation(
      noPenetrationFixture as unknown as GameViewSnapshot,
      undefined,
      { inspect: true },
    );
    const detail = other.strikes.find((s) => s.id.includes('->npc-1@'))?.detail;
    expect(detail).toContain('관통 0 → 90');
  });

  it('관통은 공격 쪽 기여로 보이지 않는다 — rawDamage 는 그대로다', () => {
    expect(strike('npc-1', true)?.detail).toContain('6+20=26');
  });
});

describe('entities.attributes.versusObserver — 치기 전에 무엇이 통할지 보인다', () => {
  it('상대의 방어 뒤에 나에게 읽히는 값이 붙는다', () => {
    const lines = inspectLines('npc-1');
    expect(lines?.[4]).toBe('오라 공격 15 · 오라 방어 90 (받는 피해 53%) → 나에게 56.25 (64%)');
  });

  it('내 관통이 없는 쪽에는 아무 말도 붙지 않는다 — 같다는 것은 화살표가 없는 것이다', () => {
    const lines = inspectLines('npc-1');
    expect(lines?.[3]).toBe('물리 공격 40 · 물리 방어 30 (받는 피해 77%)');
    expect(lines?.[3]).not.toContain('나에게');
  });

  it('그 존재가 지닌 관통도 한 줄로 읽힌다', () => {
    expect(inspectLines('npc-1')?.[5]).toBe('관통 물리 0 · 오라 0');
  });

  it('약점 판정은 걷히기 전 방어로 한다 — 관통이 그것을 흔들지 않는다', () => {
    // wanderer 는 Armor 30 · Resistance 90 — 오라 쪽이 단단하므로 물리에 약하다.
    // 내 오라 관통이 그 벽을 56.25 로 만들어도 판정은 30 과 90 을 견준 결과 그대로다
    expect(inspectLines('npc-1')?.[6]).toBe('약점 물리에 약하다');
  });

  it('걷힌 값을 View 가 만들어내지 않는다 — 세계가 보낸 값을 그대로 쓴다', () => {
    // fixture 의 versusObserver 를 지우면 그 표시도 사라져야 한다.
    // View 가 combatStats.armor 와 내 관통을 곱하고 있었다면 여전히 나타난다
    const stripped = JSON.parse(JSON.stringify(snapshot)) as GameViewSnapshot;
    for (const entity of stripped.entities) {
      if (entity.attributes) {
        entity.attributes.versusObserver = {
          armor: entity.attributes.combatStats.armor,
          resistance: entity.attributes.combatStats.resistance,
          armorMultiplier: entity.attributes.combatStats.armorMultiplier,
          resistanceMultiplier: entity.attributes.combatStats.resistanceMultiplier,
        };
      }
    }
    const lines = resolvePresentation(stripped, undefined, { inspect: true }).entities.find(
      (e) => e.id === 'npc-1',
    )?.inspect;
    expect(lines?.[4]).toBe('오라 공격 15 · 오라 방어 90 (받는 피해 53%)');
  });
});

describe('hud.self.combatStats — 내 관통은 늘 눈앞에 있다', () => {
  it('관통 두 값이 능력치 두 줄 뒤에 온다', () => {
    const lines = plan().self?.lines ?? [];
    expect(lines[0]).toBe('물리 공격 40 · 물리 방어 50 (받는 피해 67%)');
    expect(lines[2]).toBe('관통 물리 0 · 오라 60');
  });

  it('0 인 쪽도 쓴다 — 없다는 것을 아는 것이 그쪽으로는 못 깎는다를 아는 것이다', () => {
    expect(plan().self?.lines[2]).toContain('물리 0');
  });
});
