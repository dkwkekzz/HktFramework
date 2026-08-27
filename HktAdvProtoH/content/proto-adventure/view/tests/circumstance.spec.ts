// C-COMBAT-003 View 단독 테스트 — World 미기동, Fixture 만으로.
//
// 04-gameview.spec.yaml 의 `interactions[].profile.requires` · `.conditions` ·
// `strikes[].breakdown.conditions` 를 검증한다. 세계 프로세스도, 세계 코드의 import 도
// 없다 — 계약이 실은 값만으로 화면이 정해진다.
//
// fixture 둘이 답하는 것이 다르다.
//   circumstance-closed   힘을 능력에 몰아 두지 않은 세계 — 관문이 닫혀 있다
//   circumstance          몰아 두었고 생명이 절반인 세계 — 열렸고 조건 하나가 참이며
//                         그 한 방이 경위와 함께 남아 있다

import { beforeEach, describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { codeText, shortCodeText } from '../code-text';
import { forgetWaits } from '../request-timing';
import { skillDetailLines, skillObservations, skillSlotBar } from '../skill-presentation';
import closedFixture from './fixtures/circumstance-closed.fixture.json';
import openFixture from './fixtures/circumstance.fixture.json';

const closed = closedFixture as GameViewSnapshot;
const open = openFixture as GameViewSnapshot;

const panel = (snapshot: GameViewSnapshot) =>
  skillDetailLines(snapshot, codeText, {}, 0).join('\n');
const line = (snapshot: GameViewSnapshot, label: string) =>
  skillDetailLines(snapshot, codeText, {}, 0).find((l) => l.startsWith(label)) ?? '';
const cells = (snapshot: GameViewSnapshot) =>
  skillSlotBar(snapshot, shortCodeText, {}, 0).cells;

beforeEach(() => forgetWaits());

// ─────────────────────────────────────────────────────────────────
describe('기술이 넷이 되어도 화면은 이름으로 가르지 않는다', () => {
  it('세계가 실은 기술이 전부 칸이 된다 — 사정을 지는 것도 하나의 칸이다', () => {
    expect(cells(open).map((c) => c.id)).toEqual([
      'attack',
      'skill-heavy',
      'skill-aura',
      'skill-hatsu',
    ]);
  });

  it('부를 키가 실린다 — 표에 자리가 있으면 손가락이 닿는다', () => {
    expect(cells(open).find((c) => c.id === 'skill-hatsu')?.key).toBe('O');
  });

  it('사정을 지는 기술도 다른 셋과 같은 자리·같은 값으로 읽힌다', () => {
    const cell = cells(open).find((c) => c.id === 'skill-hatsu');
    // 모양이 있으므로 다른 기술과 똑같이 모양을 보인다 (C025 의 결정 그대로)
    expect(cell?.detail).toMatch(/도달 /);
    expect(cell?.title).toBe('발현 일격');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('갖춰지지 않은 기술은 사라지지 않고 사유를 보인다', () => {
  it('관문이 닫혀도 칸이 남는다 — 무엇을 갖추면 열리는지 알 길이 있어야 한다', () => {
    const cell = cells(closed).find((c) => c.id === 'skill-hatsu');
    expect(cell).toBeDefined();
    expect(cell?.state).toBe('blocked');
  });

  it('사유가 세계의 사실을 가리키고, 무엇을 하면 열리는지까지 말한다', () => {
    expect(line(closed, '발현 일격')).toContain('힘을 능력에 몰아 두어야 나간다');
    expect(line(closed, '발현 일격')).toContain('배분을 발현으로 옮겨라');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('요구와 조건이 다른 말로 읽힌다', () => {
  it('요구는 사정의 이름으로 적힌다 — 갖춰졌는지는 표기가 말한다', () => {
    expect(line(closed, '발현 일격')).toContain('요구 ✗능력에 힘을 몰아 둠');
    expect(line(open, '발현 일격')).toContain('요구 ✓능력에 힘을 몰아 둠');
  });

  it('긴 사유는 한 줄에 한 번만 선다 — 앞머리에 이미 서 있다', () => {
    const text = line(closed, '발현 일격');
    const occurrences = text.split('힘을 능력에 몰아 두어야 나간다').length - 1;
    expect(occurrences).toBe(1);
    expect(text).toContain('배분을 발현으로 옮겨라');
  });

  it('조건은 지금 참인지와 얼마나 커지는지를 함께 보인다', () => {
    const text = line(open, '발현 일격');
    expect(text).toContain('조건 ');
    expect(text).toContain('✗그 상대에게 방금 맞음 +0.4');
    expect(text).toContain('✓생명이 절반 아래 +0.4');
  });

  it('요구가 조건보다 앞에 온다 — 못 쓰는 물음이 더 잘 드는 물음보다 먼저다', () => {
    const text = line(open, '발현 일격');
    expect(text.indexOf('요구 ')).toBeLessThan(text.indexOf('조건 '));
  });
});

// ─────────────────────────────────────────────────────────────────
describe('사정을 지지 않는 기술은 한 글자도 달라지지 않는다', () => {
  it('기존 세 기술의 줄에 사정이 붙지 않는다', () => {
    for (const label of ['기본 스킬', '고급 스킬', '오라 스킬']) {
      expect(line(open, label)).not.toContain('요구 ');
      expect(line(open, label)).not.toContain('조건 ');
    }
  });

  it('빈 목록이 실려도 화면이 빈 자리를 만들지 않는다', () => {
    const basic = skillObservations(open).find((s) => s.id === 'attack');
    expect(basic?.profile.requires).toEqual([]);
    expect(basic?.profile.conditions).toEqual([]);
    expect(line(open, '기본 스킬')).toBe(
      '기본 스킬 ✓ F · 기력 -0 / +12 · 공격 피해 22 (물리)',
    );
  });
});

// ─────────────────────────────────────────────────────────────────
describe('띠는 짧게 남는다 — 사정은 패널의 것이다', () => {
  it('띠의 어느 칸에도 사정의 긴 문장이 오지 않는다 (C025 가 실측으로 배운 것)', () => {
    for (const cell of cells(open)) {
      expect(cell.detail).not.toContain('요구 ');
      expect(cell.detail).not.toContain('조건 ');
      expect(cell.status).not.toContain('요구 ');
    }
  });
});

// ─────────────────────────────────────────────────────────────────
describe('경위가 왜 이만큼인지에 답한다', () => {
  it('참인 조건과 그 몫이 타격 결과에 실려 온다', () => {
    expect(open.strikes.at(-1)?.breakdown.conditions).toEqual([
      { id: 'life-below-half', bonus: 0.4 },
    ]);
  });

  it('되짚기가 성립한다 — 계수가 1.7 이어서 raw 가 118.8 이 되었다', () => {
    const breakdown = open.strikes.at(-1)!.breakdown;
    expect(breakdown.rawDamage).toBeCloseTo(118.8, 6);
    expect(open.strikes.at(-1)?.amount).toBe(76);
  });

  it('사정이 아무것도 하지 않은 세계에서도 그 자리는 온다 — 빈 목록이다', () => {
    // 닫힌 세계는 아직 아무도 치지 않았다. 그래도 계약의 자리는 형으로 서 있다.
    expect(closed.strikes).toEqual([]);
  });

  it('화면은 계수를 피해로 환산하지 않는다 — 세계가 준 수를 그대로 보인다', () => {
    expect(panel(open)).not.toContain('118.8');
    expect(line(open, '발현 일격')).toContain('공격 피해 93.2 (오라)');
  });
});
