// C007 전투 표현 결정 Layer 단독 테스트 — World 미기동, Fixture 만으로
// entityHud(이름·생명·쓰러짐) · strikeEvents(피해 숫자) · hud.self(자원·능력치·배율) ·
// debugAuthority.inspect(속성 펼쳐 보기) 의 표현 결정을 검증한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import fixture from './fixtures/combat.fixture.json';

const snapshot = fixture as GameViewSnapshot;
const plan = () => resolvePresentation(snapshot);
const entity = (id: string) => plan().entities.find((e) => e.id === id);

describe('entityHud — 이름과 생명은 그 몸 위에 늘 붙는다', () => {
  it('모든 존재가 이름·생명·비율을 가진 표지를 얻는다', () => {
    expect(entity('player-1')?.nameplate).toEqual({
      name: 'Player 1',
      health: 150,
      healthMaximum: 200,
      healthRatio: 0.75,
      downed: false,
      anchorHeight: 3.55, // player-character 그림 크기 3.4 + 여백
    });
    expect(entity('npc-1')?.nameplate?.name).toBe('Wanderer 1');
    expect(entity('npc-1')?.nameplate?.healthRatio).toBeCloseTo(65 / 120, 5);
  });

  it('쓰러진 존재는 그 사실이 표지에 실린다 — 살아 있는 존재와 구분된다', () => {
    expect(entity('npc-2')?.nameplate).toMatchObject({ downed: true, health: 0, healthRatio: 0 });
    expect(entity('npc-1')?.nameplate?.downed).toBe(false);
  });

  it('표지는 그 존재의 그림 바로 위에 붙는다 — 그림이 작으면 표지도 낮다', () => {
    // player-character 3.4 · npc-character 2.8 (role-presentation 의 size)
    expect(entity('player-1')?.nameplate?.anchorHeight).toBeCloseTo(3.55, 5);
    expect(entity('npc-1')?.nameplate?.anchorHeight).toBeCloseTo(2.95, 5);
  });

  it('타격 숫자는 맞은 몸의 그림 한가운데쯤에서 떠오른다', () => {
    const strikes = plan().strikes;
    // npc-1 이 맞은 것 (그림 2.8) / player-1 이 맞은 것 (그림 3.4)
    expect(strikes[0]?.anchorHeight).toBeCloseTo(2.8 * 0.55, 5);
    expect(strikes[1]?.anchorHeight).toBeCloseTo(3.4 * 0.55, 5);
  });

  it('표지는 관찰자의 선택이 아니다 — 토글 없이 언제나 실린다', () => {
    for (const e of plan().entities) {
      if (e.id.startsWith('deposit')) continue;
      expect(e.nameplate).toBeDefined();
    }
  });

  it('몸 위에 기력·능력치는 기본으로 실리지 않는다 (펼쳐야 보인다)', () => {
    expect(entity('npc-1')?.inspect).toBeUndefined();
  });
});

describe('debugAuthority.inspect — 켜면 모든 속성이 그 자리에서 펼쳐진다 (R2)', () => {
  it('켜면 남의 것이든 자기 것이든 속성 줄이 실린다', () => {
    const opened = resolvePresentation(snapshot, undefined, { inspect: true });
    const npc = opened.entities.find((e) => e.id === 'npc-1');

    expect(npc?.inspect?.[0]).toBe('기력 20 / 60');
    expect(npc?.inspect?.join('\n')).toContain('공속 ×0.85');
    expect(npc?.inspect?.join('\n')).toContain('충전×0.2');

    const self = opened.entities.find((e) => e.id === 'player-1');
    expect(self?.inspect?.[0]).toBe('기력 24 / 100');
    expect(self?.inspect?.join('\n')).toContain('달리기');
  });

  it('꺼져 있으면 실리지 않는다 — 세계가 감춘 것이 아니라 표시 선택이다', () => {
    expect(resolvePresentation(snapshot, undefined, {}).entities[0]?.inspect).toBeUndefined();
  });
});

describe('strikeEvents — 타격 결과가 맞은 자리에 숫자로 드러난다', () => {
  it('깎인 값이 숫자로 실리고 자리와 시각이 함께 온다', () => {
    const strikes = plan().strikes;
    expect(strikes).toHaveLength(2);
    expect(strikes[0]).toMatchObject({
      text: '-55',
      position: { x: 1.4, z: 0 },
      since: 12.1,
    });
  });

  it('고급 스킬의 결과는 강조된다 — 기본 스킬과 구분된다', () => {
    const strikes = plan().strikes;
    expect(strikes[0]?.emphasis).toBe(true); // heavy-attack
    expect(strikes[1]?.emphasis).toBe(false); // attack
  });

  it('내가 친 것과 남이 친 것 모두 실린다', () => {
    expect(plan().strikes.map((s) => s.id)).toEqual([
      'player-1->npc-1@12.1',
      'npc-1->player-1@11.6',
    ]);
  });

  it('나이를 잴 기준으로 세계 시각이 함께 온다', () => {
    expect(plan().worldTime).toBe(12.5);
  });
});

