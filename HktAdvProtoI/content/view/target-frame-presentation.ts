// Target Frame Presentation — 지목한 것이 서는 **판의 결정 표** (C026 ADDED).
//
// 사실을 만드는 것은 place-reading 이고, 여기는 그 사실을 **어떤 순서로 · 무슨 이름으로 ·
// 무슨 색으로** 세울지만 정한다. 순서와 이름은 아래 표(PLACE_ROWS)의 것이고 코드 분기가
// 아니다 — 줄이 늘면 표에 한 줄이 는다.
//
// 줄의 차례는 Play §5.4 의 것 그대로다:
//   어디인가(방 · 깊이) → 땅이 어떤가(표면 · 통행 · 사유) → 무엇이 걸렸나(area · 통로) →
//   규칙이 있나(패턴 · 압력)
// **없는 것은 줄 자체가 없다.** 규칙 없는 방의 압력을 0 으로 지어내지 않는다 (SPEC-004 경계).

import type {
  SceneFrameRow,
  SceneHighlight,
  SceneTargetFrame,
} from '../../engine/view-kernel/scene/scene-state';
import type { GameViewSnapshot } from '../protocol/gameview';
import { codeText } from './code-text';
import { SETTLEMENT_LAYER } from './biome-rules';
import { CELL_LAYER, regionName } from './region-presentation';
import type { Designation } from './pointer-rules';
import { readPlace, type PlaceReading } from './place-reading';

/** 값이 여럿일 때 잇는 말 — 목록 구분자다 (region.safe-by 와 같은 어법: 하나로 줄이지 않는다) */
const VALUE_SEPARATOR = ' · ';

/** 좌표를 적는 자릿수 — 격자 칸이 1 이므로 소수 한 자리면 어느 칸인지가 갈린다 */
const COORD_DIGITS = 1;

/**
 * 줄의 이름표 — id → 라벨. **순서는 아래 buildPlaceRows 가 이 표를 읽는 차례다.**
 * hud-presentation 과 같은 어법이고, 미등록 id 는 없다 (전부 여기서 만든다).
 */
export const PLACE_ROW_LABELS: Readonly<Record<string, string>> = {
  // 어디인가
  'place.region': '방',
  'place.depth': '깊이',
  // 땅이 어떤가
  'place.surface': '땅',
  'place.passable': '통행',
  'place.blocked': '막는 것',
  // 세계와 다른 땅을 보고 있다 — 위의 셋과 아래의 area·통로를 **대신한다** (SPEC-005)
  'place.mismatch': '답할 수 없다',
  // 무엇이 걸렸나
  'place.settlement': '걸린 것',
  'place.cell': '구역',
  'place.passage': '통로',
  // 규칙이 있나
  'place.pattern': '지금 길',
  'place.pressure': '압력',
};

/** area layer → 그 줄의 id. 표에 없는 layer 는 줄이 서지 않는다 (모르는 것은 그리지 않는다) */
const AREA_LAYER_ROWS: Readonly<Record<string, string>> = {
  [SETTLEMENT_LAYER]: 'place.settlement',
  [CELL_LAYER]: 'place.cell',
};

/**
 * 지목 표식의 색 — **흰색이다** (spec UNRESOLVED "지목 표식의 색·모양").
 *
 * 지목은 세계의 것이 아니라 **관찰자의 것**이다 (세계는 누가 무엇을 지목했는지 모른다).
 * 그래서 세계의 어느 계열에도 속하지 않는 색이어야 한다 — 지면 넷(초록 · 갈색 · 무채색 ·
 * 청록)도, 구역 넷(청록 · 자홍 · 호박 · 상아)도, 출구 표식 일곱도 전부 유채색이거나 어둡다.
 * 무채색의 가장 밝은 끝 하나만 아무도 쓰지 않고 남아 있고, 그 자리가 여기다.
 *
 * 반지름 1.5 — 격자 칸(TERRAIN_RESOLUTION = 1)의 1.5 배다. 답이 나온 칸 하나를 덮고
 * 그 둘레가 조금 넘쳐 보이는 크기이며, 몸(3.4)보다는 작아 표식이 사람을 가리지 않는다.
 */
export const DESIGNATION_HIGHLIGHT = {
  color: 0xffffff,
  opacity: 0.9,
  radius: 1.5,
} as const;

/** 지목한 것 위의 표식 — 존재면 그 몸에, 자리면 그 좌표에 선다 */
export function designationHighlight(designation: Designation): SceneHighlight {
  return 'entityId' in designation
    ? { entityId: designation.entityId, ...DESIGNATION_HIGHLIGHT }
    : { ground: designation.ground, ...DESIGNATION_HIGHLIGHT };
}

