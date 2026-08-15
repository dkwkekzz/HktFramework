// C010 막기 View 단독 테스트 — World 를 띄우지 않는다.
// 입력은 GameView Fixture 뿐이며, 검증 대상은 04-gameview.spec.yaml 의 계약이
// 화면 지시(Render Plan)로 옮겨졌는가다.
//
// 04 delta — entities.character.stance · interactions.guard · hud.self.guard ·
//            strikeEvents.breakdown · entityHud.shows(guarding/guardBroken)

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../presentation/resolve';
import guardFixture from './fixtures/guard.fixture.json';
import brokenFixture from './fixtures/guard-broken.fixture.json';

const guarding = guardFixture as unknown as GameViewSnapshot;
const broken = brokenFixture as unknown as GameViewSnapshot;

const plan = (s: GameViewSnapshot) => resolvePresentation(s);
const entity = (s: GameViewSnapshot, id: string) => plan(s).entities.find((e) => e.id === id);
const strike = (s: GameViewSnapshot, targetId: string) =>
  plan(s).strikes.find((k) => k.id.includes(`->${targetId}@`));
const interaction = (s: GameViewSnapshot, id: string) =>
  plan(s).interactions.find((i) => i.id === id);

describe('entityHud (C010) — 막고 있는지가 몸 위에서 읽힌다', () => {
  it('막고 있는 존재는 표지에 그것이 실린다', () => {
    expect(entity(guarding, 'player-1')?.nameplate?.guarding).toBe(true);
    expect(entity(guarding, 'player-1')?.nameplate?.guardBroken).toBe(false);
  });

  it('무너진 여파 안의 존재는 그냥 안 막는 존재와 구분된다', () => {
    const plate = entity(guarding, 'npc-1')?.nameplate;
    expect(plate?.guarding).toBe(false);
    expect(plate?.guardBroken).toBe(true);
  });

  it('막는 것은 이름·생명과 같은 자리에 늘 실린다 — 켜야 보이는 것이 아니다', () => {
    // inspect 를 켜지 않은 기본 화면에서도 표지에 들어 있다
    expect(entity(guarding, 'player-1')?.inspect).toBeUndefined();
    expect(entity(guarding, 'player-1')?.nameplate?.guarding).toBe(true);
  });
});

describe('strikeEvents.breakdown (C010) — 숫자가 아니라 경로를 읽는다', () => {
  it('막아 낸 타격은 무엇을 치렀는지가 함께 보인다', () => {
    const mark = strike(guarding, 'player-1');
    expect(mark?.guarded).toBe(true);
    expect(mark?.guardBroken).toBe(false);
    // 막으면 한 자리 수 아래로 떨어진다 — 0 으로 반올림하면 "안 아프다" 로 잘못 읽힌다
    expect(mark?.text).toBe('-2.3');
    expect(mark?.detail).toContain('20 → 15');
    expect(mark?.detail).toContain('막음');
    expect(mark?.detail).toContain('기력 -10.2');
  });

  it('방어를 무너뜨린 타격은 그 사실이 드러난다', () => {
    const marks = plan(guarding).strikes.filter((m) => m.guardBroken);
    expect(marks).toHaveLength(1);
    expect(marks[0]?.text).toBe('-50');
    expect(marks[0]?.detail).toContain('방어 무너짐');
    expect(marks[0]?.guarded).toBe(false); // 무너진 타격은 막아 낸 것이 아니다
  });

  it('막지 않은 타격도 방어력이 걷어낸 몫이 보인다', () => {
    const mark = strike(guarding, 'npc-1');
    expect(mark?.guarded).toBe(false);
    expect(mark?.text).toBe('-17');
    expect(mark?.detail).toBe('20 → 17');
  });

  it('같은 스킬이라도 막았는지에 따라 다르게 읽힌다', () => {
    const blocked = strike(guarding, 'player-1');
    const unblocked = strike(guarding, 'npc-1');
    expect(blocked?.text).not.toBe(unblocked?.text);
    expect(blocked?.guarded).not.toBe(unblocked?.guarded);
  });
});

describe('hud.self.guard (C010) — 막을 수 있는지가 늘 눈앞에 있다', () => {
  it('지금 자세가 문구와 코드로 함께 실린다', () => {
    const self = plan(guarding).self;
    expect(self?.stance).toBe('막기');
    expect(self?.stanceCode).toBe('guard');
    expect(self?.guarding).toBe(true);
    expect(self?.guardBroken).toBe(false);
  });

  it('방어력이 자기 줄에 실린다', () => {
    expect(plan(guarding).self?.defense).toBe(5);
    expect(plan(guarding).self?.lines).toContain('방어력 5');
  });

  it('막을 수 없으면 그 사유가 같은 자리에서 읽힌다', () => {
    const self = plan(broken).self;
    expect(self?.guardBroken).toBe(true);
    expect(self?.guardUnavailableText).toBe('방어가 무너져 아직 다시 막을 수 없다');
  });

  it('막을 수 있으면 사유가 없다', () => {
    expect(plan(guarding).self?.guardUnavailableText).toBeUndefined();
  });
});

describe('interactions.guard (C010) — 막기는 키로 고르는 선택이다', () => {
  it('막기에 키와 프롬프트가 붙는다', () => {
    const guard = interaction(guarding, 'guard');
    expect(guard?.key).toBe('KeyQ');
    expect(guard?.keyLabel).toBe('Q');
    expect(guard?.prompt).toBe('막기');
  });

  it('막는 동안 스킬이 왜 안 되는지가 문구로 나온다', () => {
    expect(interaction(guarding, 'attack')?.available).toBe(false);
    expect(interaction(guarding, 'attack')?.unavailableText).toBe('막는 중에는 할 수 없다');
    expect(interaction(guarding, 'skill-heavy')?.unavailableText).toBe('막는 중에는 할 수 없다');
  });

  it('무너진 여파 안에서는 막기가 불가로 표시된다', () => {
    const guard = interaction(broken, 'guard');
    expect(guard?.available).toBe(false);
    expect(guard?.unavailableText).toBe('방어가 무너져 아직 다시 막을 수 없다');
  });

  it('걸음은 막는 자세에 막히지 않는다 — 계약 그대로 가용하다', () => {
    expect(interaction(guarding, 'move')?.available).toBe(true);
  });
});

describe('속성 관찰 (C010) — 켜면 방어력과 자세가 함께 펼쳐진다', () => {
  it('inspect 를 켜면 그 존재의 방어력과 자세가 줄로 나온다', () => {
    const scene = resolvePresentation(guarding, undefined, { inspect: true });
    const lines = scene.entities.find((e) => e.id === 'player-1')?.inspect ?? [];
    expect(lines).toContain('방어 5');
    expect(lines).toContain('자세 막기');
  });

  it('무너진 여파는 자세 줄에 함께 드러난다', () => {
    const scene = resolvePresentation(guarding, undefined, { inspect: true });
    const lines = scene.entities.find((e) => e.id === 'npc-1')?.inspect ?? [];
    expect(lines).toContain('자세 평상 (무너짐)');
  });
});

describe('계약 정합 — View 는 Spec 만으로 동작한다', () => {
  it('이 화면은 C010 계약을 소비한다', () => {
    expect(plan(guarding).specId).toBe('VIEW-GUARD-TRADES-BODY-FOR-RESOURCE-001');
  });

  it('자세를 싣지 않는 대상(광맥)에는 표지 자체가 없다 — 터지지 않는다', () => {
    expect(entity(guarding, 'deposit-1')?.nameplate).toBeUndefined();
  });
});
