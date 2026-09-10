// C036 — 방이 기회를 내민다 · 판 쪽 **시나리오** 검증 (spec SPEC-005) — T 몫
//
// V 레인이 쓴 c036-a-room-offers.spec.ts 와 자리가 갈린다: 그 파일은 판이 **무슨 말을 하는가**
// (문구 셋을 값 그대로)를 재고, 이 파일은 그 말이 무엇이든 **판이 지켜야 하는 경계**를 잰다 —
// 형식 · 순서 · 거절 사유 · 판정 · 세계 위의 글자가 한 값도 달라지지 않는가 (SPEC-005 경계 ① ②).
//
// 이 파일은 이 Cycle 이 새로 쓴 코드를 **읽지 않고** 쓴다 (c026 · c027 의 선례). 그래서
// discovery 의 문구가 무슨 말인지도, 그 말이 어느 줄의 어느 자리에 붙는지도 모른다. 아는 것은
// 계약뿐이다:
//
//   InteractionView.opportunity?  { id, discovery }   — discovery 는 VISIBLE · SIGNAL · TRACE · HIDDEN
//   resolvePresentation(snapshot, motions?, { designation })
//   SceneState.targetFrame { title, subtitle?, rows[{ id, label, value, progress?, muted? }] }
//
// **판정 방식** — 문구를 모르므로 **차이로** 잰다 (c027 의 규율 그대로): 같은 봉투에서 기회 하나만
// 붙였다 뗐다 하며 두 판을 세우고, 판의 글이 달라졌는가 · 줄의 id 가 사라졌는가 · 줄의 상대 차례가
// 뒤집혔는가 · **판 밖(세계 위)이 달라졌는가**로 판정한다. 개수는 단언하지 않는다.
//
// 봉투는 기존 fixture 를 **읽기만** 한다 (out-of-range.fixture.json — 원천 하나와 그것을 겨냥한
// harvest-source 하나가 이미 서 있는 자리). 세계는 기동하지 않는다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { resolvePresentation } from '../resolve';
import { codeText } from '../code-text';
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
// C037 CHANGED — 봉투의 기회가 `event` · `open` 을 함께 싣는다 (관찰 계약 2.1). 이 파일이 재는
// 것은 **C036 의 경계**이므로 여기 서는 기회는 전부 때가 없고(event: false) 열려 있다(open: true) —
// 그 값에서 판의 줄이 C036 과 한 값도 다르지 않아야 한다는 것이 C037 SPEC-004 경계의 회귀다
type Opportunity = { id: string; discovery: string; event: boolean; open: boolean };
/** 때가 없는 기회 하나 — 이 파일의 모든 기회가 이것이다 */
const opportunityOf = (id: string, discovery: string): Opportunity => ({
  id,
  discovery,
  event: false,
  open: true,
});
type SeenInteraction = InteractionView & { opportunity?: Opportunity };

/** spec 이 못 박은 discovery 셋 (이 Cycle 의 데이터에 HIDDEN 은 없다 · SPEC-001 경계 ②) */
const VISIBLE = 'VISIBLE';
const SIGNAL = 'SIGNAL';
const TRACE = 'TRACE';
const THREE = [VISIBLE, SIGNAL, TRACE] as const;

/** fixture 가 이미 세워 둔 자리 — 원천 하나와 그것을 겨냥한 채취 하나 */
const BASE = outOfRange as unknown as GameViewSnapshot;
const SOURCE_ID = 'MOLT_LITTER';
/** 그 채취의 거절 사유 — fixture 가 적은 값이다 (C027 · C028 의 문구가 이 코드에서 온다) */
const REASON = 'out-of-range';
/** 문 하나를 더 세운다 — 건너기의 줄도 기회에서 오는가를 보는 자리 (spec Observable 2) */
const GATE_ID = 'c036-test:gate';

/** 그 봉투에 기회 하나를 붙인 사본 — 다른 자리는 한 글자도 건드리지 않는다 */
function withOpportunity(targetEntityId: string, opportunity?: Opportunity): GameViewSnapshot {
  const copy = JSON.parse(JSON.stringify(BASE)) as GameViewSnapshot;
  copy.interactions = (copy.interactions as SeenInteraction[]).map((one) =>
    one.targetEntityId === targetEntityId && opportunity ? { ...one, opportunity } : one,
  );
  return copy;
}

/** 문 하나와 그것을 겨냥한 건너기를 더한 봉투 */
function withGate(opportunity?: Opportunity): GameViewSnapshot {
  const copy = JSON.parse(JSON.stringify(BASE)) as GameViewSnapshot;
  copy.entities = [
    ...copy.entities,
    {
      id: GATE_ID,
      role: 'region-exit',
      state: 'open',
      kind: 'road',
      position: { x: -6, z: 4 },
    } as GameViewSnapshot['entities'][number],
  ];
  const transit: SeenInteraction = {
    id: 'transit',
    role: 'transit-connector',
    targetEntityId: GATE_ID,
    available: true,
    ...(opportunity ? { opportunity } : {}),
  };
  copy.interactions = [...(copy.interactions as SeenInteraction[]), transit];
  return copy;
}

type Designation = { entityId: string } | { ground: { x: number; z: number } };
const resolveWith = (snapshot: GameViewSnapshot, designation?: Designation): Scene =>
  resolvePresentation(snapshot, undefined, {
    ...(designation ? { designation } : {}),
  } as Parameters<typeof resolvePresentation>[2]) as Scene;

