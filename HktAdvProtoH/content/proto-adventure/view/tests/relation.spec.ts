// C018 View 단독 테스트 — World 미기동, Fixture 만으로.
// 04-gameview.spec.yaml 의 VIEW REQUIREMENT 넷을 검증한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import fixture from './fixtures/relation.fixture.json';

const snapshot = fixture as GameViewSnapshot;
const plan = (opts = {}) => resolvePresentation(snapshot, undefined, opts);
const entity = (id: string, opts = {}) => plan(opts).entities.find((e) => e.id === id);

describe('VIEW REQUIREMENT 1 — 존재마다 그 사이가 어떤 관계인지 구분해 보인다', () => {
  it('적대인 존재의 몸 위에는 관계가 붙는다', () => {
    expect(entity('npc-1')?.nameplate?.name).toContain('[적대]');
  });

  it('중립인 존재에는 붙지 않는다 — 표시가 없다는 것이 곧 중립이다', () => {
    expect(entity('npc-2')?.nameplate?.name).not.toContain('[적대]');
  });

  it('내 몸에도 붙지 않는다', () => {
    expect(entity('player-1')?.nameplate?.name).not.toContain('[적대]');
  });

  it('관계 표시는 이름 앞에 온다 — 무엇인지보다 어떤 사이인지가 먼저 읽힌다', () => {
    expect(entity('npc-1')?.nameplate?.name.startsWith('[적대]')).toBe(true);
  });

  it('아직 다 알지 못한다는 표시(C014)와 함께 설 수 있다 — 둘은 다른 사실이다', () => {
    const name = entity('npc-1')?.nameplate?.name ?? '';
    expect(name).toContain('[적대]');
    expect(name).toContain('?'); // 살펴보지 않은 존재다
  });
});

describe('VIEW REQUIREMENT 3 — 무산은 빗나감과 다르게 그려진다', () => {
  it('무산된 접촉이 맞은 자리에 사유와 함께 뜬다', () => {
    const marks = plan().strikes;
    const unharmed = marks.find((m) => m.text === '적대가 아니다');
    expect(unharmed).toBeDefined();
    expect(unharmed?.position).toEqual({ x: 3, z: 0 });
  });

  it('타격 숫자와 같은 자리를 쓰되 크게 그리지 않는다 — 일어나지 않은 일이다', () => {
    const unharmed = plan().strikes.find((m) => m.text === '적대가 아니다');
    expect(unharmed?.emphasis).toBe(false);
    expect(unharmed?.anchorHeight).toBeGreaterThan(0);
  });

  it('성립한 타격과 섞이지 않는다 — 숫자는 숫자대로 남는다', () => {
    const marks = plan().strikes;
    expect(marks.some((m) => m.text.startsWith('-'))).toBe(true); // 피해 숫자
    expect(marks.some((m) => m.text === '적대가 아니다')).toBe(true); // 무산
  });

  it('무산에는 경위가 붙지 않는다 — 산정 자체가 없다', () => {
    const unharmed = plan({ inspect: true }).strikes.find((m) => m.text === '적대가 아니다');
    expect(unharmed?.detail).toBeUndefined();
  });
});

describe('두 방향은 펼쳐야 보인다 — 방향값임이 거기서 드러난다', () => {
  it('속성 관찰을 켜면 두 방향이 따로 읽힌다', () => {
    const lines = entity('npc-1', { inspect: true })?.inspect ?? [];
    const line = lines.find((l) => l.startsWith('관계'));
    expect(line).toBe('관계 적대→나 · 나→중립');
  });

  it('중립인 존재도 그 줄이 비지 않는다 — 자리를 비우면 세계에 값이 없다고 배운다', () => {
    const lines = entity('npc-2', { inspect: true })?.inspect ?? [];
    expect(lines.find((l) => l.startsWith('관계'))).toBe('관계 중립→나 · 나→중립');
  });
});

describe('VIEW REQUIREMENT 4 — 사유 코드를 문구로 옮기는 표는 View 가 소유한다', () => {
  it('세계가 보낸 코드가 그대로 화면에 나오지 않는다', () => {
    const marks = plan().strikes;
    expect(marks.some((m) => m.text === 'not-hostile')).toBe(false);
  });
});

describe('View 는 종류로도 조종 주체로도 태도를 짐작하지 않는다', () => {
  it('같은 종류(npc-character)의 둘이 서로 다른 표시를 얻는다', () => {
    const hostile = entity('npc-1');
    const neutral = entity('npc-2');
    expect(hostile?.spriteId.split(':')[0]).toBe(neutral?.spriteId.split(':')[0]); // 같은 그림
    expect(hostile?.nameplate?.name).toContain('[적대]');
    expect(neutral?.nameplate?.name).not.toContain('[적대]');
  });
});
