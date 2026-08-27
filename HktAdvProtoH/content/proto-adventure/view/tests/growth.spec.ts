// C-GROWTH-001 한 일이 몸을 키운다 — View 단독 테스트. World 미기동, Fixture 만으로 검증한다.
//
// 04-gameview.spec.yaml 의 셋을 화면 결정으로 옮긴 것을 본다:
//   ① 자란 것이 늘 보인다 (0 도 · 최대 단계도)
//   ② 방금 무엇을 해서 쌓였는지가 보이고, 오른 순간은 다르게 읽힌다
//   ③ 화면이 아무것도 계산하지 않는다 — 세계가 보낸 수를 그대로 옮긴다
//
// Fixture 의 자리
//   growth        단계 1/5 · 쌓인 것 20 · 다음 문턱 50 (남은 30)
//                 방금 한 대(+1)와 쓰러뜨림(+14)이 있었고 그 둘째가 단계를 올렸다
//   growth-max    단계 5/5 · 쌓인 것 240 — **다음 문턱이 아예 오지 않는다**

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { codeText } from '../code-text';
import { growthEventLines, growthLines, justLeveled } from '../growth-presentation';
import { resolvePresentation } from '../resolve';
import grownFixture from './fixtures/growth.fixture.json';
import maxedFixture from './fixtures/growth-max.fixture.json';
import flatFixture from './fixtures/combat.fixture.json';

const grown = grownFixture as GameViewSnapshot;
const maxed = maxedFixture as GameViewSnapshot;
const flat = flatFixture as GameViewSnapshot; // 아직 아무것도 쌓지 않은 몸

const selfLines = (snapshot: GameViewSnapshot) =>
  resolvePresentation(snapshot).self?.lines ?? [];
const lineWith = (snapshot: GameViewSnapshot, needle: string) =>
  selfLines(snapshot).find((l) => l.includes(needle));