const point = (snapshot: GameViewSnapshot, entityId: string): Scene => resolveWith(snapshot, { entityId });
const look = (snapshot: GameViewSnapshot): Scene => resolveWith(snapshot);

function frameOf(scene: Scene): TargetFrame {
  const frame = scene.targetFrame;
  if (!frame) throw new Error('판(targetFrame)이 서지 않았다');
  return frame;
}
const rowIds = (scene: Scene): string[] => frameOf(scene).rows.map((row) => row.id);
/** 판 전체의 글 — 제목 · 부제 · 줄의 label 과 value 를 이어 붙인다 */
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

/** 그 봉투의 화면 — 기회를 붙인 것과 붙이지 않은 것 */
const bare = () => point(BASE, SOURCE_ID);
const carrying = (discovery: string) =>
  point(withOpportunity(SOURCE_ID, opportunityOf(`gather:${SOURCE_ID}`, discovery)), SOURCE_ID);

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-005 판이 discovery 를 말한다', () => {
  it('S-336 기회가 붙으면 판에 한 마디가 는다 — 기존 줄은 하나도 사라지지 않는다', () => {
    // Given 같은 봉투 · 같은 지목. 다른 것은 그 행동에 기회 이름이 실렸는가 하나뿐이다
    const before = bare();
    const after = carrying(TRACE);
    // Then 판의 글이 달라졌다 — 한 마디가 붙었다
    expect(frameText(after)).not.toBe(frameText(before));
    // And 있던 줄은 하나도 사라지지 않았다 (붙는 것이지 갈아 끼우는 것이 아니다)
    for (const id of rowIds(before)) {
      expect({ row: id, kept: rowIds(after).includes(id) }).toEqual({ row: id, kept: true });
    }
  });

  it('S-337 discovery 셋이 서로 다른 말이 된다 — 보이는 것 · 흔적이 말하는 것 · 신호로 오는 것', () => {
    const texts = THREE.map((discovery) => ({ discovery, text: frameText(carrying(discovery)) }));
    for (const one of texts) {
      // 셋 다 기회가 없을 때와 다르다
      expect({ discovery: one.discovery, said: one.text !== frameText(bare()) }).toEqual({
        discovery: one.discovery,
        said: true,
      });
      // 그리고 코드 글자 그대로가 판에 서지는 않는다 — 문구는 View 의 표가 짓는다
      expect({ discovery: one.discovery, raw: one.text.includes(one.discovery) }).toEqual({
        discovery: one.discovery,
        raw: false,
      });
    }
    // 셋이 서로 다르다 — 갈려 읽힌다
    expect(new Set(texts.map((t) => t.text)).size).toBe(THREE.length);
  });

  it('S-338 (경계 ①) 거절 사유의 문구도 줄의 차례도 그대로다 — 형식 · 순서 · 사유는 C027 · C028 그대로', () => {
    const before = bare();
    const reasonText = codeText(REASON);
    expect(frameText(before)).toContain(reasonText);
    for (const discovery of THREE) {
      const after = carrying(discovery);
      // 거절 사유의 문구가 그대로 있다
      expect({ discovery, said: frameText(after).includes(reasonText) }).toEqual({ discovery, said: true });
      // 있던 줄의 **상대 차례**가 그대로다 (새 줄이 끼어들어도 앞뒤가 뒤집히지 않는다)
      expect({ discovery, order: rowIds(after).filter((id) => rowIds(before).includes(id)) }).toEqual({
        discovery,
        order: rowIds(before),
      });
    }
  });

  it('S-339 (경계 ②) discovery 는 무엇을 할 수 있는가를 바꾸지 않는다 — 판정은 규칙의 것이다', () => {
    const before = bare();
    for (const discovery of THREE) {
      const after = carrying(discovery);
      expect({ discovery, interactions: JSON.stringify(after.interactions) }).toEqual({
        discovery,
        interactions: JSON.stringify(before.interactions),
      });
    }
  });

  it('S-340 세계 위에 뜨는 글자는 늘지 않는다 — 판을 뺀 화면이 한 글자도 달라지지 않는다', () => {
    const before = bare();
    for (const discovery of THREE) {
      expect({ discovery, scene: withoutFrame(carrying(discovery)) }).toEqual({
        discovery,
        scene: withoutFrame(before),
      });
    }
    // 지목하지 않은 화면도 그대로다 — 판은 지목한 대상의 것만 말한다
    expect(JSON.stringify(look(withOpportunity(SOURCE_ID, opportunityOf(`gather:${SOURCE_ID}`, TRACE))))).toBe(
      JSON.stringify(look(BASE)),
    );
  });

  it('S-341 문(건너기)의 줄도 기회에서 온다 — VISIBLE 한 마디가 붙고 기회가 없는 줄은 지금 그대로다', () => {
    const plain = point(withGate(), GATE_ID);
    const locked = point(withGate(opportunityOf(`cross:${GATE_ID}`, VISIBLE)), GATE_ID);
    // Lock 이 걸린 문 — 한 마디가 붙는다
    expect(frameText(locked)).not.toBe(frameText(plain));
    for (const id of rowIds(plain)) {
      expect({ row: id, kept: rowIds(locked).includes(id) }).toEqual({ row: id, kept: true });
    }
    // 기회가 없는 줄은 지금 그대로다 — 같은 봉투에서 원천 쪽 판은 한 글자도 다르지 않다
    expect(frameText(point(withGate(), SOURCE_ID))).toBe(frameText(bare()));
  });
});
