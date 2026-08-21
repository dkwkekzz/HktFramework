// C014 Observe — View 단독 테스트 (World 미기동, Fixture 만으로 돈다)
//
// 계약 출처: cycles/C014-observe-reveals-the-opponent/04-gameview.spec.yaml
//   entities.character.attributes.acquainted / concealed / unacquaintedReason
//   entities.character.attributes.combatStats · versusObserver · defenseShape (알 때만)
//   interactions.observe (존재마다) · interactions.forgetAcquaintance
//   EMPTY-SLOT NOTE — 비어 있는 자리를 어떻게 다뤄야 하는가
//
// fixture 는 npc-1 은 살펴봤고 npc-2 는 살펴보지 않은 순간이다.
//   관찰자 rabbit-swordsman (player-1) · wanderer 둘 (npc-1 아는 존재 · npc-2 모르는 존재)
//
// 이 파일이 지키는 것은 하나다 — **모름이 화면에서 읽히고, 없는 값이 발명되지 않는다.**

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { commandEntries } from '../../../../engine/view-kernel/presentation/command-presentation';
import { codeText } from '../code-text';
import { commandActionRequest } from '../command-request';
import { interactionPresentation } from '../interaction-presentation';
import { resolvePresentation } from '../resolve';
import fixture from './fixtures/observe.fixture.json';

const snapshot = fixture as unknown as GameViewSnapshot;
const plan = (inspect = false) => resolvePresentation(snapshot, undefined, { inspect });
const entity = (id: string, inspect = false) => plan(inspect).entities.find((e) => e.id === id);
// C017 CHANGED — 존재마다 실리던 것은 **고르기**이고, 살펴봄은 고른 것에 대해 하나다.
const selectOf = (id: string) =>
  plan().interactions.find((i) => i.id === 'select-target' && i.targetEntityId === id);
const observeOne = () => plan().interactions.find((i) => i.id === 'observe');
const inspectText = (id: string) => entity(id, true)?.inspect?.join('\n') ?? '';

describe('몸 위 표시 — 켜지 않아도 모른다는 것이 읽힌다', () => {
  it('살펴보지 않은 존재는 이름 뒤에 물음표가 붙는다', () => {
    expect(entity('npc-2')?.nameplate?.name).toBe('Wanderer 2 ?');
  });

  it('살펴본 존재와 내 몸은 이름 그대로다', () => {
    expect(entity('npc-1')?.nameplate?.name).toBe('Wanderer 1');
    expect(entity('player-1')?.nameplate?.name).toBe('Player 1');
  });

  it('생명은 가려지지 않는다 — 모르는 존재도 몸에서 읽힌다', () => {
    expect(entity('npc-2')?.nameplate?.health).toBe(120);
    expect(entity('npc-2')?.nameplate?.healthMaximum).toBe(120);
  });
});

describe('속성 관찰 — 아는 존재와 모르는 존재가 다르게 펼쳐진다', () => {
  it('아는 존재는 C012·C013 그대로 겨루는 힘이 나온다', () => {
    const text = inspectText('npc-1');
    expect(text).toContain('물리 공격 40 · 물리 방어 30 (받는 피해 77%)');
    expect(text).toContain('오라 공격 15 · 오라 방어 90 (받는 피해 53%)');
    expect(text).toContain('→ 나에게 56.25 (64%)'); // 내 오라 관통 60 이 90 을 깎은 값
    expect(text).toContain('약점 물리에 약하다');
  });

  it('모르는 존재는 그 자리에 무엇을 모르는지가 온다', () => {
    const text = inspectText('npc-2');
    expect(text).toContain('겨루는 힘 · 나에게 읽히는 방어 · 약점 — 아직 살펴보지 않았다');
  });

  it('모르는 존재에 없는 값을 만들어 넣지 않는다', () => {
    const text = inspectText('npc-2');
    // 0 으로 채우거나 종류 이름으로 짐작하지 않는다 (04 EMPTY-SLOT NOTE ①②).
    // 가려진 항목의 **이름**은 나오지만 그 **값**은 한 개도 나오지 않는다
    expect(text).not.toContain('물리 공격');
    expect(text).not.toContain('오라 공격');
    expect(text).not.toContain('받는 피해');
    expect(text).not.toContain('관통 물리');
    expect(text).not.toMatch(/약점 (물리에|오라에|치우침)/);
    expect(text).not.toMatch(/나에게 \d/);
  });

  it('모르는 존재도 몸에서 읽히는 것은 그대로 펼쳐진다', () => {
    const text = inspectText('npc-2');
    expect(text).toContain('기력 20 / 60');
    expect(text).toContain('이동 걷기');
    expect(text).toContain('막기 없음');
  });

  it('가려진 항목의 이름은 세계가 보낸 목록을 옮긴 것이다', () => {
    // View 가 "가려질 수 있는 것은 이 셋" 을 자기 코드에 적지 않는다
    // (04 EMPTY-SLOT NOTE ④ · DC-WORLD-OWNS-THE-SURFACE-LIST).
    // 세계가 다른 이름을 보내면 문구도 따라 바뀐다.
    const stripped = JSON.parse(JSON.stringify(snapshot)) as GameViewSnapshot;
    const npc2 = stripped.entities.find((e) => e.id === 'npc-2');
    if (npc2?.attributes) npc2.attributes.concealed = ['defenseShape'];
    const lines =
      resolvePresentation(stripped, undefined, { inspect: true }).entities.find(
        (e) => e.id === 'npc-2',
      )?.inspect ?? [];

    expect(lines.join('\n')).toContain('약점 — 아직 살펴보지 않았다');
    expect(lines.join('\n')).not.toContain('겨루는 힘 ·');
  });
});