/**
 * 지목한 것이 서는 판 — 없으면 없다 (SPEC-001 경계).
 *
 * 존재 지목은 이 Cycle 밖이다 (C027 — 그 대상이 무엇이고 무엇을 줄 수 있는지).
 * 그래서 지금은 **제목만** 세운다: 이름을 아는 것은 이미 봉투에 있고, 그 이상을 여기서
 * 지어내면 C027 이 할 말을 화면이 먼저 하게 된다.
 */
export function targetFrame(
  snapshot: GameViewSnapshot,
  designation: Designation,
): SceneTargetFrame {
  if ('entityId' in designation) {
    const entity = snapshot.entities.find((e) => e.id === designation.entityId);
    return { title: entity?.name ?? designation.entityId, rows: [] };
  }
  const point = designation.ground;
  return {
    title: codeText('target.place'),
    // 무엇을 지목했는지 — 자리에는 이름이 없으므로 좌표가 그 이름이다
    subtitle: `${point.x.toFixed(COORD_DIGITS)}, ${point.z.toFixed(COORD_DIGITS)}`,
    rows: placeRows(readPlace(snapshot, point)),
  };
}

/**
 * 자리의 사실 → 판의 줄들. **차례가 곧 이 함수의 차례다** (Play §5.4).
 * 값이 의미 코드면 codeText 로 옮기고, 모르는 코드는 코드 그대로 남는다 (지어내지 않는다).
 */
export function placeRows(reading: PlaceReading): SceneFrameRow[] {
  const rows: SceneFrameRow[] = [];
  // ① 어디인가 — 봉투의 것이다. 어긋남과 무관하게 언제나 선다
  rows.push(row('place.region', regionName(reading.regionId)));
  if (reading.depth !== undefined) rows.push(row('place.depth', codeText(reading.depth)));

  const g = reading.ground;
  if (reading.mismatched) {
    // ② ③ 을 대신하는 한 줄 — 땅에서 유도한 것을 답으로 내놓지 않는다 (SPEC-005)
    rows.push(row('place.mismatch', codeText('region.hash-mismatch')));
  } else if (g) {
    // ② 땅이 어떤가
    if (g.surface !== undefined) rows.push(row('place.surface', codeText(g.surface)));
    rows.push({
      ...row('place.passable', codeText(g.traversable ? 'place.passable' : 'place.impassable')),
      // 지날 수 있다는 것은 소식이 아니다 — 눈에 띄어야 하는 것은 **못 지나간다**는 쪽이다
      ...(g.traversable ? { muted: true } : {}),
    });
    if (g.blockedReason !== undefined) {
      rows.push(row('place.blocked', codeText(g.blockedReason)));
    }
    // ③ 무엇이 걸렸나 — 겹치면 전부 잇는다 (SPEC-003: 하나로 줄이지 않는다)
    for (const area of g.areas) {
      const id = AREA_LAYER_ROWS[area.layer];
      if (id) rows.push(row(id, area.tags.map((t) => codeText(t)).join(VALUE_SEPARATOR)));
    }
    for (const passage of g.passages) {
      rows.push(
        row(
          'place.passage',
          codeText(
            passage.open === null
              ? 'place.passage.unknown'
              : passage.open
                ? 'place.passage.open'
                : 'place.passage.closed',
          ),
        ),
      );
    }
  }

  // ④ 규칙이 있나 — 품지 않은 방에는 이 둘이 아예 없다 (SPEC-004 경계)
  const rule = reading.rule;
  if (rule) {
    rows.push(row('place.pattern', codeText(rule.pattern)));
    const ratio =
      rule.pressureLimit > 0
        ? Math.min(1, Math.max(0, rule.pressure / rule.pressureLimit))
        : undefined;
    rows.push({
      // 압력은 HUD 의 압력 줄과 **같은 형식**이다 (resolve 의 pressureHud) — 같은 값이
      // 두 자리에서 다르게 적히면 둘 중 하나를 믿을 수 없게 된다
      ...row('place.pressure', `${Math.floor(rule.pressure)} / ${rule.pressureLimit}`),
      ...(ratio === undefined ? {} : { progress: ratio }),
    });
  }
  return rows;
}

function row(id: string, value: string): SceneFrameRow {
  return { id, label: PLACE_ROW_LABELS[id] ?? id, value };
}