// ─────────────────────────────────────────────────────────────────
describe('① 자란 것이 늘 보인다', () => {
  it('단계 · 쌓인 것 · 다음 문턱까지가 한 줄에 선다', () => {
    expect(lineWith(grown, '자란 것')).toBe('자란 것 1/5 · 쌓인 것 20 · 다음까지 30 (50)');
  });

  it('아직 아무것도 쌓지 않아도 보인다 — 0 이라는 사실과 자리가 없다는 사실은 다르다', () => {
    expect(lineWith(flat, '자란 것')).toBe('자란 것 0/5 · 쌓인 것 0 · 다음까지 20 (20)');
  });

  it('단계가 어느 값에 얼마를 보태는지가 함께 온다 — 없으면 숫자의 뜻을 알 수 없다', () => {
    expect(lineWith(grown, '단계 몫')).toBe(
      '단계 몫 물리 공격 +4 · 오라 공격 +4 · 물리 방어 +3 · 오라 방어 +3',
    );
  });

  it('보태는 몫이 0 이어도 쓴다 — 한 단계 올린 뒤 이 줄이 움직이는 것이 읽혀야 한다', () => {
    expect(lineWith(flat, '단계 몫')).toBe(
      '단계 몫 물리 공격 +0 · 오라 공격 +0 · 물리 방어 +0 · 오라 방어 +0',
    );
  });

  it('더 오를 곳이 없으면 남은 양 대신 그 사실을 말한다 — 0 을 지어내지 않는다', () => {
    expect(lineWith(maxed, '자란 것')).toBe('자란 것 5/5 · 쌓인 것 240 · 더 오를 곳이 없다');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('② 방금 쌓인 일이 보이고, 오른 순간은 다르게 읽힌다', () => {
  it('무엇을 해서 얼마가 쌓였는지가 줄로 선다', () => {
    const lines = growthEventLines(grown, codeText);
    expect(lines[0]).toBe('한 대 +1 (6)');
  });

  it('오른 줄만 전후 단계를 함께 쓴다 — 화면이 이전 값을 기억하지 않는다', () => {
    const lines = growthEventLines(grown, codeText);
    expect(lines[1]).toBe('쓰러뜨림 +14 (20) → 자란 것 0 ▸ 1');
  });

  it('오르지 않은 쌓임도 사라지지 않는다 — 다음 문턱까지의 거리가 읽혀야 한다', () => {
    expect(growthEventLines(grown, codeText)).toHaveLength(2);
  });

  it('방금 올랐는가를 한 물음으로 답한다', () => {
    expect(justLeveled(grown)).toBe(true);
    expect(justLeveled(maxed)).toBe(false); // 목록이 비어 있다 (세계가 지웠다)
    expect(justLeveled(flat)).toBe(false);
  });

  it('모르는 원천이 와도 화면이 멈추지 않는다 — 코드 그대로 보인다', () => {
    const future = {
      ...grown,
      growthEvents: [
        { source: 'solved-an-event', amount: 9, deedsAfter: 29, levelBefore: 1, levelAfter: 1, since: 20 },
      ],
    } as GameViewSnapshot;
    expect(growthEventLines(future, codeText)[0]).toBe('deed.solved-an-event +9 (29)');
  });

  it('쌓인 줄들이 자란 것 바로 아래에 선다 — 무엇 때문에 움직였는지가 이어진다', () => {
    const lines = selfLines(grown);
    const at = (needle: string) => lines.findIndex((l) => l.includes(needle));
    expect(at('단계 몫')).toBe(at('자란 것') + 1);
    expect(at('쓰러뜨림 +14')).toBe(at('단계 몫') + 2);
  });

  it('자란 것은 목록의 맨 뒤다 — 이력은 지금의 결정을 재촉하지 않는다', () => {
    const lines = selfLines(grown);
    expect(lines.findIndex((l) => l.includes('자란 것'))).toBeGreaterThan(
      lines.findIndex((l) => l.includes('배분')),
    );
    // 마지막 줄은 방금 쌓인 일 — 그 뒤에 아무것도 붙지 않는다
    expect(lines.at(-1)).toContain('쓰러뜨림 +14');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('③ 화면이 아무것도 계산하지 않는다', () => {
  it('세계가 보낸 수를 그대로 옮긴다 — 나누지도 빼지도 곱하지도 않는다', () => {
    // 세계가 앞뒤가 맞지 않는 수를 보내도 화면은 그것을 고치지 않는다.
    // 고치는 순간 판정이 두 곳에 생기고 어긋나는 자리가 열린다
    // (DC-WORLD-OWNS-THE-SURFACE-LIST).
    const odd = {
      ...grown,
      growth: { deeds: 7, level: 4, maxLevel: 5, nextThreshold: 999, deedsToNext: 3, contributions: [] },
    } as GameViewSnapshot;
    expect(growthLines(odd, codeText)[0]).toBe('자란 것 4/5 · 쌓인 것 7 · 다음까지 3 (999)');
  });

  it('보태는 몫의 차례도 세계가 정한다 — 화면은 정렬하지 않는다', () => {
    const shuffled = {
      ...grown,
      growth: {
        ...grown.growth,
        contributions: [
          { stat: 'resistance', amount: 3 },
          { stat: 'physicalAttack', amount: 4 },
        ],
      },
    } as GameViewSnapshot;
    expect(growthLines(shuffled, codeText)[1]).toBe('단계 몫 오라 방어 +3 · 물리 공격 +4');
  });

  it('자란 몸의 능력치 줄은 세계가 보낸 유효 값을 그대로 쓴다', () => {
    // 기본값 40 에 자란 몫 4 가 얹힌 44 가 세계에서 온다. 화면이 40 과 4 를 더하지 않는다.
    expect(lineWith(grown, '물리 공격')).toContain('물리 공격 44');
    expect(lineWith(flat, '물리 공격')).toContain('물리 공격 40');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('계약이 없는 관찰에도 화면이 선다', () => {
  it('growth 가 아예 없으면 줄을 만들지 않는다 — 자리를 지어내지 않는다', () => {
    const bare = { ...grown, growth: undefined, growthEvents: undefined } as unknown as GameViewSnapshot;
    expect(growthLines(bare, codeText)).toEqual([]);
    expect(growthEventLines(bare, codeText)).toEqual([]);
    expect(justLeveled(bare)).toBe(false);
  });
});
