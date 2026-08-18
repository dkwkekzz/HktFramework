// C011 막기 표현 결정 Layer 단독 테스트 — World 미기동, Fixture 만으로
// entities.attributes.guard · interactions.guardBegin/Release ·
// strikeEvents.breakdown.guard · hud.self.guard 의 표현 결정을 검증한다.
//
// guard.fixture.json        관찰자가 막고 있고, 막힌 타격과 무너진 타격이 함께 떠 있다
// guard-broken.fixture.json 방어가 무너져 아직 다시 들지 못하는 순간

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import brokenFixture from './fixtures/guard-broken.fixture.json';
import guardFixture from './fixtures/guard.fixture.json';

const guarding = guardFixture as GameViewSnapshot;
const broken = brokenFixture as GameViewSnapshot;

const plan = (snapshot: GameViewSnapshot, inspect = false) =>
  resolvePresentation(snapshot, undefined, { inspect });
const strikeAt = (since: number, inspect = false) =>
  plan(guarding, inspect).strikes.find((s) => s.id.endsWith(`@${since}`));
const interaction = (snapshot: GameViewSnapshot, id: string) =>
  plan(snapshot).interactions.find((i) => i.id === id);

describe('hud.self.guard — 내가 들고 있다는 것이 늘 보인다', () => {
  it('막고 있으면 그 사실이 자기 표시에 뜬다', () => {
    expect(plan(guarding).self?.guard).toEqual({
      guarding: true,
      broken: false,
      text: '막는 중',
    });
  });

  it('무너진 동안에는 막는 중과 다른 문구가 뜬다', () => {
    expect(plan(broken).self?.guard).toEqual({
      guarding: false,
      broken: true,
      text: '무너짐',
    });
  });

  it('아무것도 아닐 때는 쓸 말이 없다 — 빈 자리를 만들지 않는다', () => {
    const idle = {
      ...guarding,
      hud: guarding.hud.map((h) =>
        h.id === 'self.guard.guarding' ? { ...h, value: false } : h,
      ),
    } as GameViewSnapshot;
    expect(plan(idle).self?.guard.text).toBeUndefined();
  });
});

describe('interactions — 막기를 걸 수 있다는 것을 세계가 알려 준다', () => {
  it('막기에 키가 배정되고 안내 문구가 붙는다', () => {
    const begin = interaction(guarding, 'guard-begin');
    expect(begin?.keyLabel).toBe('Q');
    expect(begin?.prompt).toBe('막기');
    expect(begin?.available).toBe(true);
  });

  it('놓기에는 키를 두지 않는다 — 한 키가 두 요청을 부르면 어느 쪽인지 알 수 없다', () => {
    expect(interaction(guarding, 'guard-release')?.key).toBeUndefined();
  });

  it('무너져 있으면 걸 수 없다는 것과 그 사유가 함께 온다', () => {
    const begin = interaction(broken, 'guard-begin');
    expect(begin?.available).toBe(false);
    // 세계는 코드를 보내고 문구는 결정 Layer 가 정한다
    expect(begin?.unavailableText).toBe('방어가 무너져 아직 다시 들 수 없다');
  });

  it('막는 동안 스킬이 왜 안 나가는지가 사유로 드러난다', () => {
    expect(interaction(guarding, 'attack')?.unavailableText).toBe('막는 중에는 휘두를 수 없다');
    expect(interaction(guarding, 'skill-heavy')?.unavailableText).toBe(
      '막는 중에는 휘두를 수 없다',
    );
  });
});

describe('strikeEvents.breakdown.guard — 맞바꿨다는 것이 그 자리에서 읽힌다', () => {
  it('막힌 타격은 관찰을 켜지 않아도 무엇을 치렀는지 함께 보인다', () => {
    const s = strikeAt(11.6);
    expect(s?.text).toBe('-9'); // 실제로 들어간 값
    expect(s?.detail).toBe('막음 17→9 · 기력 -11');
    expect(s?.guard).toBe('blocked');
  });

  it('막지 않았다면 얼마였는지가 함께 읽힌다 — 줄어든 값만으로는 알 수 없다', () => {
    expect(strikeAt(11.6)?.detail).toContain('17→9');
  });

  it('무너진 타격은 막힌 타격과 다르게 표시된다', () => {
    const s = strikeAt(12.4);
    expect(s?.text).toBe('-17'); // 줄지 않았다
    expect(s?.detail).toBe('방어 무너짐');
    expect(s?.guard).toBe('broken');
  });

  it('막지 않은 타격의 표시는 C010 과 완전히 같다', () => {
    const s = strikeAt(12.1); // player-1 이 npc-1 을 친 것 — 막기와 무관하다
    expect(s?.text).toBe('-55');
    expect(s?.detail).toBeUndefined();
    expect(s?.guard).toBeUndefined();
  });

  it('관찰을 켜면 막기 줄 뒤에 계산 경위가 함께 붙는다', () => {
    // C012 — 막기 줄은 그대로이고 그 뒤 경위에만 방식이 붙는다.
    // 막기 표시가 방식과 무관하다는 것이 여기서 드러난다
    expect(strikeAt(11.6, true)?.detail).toBe(
      '막음 17→9 · 기력 -11 · 물리 · 6+20=26 (물리 공격 40) ×67%(물리 방어 50 · 관통 0 → 50) = 17',
    );
  });
});

describe('entities.attributes.guard — 남이 막고 있는지도 펼쳐 보면 나온다', () => {
  it('속성 관찰을 켜면 막기 상태가 줄로 나온다', () => {
    const me = plan(guarding, true).entities.find((e) => e.id === 'player-1');
    expect(me?.inspect?.join('\n')).toContain('막기 막는 중');
  });

  it('막지 않는 존재도 그 사실이 나온다 — 안 알려주는 것과 다르다', () => {
    const npc = plan(guarding, true).entities.find((e) => e.id === 'npc-1');
    expect(npc?.inspect?.join('\n')).toContain('막기 없음');
  });

  it('막기는 행동 표시로 대신할 수 없다 — 상태와 별개다', () => {
    const me = plan(guarding, true).entities.find((e) => e.id === 'player-1');
    // fixture 의 player-1 은 행동이 무엇이든 막고 있다.
    // 몸의 상태(state)를 읽어서는 막고 있는지 알 수 없다는 것이 요점이다.
    expect(me?.inspect?.some((line) => line.startsWith('막기 '))).toBe(true);
  });
});
