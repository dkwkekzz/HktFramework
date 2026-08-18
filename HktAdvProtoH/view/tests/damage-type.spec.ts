// C012 Damage Type — View 단독 테스트 (World 미기동, Fixture 만으로 돈다)
//
// 계약 출처: cycles/C012-damage-type-chooses-the-defense/04-gameview.spec.yaml
//   entities.character.attributes.combatStats (네 값) · attributes.defenseShape
//   interactions.skillAura · strikeEvents.breakdown.damageType/offenseStat/defenseStat
//   hud.self.combatStats
//
// fixture 는 오라 스킬로 자율 존재(wanderer)를 한 번 친 순간이다.
//   관찰자 rabbit-swordsman  PhysicalAttack 40 · AuraAttack 40 · Armor 50 · Resistance 20
//   자율 존재 wanderer       PhysicalAttack 40 · AuraAttack 15 · Armor 30 · Resistance 90

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { interactionPresentation } from '../presentation/interaction-presentation';
import { resolvePresentation } from '../presentation/resolve';
import fixture from './fixtures/damage-type.fixture.json';

const snapshot = fixture as unknown as GameViewSnapshot;
const plan = (inspect = false) => resolvePresentation(snapshot, undefined, { inspect });
const strike = (targetId: string, inspect = false) =>
  plan(inspect).strikes.find((s) => s.id.includes(`->${targetId}@`));

describe('strikeEvents.breakdown — 무엇으로 쳤고 무엇을 읽었는가', () => {
  it('맞은 자리의 값은 오라 타격의 결과다', () => {
    expect(strike('npc-1')?.text).toBe('-14');
  });

  it('관찰을 켜면 방식과 고른 두 능력이 이름과 함께 나온다', () => {
    // 값만 있으면 왜 이쪽으로 계산되었는지 알 수 없다 (04 strikeEvents.meaning)
    expect(strike('npc-1', true)?.detail).toBe(
      // C013 — 방어 자리가 세 값이 된다. 관통 0 이어도 쓴다 —
      // 두 값이 같은 것이 "이 상대에게는 통하지 않았다" 의 관찰이다
      '오라 · 6+20=26 (오라 공격 40) ×53%(오라 방어 90 · 관통 0 → 90) = 14',
    );
  });

  it('막지 않은 타격이므로 막기 줄이 붙지 않는다 — C010·C011 표시 그대로다', () => {
    expect(strike('npc-1', true)?.guard).toBeUndefined();
    expect(strike('npc-1')?.detail).toBeUndefined();
  });
});

describe('entities.attributes — 상대의 두 방어와 약점이 보인다', () => {
  it('속성 관찰을 켜면 네 능력이 두 줄로 나온다', () => {
    const npc = plan(true).entities.find((e) => e.id === 'npc-1');
    const text = npc?.inspect?.join('\n') ?? '';
    expect(text).toContain('물리 공격 40 · 물리 방어 30 (받는 피해 77%)');
    expect(text).toContain('오라 공격 15 · 오라 방어 90 (받는 피해 53%)');
  });

  it('약점은 세계가 판정한 값을 그대로 옮긴 것이다', () => {
    // wanderer 는 오라 쪽(90)이 물리 쪽(30)보다 단단하다 → 물리에 약하다.
    // View 가 두 수치를 비교해 만들어내지 않는다 (04 defenseShape.meaning ·
    // DC-WORLD-OWNS-THE-SURFACE-LIST). 세계가 보낸 코드가 aura-tougher 이고
    // 결정 Layer 는 그것을 사람 말로 옮기기만 한다.
    expect(
      (snapshot.entities.find((e) => e.id === 'npc-1')?.attributes as { defenseShape: string })
        .defenseShape,
    ).toBe('aura-tougher');
    const npc = plan(true).entities.find((e) => e.id === 'npc-1');
    expect(npc?.inspect?.join('\n')).toContain('약점 물리에 약하다');
  });

  it('관찰을 끄면 펼침이 없다 — 기존 규칙 그대로다', () => {
    expect(plan(false).entities.find((e) => e.id === 'npc-1')?.inspect).toBeUndefined();
  });
});

describe('hud.self — 내 네 능력과 내 약점', () => {
  it('물리·오라가 각각 한 줄로, 그다음 내 약점이 온다', () => {
    const lines = plan().self?.lines ?? [];
    expect(lines[0]).toBe('물리 공격 40 · 물리 방어 50 (받는 피해 67%)');
    expect(lines[1]).toBe('오라 공격 40 · 오라 방어 20 (받는 피해 83%)');
    // rabbit-swordsman 은 물리 쪽(50)이 오라 쪽(20)보다 단단하다 → 오라에 약하다
    expect(lines[2]).toBe('관통 물리 0 · 오라 0'); // C013
    expect(lines[3]).toBe('내 약점 오라에 약하다');
  });
});

describe('interactions.skillAura — 고를 수 있는 표면이 열린다', () => {
  it('세계가 실어 보낸 목록에 오라 스킬이 있고 사유 목록이 기존 스킬과 같다', () => {
    const aura = snapshot.interactions.find((i) => i.id === 'skill-aura');
    expect(aura?.role).toBe('skill-aura');
    // 이 fixture 는 휘두름 도중의 한 순간이다 — 세 스킬 모두 같은 사유로 막혀 있다.
    // 오라 스킬이 별도 관문을 갖지 않는다는 것이 여기서 드러난다
    expect(aura?.available).toBe(false);
    expect(aura?.reason).toBe('action-busy');
    expect(snapshot.interactions.find((i) => i.id === 'attack')?.reason).toBe('action-busy');
  });

  it('기본 스킬 바로 옆자리 키에 걸린다 — 둘은 나란한 선택이다', () => {
    // View 는 목록을 읽을 뿐 스스로 만들지 않는다. 키를 정하는 것만이 결정 Layer 의 몫이다
    expect(interactionPresentation('skill-basic').keyLabel).toBe('F');
    expect(interactionPresentation('skill-aura').keyLabel).toBe('R');
    expect(interactionPresentation('skill-aura').prompt).toBe('오라 스킬');
  });

  it('세계가 실은 방식이 그대로 읽힌다 — View 가 짐작하지 않는다', () => {
    const profile = (id: string) =>
      snapshot.interactions.find((i) => i.id === id)?.profile?.damageType;
    expect(profile('attack')).toBe('physical');
    expect(profile('skill-heavy')).toBe('physical');
    expect(profile('skill-aura')).toBe('aura');
  });

  it('오라 스킬의 rawDamage 는 오라 공격 능력으로 계산되어 온다', () => {
    const aura = snapshot.interactions.find((i) => i.id === 'skill-aura');
    expect(aura?.profile?.rawDamage).toBe(26); // 6 + 40 × 0.5
  });
});

describe('세계가 목록을 바꾸면 View 는 따라온다 (DC-WORLD-OWNS-THE-SURFACE-LIST)', () => {
  it('변경 가능 속성 목록이 네 능력으로 바뀐 것이 그대로 실린다', () => {
    const attribute = snapshot.commands
      ?.find((c) => c.id === 'set-attribute')
      ?.parameters.find((p) => p.id === 'attribute');
    const options = attribute?.domain.options?.map((o) => o.name) ?? [];

    expect(options).toContain('physicalAttack');
    expect(options).toContain('auraAttack');
    expect(options).toContain('armor');
    expect(options).toContain('resistance');
    // 옛 이름은 사라졌다 — View 코드를 고치지 않았는데 목록이 따라 바뀌었다
    expect(options).not.toContain('attack');
    expect(options).not.toContain('defense');
  });
});
