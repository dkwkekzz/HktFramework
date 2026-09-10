// C037 — 때가 있는 기회 · 판 쪽 **시나리오** 검증 (spec SPEC-004) — T 몫
//
// V 레인이 쓴 c037-an-opportunity-with-a-time.spec.ts 와 자리가 갈린다: 그 파일은 판이 **무슨
// 말을 하는가**(「— 지금은 없다」 의 문구를 값 그대로)를 재고, 이 파일은 그 말이 무엇이든
// **판이 지켜야 하는 경계**를 잰다 — 닫힌 Event 는 줄에 서되 한 마디가 붙는가 · 열린 Event 에는
// 붙지 않는가 · Event 가 아닌 것에는 붙지 않는가 · 어느 줄에도 "N초 뒤" 와 무엇이 여는지가
// 없는가 · 판 밖(세계 위)이 달라지지 않는가.
//
// 이 파일은 이 Cycle 이 새로 쓴 코드를 **읽지 않고** 쓴다 (c026 · c027 · c036 의 선례). 그래서
// 「지금은 없다」 가 무슨 말인지도, 그 말이 어느 줄의 어느 자리에 붙는지도 모른다. 아는 것은
// 계약뿐이다:
//
//   InteractionView.opportunity?  { id, discovery, event, open }   — C037 2.1 의 관찰 계약
//   resolvePresentation(snapshot, motions?, { designation })
//   SceneState.targetFrame { title, subtitle?, rows[{ id, label, value, progress?, muted? }] }
//
// **판정 방식** — 문구를 모르므로 **차이로** 잰다 (c027 · c036 의 규율 그대로): 같은 봉투에서
// 기회의 `event` · `open` 만 갈라 판 넷을 세우고, 판의 글이 달라졌는가 · 줄이 사라졌는가 ·
// 줄의 상대 차례가 뒤집혔는가 · 달라진 글이 무엇을 담고 있는가로 판정한다. 개수는 세지 않는다.
//
// 봉투는 기존 fixture 를 **읽기만** 한다 (out-of-range.fixture.json — 원천 하나와 그것을 겨냥한
// harvest-source 하나가 이미 서 있는 자리). 세계는 기동하지 않는다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { resolvePresentation } from '../resolve';
import outOfRange from './fixtures/out-of-range.fixture.json';

// ── 계약이 준 형 (spec 이 글로 적은 그대로 · engine 의 형을 읽지 않는다) ──
interface TargetFrameRow {
  id: string;
  label: string;
  value: string | number;
  progress?: number;
  muted?: boolean;
}
interface TargetFrame {
  title: string;
  subtitle?: string;
  rows: TargetFrameRow[];
}
type Scene = SceneState & { targetFrame?: TargetFrame };
interface Opportunity {
  id: string;
  discovery: string;
  event: boolean;
  open: boolean;
}
type SeenInteraction = InteractionView & { opportunity?: Opportunity };

/** 세계 사건으로 오는 기회의 discovery — 비늘의 역할이 그것이다 (C036 역할 표 · world-event → SIGNAL) */
const SIGNAL = 'SIGNAL';
/** fixture 가 이미 세워 둔 자리 — 원천 하나와 그것을 겨냥한 채취 하나 */
const BASE = outOfRange as unknown as GameViewSnapshot;
const SOURCE_ID = 'MOLT_LITTER';
const OPPORTUNITY_ID = `gather:${SOURCE_ID}`;
/**
 * 판이 말해서는 안 되는 것들 — spec SPEC-004 경계 ("N초 뒤" · 무엇이 여는가).
 * 경로의 이름도 지나는 것의 코드도 사람 말의 「고래」 도 어느 줄에도 없다.
 */
const MUST_NOT_SAY = ['SKY_WHALE_ROUTE', 'sky-whale', '고래', 'BLIND_HUNTER_ROUTE', 'blind-hunter'];

/** 그 봉투의 채취에 기회 하나를 붙인 사본 — 다른 자리는 한 글자도 건드리지 않는다 */
function withOpportunity(opportunity?: Opportunity): GameViewSnapshot {
  const copy = JSON.parse(JSON.stringify(BASE)) as GameViewSnapshot;
  copy.interactions = (copy.interactions as SeenInteraction[]).map((one) =>
    one.targetEntityId === SOURCE_ID && opportunity ? { ...one, opportunity } : one,
  );
  return copy;
}

type Designation = { entityId: string } | { ground: { x: number; z: number } };
const resolveWith = (snapshot: GameViewSnapshot, designation?: Designation): Scene =>
  resolvePresentation(snapshot, undefined, {
    ...(designation ? { designation } : {}),
  } as Parameters<typeof resolvePresentation>[2]) as Scene;
const point = (snapshot: GameViewSnapshot): Scene => resolveWith(snapshot, { entityId: SOURCE_ID });

function frameOf(scene: Scene): TargetFrame {
  const frame = scene.targetFrame;
  if (!frame) throw new Error('판(targetFrame)이 서지 않았다');
  return frame;
}
const rowIds = (scene: Scene): string[] => frameOf(scene).rows.map((row) => row.id);
/** 판 전체의 글 — 제목 · 부제 · 줄의 label 과 value 를 이어 붙인다 (c036 의 자 그대로) */
const frameText = (scene: Scene): string => {
  const frame = frameOf(scene);
  return [
    frame.title ?? '',
    frame.subtitle ?? '',
    ...frame.rows.flatMap((r) => [String(r.label ?? ''), String(r.value ?? '')]),
  ].join('␟');
};
/** 판을 뺀 화면 전부 — "세계 위에 뜨는 글자는 늘지 않는다" 를 재는 자 */
const withoutFrame = (scene: Scene): string =>
  JSON.stringify({ ...(scene as unknown as Record<string, unknown>), targetFrame: undefined });

