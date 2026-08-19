// C015 Critical — View 단독 테스트 (World 미기동, Fixture 만으로 돈다)
//
// 계약 출처: cycles/C015-critical-amplifies-the-blow/04-gameview.spec.yaml
//   strikeEvents.breakdown.critical · combatStats.criticalChance / criticalDamage ·
//   hud.self.combat.critical* · VARIANCE NOTE
//
// critical.fixture.json — 관찰자가 가능성 0.5 로 **한 번 휘둘러 둘을 친** 순간이다.
//   npc-1 은 안 터졌고(20) npc-2 는 터졌다(40). 둘 다 살펴본 뒤라 combatStats 가 실려 있다.
//   같은 휘두름 · 같은 스킬 · 같은 종류의 상대인데 결과가 갈렸다 —
//   **화면이 그 둘을 구별하지 못하면 이 Cycle 은 플레이되지 않는다.**
//
// critical-guard.fixture.json — 자율 존재가 가능성 1 로 관찰자를 치고 관찰자가 막은 순간이다.
//   17 이 34 가 되어 들어왔고 막아서 17 이 남았으며 기력 21 을 치렀다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import fixture from './fixtures/critical.fixture.json';
import guardFixture from './fixtures/critical-guard.fixture.json';
import plainFixture from './fixtures/combat.fixture.json';

const snapshot = fixture as unknown as GameViewSnapshot;
const plan = (inspect = false) => resolvePresentation(snapshot, undefined, { inspect });
const strike = (targetId: string, inspect = false) =>
  plan(inspect).strikes.find((s) => s.id.includes(`->${targetId}@`));
const inspectLines = (entityId: string) =>
  plan(true).entities.find((e) => e.id === entityId)?.inspect;

const guardPlan = (inspect = false) =>
  resolvePresentation(guardFixture as unknown as GameViewSnapshot, undefined, { inspect });