describe('interactions — 고르기가 존재마다, 살펴봄은 고른 것에 하나 (C017 CHANGED)', () => {
  it('고른 상대를 살펴볼 수 있다 — 이 fixture 는 npc-2 를 고른 화면이다', () => {
    expect(observeOne()).toMatchObject({ available: true, prompt: '살펴보기' });
  });

  it('고르기는 존재마다 실린다 — 광맥에도 실린다', () => {
    expect(selectOf('npc-1')).toMatchObject({ available: true, prompt: '지목' });
    expect(selectOf('npc-2')).toMatchObject({ available: true });
    expect(selectOf('deposit-1')).toMatchObject({ available: true });
  });

  it('자기 몸은 왜 못 고르는지도 말한다 — 그 뜻이 고르기로 옮겨왔다', () => {
    expect(selectOf('player-1')).toMatchObject({
      available: false,
      unavailableText: '자기 자신은 고를 수 없다',
    });
  });

  it('푸는 길이 늘 열려 있다', () => {
    expect(plan().interactions.find((i) => i.id === 'clear-target')).toMatchObject({
      available: true,
      key: 'Escape',
      prompt: '지목 해제',
    });
  });

  it('너무 먼 상대의 사유도 문구가 있다', () => {
    // 세계가 out-of-range 를 보내면 "더 다가가야 안다" 가 화면에 뜬다 —
    // 살펴봄의 대가가 거리라는 것을 배우는 유일한 자리다 (04 interactions.observe.meaning)
    expect(codeText('out-of-range')).toBe('너무 멀다 — 가까이 이동하자');
  });

  it('살펴봄에 키가 생겼다 — 대상을 고르는 수단이 세계에 있으므로 (C017 CHANGED)', () => {
    // C014 가 키를 두지 않은 이유("키에는 대상을 고를 수단이 없다")가 사라졌다.
    // 무엇을 살펴볼지는 여전히 세계가 지닌다 — View 가 선택 규칙을 발명하지 않는다.
    // C023 CHANGED — KeyT 는 엔진의 시점 조작(내려다보기)이라 눌려도 삼켜졌다.
    // 키가 있다는 것과 그 키가 닿는다는 것은 다르다 — Y 로 옮겼다.
    expect(interactionPresentation('observe-character').key).toBe('KeyY');
    expect(observeOne()?.targetEntityId).toBeUndefined();
    // 고르기는 그 몸을 눌러 부르므로 키를 두지 않는다
    expect(interactionPresentation('select-target').key).toBeUndefined();
    expect(selectOf('npc-2')?.targetEntityId).toBe('npc-2');
  });
});

describe('되돌림 — 살펴보기 전과 후를 견주는 경로', () => {
  it('세계가 싣는 요청 목록에 있고 무엇을 하는지 읽힌다', () => {
    const entries = commandEntries(
      snapshot,
      { 'collider-observe': false, 'attribute-inspect': false },
      codeText,
    );
    const forget = entries.find((entry) => entry.id === 'forget-acquaintance');
    expect(forget?.origin).toBe('world');
    expect(forget?.title).toBe('이 존재를 다시 모르는 상태로 되돌린다');
  });

  it('지목하면 그 존재만, 비우면 알고 있는 전부다', () => {
    expect(commandActionRequest('forget-acquaintance', { target: 'npc-1' })).toEqual({
      interactionId: 'forget-acquaintance',
      targetEntityId: 'npc-1',
    });
    expect(commandActionRequest('forget-acquaintance', {})).toEqual({
      interactionId: 'forget-acquaintance',
    });
  });

  it('비웠을 때의 뜻이 사람 말로 있다', () => {
    expect(codeText('omitted:all-known')).toBe('알고 있는 전부');
  });
});

describe('DC-WORLD-PLAYER-UNFIXED-PATH — 살펴봄은 관문이 아니다', () => {
  it('모르는 상대가 있어도 세 스킬과 막기가 그대로 뜬다', () => {
    const ids = plan().interactions.filter((i) => i.available).map((i) => i.id);
    expect(ids).toContain('attack');
    expect(ids).toContain('skill-aura');
    expect(ids).toContain('guard-begin');
  });
});

describe('살펴봄이 화면에서 진행으로 읽힌다', () => {
  it('행동 코드에 문구가 있다 — 새 HUD 자리를 만들지 않았다', () => {
    // 살펴봄은 hud.playerAction 의 기존 자리로 보인다 (04 hud.playerAction)
    expect(codeText('observe')).toBe('살펴봄');
  });
});
