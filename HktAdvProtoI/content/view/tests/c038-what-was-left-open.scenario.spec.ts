// C038 — 열려 있던 것을 닫는다 · 판 쪽 **시나리오** 검증 (spec Reuse 「View · 없음」 · 기본형 ⑤) — T 몫
//
// 이 Cycle 은 판에 새 글자를 세우지 않는다. 판에서 일어나는 일은 **지움** 하나다 —
// 세계가 HIDDEN 인 기회의 이름을 싣지 않게 되었으므로 `discovery-hidden` 은 **닿지 않는 말**이
// 되었고, 닿지 않는 말은 표에 두지 않는다 (기본형 ⑤).
//
// 그래서 여기서 재는 것은 둘이다:
//   ① 지움이 **남은 셋을 건드리지 않았는가** — VISIBLE · SIGNAL · TRACE 는 저마다 판에 말을 남기고
//      서로 갈린다 (회귀)
//   ② 지워진 말이 **정말 닿지 않는가** — 세계가 결코 내지 않는 봉투(HIDDEN 을 실은 것)를 억지로
//      지어 주어도 판은 그 말로 새 마디를 짓지 않는다
//
// 이 파일은 이 Cycle 이 새로 쓴 코드를 **읽지 않고** 쓴다 (c026 · c027 · c036 · c037 의 선례).
// 아는 것은 계약뿐이다:
//
//   InteractionView.opportunity?  { id, discovery, event, open }   — C037 2.1 의 관찰 계약
//   resolvePresentation(snapshot, motions?, { designation })
//   SceneState.targetFrame { title, subtitle?, rows[{ id, label, value, progress?, muted? }] }
//
// **판정 방식** — 문구를 모르므로 **차이로** 잰다 (c027 · c036 · c037 의 규율 그대로). 개수는 세지
// 않는다. 봉투는 기존 fixture 를 **읽기만** 한다 (out-of-range.fixture.json).

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

/** discovery 넷 — C036 World Change 1. 세계가 싣는 것은 이제 앞 셋뿐이다 */
const SHOWN = ['VISIBLE', 'SIGNAL', 'TRACE'] as const;
const HIDDEN = 'HIDDEN';
/** 표에서 지운 의미 코드 — spec 기본형 ⑤ 가 글자로 적은 그대로 */
const HIDDEN_CODE = 'discovery-hidden';
/** 의미 코드의 자리 — 사람 말이 붙지 않은 코드는 이 꼴로 남는다 */
const CODE_MARK = 'discovery-';
/** fixture 가 이미 세워 둔 자리 — 원천 하나와 그것을 겨냥한 채취 하나 */
const BASE = outOfRange as unknown as GameViewSnapshot;
const SOURCE_ID = 'MOLT_LITTER';
const OPPORTUNITY_ID = `gather:${SOURCE_ID}`;

/** 그 봉투의 채취에 기회 하나를 붙인 사본 — 다른 자리는 한 글자도 건드리지 않는다 (c037 그대로) */
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
/** 판 전체의 글 — 제목 · 부제 · 줄의 label 과 value 를 이어 붙인다 (c036 · c037 의 자 그대로) */
const frameText = (scene: Scene): string => {
  const frame = frameOf(scene);
  return [
    frame.title ?? '',
    frame.subtitle ?? '',
    ...frame.rows.flatMap((r) => [String(r.label ?? ''), String(r.value ?? '')]),
  ].join('␟');
};
/** 판을 뺀 화면 전부 — "세계 위에 뜨는 글자는 늘지 않는다" 를 재는 자 (c037 그대로) */
const withoutFrame = (scene: Scene): string =>
  JSON.stringify({ ...(scene as unknown as Record<string, unknown>), targetFrame: undefined });
/** 그 코드 글자와 그 앞의 이음표를 걷어낸 글 — 남는 것이 사람 말이다 */
const stripCode = (text: string, code: string): string =>
  text.replace(new RegExp(`\\s*·?\\s*${code}`, 'g'), '');
/** 두 판의 글에서 **달라진 마디들** — 한쪽에만 있는 조각을 모은다 */
const addedParts = (before: Scene, after: Scene): string[] => {
  const had = new Set(frameText(before).split('␟'));
  return frameText(after)
    .split('␟')
    .filter((part) => part.length > 0 && !had.has(part));
};

const carrying = (discovery: string): Scene =>
  point(withOpportunity({ id: OPPORTUNITY_ID, discovery, event: false, open: true }));
/** 기회를 하나도 붙이지 않은 판 — 지워진 말이 무엇에도 닿지 않는가를 견주는 바닥이다 */
const bare = (): Scene => point(withOpportunity());

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-001 판에서 지워진 말 — 남은 셋은 그대로다', () => {
  it('S-691 VISIBLE · SIGNAL · TRACE 는 저마다 판에 말을 남기고 서로 갈린다', () => {
    const said = new Map<string, string>();
    for (const kind of SHOWN) {
      const scene = carrying(kind);
      // 기회가 붙으면 판의 글이 달라진다 — 그 마디가 곧 discovery 의 말이다
      expect({ kind, changed: frameText(scene) !== frameText(bare()) }).toEqual({ kind, changed: true });
      expect({ kind, added: addedParts(bare(), scene).length > 0 }).toEqual({ kind, added: true });
      // 그 마디는 **사람 말**이다 — 코드가 그대로 새어 나오지 않는다 (셋의 문구는 표에 남아 있다)
      for (const part of addedParts(bare(), scene)) {
        expect({ kind, part, raw: part.includes(CODE_MARK) }).toEqual({ kind, part, raw: false });
      }
      said.set(kind, frameText(scene));
    }
    // 셋이 서로 다른 말을 한다 — 하나로 뭉뚱그려지지 않았다
    expect({ kinds: new Set(said.values()).size }).toEqual({ kinds: SHOWN.length });
  });

  it('S-692 지워진 말은 닿지 않는다 — HIDDEN 에 붙는 사람 말이 판에 하나도 없다', () => {
    // 세계는 이제 이런 봉투를 내지 않는다 (C038 SPEC-001). 그래도 판이 그 말을 쥐고 있는지 잰다.
    //
    // spec 이 침묵한 자리 — 표에서 지운 코드를 판이 **무엇으로** 대신하는지는 정해지지 않았다.
    // 그래서 문구가 아니라 **사람 말이 붙었는가**로 잰다: 코드 글자를 걷어내면 기회 없는 판과
    // 한 글자도 다르지 않아야 한다 (지워진 말에는 대신할 사람 말이 없다는 뜻이다).
    const hidden = carrying(HIDDEN);
    expect(stripCode(frameText(hidden), HIDDEN_CODE)).toBe(frameText(bare()));
    // 그리고 그것이 남은 셋의 말 가운데 어느 것으로도 둔갑하지 않는다
    for (const kind of SHOWN) {
      for (const part of addedParts(bare(), carrying(kind))) {
        expect({ kind, part, said: frameText(hidden).includes(part) }).toEqual({ kind, part, said: false });
      }
    }
  });

  it('S-693 (경계) 세계 위에 뜨는 글자는 discovery 넷 어느 것에도 달라지지 않는다', () => {
    const plain = withoutFrame(bare());
    for (const kind of [...SHOWN, HIDDEN]) {
      expect({ kind, screen: withoutFrame(carrying(kind)) }).toEqual({ kind, screen: plain });
    }
  });
});
