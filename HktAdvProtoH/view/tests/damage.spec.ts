// C010 피해 표현 결정 Layer 단독 테스트 — World 미기동, Fixture 만으로
// entities.attributes.combatStats · strikeEvents.breakdown · hud.self.combatStats 의
// 표현 결정을 검증한다.
//
// Fixture 의 관찰자는 rabbit-swordsman (Attack 40 · Defense 50),
// 자율 존재는 wanderer (Attack 40 · Defense 30) 다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../presentation/resolve';
import fixture from './fixtures/combat.fixture.json';

const snapshot = fixture as GameViewSnapshot;
const plan = (inspect = false) => resolvePresentation(snapshot, undefined, { inspect });
const strike = (targetId: string, inspect = false) =>
  plan(inspect).strikes.find((s) => s.id.includes(`->${targetId}@`));

describe('hud.self.combatStats — 내 두 능력은 늘 눈앞에 있다', () => {
  it('공격력·방어력과 그 방어가 남기는 비율이 첫 줄에 온다', () => {
    const lines = plan().self?.lines ?? [];
    // C012 — 두 줄로 갈린다. 고를 때 견주는 축이 공격/방어가 아니라 물리/오라이기 때문이다
    expect(lines[0]).toBe('물리 공격 40 · 물리 방어 50 (받는 피해 67%)');
    expect(lines[1]).toBe('오라 공격 40 · 오라 방어 50 (받는 피해 67%)');
    expect(lines[2]).toBe('관통 물리 0 · 오라 0'); // C013
    expect(lines[3]).toBe('내 약점 치우침 없음');
  });

  it('비율은 백분율로 읽힌다 — 0.67 보다 67% 가 먼저 이해된다', () => {
    // 세계가 보내는 값은 100/150 = 0.6666… 이다. 결정 Layer 가 읽을 형태로 바꾼다.
    expect(plan().self?.lines[0]).not.toContain('0.66');
  });
});

describe('entities.attributes.combatStats — 남의 능력도 펼쳐 보면 나온다', () => {
  it('속성 관찰을 켜면 그 존재의 공격력·방어력이 줄로 나온다', () => {
    const npc = plan(true).entities.find((e) => e.id === 'npc-1');
    expect(npc?.inspect?.join('\n')).toContain('물리 공격 40 · 물리 방어 30 (받는 피해 77%)');
    expect(npc?.inspect?.join('\n')).toContain('오라 공격 40 · 오라 방어 30 (받는 피해 77%)');
    // C012 — 약점 판정은 세계가 보낸 값이다. View 가 두 수치를 비교해 만들지 않는다
    expect(npc?.inspect?.join('\n')).toContain('약점 치우침 없음');
  });

  it('꺼져 있으면 몸 위를 채우지 않는다 — 감춘 것이 아니라 표시 선택이다', () => {
    expect(plan(false).entities.find((e) => e.id === 'npc-1')?.inspect).toBeUndefined();
  });
});

describe('strikeEvents.breakdown — 그 숫자가 왜 그만큼인지', () => {
  it('평소에는 피해 숫자만 뜬다 — 경위가 숫자를 가리지 않는다', () => {
    const s = strike('npc-1');
    expect(s?.text).toBe('-55');
    expect(s?.detail).toBeUndefined();
  });

  it('속성 관찰을 켜면 경위가 한 줄로 따라붙는다', () => {
    // 고급 스킬: 기본 32 + 공격 기여 40 = 72, 방어 30 이 77% 로 줄여 55
    // C012 — 방식과 고른 두 능력의 이름이 함께 나온다
    expect(strike('npc-1', true)?.detail).toBe(
      '물리 · 32+40=72 (물리 공격 80) ×77%(물리 방어 30 · 관통 0 → 30) = 55',
    );
  });

  it('맞는 쪽이 단단하면 같은 구조로 더 줄어든 것이 보인다', () => {
    // 기본 스킬: 6 + 20 = 26, 방어 50 이 67% 로 줄여 17
    expect(strike('player-1', true)?.detail).toBe(
      '물리 · 6+20=26 (물리 공격 40) ×67%(물리 방어 50 · 관통 0 → 50) = 17',
    );
  });

  it('표시되는 피해 숫자와 경위의 최종 피해가 어긋나지 않는다', () => {
    for (const s of plan(true).strikes) {
      const final = s.detail?.split('= ').pop();
      expect(s.text).toBe(`-${final}`);
    }
  });

  it('경위가 있어도 기존 표시(크기·자리·나이)는 그대로다', () => {
    const withDetail = strike('npc-1', true);
    const without = strike('npc-1', false);
    expect(withDetail?.emphasis).toBe(without?.emphasis); // 고급 스킬은 여전히 크게
    expect(withDetail?.anchorHeight).toBe(without?.anchorHeight);
    expect(withDetail?.since).toBe(without?.since);
  });
});