/** 그 기회를 붙인 판 — 때와 열림만 갈린다 */
const opportunityOf = (event: boolean, open: boolean): Opportunity => ({
  id: OPPORTUNITY_ID,
  discovery: SIGNAL,
  event,
  open,
});
const carrying = (event: boolean, open: boolean): Scene => point(withOpportunity(opportunityOf(event, open)));
/** 때 없는 기회 — C036 이 세운 그 판 (늘 열려 있는 기회) */
const timeless = (): Scene => carrying(false, true);
/** 때가 있고 지금 열려 있는 기회 */
const openEvent = (): Scene => carrying(true, true);
/** 때가 있고 지금 닫혀 있는 기회 — 「— 지금은 없다」 가 붙는 자리 */
const closedEvent = (): Scene => carrying(true, false);
/** Event 가 아닌데 열려 있지 않은 기회 — 판정 불가가 그것이다 (기본형 ③) */
const closedPlain = (): Scene => carrying(false, false);

/** 두 판의 글에서 **달라진 마디들** — 한쪽에만 있는 조각을 모은다 */
const addedParts = (before: Scene, after: Scene): string[] => {
  const had = new Set(frameText(before).split('␟'));
  return frameText(after)
    .split('␟')
    .filter((part) => part.length > 0 && !had.has(part));
};

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-004 판의 어법 — 닫힌 Event 에만 한 마디가 붙는다', () => {
  it('S-370 Event 가 닫혀 있으면 줄에 서되 한 마디가 붙는다 — 있던 줄은 하나도 사라지지 않는다', () => {
    const open = openEvent();
    const closed = closedEvent();
    // Then 판의 글이 달라졌다 — 한 마디가 붙었다
    expect(frameText(closed)).not.toBe(frameText(open));
    // And 그 줄은 여전히 선다 — 닫혔다고 지워지지 않는다 (Event 는 닫혀 있어도 줄에 선다)
    for (const id of rowIds(open)) {
      expect({ row: id, kept: rowIds(closed).includes(id) }).toEqual({ row: id, kept: true });
    }
    // And 있던 줄의 **상대 차례**가 그대로다 (새 마디가 끼어들어도 앞뒤가 뒤집히지 않는다)
    expect(rowIds(closed).filter((id) => rowIds(open).includes(id))).toEqual(rowIds(open));
  });

  it('S-371 열려 있으면 붙지 않는다 — 열린 Event 의 판이 때 없는 기회의 판과 한 글자도 다르지 않다', () => {
    expect(frameText(openEvent())).toBe(frameText(timeless()));
  });

  it('S-372 (경계) Event 가 아닌 것에는 그 마디가 붙지 않는다 — 판정 불가는 「지금은 없다」 로 말해지지 않는다', () => {
    // 기본형 ③ — 열려 있지 않아도 Event 가 아니면 판은 지금 그대로 말한다 (사유는 C029 의 것이다)
    expect(frameText(closedPlain())).toBe(frameText(timeless()));
  });

  it('S-373 (경계) 어느 줄에도 "N초 뒤" 도 무엇이 여는지도 없다', () => {
    const added = addedParts(openEvent(), closedEvent());
    // 붙은 마디가 실제로 있다 — 없으면 S-370 이 헛돈 것이다
    expect({ added: added.length > 0 }).toEqual({ added: true });
    for (const part of added) {
      // 남은 시간을 말하지 않는다 — 숫자가 한 자리도 없다
      expect({ part, hasNumber: /\d/.test(part) }).toEqual({ part, hasNumber: false });
      // 무엇이 여는지도 말하지 않는다
      for (const name of MUST_NOT_SAY) {
        expect({ part, said: part.includes(name) }).toEqual({ part, said: false });
      }
    }
    // 그리고 판 전체 어디에도 여는 것의 이름이 없다 (닫혔든 열렸든)
    for (const scene of [openEvent(), closedEvent(), closedPlain(), timeless()]) {
      for (const name of MUST_NOT_SAY) {
        expect({ name, said: frameText(scene).includes(name) }).toEqual({ name, said: false });
      }
    }
  });

  it('S-374 세계 위에 뜨는 글자는 늘지 않는다 — 판을 뺀 화면이 한 글자도 달라지지 않는다', () => {
    const bare = point(withOpportunity());
    for (const [event, open] of [
      [true, false],
      [true, true],
      [false, false],
      [false, true],
    ] as const) {
      expect({ event, open, scene: withoutFrame(carrying(event, open)) }).toEqual({
        event,
        open,
        scene: withoutFrame(bare),
      });
    }
  });

  it('S-375 (경계) 때와 열림은 무엇을 할 수 있는가를 바꾸지 않는다 — 판정은 규칙의 것이다', () => {
    const bare = point(withOpportunity());
    for (const [event, open] of [
      [true, false],
      [true, true],
      [false, false],
    ] as const) {
      expect({ event, open, interactions: JSON.stringify(carrying(event, open).interactions) }).toEqual({
        event,
        open,
        interactions: JSON.stringify(bare.interactions),
      });
    }
  });
});
