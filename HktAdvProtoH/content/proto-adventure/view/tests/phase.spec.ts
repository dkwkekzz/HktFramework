// C019 View 단독 테스트 — World 미기동, Fixture 만으로.
// 04-gameview.spec.yaml 의 VIEW NOTE 셋을 검증한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import fixture from './fixtures/phase.fixture.json';

const snapshot = fixture as GameViewSnapshot;
const plan = (opts = {}) => resolvePresentation(snapshot, undefined, opts);
const entity = (id: string, opts = {}) => plan(opts).entities.find((e) => e.id === id);

describe('VIEW NOTE 1 — 구간이 한눈에 갈린다', () => {
  it('선딜 중인 존재의 몸 위에는 표시가 붙는다', () => {
    expect(entity('player-1')?.nameplate?.name).toContain('준비!');
  });

  it('이미 나간 존재에는 붙지 않는다 — 표시가 없다는 것이 곧 늦었다는 뜻이다', () => {
    expect(entity('npc-1')?.nameplate?.name).not.toContain('준비!');
  });

  it('기술이 아닌 행동에는 붙지 않는다', () => {
    expect(entity('npc-2')?.nameplate?.name).not.toContain('준비!');
  });

  it('관계 표시와 나란히 선다 — 어떤 사이인지가 먼저, 그다음이 지금의 틈이다', () => {
    // npc-1 은 적대이므로 관계 표시가 있고, 이미 나갔으므로 선딜 표시는 없다
    expect(entity('npc-1')?.nameplate?.name).toContain('[적대]');
  });
});

describe('VIEW NOTE 2 — 캔슬이 일어난 자리에서 보인다', () => {
  const marks = () => plan().strikes;

  it('끊긴 자리에 무엇이 끊겼는지가 뜬다', () => {
    const cancel = marks().find((m) => m.text.includes('끊김'));
    expect(cancel).toBeDefined();
    expect(cancel?.text).toContain('강공격'); // 큰 것을 끊었다는 사실이 읽혀야 한다
    expect(cancel?.position).toEqual({ x: 0, z: 0 });
  });

  it('타격 숫자와 같은 자리를 쓰되 섞이지 않는다', () => {
    const texts = marks().map((m) => m.text);
    expect(texts.some((t) => t.includes('끊김'))).toBe(true);
    expect(texts.some((t) => /\d/.test(t))).toBe(true); // 끊은 타격 자체의 숫자
    expect(marks().length).toBeGreaterThanOrEqual(2); // 둘은 같은 순간의 다른 두 사실이다
  });

  it('크게 그린다 — 일어나지 않게 만든 일이고 그것이 플레이어가 한 일이다', () => {
    expect(marks().find((m) => m.text.includes('끊김'))?.emphasis).toBe(true);
  });
});

describe('VIEW NOTE 3 — 세계가 보낸 값만 읽는다', () => {
  it('구간을 진행도로 다시 계산하지 않는다', () => {
    // player-1 의 progress 0.2 는 기본 기술이면 선딜이지만 큰 기술이면 경계가 다르다.
    // View 가 스스로 계산했다면 이 fixture 로는 맞출 수 없다 — 세계 값을 그대로 읽는다.
    const flipped = {
      ...snapshot,
      entities: snapshot.entities.map((e) =>
        e.id === 'player-1' ? { ...e, actionPhase: 'active' } : e,
      ),
    } as GameViewSnapshot;
    const name = resolvePresentation(flipped, undefined, {}).entities.find(
      (e) => e.id === 'player-1',
    )?.nameplate?.name;
    expect(name).not.toContain('준비!'); // progress 는 그대로인데 표시가 사라진다
  });

  it('선딜은 고르기 전에도 읽힌다 — profile 에 구간 경계가 온다', () => {
    const heavy = snapshot.interactions.find((i) => i.id === 'skill-heavy')?.profile;
    const basic = snapshot.interactions.find((i) => i.id === 'attack')?.profile;
    expect(heavy?.swingBegin).toBeGreaterThan(basic!.swingBegin);
  });
});
