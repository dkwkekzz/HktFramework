// C025 View 단독 테스트 — World 미기동, Fixture 만으로 (VUX-SK-V-12).
//
// 04-gameview.spec.yaml 의 `skill` · `requestOutcome` · `prohibited` 를 검증한다.
// 세계 프로세스도, 세계 코드의 import 도 없다 — 계약이 실은 값만으로 화면이 정해진다.

import { beforeEach, describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import {
  isSkillInteraction,
  skillDetailLines,
  skillSlotBar,
  skillInteractionIds,
  skillObservations,
  SKILL_HUD_PREFIX,
  type SkillAnswers,
} from '../skill-presentation';
import { codeText, shortCodeText } from '../code-text';
import { forgetWaits } from '../request-timing';
import combatFixture from './fixtures/combat.fixture.json';
import guardFixture from './fixtures/guard.fixture.json';
import damageTypeFixture from './fixtures/damage-type.fixture.json';
import unknownFixture from './fixtures/skill-unknown.fixture.json';

const combat = combatFixture as GameViewSnapshot;
const guard = guardFixture as GameViewSnapshot;
const damageType = damageTypeFixture as GameViewSnapshot;
const unknown = unknownFixture as GameViewSnapshot;

// `now` 는 **기다림의 나이를 재는 시계**다 (V-007). 넘기지 않으면 지금을 읽는다.
const bar = (snapshot: GameViewSnapshot, answers: SkillAnswers = {}, now?: number) =>
  skillSlotBar(snapshot, shortCodeText, answers, now ?? performance.now()).cells;
const panel = (snapshot: GameViewSnapshot, answers: SkillAnswers = {}, now?: number) =>
  skillDetailLines(snapshot, codeText, answers, now ?? performance.now()).join('\n');
const slot = (snapshot: GameViewSnapshot, id: string, answers: SkillAnswers = {}, now?: number) =>
  bar(snapshot, answers, now).find((cell) => cell.id === id);

// 기다림의 장부는 화면이 프레임 사이에 쥐고 있는 것이므로, 검사마다 비우고 시작한다 —
// 앞 검사의 나이를 물려받으면 누르자마자 `이어짐 확인` 이 뜨는 화면을 검사하게 된다.
beforeEach(() => forgetWaits());

// ── VUX-SK-FX-READY ────────────────────────────────────────────────
describe('VUX-SK-FX-READY — 손에 든 것 전부가 한 자리에 선다', () => {
  it('세계가 실은 기술이 전부 칸이 된다 — 하나가 다른 하나를 밀어내지 않는다', () => {
    // damage-type fixture 는 셋을 싣는다. 셋 다 칸이 있어야 한다.
    expect(bar(damageType).map((cell) => cell.id)).toEqual([
      'attack',
      'skill-heavy',
      'skill-aura',
    ]);
  });

  it('세계가 보낸 순서 그대로다 — 화면이 순서를 만들지 않는다', () => {
    const world = damageType.interactions.filter(isSkillInteraction).map((i) => i.id);
    expect(skillObservations(damageType).map((s) => s.id)).toEqual(world);
  });

  it('실제 바인딩이 칸에 보인다 (VUX-SK-V-01)', () => {
    expect(slot(combat, 'attack')?.key).toBe('F');
    expect(slot(combat, 'skill-heavy')?.key).toBe('G');
  });

  it('쓸 수 있는 기술은 그렇다고 말한다', () => {
    expect(slot(combat, 'attack')?.status).toBe('지금 됨');
  });

  it('기술이 없는 관찰 결과에는 칸도 줄도 없다 — 없는 자리를 만들지 않는다', () => {
    const empty = { ...combat, interactions: [] } as GameViewSnapshot;
    expect(bar(empty)).toEqual([]);
    expect(skillDetailLines(empty, codeText)).toEqual([]);
  });
});

// ── VUX-SK-FX-UNAVAILABLE ──────────────────────────────────────────
describe('VUX-SK-FX-UNAVAILABLE — 막힌 기술마다 자기 사유가 붙는다', () => {
  it('같은 화면에서 하나는 되고 하나는 안 된다 — 둘 다 보인다', () => {
    expect(slot(combat, 'attack')?.status).toBe('지금 됨');
    expect(slot(combat, 'skill-heavy')?.status).toBe('불가 · 기력 모자람');
  });

  it('사유는 세계가 준 코드 그대로 문구가 된다 (VUX-SK-V-01)', () => {
    expect(panel(combat)).toContain('✗ 기력이 모자란다');
  });

  it('다른 사정은 다른 사유로 온다 — 막는 중은 기력과 다른 말이다', () => {
    expect(slot(guard, 'attack')?.status).toBe('불가 · 막는 중');
    expect(slot(guard, 'skill-heavy')?.status).toBe('불가 · 막는 중');
    expect(panel(guard)).toContain('✗ 막는 중에는 휘두를 수 없다');
  });

  it('행동 중은 셋 모두에 같은 사유로 온다 — 세계가 그렇게 판정했기 때문이다', () => {
    for (const id of ['attack', 'skill-heavy', 'skill-aura']) {
      expect(slot(damageType, id)?.status).toBe('불가 · 행동 중');
    }
  });

  it('쓸 수 있는 기술에는 사유를 지어내지 않는다', () => {
    expect(slot(combat, 'attack')?.status).not.toContain('불가');
  });
});

// ── 04 skill.profile — 치를 것과 낼 것 ─────────────────────────────
describe('고르기 전에 값을 안다', () => {
  it('치르는 기력과 채우는 기력이 합쳐지지 않고 따로 보인다', () => {
    expect(panel(combat)).toContain('기본 스킬 ✓ F · 기력 -0 / +12');
    expect(panel(combat)).toContain('고급 스킬 ✗ 기력이 모자란다 · 기력 -30 / +8');
  });

  it('지금 이 몸으로 내는 공격 피해가 세계가 준 값 그대로 보인다 (VUX-SK-V-03)', () => {
    // 계약의 rawDamage 를 그대로 옮긴다 — baseDamage + 공격력 × attackRatio 를
    // 화면이 다시 계산하지 않는다 (04 prohibited).
    expect(panel(combat)).toContain('공격 피해 26');
    expect(panel(combat)).toContain('공격 피해 72');
  });

  it('방식이 보인다 — 세기가 아니라 방식으로 갈리는 선택이기 때문이다', () => {
    expect(panel(damageType)).toContain('공격 피해 26 (물리)');
    expect(panel(damageType)).toContain('공격 피해 26 (오라)');
  });

  it('최종 피해를 만들어내지 않는다 — 대상이 정해지기 전에는 세계도 모르는 값이다', () => {
    expect(panel(combat)).not.toContain('최종');
  });
});

// ── VUX-SK-FX-STALE — 내 요청이 어떻게 되었는가 ────────────────────
describe('VUX-SK-FX-STALE — 요청의 대답이 그것을 부른 자리에 붙는다', () => {
  // 매번 새로 만든다 — 같은 객체를 여러 검사가 나눠 쓰면 어느 검사가 무엇을 바꿨는지
  // 읽기 어려워진다 (기다림의 장부는 이미 beforeEach 가 비운다)
  const answers = (): SkillAnswers => ({ attack: { state: 'pending' } });

  it('걸어 둔 것은 걸어 둔 것으로 보인다 — 일어난 일로 보이지 않는다 (VUX-SK-V-05)', () => {
    // V-007 — 다만 **늦을 때부터**다. 세계는 보통 한 Tick 안에 답하므로 곧바로 띄우면
    // 그 글자는 읽히기 전에 사라지고, 남는 것은 칸이 깜빡였다는 인상뿐이다
    const t = performance.now();
    expect(slot(combat, 'attack', answers(), t)?.status).toBe('지금 됨'); // 아직 말하지 않는다
    expect(slot(combat, 'attack', answers(), t + 1200)?.status).toBe('처리 중');
    expect(panel(combat, answers(), t + 1200)).toContain('기본 스킬 ⋯ 처리 중');
  });

  it('많이 늦으면 다시 걸라고 하지 않는다 — 이어짐을 보라고 한다', () => {
    const t = performance.now();
    expect(slot(combat, 'attack', answers(), t)?.status).toBe('지금 됨');
    expect(slot(combat, 'attack', answers(), t + 5200)?.status).toBe('이어짐 확인');
  });

  it('걸어 두었다는 사실은 늦기 전에도 참이다 — 같은 요청이 두 번 나가지 않는다', () => {
    // 화면이 말하지 않는 것과 화면이 잊은 것은 다르다. 두 번 나가는 것을 막는 것은
    // 이 표시가 아니라 기다림의 표다 (inventory-workspace 의 pending · 조립의 pendingSkills)
    const t = performance.now();
    expect(slot(combat, 'attack', answers(), t)?.state).toBe('available');
    expect(slot(combat, 'attack', answers(), t + 1200)?.state).toBe('pending');
  });

  it('거절은 사유와 함께 그 기술의 자리에 남는다', () => {
    const answers: SkillAnswers = {
      attack: { state: 'rejected', reason: 'guarding' },
    };
    // guard fixture 는 셋 다 막는 중이므로 거절이 아직 참이다.
    expect(slot(guard, 'attack', answers)?.status).toBe('거절 · 막는 중');
    expect(panel(guard, answers)).toContain('✗ 거절 — 막는 중에는 휘두를 수 없다');
  });

  it('거절은 남의 자리에 붙지 않는다', () => {
    const answers: SkillAnswers = {
      attack: { state: 'rejected', reason: 'guarding' },
    };
    expect(slot(guard, 'skill-heavy', answers)?.status).toBe('불가 · 막는 중');
    expect(slot(combat, 'skill-heavy', answers)?.status).toBe('불가 · 기력 모자람');
  });

  it('막을 것이 사라지면 거절이 물러난다 — 화면이 지금 참이 아닌 것을 말하지 않는다', () => {
    // 막는 중에 거절당한 뒤 손을 내린 상태. 거절은 일어난 일이지만 그 사유는 이미 없다.
    const answers: SkillAnswers = {
      attack: { state: 'rejected', reason: 'guarding' },
    };
    expect(slot(combat, 'attack', answers)?.status).toBe('지금 됨');
    expect(panel(combat, answers)).not.toContain('거절');
  });

  it('아직 막혀 있는 동안에는 거절이 미리 받은 안내보다 앞선다', () => {
    // 실제로 걸어 보고 받은 답이 짐작보다 앞선다.
    const answers: SkillAnswers = {
      'skill-heavy': { state: 'rejected', reason: 'insufficient-cp' },
    };
    expect(slot(combat, 'skill-heavy', answers)?.status).toBe('거절 · 기력 모자람');
  });

  it('사정이 바뀌면 세계의 지금 말이 이긴다 — 낡은 사유를 붙들지 않는다', () => {
    // 행동 중이라 거절당했는데 지금은 막는 중이다. 둘 다 불가이지만 사유가 다르다.
    const answers: SkillAnswers = {
      attack: { state: 'rejected', reason: 'action-busy' },
    };
    expect(slot(guard, 'attack', answers)?.status).toBe('불가 · 막는 중');
  });

  it('세계에 닿지 못한 것은 거절과 다른 사정이다', () => {
    const answers: SkillAnswers = { attack: { state: 'unsent' } };
    expect(slot(combat, 'attack', answers)?.status).toBe('세계에 닿지 않음');
    expect(slot(combat, 'attack', answers)?.status).not.toContain('거절');
  });

  it('받아들여진 것은 그 자리에서 보인다', () => {
    const answers: SkillAnswers = { attack: { state: 'accepted' } };
    expect(slot(combat, 'attack', answers)?.status).toBe('나갔다');
    expect(panel(combat, answers)).toContain('기본 스킬 ✓ 나갔다');
  });

  it('받아들여짐이 불가보다 앞선다 — 뒤에 두면 영영 보이지 않는다', () => {
    // 받아들여진 기술은 그 순간부터 행동 중이라 세계가 곧바로 막는다.
    // damage-type fixture 가 정확히 그 상태다 (셋 다 action-busy).
    const answers: SkillAnswers = { attack: { state: 'accepted' } };
    expect(slot(damageType, 'attack', answers)?.status).toBe('나갔다');
    // 나가지 않은 옆 칸은 여전히 세계의 지금을 말한다
    expect(slot(damageType, 'skill-heavy', answers)?.status).toBe('불가 · 행동 중');
  });

  it('표시가 걷히면 세계의 지금이 자리를 돌려받는다', () => {
    // 조립 루트가 시간이 지나 항목을 지운 뒤의 화면.
    expect(slot(damageType, 'attack', {})?.status).toBe('불가 · 행동 중');
  });

  it('내가 건 것이 세계가 미리 말해 둔 가용성보다 앞선다', () => {
    // 세계는 "기력이 모자라다" 고 말해 두었고, 나는 방금 그것을 걸었다.
    // 지금 알고 싶은 것은 방금 그것이 어떻게 됐는가다 — **늦어졌다면** (V-007).
    const heavy: SkillAnswers = { 'skill-heavy': { state: 'pending' } };
    const t = performance.now();
    expect(slot(combat, 'skill-heavy', heavy, t)?.status).toBe('불가 · 기력 모자람');
    expect(slot(combat, 'skill-heavy', heavy, t + 1200)?.status).toBe('처리 중');
  });
});

// ── VUX-SK-FX-UNKNOWN ──────────────────────────────────────────────
describe('VUX-SK-FX-UNKNOWN — 모르는 것이 와도 화면이 멈추지 않는다', () => {
  it('화면이 이름을 모르는 기술도 칸을 얻는다 — profile 이 곧 기술이라는 관찰이다', () => {
    expect(bar(unknown).map((c) => c.id)).toContain('skill-tideturn');
  });

  it('키가 정해지지 않은 기술도 사라지지 않는다 — 부르지 못할 뿐 존재는 관찰된다', () => {
    expect(slot(unknown, 'skill-tideturn')?.title).toBe('skill-tideturn');
  });

  it('모르는 사유 코드는 원문 그대로 보인다 (VUX-SK-V-10)', () => {
    expect(slot(unknown, 'skill-tideturn')?.status).toBe('불가 · moon-not-risen');
    expect(panel(unknown)).toContain('✗ moon-not-risen');
  });

  it('모르는 방식도 원문 그대로 보인다 — 값을 버리지 않는다', () => {
    expect(panel(unknown)).toContain('공격 피해 41 (tide)');
  });

  it('모르는 것이 있어도 아는 기술들은 그대로 그려진다', () => {
    expect(slot(unknown, 'attack')?.key).toBe('F');
    expect(slot(unknown, 'skill-heavy')?.status).toBe('불가 · 기력 모자람');
  });
});

// ── 04 skill.identification — 이름으로 고르지 않는다 ────────────────
describe('무엇이 기술인가는 profile 이 답한다', () => {
  it('profile 이 없는 interaction 은 기술이 아니다', () => {
    const move = combat.interactions.find((i) => i.id === 'move');
    expect(move).toBeDefined();
    expect(isSkillInteraction(move!)).toBe(false);
  });

  it('role 이 skill- 로 시작하지 않아도 profile 이 있으면 기술이다', () => {
    // 기본 기술의 id 는 `attack` 이다 — 접두사로 골랐다면 이것을 놓쳤을 것이다.
    expect(skillInteractionIds(combat).has('attack')).toBe(true);
  });

  it('profile 을 떼면 그것은 더 이상 기술이 아니다 — 이름은 그대로인데도', () => {
    const stripped = {
      ...combat,
      interactions: combat.interactions.map((i) =>
        i.id === 'attack' ? { ...i, profile: undefined } : i,
      ),
    } as GameViewSnapshot;
    expect(skillInteractionIds(stripped).has('attack')).toBe(false);
    expect(skillInteractionIds(stripped).has('skill-heavy')).toBe(true);
  });

  it('조립 루트가 표식을 달 대상은 이 집합 하나로 정해진다', () => {
    expect([...skillInteractionIds(damageType)]).toEqual([
      'attack',
      'skill-heavy',
      'skill-aura',
    ]);
  });
});

// ── VUX-SK-V-02 — 키와 손가락이 같은 요청으로 수렴한다 ─────────────
describe('VUX-SK-V-02 — 같은 의미, 두 입력', () => {
  const plan = resolvePresentation(damageType);

  it('기술마다 실제 키가 장면에 실린다 — 그 키가 두 입력이 만나는 자리다', () => {
    for (const skill of skillObservations(damageType)) {
      const scene = plan.interactions.find((i) => i.id === skill.id);
      expect(scene?.key).toBeDefined();
    }
  });

  it('손가락 버튼이 서는 조건을 기술이 모두 만족한다', () => {
    // 손가락 버튼 띠는 `key && prompt && !terrainTarget` 인 것을 편다
    // (engine/view-kernel/hud/touch-pad.ts). 그 조건을 기술이 만족해야
    // 두 입력 수단이 **같은 목록**을 본다 (INTENT-SKILL-INPUT-CONVERGES-001).
    for (const skill of skillObservations(damageType)) {
      const scene = plan.interactions.find((i) => i.id === skill.id);
      expect(Boolean(scene?.key && scene?.prompt && !scene?.terrainTarget)).toBe(true);
    }
  });

  it('같은 키 코드는 어느 쪽에서 왔든 같은 기술 하나로 풀린다', () => {
    // 조립 루트는 code 로 interaction 을 고르고 그 id 를 요청에 싣는다.
    // 손가락 버튼은 그 code 를 그대로 흉내 내므로 갈라질 길이 없다.
    for (const skill of skillObservations(damageType)) {
      const code = plan.interactions.find((i) => i.id === skill.id)?.key;
      const keyed = plan.interactions.filter((i) => i.key === code);
      const chosen = keyed.find((i) => i.available) ?? keyed[0];
      expect(chosen?.id).toBe(skill.id);
    }
  });
});

// ── VUX-SK-V-05 — 대답 전에 앞질러 만들지 않는다 ────────────────────
describe('VUX-SK-V-05 — 세계가 말하기 전에는 아무것도', () => {
  it('걸어 둔 것이 기력도 행동도 타격도 바꾸지 않는다', () => {
    const before = resolvePresentation(combat);
    const after = resolvePresentation(combat, undefined, {
      skillAnswers: { attack: { state: 'pending' }, 'skill-heavy': { state: 'pending' } },
    });
    expect(after.self?.energy).toBe(before.self?.energy);
    expect(after.entities).toEqual(before.entities);
    expect(after.strikes).toEqual(before.strikes);
    expect(after.effects).toEqual(before.effects);
  });

  it('받아들여진 뒤에도 값은 세계의 관찰 결과에서만 온다', () => {
    const before = resolvePresentation(combat);
    const after = resolvePresentation(combat, undefined, {
      skillAnswers: { attack: { state: 'accepted' } },
    });
    expect(after.self?.energy).toBe(before.self?.energy);
    expect(after.entities).toEqual(before.entities);
  });

  it('세계에 없는 자리를 만들지 않는다 — 재사용 대기도 토글도 연계도', () => {
    const text =
      panel(combat) +
      bar(combat)
        .map((c) => `${c.key ?? ''}${c.title}${c.detail ?? ''}${c.status ?? ''}`)
        .join('');
    for (const absent of ['재사용', '쿨', 'ON', 'OFF', '단계']) {
      expect(text).not.toContain(absent);
    }
  });
});

// ── 띠가 다른 자리를 밀어내지 않는다 (회귀) ─────────────────────────
describe('기존 자리와 나란히 선다', () => {
  it('바닥 프롬프트용 interaction 목록은 그대로다 — 기술 칸이 그것을 대신하지 않는다', () => {
    const plan = resolvePresentation(combat);
    expect(plan.interactions.find((i) => i.id === 'attack')).toMatchObject({
      key: 'KeyF',
      prompt: '기본 스킬',
    });
    expect(plan.interactions.find((i) => i.id === 'skill-heavy')?.unavailableText).toBe(
      '기력이 모자란다',
    );
  });

  it('기술 블록이 통째로 패널에 실린다 — 앞의 줄들을 밀어내지 않는다', () => {
    const lines = resolvePresentation(combat).self?.lines ?? [];
    const block = skillDetailLines(combat, codeText);
    const at = lines.indexOf('기술');
    expect(at).toBeGreaterThan(0); // 능력치 줄들 뒤에 온다
    expect(lines.slice(at, at + block.length)).toEqual(block);
  });

  it('요청 대답을 주지 않아도 그려진다 — 아무것도 걸지 않은 화면이 기본이다', () => {
    expect(() => resolvePresentation(combat)).not.toThrow();
    expect(bar(combat)).toHaveLength(2);
  });
});