describe('hud.self — 자기 자원·능력치·배율은 늘 눈앞에 있다', () => {
  it('생명과 기력이 현재/최대와 비율로 실린다', () => {
    expect(plan().self).toMatchObject({
      health: 150,
      healthMaximum: 200,
      healthRatio: 0.75,
      energy: 24,
      energyMaximum: 100,
      energyRatio: 0.24,
      downed: false,
    });
  });

  it('이동 모드는 문구로, 요청에 쓸 코드는 코드로 실린다', () => {
    expect(plan().self?.moveMode).toBe('달리기');
    expect(plan().self?.moveModeCode).toBe('run');
  });

  it('전투 능력치와 템포 능력치가 줄로 실린다', () => {
    const lines = plan().self?.lines ?? [];
    // C010 — 내가 얼마나 세게 때리고 얼마나 덜 맞는가가 맨 위에 온다
    // C012 — 능력이 방식별로 갈렸다. 첫 줄은 물리 쪽이다
    expect(lines[0]).toContain('물리 공격 40');
    expect(lines[0]).toContain('물리 방어 50');
    expect(lines[0]).toContain('받는 피해 67%'); // 100/150 — 체감을 백분율로 읽는다
    expect(lines[1]).toContain('오라 공격 40');
    // C013 — 내 관통이 능력치 두 줄 바로 뒤에 온다. 0 인 쪽도 쓴다
    expect(lines[2]).toBe('관통 물리 0 · 오라 0');
    expect(lines[3]).toContain('내 약점');
    // C015 — 내가 얼마나 터뜨리는 몸인가. 방어 읽기가 끝난 뒤에 온다.
    // 이 fixture 의 몸은 터뜨리지 못한다 — 0% 라고만 쓰면 옆의 배율과 헷갈리므로
    // "터뜨리지 못함" 이라고 쓴다
    expect(lines[4]).toBe('치명타 터뜨리지 못함');
    expect(lines[5]).toContain('이동 속도 6');
    expect(lines[5]).toContain('달리기 ×1.8');
    expect(lines[6]).toBe('공격 속도 ×1');
  });

  it('1 이 아닌 배율만 줄이 된다 — 걸린 것이 있을 때만 드러난다', () => {
    const lines = plan().self?.lines.join('\n') ?? '';
    expect(lines).toContain('기력 충전 배율 ×0.5'); // 달리는 중
    expect(lines).not.toContain('기력 소비 배율'); // 1 — 걸린 것이 없다
    expect(lines).not.toContain('이동 속도 배율');
  });

  it('self 값은 일반 HUD 줄로 중복되지 않는다', () => {
    // C017 — 고른 대상 자리가 앞에 붙는다 (이 fixture 는 아무것도 고르지 않은 화면이다)
    // C020 CHANGED — 고른 대상 다음에 소지품 자리가 오고, 돌 전용 칸은 사라졌다.
    // 이 fixture 의 몸은 아무것도 지니지 않았으므로 자리 줄이 없고 요약 둘만 온다.
    expect(plan().hud.map((h) => h.id)).toEqual([
      'target.none',
      'carried.room',
      'carried.letGo:none',
      'world.time',
    ]);
  });
});

describe('interaction 표현 — 스킬 2종과 이동 모드', () => {
  const interaction = (id: string) => plan().interactions.find((i) => i.id === id);

  it('기본 스킬은 기존 자리(F)를, 고급 스킬은 G 를 쓴다', () => {
    expect(interaction('attack')).toMatchObject({ key: 'KeyF', keyLabel: 'F', prompt: '기본 스킬' });
    expect(interaction('skill-heavy')).toMatchObject({ key: 'KeyG', prompt: '고급 스킬' });
  });

  it('기력이 모자란 고급 스킬은 그 사유가 문구로 바뀐다', () => {
    expect(interaction('skill-heavy')?.available).toBe(false);
    expect(interaction('skill-heavy')?.unavailableText).toBe('기력이 모자란다');
  });

  it('이동 모드에는 안내 키가 있고, 속성 변경에는 없다 (이번 Cycle 은 경로만)', () => {
    expect(interaction('move-mode')?.keyLabel).toBe('Shift');
    expect(interaction('set-attribute')?.key).toBeUndefined();
  });
});

describe('행동 코드 표현 — 새 상태도 문구가 있다', () => {
  it('강공격·쓰러짐이 각자의 그림 키를 얻는다', () => {
    expect(entity('player-1')?.spriteId).toBe('player-pickaxe:heavy-attack');
    expect(entity('npc-2')?.spriteId).toContain(':downed');
  });
});
