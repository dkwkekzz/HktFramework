// 기술 표현 결정 Layer 단독 테스트 (C023) — World 미기동, Fixture 만으로
// 04-gameview.spec.yaml 의 계약(profile 의 모양 셋 · swing · 가능/사유)이
// 화면 지시로 어떻게 옮겨지는지 검증한다.
//
// 이 Cycle 의 Human 지시(05-review.md)가 요구한 둘을 여기서 지킨다.
//   ① 모양이 평시 화면에 나타난다
//   ② 셋을 나란히 놓고 견줄 수 있다

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import { SKILL_HUD_PREFIX } from '../skill-presentation';
import fixture from './fixtures/skill-shape.fixture.json';

const snapshot = fixture as unknown as GameViewSnapshot;

const skillLines = (plan: ReturnType<typeof resolvePresentation>) =>
  plan.hud.filter((h) => h.id.startsWith(SKILL_HUD_PREFIX));

describe('기술 줄 (Semantic → Render Plan) — 셋을 견준다', () => {
  it('모양을 지닌 것이 모두 한 줄씩 실린다 — 세계가 보낸 만큼', () => {
    const lines = skillLines(resolvePresentation(snapshot));
    expect(lines.map((l) => l.id)).toEqual([
      'skill.attack',
      'skill.skill-heavy',
      'skill.skill-aura',
    ]);
  });

  it('줄마다 그 기술을 부르는 키와 이름이 붙는다 (Human 지시 — 셋 다 쓸 수 있어야 한다)', () => {
    const lines = skillLines(resolvePresentation(snapshot));
    expect(lines.map((l) => l.label)).toEqual(['F 기본 스킬', 'G 고급 스킬', 'R 오라 스킬']);
  });

  it('넓이와 도달이 숫자로 실린다 — 걸어 보고 아는 것이 아니다', () => {
    const lines = skillLines(resolvePresentation(snapshot));
    const basic = lines.find((l) => l.id === 'skill.attack')!;
    const heavy = lines.find((l) => l.id === 'skill.skill-heavy')!;
    // 150° · 도달 1.3 + 0.7 = 2.0
    expect(String(basic.value)).toContain('150°');
    expect(String(basic.value)).toContain('도달 2.0');
    // 40° · 도달 2.2 + 0.55 = 2.75 → 2.8
    expect(String(heavy.value)).toContain('40°');
    expect(String(heavy.value)).toContain('도달 2.8');
  });

  it('넓이 막대는 목록 안에서 견준다 — 화면이 "몇 도부터 넓은가" 를 정하지 않는다', () => {
    const lines = skillLines(resolvePresentation(snapshot));
    const bar = (id: string) => String(lines.find((l) => l.id === id)!.value).split(' ')[0]!;
    // 가장 넓은 것이 가득 찬다
    expect(bar('skill.attack')).toBe('█████');
    // 좁은 것은 덜 찬다 — 그러나 비어 보이지는 않는다
    expect(bar('skill.skill-heavy').startsWith('█')).toBe(true);
    expect(bar('skill.skill-heavy')).not.toBe(bar('skill.attack'));
    // 같은 모양을 지닌 둘은 같은 막대다 (오라 기술은 기본 기술과 모양이 같다)
    expect(bar('skill.skill-aura')).toBe(bar('skill.attack'));
  });

  it('띠에는 사유가 붙지 않는다 — 무엇이든 하는 동안 세 줄이 다 길어지지 않게 (C022 와 같은 판단)', () => {
    for (const line of skillLines(resolvePresentation(snapshot))) {
      expect(String(line.value)).not.toContain('✗');
      expect(String(line.value)).not.toContain('—');
    }
  });

  it('못 거는 사유는 세로로 자라는 패널에 실린다 — 사라지지 않고 자리만 옮겼다', () => {
    const lines = resolvePresentation(snapshot).self!.lines;
    const start = lines.indexOf('기술');
    expect(start).toBeGreaterThanOrEqual(0);
    const block = lines.slice(start + 1, start + 4);
    expect(block[0]).toBe('기본 스킬 ✓ F');
    expect(block[1]).toMatch(/^고급 스킬 ✗ /); // fixture 의 reason 은 insufficient-cp
    expect(block[1]).not.toContain('insufficient-cp'); // 코드가 아니라 문구로 옮겨진다
    expect(block[2]).toBe('오라 스킬 ✓ R');
  });

  it('모양이 없는 세계에서는 줄이 하나도 서지 않는다 — 기술 이름을 아는 코드가 없다는 증거', () => {
    const noShape = structuredClone(snapshot) as GameViewSnapshot;
    for (const interaction of noShape.interactions) delete interaction.profile;
    const plan = resolvePresentation(noShape);
    expect(skillLines(plan)).toEqual([]);
    expect(plan.self!.lines).not.toContain('기술'); // 패널 쪽도 함께 사라진다
  });

  it('세계가 넷째 기술을 정의하면 줄이 하나 는다 — 이 파일을 고치지 않고', () => {
    const withFourth = structuredClone(snapshot) as GameViewSnapshot;
    const basic = withFourth.interactions.find((i) => i.id === 'attack')!;
    withFourth.interactions.push({
      ...structuredClone(basic),
      id: 'skill-unknown',
      role: 'skill-unknown', // 표현 표에 없는 역할이다
    });
    const lines = skillLines(resolvePresentation(withFourth));
    expect(lines).toHaveLength(4);
    // 표에 없어도 화면이 멈추지 않는다 — 역할 코드가 그대로 보인다
    expect(lines[3]!.label).toBe('skill-unknown');
  });
});

describe('칼끝 (Semantic → Render Plan) — 평시 화면에 나타난다', () => {
  it('휘두르는 중이면 칼끝이 세계가 보낸 자리·굵기로 실린다', () => {
    const withSwing = structuredClone(snapshot) as GameViewSnapshot;
    withSwing.entities[0]!.swing = {
      center: { x: 2.2, z: 0 },
      radius: 0.55,
      active: true,
      struck: [],
    };
    const spheres = resolvePresentation(withSwing).colliderDebug!.spheres;
    expect(spheres).toHaveLength(1);
    expect(spheres[0]).toMatchObject({ center: { x: 2.2, z: 0 }, radius: 0.55 });
  });

  it('휘두르는 이가 없으면 아무것도 그리지 않는다', () => {
    const still = structuredClone(snapshot) as GameViewSnapshot;
    for (const entity of still.entities) delete entity.swing;
    expect(resolvePresentation(still).colliderDebug!.spheres).toEqual([]);
  });

  it('나간 칼과 아직 나가지 않은 칼이 구분되어 보인다', () => {
    const make = (active: boolean) => {
      const s = structuredClone(snapshot) as GameViewSnapshot;
      s.entities[0]!.swing = { center: { x: 1.3, z: 0 }, radius: 0.7, active, struck: [] };
      return resolvePresentation(s).colliderDebug!.spheres[0]!;
    };
    const active = make(true);
    const idle = make(false);
    expect(active.color).not.toBe(idle.color);
    expect(active.opacity).toBeGreaterThan(idle.opacity!);
  });
});