// ─────────────────────────────────────────────────────────────────
describe('strikeEvents.breakdown.critical — 터진 한 방이 화면에서 구별된다', () => {
  it('터진 한 방과 안 터진 한 방의 숫자가 다르다', () => {
    expect(strike('npc-1')?.text).toBe('-20');
    expect(strike('npc-2')?.text).toBe('-40');
  });

  it('터졌다는 것이 관찰을 켜지 않아도 읽힌다', () => {
    // 이 줄이 없으면 화면에는 그냥 커진 숫자만 남고, 플레이어는 상대의 방어가
    // 얇았나 보다고 배운다 (04 VARIANCE NOTE ①)
    expect(strike('npc-2')?.detail).toBe('치명타 ×2 20→40');
  });

  it('커지기 전 값은 세계가 실어 보낸 값을 그대로 쓴다', () => {
    // finalDamage / multiplier 로 되돌리지 않는다 — 반올림 때문에 어긋난다 (04 ②).
    // fixture 의 damageBeforeCritical 을 지우면 이 줄이 만들어질 수 없다
    const before = snapshot.strikes.find((s) => s.targetId === 'npc-2')!.breakdown.critical
      .damageBeforeCritical;
    expect(strike('npc-2')?.detail).toContain(`${before}→`);
  });

  it('터진 한 방은 크게 그린다 — 고급 스킬과 같은 자리를 쓴다', () => {
    // 둘 다 기본 스킬이다. 강조가 갈리는 것은 오직 터졌는가 때문이다
    expect(strike('npc-1')?.emphasis).toBe(false);
    expect(strike('npc-2')?.emphasis).toBe(true);
  });

  it('안 터진 한 방은 평소에 아무 말도 붙이지 않는다', () => {
    // 매번 "안 터짐" 을 띄우면 정작 터진 순간이 묻힌다
    expect(strike('npc-1')?.detail).toBeUndefined();
  });

  it('관찰을 켜면 안 터진 한 방에도 그 사실과 가능성이 나온다', () => {
    expect(strike('npc-1', true)?.detail).toContain('치명타 없음 (50%)');
  });

  it('"터질 리 없는 몸" 과 "이번엔 운이 없었다" 가 화면에서 갈린다', () => {
    // 이 fixture 의 치는 이는 가능성 0.5 다 — 이번에 운이 없었던 것이다
    expect(strike('npc-1', true)?.detail).toContain('치명타 없음 (50%)');
    // 가능성 0 인 몸이 친 타격은 다른 말이 나온다 (combat.fixture 의 자율 존재)
    const plain = resolvePresentation(plainFixture as unknown as GameViewSnapshot, undefined, {
      inspect: true,
    });
    const fromNpc = plain.strikes.find((s) => s.id.startsWith('npc-1->'));
    expect(fromNpc?.detail).toContain('치명타 없음 (터질 리 없다)');
  });

  it('치명타 줄이 막기 줄보다 앞에 온다 — 숫자에 일어난 일의 순서 그대로다', () => {
    // 계산이 값을 내고 · 치명타가 키우고 · 막기가 덜어낸다
    const blocked = guardPlan().strikes.find((s) => s.id.includes('->player-1@'));
    expect(blocked?.detail).toBe('치명타 ×2 17→34 · 막음 34→17 · 기력 -21');
  });

  it('막아도 커진 값을 마주했다는 것이 읽힌다', () => {
    // 막기가 남기는 비율(0.5)도 대가의 기준도 그대로다 — 마주한 크기만 두 배다.
    // 터지지 않았다면 17→9 에 기력 11 이었을 자리다
    const blocked = guardPlan().strikes.find((s) => s.id.includes('->player-1@'));
    expect(blocked?.text).toBe('-17');
    expect(blocked?.guard).toBe('blocked');
    expect(blocked?.detail).toContain('막음 34→17');
    expect(blocked?.detail).toContain('기력 -21');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('entities.attributes.combatStats — 상대가 얼마나 터뜨리는 몸인가', () => {
  it('속성 관찰을 켜면 치명타 줄이 방어 읽기 뒤에 온다', () => {
    const lines = inspectLines('npc-2') ?? [];
    const at = lines.findIndex((line) => line.startsWith('치명타'));
    const weakAt = lines.findIndex((line) => line.startsWith('약점'));
    expect(at).toBeGreaterThan(weakAt);
  });

  it('터뜨리지 못하는 상대는 0% 가 아니라 그렇게 쓴다', () => {
    // 0% 라고만 쓰면 옆의 배율을 읽는 이가 기대값으로 삼는다
    expect(inspectLines('npc-2')).toContain('치명타 터뜨리지 못함');
  });

  it('터뜨리는 몸은 빈도와 크기를 함께 쓴다 — 둘은 따로 자란다', () => {
    expect(inspectLines('player-1')).toContain('치명타 50% · ×2');
  });

  it('살펴보지 않은 상대에게는 치명타 줄이 아예 오지 않는다', () => {
    // C014 의 관문 그대로다. 겨루는 힘의 자리에 "모름" 한 줄만 온다 —
    // 종류 이름으로 짐작하거나 타격 경위에서 끌어오지 않는다 (04 VARIANCE NOTE ⑤)
    const unseen = guardPlan(true).entities.find((e) => e.id === 'npc-1')?.inspect ?? [];
    expect(unseen.some((line) => line.startsWith('치명타'))).toBe(false);
    expect(unseen.join('\n')).toContain('겨루는 힘');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('hud.self — 내가 터뜨리는 몸인지는 늘 눈앞에 있다', () => {
  it('내 약점 뒤에 내 치명타가 온다', () => {
    const lines = plan().self?.lines ?? [];
    expect(lines[3]).toContain('내 약점');
    expect(lines[4]).toBe('치명타 50% · ×2');
  });

  it('살펴봄과 무관하다 — 자기 것은 언제나 실린다', () => {
    // 관찰을 켜지 않아도 나온다. 이것이 "성질을 올리면 달라지는 것이 보인다" 의 자리다
    expect(plan(false).self?.lines.join('\n')).toContain('치명타 50%');
  });

  it('터뜨리지 못하는 몸에는 그렇게 쓴다', () => {
    // combat.fixture 의 몸은 터뜨리는 성질을 지니지 않는다 —
    // 그 자리가 비지 않고 "터뜨리지 못함" 으로 그려져야 한다
    const plain = resolvePresentation(plainFixture as unknown as GameViewSnapshot, undefined, {});
    expect(plain.self?.lines).toContain('치명타 터뜨리지 못함');
  });
});
