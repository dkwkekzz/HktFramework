// C016 Insight — View 단독 테스트 (World 미기동, Fixture 만으로 돈다)
//
// 계약 출처: cycles/C016-insight-sees-before-looking/04-gameview.spec.yaml
//   entities.character.attributes.insight (가려지지 않는다)
//   entities.character.attributes.concealed (부분 목록이 될 수 있다)
//   SEAT NOTE — 세 자리가 독립적으로 온다 · EMPTY-SLOT NOTE — 가려진 자리는 이름으로 남는다
//   hud.self.insight
//
// fixture 는 관찰자의 통찰이 60 인 순간이다.
//   npc-1  살펴본 존재       → 세 자리가 다 열려 있다
//   npc-2  살펴본 적 없음    → 통찰이 형태와 관계를 열었고 수치만 가려져 있다
//
// 이 파일이 지키는 것은 하나다 — **일부만 아는 화면이 그려지고, 없는 값이 발명되지 않는다.**

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import fixture from './fixtures/insight.fixture.json';

const snapshot = fixture as unknown as GameViewSnapshot;
const plan = (inspect = false) => resolvePresentation(snapshot, undefined, { inspect });
const entity = (id: string, inspect = false) => plan(inspect).entities.find((e) => e.id === id);
const inspectText = (id: string) => entity(id, true)?.inspect?.join('\n') ?? '';

/** 자리 하나를 지운 판 — 세계가 그 자리를 안 보냈을 때 화면이 어떻게 되는지 본다 */
const without = (entityId: string, keys: string[], concealed: string[]) => {
  const copy = JSON.parse(JSON.stringify(snapshot)) as GameViewSnapshot;
  const target = copy.entities.find((e) => e.id === entityId)!;
  const attributes = target.attributes as unknown as Record<string, unknown>;
  for (const key of keys) delete attributes[key];
  attributes.concealed = concealed;
  attributes.acquainted = concealed.length === 0;
  return resolvePresentation(copy, undefined, { inspect: true }).entities.find(
    (e) => e.id === entityId,
  );
};

describe('attributes.insight — 통찰은 화면에서 읽힌다', () => {
  it('내 통찰이 내 자리에 있다', () => {
    expect(plan().self?.lines).toContain('통찰 60');
  });

  it('존재의 통찰이 그 몸의 관찰에 실린다 — 가려지지 않는다', () => {
    // npc-2 는 수치가 가려진 존재인데도 통찰 줄은 나온다
    expect(inspectText('npc-2')).toContain('통찰 0');
    expect(inspectText('npc-1')).toContain('통찰 0');
  });
});

describe('SEAT NOTE — 세 자리가 따로 온다', () => {
  it('수치만 가려진 존재에서 열린 자리와 가려진 자리가 함께 보인다', () => {
    const text = inspectText('npc-2');

    // 열린 것 — 형태와 관계
    expect(text).toContain('약점 물리에 약하다');
    expect(text).toContain('나에게 읽히는 오라 방어 56.25');
    // 가려진 것 — 이름으로 남는다
    expect(text).toContain('겨루는 힘 — 아직 살펴보지 않았다');
    // 오지 않은 수치를 만들어내지 않는다
    expect(text).not.toContain('오라 공격');
    expect(text).not.toContain('치명타');
  });

  it('전부 아는 존재는 C015 까지의 화면 그대로다', () => {
    const text = inspectText('npc-1');

    expect(text).toContain('오라 공격 15 · 오라 방어 90 (받는 피해 53%) → 나에게 56.25 (64%)');
    expect(text).toContain('관통 물리 0 · 오라 0');
    expect(text).toContain('약점 물리에 약하다');
    expect(text).toContain('치명타 터뜨리지 못함');
    // 가려진 것이 없으므로 가려짐 줄이 없다
    expect(text).not.toContain('아직 살펴보지 않았다');
  });

  it('형태만 열린 존재도 그려진다 — 조합을 코드가 세지 않는다', () => {
    const shallow = without('npc-2', ['versusObserver'], ['combatStats', 'versusObserver']);
    const text = shallow?.inspect?.join('\n') ?? '';

    expect(text).toContain('약점 물리에 약하다');
    expect(text).toContain('겨루는 힘 · 나에게 읽히는 방어 — 아직 살펴보지 않았다');
    expect(text).not.toContain('나에게 읽히는 오라 방어');
  });

  it('세 자리가 다 가려진 존재는 C014 의 화면과 같다', () => {
    const blind = without(
      'npc-2',
      ['versusObserver', 'defenseShape'],
      ['combatStats', 'versusObserver', 'defenseShape'],
    );
    const text = blind?.inspect?.join('\n') ?? '';

    expect(text).toContain('겨루는 힘 · 나에게 읽히는 방어 · 약점 — 아직 살펴보지 않았다');
    expect(text).not.toContain('약점 물리에 약하다');
  });

  it('수치만 온 자리도 그려진다 — 관계값 없이 방어 줄이 나온다', () => {
    const noVersus = without('npc-1', ['versusObserver'], ['versusObserver']);
    const text = noVersus?.inspect?.join('\n') ?? '';

    expect(text).toContain('오라 공격 15 · 오라 방어 90 (받는 피해 53%)');
    // 걷힌 값을 View 가 만들어내지 않는다 (C013 의 금지 그대로) —
    // 화살표가 없는 것이 "그 값이 오지 않았다" 다
    expect(text).not.toContain('→ 나에게');
    expect(text).toContain('나에게 읽히는 방어 — 아직 살펴보지 않았다');
  });
});

describe('가려진 자리의 이름은 세계의 것이다', () => {
  it('View 는 목록을 만들지 않는다 — 세계가 보낸 이름만 옮긴다', () => {
    const renamed = JSON.parse(JSON.stringify(snapshot)) as GameViewSnapshot;
    const target = renamed.entities.find((e) => e.id === 'npc-2')!;
    // 세계가 아직 없는 이름을 보내와도 화면이 그것을 그대로 나른다
    target.attributes!.concealed = ['somethingNew'];

    const text =
      resolvePresentation(renamed, undefined, { inspect: true })
        .entities.find((e) => e.id === 'npc-2')
        ?.inspect?.join('\n') ?? '';

    expect(text).toContain('somethingNew — 아직 살펴보지 않았다');
  });
});

describe('몸 위 표시 — 일부만 아는 존재도 물음표가 남는다', () => {
  it('아직 가려진 것이 있으면 이름 뒤에 물음표가 붙는다', () => {
    expect(entity('npc-2')?.nameplate?.name).toBe('Wanderer 2 ?');
  });

  it('전부 아는 존재와 내 몸은 이름 그대로다', () => {
    expect(entity('npc-1')?.nameplate?.name).toBe('Wanderer 1');
    expect(entity('player-1')?.nameplate?.name).toBe('Player 1');
  });
});

describe('interactions.observe — 아직 열 자리가 남으면 살펴볼 수 있다', () => {
  it('일부만 열린 존재에는 살펴봄이 가용하다', () => {
    const observe = plan().interactions.find(
      (i) => i.id === 'observe' && i.targetEntityId === 'npc-2',
    );

    expect(observe?.available).toBe(true);
  });

  it('더 열 자리가 없는 존재에는 사유가 이미 알고 있다로 나온다', () => {
    const observe = plan().interactions.find(
      (i) => i.id === 'observe' && i.targetEntityId === 'npc-1',
    );

    expect(observe?.available).toBe(false);
    expect(observe?.unavailableText).toBe('이미 알고 있다');
  });
});
