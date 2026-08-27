// C-COMBAT-004 View 단독 테스트 — World 미기동, Fixture 만으로.
//
// 04-gameview.spec.yaml 의 `entities[].attributes.marks` · `interactions.skillMark` ·
// `skillHatsu.profile.conditions` 를 검증한다. 세계 프로세스도, 세계 코드의 import 도 없다.
//
// fixture 둘이 답하는 것이 다르다.
//   mark-none    아직 아무것도 남기지 않은 세계
//   mark-borne   표식을 남기고 그 뒤 발현 일격이 크게 들어간 세계

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot } from '../../protocol/gameview';
import { codeText, shortCodeText } from '../code-text';
import { inspectLines, nameplate } from '../combat-presentation';
import { markLine, markMark } from '../mark-presentation';
import { forgetWaits } from '../request-timing';
import { skillDetailLines, skillSlotBar } from '../skill-presentation';
import noneFixture from './fixtures/mark-none.fixture.json';
import borneFixture from './fixtures/mark-borne.fixture.json';
import unchosenFixture from './fixtures/mark-unchosen.fixture.json';
import { beforeEach } from 'vitest';

const none = noneFixture as GameViewSnapshot;
const borne = borneFixture as GameViewSnapshot;
const unchosen = unchosenFixture as GameViewSnapshot;

const npcOf = (v: GameViewSnapshot) => v.entities.find((e) => e.id === 'npc-1') as EntityView;
const line = (v: GameViewSnapshot, label: string) =>
  skillDetailLines(v, codeText, {}, 0).find((l) => l.startsWith(label)) ?? '';
const cells = (v: GameViewSnapshot) => skillSlotBar(v, shortCodeText, {}, 0).cells;

beforeEach(() => forgetWaits());

// ─────────────────────────────────────────────────────────────────
describe('붙은 것이 몸 위에서 읽힌다', () => {
  it('아무것도 붙지 않은 몸에는 표기가 없다 — 없다는 것이 곧 관찰이다', () => {
    expect(markMark(npcOf(none).attributes)).toBe('');
    expect(nameplate(npcOf(none), 1)?.name).not.toContain('◈');
  });

  it('붙은 몸에는 표기가 하나 붙는다', () => {
    expect(markMark(npcOf(borne).attributes)).toBe('◈');
    expect(nameplate(npcOf(borne), 1)?.name).toContain('◈');
  });

  it('살펴보지 않은 몸에도 뜬다 — 겨루는 힘은 여전히 가려져 있다', () => {
    const a = npcOf(borne).attributes!;
    expect(a.acquainted).toBe(false);
    expect(a.concealed).toContain('combatStats');
    expect(a.marks).toHaveLength(1);
    expect(nameplate(npcOf(borne), 1)?.name).toContain('◈');
  });

  it('몸 위에는 남긴 자의 이름이 붙지 않는다 — 이름줄이 길어진다', () => {
    expect(nameplate(npcOf(borne), 1)?.name).not.toContain('player-1');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('누가 남겼는지는 펼쳐 읽는다', () => {
  it('펼침 줄에 남긴 자가 온다', () => {
    expect(markLine(npcOf(borne).attributes!.marks)).toBe('표식 player-1');
    expect(inspectLines(npcOf(borne))).toContain('표식 player-1');
  });

  it('붙은 것이 없으면 없다고 말한다 — 줄이 사라지지 않는다', () => {
    expect(markLine(npcOf(none).attributes!.marks)).toBe('표식 없음');
    expect(inspectLines(npcOf(none))).toContain('표식 없음');
  });

  it('언제까지인지는 화면 어디에도 없다 — 세계가 싣지 않았다', () => {
    const text = (inspectLines(npcOf(borne)) ?? []).join('\n');
    expect(text).not.toMatch(/남은|초 뒤|까지/);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('피해가 0 인 기술이 그렇게 읽힌다', () => {
  it('띠에 다섯째 칸이 서고 부를 키가 있다', () => {
    expect(cells(none).map((c) => c.id)).toEqual([
      'attack',
      'skill-heavy',
      'skill-aura',
      'skill-mark',
      'skill-hatsu',
    ]);
    expect(cells(none).find((c) => c.id === 'skill-mark')?.key).toBe('P');
  });

  it('`공격 피해 0` 이 아니라 `피해 없음` 으로 읽힌다', () => {
    const text = line(none, '표식 남기기');
    expect(text).toContain('피해 없음');
    expect(text).not.toContain('공격 피해 0');
  });

  it('값이 있는 기술의 줄은 한 글자도 달라지지 않았다', () => {
    expect(line(none, '기본 스킬')).toBe(
      '기본 스킬 ✓ F · 기력 -0 / +12 · 공격 피해 26 (물리)',
    );
  });
});

// ─────────────────────────────────────────────────────────────────
describe('요구가 지금 고른 상대를 본 답이다', () => {
  it('아직 안 걸었으면 갖춰진 것이다', () => {
    expect(line(none, '표식 남기기')).toContain('요구 ✓그 상대에게 내 표식 없음');
  });

  it('이미 걸어 두었으면 거절되고, 무엇을 하면 열리는지까지 말한다', () => {
    const text = line(borne, '표식 남기기');
    expect(text).toContain('✗ 이미 표식을 남겨 두었다');
    expect(text).toContain('먼저 쓰거나 지워지기를 기다려라');
    expect(text).toContain('요구 ✗그 상대에게 내 표식 없음');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('아무도 고르지 않았을 때 세계가 참인 것을 말한다', () => {
  it('사유가 "이미 남겨 두었다" 가 아니라 "먼저 대상을 고르자" 다', () => {
    const text = line(unchosen, '표식 남기기');
    expect(text).toContain('먼저 대상을 고르자');
    expect(text).not.toContain('이미 표식을 남겨 두었다');
  });

  it('무엇을 지는 기술인지는 그대로 읽힌다 — 요구의 이름은 흔들리지 않는다', () => {
    expect(line(unchosen, '표식 남기기')).toContain('요구 ✗그 상대에게 내 표식 없음');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('표식이 다음 한 방을 바꾼다', () => {
  it('발현 일격의 조건 목록에 표식이 셋째로 온다', () => {
    const text = line(borne, '발현 일격');
    expect(text).toContain('✓그 상대에게 내 표식 +0.5');
  });

  it('그 한 방이 80 이고, 경위가 표식을 지목한다', () => {
    const strike = borne.strikes.at(-1);
    expect(strike?.amount).toBe(80);
    expect(strike?.breakdown.conditions).toEqual([{ id: 'bears-my-mark', bonus: 0.5 }]);
  });

  it('표식이 없는 세계에서는 그 조건이 거짓으로 온다', () => {
    expect(line(none, '발현 일격')).toContain('✗그 상대에게 내 표식 +0.5');
  });
});
