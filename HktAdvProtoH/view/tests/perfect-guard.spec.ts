// C011 완벽한 막기 View 단독 테스트 — World 를 띄우지 않는다.
// 입력은 GameView Fixture 뿐이며, 검증 대상은 04-gameview.spec.yaml 의 계약이
// 화면 지시(Render Plan)로 옮겨졌는가다.
//
// 04 delta — entities.character.stance.startedAt/perfectWindow ·
//            entities.character.exposure · strikeEvents.timing ·
//            hud.self.guard.perfectWindow/rearmAt · hud.self.exposure ·
//            interactions.guard(+guard-rearming) · entityHud.shows.exposed

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../presentation/resolve';
import perfectFixture from './fixtures/perfect-guard.fixture.json';
import rearmingFixture from './fixtures/guard-rearming.fixture.json';

const perfect = perfectFixture as unknown as GameViewSnapshot;
const rearming = rearmingFixture as unknown as GameViewSnapshot;

const plan = (s: GameViewSnapshot) => resolvePresentation(s);
const entity = (s: GameViewSnapshot, id: string) => plan(s).entities.find((e) => e.id === id);
const strike = (s: GameViewSnapshot, targetId: string) =>
  plan(s).strikes.find((k) => k.id.includes(`->${targetId}@`));
const interaction = (s: GameViewSnapshot, id: string) =>
  plan(s).interactions.find((i) => i.id === id);

describe('entities.character.stance (C011) — 방금 세운 자세는 다르게 읽힌다', () => {
  it('창 안의 자세는 그냥 막고 있는 것과 구분된다', () => {
    const plate = entity(perfect, 'player-1')?.nameplate;
    expect(plate?.guarding).toBe(true);
    expect(plate?.perfectWindow).toBe(true);
  });

  it('창이 없는 몸은 창 표지도 없다', () => {
    expect(entity(perfect, 'npc-1')?.nameplate?.perfectWindow).toBe(false);
    expect(entity(rearming, 'player-1')?.nameplate?.perfectWindow).toBe(false);
  });
});

describe('entityHud.shows.exposed (C011) — 열린 몸은 지금이 때릴 때다', () => {
  it('완벽하게 막힌 자가 열린 것이 그 몸 위에서 읽힌다', () => {
    expect(entity(perfect, 'npc-1')?.nameplate?.exposed).toBe(true);
  });

  it('막아 낸 자는 열리지 않는다 — 지불하는 쪽은 막힌 자다', () => {
    expect(entity(perfect, 'player-1')?.nameplate?.exposed).toBe(false);
  });

  it('쓰러진 몸에는 열림이 남지 않는다', () => {
    const plate = entity(perfect, 'npc-2')?.nameplate;
    expect(plate?.downed).toBe(true);
    expect(plate?.exposed).toBe(false);
  });

  it('열림은 켜야 보이는 것이 아니라 이름·생명과 같은 자리에 늘 있다', () => {
    expect(entity(perfect, 'npc-1')?.inspect).toBeUndefined();
    expect(entity(perfect, 'npc-1')?.nameplate?.exposed).toBe(true);
  });
});

describe('strikeEvents.timing (C011) — 왜 안 아팠는지가 읽힌다', () => {
  it('완벽하게 막아 낸 타격은 잃은 것 없이 번 것이 보인다', () => {
    const mark = strike(perfect, 'player-1');
    expect(mark?.perfect).toBe(true);
    expect(mark?.guarded).toBe(true);
    expect(mark?.text).toBe('-0');
    expect(mark?.detail).toContain('완벽하게 막음');
    expect(mark?.detail).toContain('0.15초'); // 창의 크기를 스스로 알아낼 수 있는 자리
    expect(mark?.detail).toContain('기력 +10');
    expect(mark?.detail).not.toContain('기력 -');
  });

  it('되받아친 타격은 무엇이 그것을 키웠는지가 함께 보인다', () => {
    const mark = strike(perfect, 'npc-1');
    expect(mark?.counter).toBe(true);
    expect(mark?.text).toBe('-22');
    expect(mark?.detail).toContain('되받음 +5');
    expect(mark?.detail).toContain('25 → 22');
  });

  it('되받아친 타격은 크게 그려진다 — 큰 숫자가 우연이 아님을 먼저 알린다', () => {
    expect(strike(perfect, 'npc-1')?.emphasis).toBe(true);
    expect(strike(perfect, 'player-1')?.emphasis).toBe(false);
  });

  it('창이 닫힌 뒤의 막기는 C010 그대로 읽힌다 — 같은 스킬, 다른 결과', () => {
    const late = strike(perfect, 'npc-2');
    expect(late?.perfect).toBe(false);
    expect(late?.guarded).toBe(true);
    expect(late?.detail).toContain('막음');
    expect(late?.detail).toContain('0.94초');
    expect(late?.detail).toContain('기력 -10.2');

    // 완벽한 막기와 나란히 두면 무엇이 갈렸는지가 시간으로 설명된다
    const early = strike(perfect, 'player-1');
    expect(early?.detail).not.toBe(late?.detail);
    expect(early?.text).not.toBe(late?.text);
  });
});

describe('hud.self.guard (C011) — 내 창과 재세움이 늘 눈앞에 있다', () => {
  it('창이 열려 있으면 그것이 자기 정보에 실린다', () => {
    const self = plan(perfect).self;
    expect(self?.guarding).toBe(true);
    expect(self?.perfectWindow).toBe(true);
    expect(self?.exposed).toBe(false);
    // 지금 세울 수 있으므로 남은 시간을 만들지 않는다
    expect(self?.guardRearmIn).toBeUndefined();
  });

  it('다시 세울 수 없으면 사유와 남은 시간이 함께 읽힌다', () => {
    const self = plan(rearming).self;
    expect(self?.guarding).toBe(false);
    expect(self?.perfectWindow).toBe(false);
    expect(self?.guardUnavailableText).toBe(
      '방금 자세를 세웠다 — 다시 세우려면 한 호흡이 필요하다',
    );
    expect(self?.guardRearmIn).toBeCloseTo(0.35, 5);
  });

  it('나도 열릴 수 있다 — 그 사실이 자기 정보에 실린다', () => {
    expect(plan(rearming).self?.exposed).toBe(true);
  });

  it('막기 상호작용의 불가 사유가 문구로 옮겨진다', () => {
    expect(interaction(perfect, 'guard')?.available).toBe(true);
    const blocked = interaction(rearming, 'guard');
    expect(blocked?.available).toBe(false);
    expect(blocked?.unavailableText).toContain('한 호흡');
  });
});

describe('View 는 세계가 준 것만 쓴다', () => {
  it('창의 크기도 열림의 길이도 View 가 정하지 않는다 — 세계가 준 값의 차이로만 만든다', () => {
    // rearmIn 은 self.guardRearmAt 과 world.time 의 차다. 자기 시계를 만들지 않는다.
    const value = (id: string) => rearming.hud.find((h) => h.id === id)?.value as number;
    expect(plan(rearming).self?.guardRearmIn).toBeCloseTo(
      value('self.guardRearmAt') - value('world.time'),
      5,
    );
  });

  it('옛 계약(시점 내역이 없는 관찰 결과)도 그려진다 — 표현 누락이 게임을 멈추지 않는다', () => {
    const legacy = JSON.parse(JSON.stringify(perfect)) as GameViewSnapshot;
    for (const s of legacy.strikes) delete (s as { timing?: unknown }).timing;
    for (const e of legacy.entities) delete (e as { exposure?: unknown }).exposure;

    const mark = plan(legacy).strikes[0];
    expect(mark).toBeDefined();
    expect(mark?.perfect).toBe(false);
    expect(mark?.counter).toBe(false);
    expect(entity(legacy, 'npc-1')?.nameplate?.exposed).toBe(false);
  });
});
