// Target Frame Presentation — 지목한 것이 서는 **판의 결정 표** (C026 ADDED · C027 CHANGED).
//
// 사실을 만드는 것은 place-reading(자리)과 being-reading(존재)이고, 여기는 그 사실을
// **어떤 순서로 · 무슨 이름으로 · 무슨 색으로** 세울지만 정한다. 순서와 이름은 아래
// 표(PLACE_ROW_LABELS · BEING_ROW_LABELS)의 것이고 코드 분기가 아니다 — 줄이 늘면 표에
// 한 줄이 는다.
//
// 자리의 차례는 Play §5.4 의 것 그대로다:
//   어디인가(방 · 깊이) → 땅이 어떤가(표면 · 통행 · 사유) → 무엇이 걸렸나(area · 통로) →
//   규칙이 있나(패턴 · 압력)
// 존재의 차례는 같은 어법의 것이다 (C027 UNRESOLVED "존재 줄의 차례"):
//   무엇인가(종류) → 어떤 상태인가(하는 일 · 생명 · 쓰러짐) → 무엇을 주는가(행동과 사유)
// **없는 것은 줄 자체가 없다.** 규칙 없는 방의 압력도, 생명 없는 것의 생명도 0 으로
// 지어내지 않는다 (SPEC-004 · C027 SPEC-002 경계).
//
// 그리고 이 판은 **지목이 없어도 선다** (C027 R3) — 그때의 대상은 내 몸이 선 자리다.

import type {
  SceneFrameRow,
  SceneHighlight,
  SceneTargetFrame,
} from '../../engine/view-kernel/scene/scene-state';
import type { GameViewPosition, GameViewSnapshot } from '../protocol/gameview';
import { agoText } from './answer-log';
import { readBeing, type BeingOffer, type BeingReading } from './being-reading';
import { codeText } from './code-text';
import { SETTLEMENT_LAYER } from './biome-rules';
import { TRACE_LAYER } from '../regions/index';
import { interactionPresentation } from './interaction-presentation';
import { CELL_LAYER, regionName } from './region-presentation';
import type { Designation } from './pointer-rules';
import { readPlace, type PlaceAreas, type PlaceReading } from './place-reading';

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
  // 흙의 변색 (C011) — 지면에는 글자가 없으므로 이 자리가 흔적이 말이 되는 유일한 곳이다.
  // 이름표는 **무엇을 본 것인지**만 말하고, 짙기는 값(code-text 의 soil-stain:n)이 말한다
  'place.trace': '흙',
  'place.passage': '통로',
  // 규칙이 있나
  'place.pattern': '지금 길',
  'place.pressure': '압력',
};

/**
 * 존재 줄의 이름표 — id → 라벨 (C027 ADDED). PLACE_ROW_LABELS 와 **같은 어법의 표**이고,
 * 차례는 아래 beingRows 가 이 표를 읽는 차례다.
 *
 * `being.downed` 의 이름표는 쓰러짐 상태의 기존 문구(code-text 의 `downed`) 그대로다 —
 * 새 말을 짓지 않는다 (C027 UNRESOLVED "쓰러진 몸의 표기"). 그 줄은 값이 없다: 이름표가
 * 곧 사실이고, 값 없는 줄은 **자리를 차지한 채** 남는다 (SceneFrameRow.value 의 규약).
 */
export const BEING_ROW_LABELS: Readonly<Record<string, string>> = {
  // 무엇인가
  'being.kind': '종류',
  // 어떤 상태인가
  'being.state': '하는 일',
  'being.vitality': '생명',
  'being.downed': '쓰러짐',
  // 무엇을 주는가
  'being.offer': '할 수 있는 것',
};

/** 두 표를 합친 이름표 — 미등록 id 는 id 그대로 뜬다 (문구 누락이 판을 멈추지 않는다) */
const ROW_LABELS: Readonly<Record<string, string>> = {
  ...PLACE_ROW_LABELS,
  ...BEING_ROW_LABELS,
};

/** area layer → 그 줄의 id. 표에 없는 layer 는 줄이 서지 않는다 (모르는 것은 그리지 않는다) */
const AREA_LAYER_ROWS: Readonly<Record<string, string>> = {
  [SETTLEMENT_LAYER]: 'place.settlement',
  [CELL_LAYER]: 'place.cell',
  [TRACE_LAYER]: 'place.trace',
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

/**
 * 지목한 것 위의 표식 — 존재면 그 몸에, 자리면 그 좌표에 선다.
 *
 * C027 CHANGED — 지목한 몸이 **세계에서 사라졌으면 표식도 없다** (SPEC-004). 없는 몸에
 * 표식을 세우면 판은 내가 선 자리를 말하는데 세계에는 사라진 것의 자국이 남는다.
 */
export function designationHighlight(
  snapshot: GameViewSnapshot,
  designation: Designation,
): SceneHighlight | undefined {
  if (!('entityId' in designation)) {
    return { ground: designation.ground, ...DESIGNATION_HIGHLIGHT };
  }
  if (!snapshot.entities.some((e) => e.id === designation.entityId)) return undefined;
  return { entityId: designation.entityId, ...DESIGNATION_HIGHLIGHT };
}

/**
 * 판에 서는 것 — 존재든 자리든 내 발밑이든 **답은 늘 이 한 자리에 온다** (C027 CHANGED).
 *
 * 지목이 없으면 대상은 내 몸이 선 자리다 (R3 · SPEC-005). 지목한 몸이 세계에서 사라졌을
 * 때도 같은 자리로 돌아간다 — 없는 몸을 판에 세우지 않는다 (SPEC-004 경계).
 * 판 자체가 없는 경우는 하나뿐이다: **내 몸이 어디 있는지도 모를 때**.
 *
 * C028 CHANGED — 지금 세계 시각을 함께 받는다 (spec R5). 자리의 규칙 줄이 마지막 재배열이
 * 얼마 전인지를 그 값으로 재기 때문이다. 모르면(넘기지 않으면) 때를 지어내지 않는다.
 */
export function targetFrame(
  snapshot: GameViewSnapshot,
  designation: Designation | undefined,
  worldTime?: number,
): SceneTargetFrame | undefined {
  if (designation && 'entityId' in designation) {
    const being = readBeing(snapshot, designation.entityId);
    return being ? beingFrame(being) : standingFrame(snapshot, worldTime);
  }
  if (designation) return placeFrame(snapshot, designation.ground, worldTime);
  return standingFrame(snapshot, worldTime);
}

/** 지목한 자리의 판 (C026 그대로) — 자리에는 이름이 없으므로 좌표가 그 이름이다 */
function placeFrame(
  snapshot: GameViewSnapshot,
  point: GameViewPosition,
  worldTime: number | undefined,
): SceneTargetFrame {
  return {
    title: codeText('target.place'),
    subtitle: coordText(point),
    rows: placeRows(readPlace(snapshot, point), worldTime),
  };
}

/**
 * RULE-STANDING-READING-001 — 지목이 없으면 판은 **내 몸이 선 자리**를 진다 (spec R3 · SPEC-005).
 *
 * C026 의 자리 읽기를 **그대로** 쓴다 (두 벌로 만들지 않는다) — 그래서 줄들도 지목했을 때와
 * 같고, 내가 움직이면 따라 바뀐다. 다만 "걸린 것" 은 땅에서 유도하지 않고 **세계가 준
 * standingConditions** 로 세운다 (SPEC-005 경계 · C006 의 규율: 안전한 이유는 세계가 판정한다).
 */
function standingFrame(
  snapshot: GameViewSnapshot,
  worldTime: number | undefined,
): SceneTargetFrame | undefined {
  const self = snapshot.entities.find((e) => e.id === snapshot.observer.characterId);
  // 내 몸이 관찰 결과에 없다 — 어디에 서 있는지 모르므로 판이 없다 (지어내지 않는다)
  if (!self) return undefined;
  const reading = readPlace(snapshot, self.position);
  return {
    // 제목이 "지목한 자리" 가 아니어야 한다 — 아무도 지목하지 않았고, 이것은 내 발밑이다
    title: codeText('target.standing'),
    subtitle: coordText(self.position),
    rows: placeRows(standingReading(snapshot, reading), worldTime),
  };
}

/**
 * 내가 선 자리의 "걸린 것" 을 세계의 답으로 갈아 끼운다 (SPEC-005 경계).
 *
 * 땅에서 유도한 settlement 태그(도시 같은 결과까지 들어 있다) 대신 세계가 실어 온
 * standingConditions 를 쓴다. 자리의 차례는 건드리지 않는다 — 걸린 것은 여전히 그 자리다.
 */
function standingReading(snapshot: GameViewSnapshot, reading: PlaceReading): PlaceReading {
  const ground = reading.ground;
  // 땅이 없으면(모르는 방 · hash 어긋남) 걸린 것도 없다 — C026 의 규율 그대로다
  if (!ground) return reading;
  const conditions = snapshot.standingConditions ?? [];
  const areas: PlaceAreas[] = [
    ...(conditions.length > 0 ? [{ layer: SETTLEMENT_LAYER, tags: [...conditions] }] : []),
    ...ground.areas.filter((area) => area.layer !== SETTLEMENT_LAYER),
  ];
  return { ...reading, ground: { ...ground, areas } };
}

/** 지목한 존재의 판 — 제목은 사람이 읽을 이름이다 (SPEC-001) */
function beingFrame(reading: BeingReading): SceneTargetFrame {
  return { title: beingTitle(reading), rows: beingRows(reading) };
}

/**
 * 그 존재를 부르는 말 — 이름 → 종류 → 역할 → 코드 그대로 (spec R1 · SPEC-001 경계).
 *
 * 종류·역할의 말은 **이미 있는 문구 표**(code-text)에서 온다. 등록되지 않은 코드는 코드
 * 그대로 뜬다 — 지어내지 않는다 (C026 SPEC-005 와 같은 규율).
 */
function beingTitle(reading: BeingReading): string {
  if (reading.name !== undefined) return reading.name;
  if (reading.kind !== undefined) return codeText(reading.kind);
  if (reading.role !== '') return codeText(reading.role);
  return reading.entityId;
}

/**
 * 존재의 사실 → 판의 줄들. **차례가 곧 이 함수의 차례다**:
 * 무엇인가 → 어떤 상태인가 → 무엇을 주는가.
 */
export function beingRows(reading: BeingReading): SceneFrameRow[] {
  const rows: SceneFrameRow[] = [];
  // ① 무엇인가 — **이름이 곧 종류인 것에는 이 줄이 없다.** 제목이 이미 그 말이고,
  // 같은 사실을 두 자리에 적지 않는다 (SPEC-006 의 어법)
  if (reading.name !== undefined && reading.kind !== undefined) {
    rows.push(row('being.kind', codeText(reading.kind)));
  }

  // ② 어떤 상태인가 — 지금 하는 일, 진행이 있으면 함께
  rows.push({
    ...row('being.state', codeText(reading.state)),
    ...(reading.progress === undefined ? {} : { progress: reading.progress }),
  });

  const vitality = reading.vitality;
  // 생명을 갖지 않는 것(광맥 · 출구 표식)에는 이 줄이 **아예 없다** (SPEC-002 경계)
  if (vitality) {
    const ratio =
      vitality.healthMaximum > 0
        ? Math.min(1, Math.max(0, vitality.health / vitality.healthMaximum))
        : undefined;
    rows.push({
      // 몸 위 표지(nameplate)와 **같은 형식**이다 — 같은 값이 두 자리에서 다르게 적히면
      // 둘 중 하나를 믿을 수 없게 된다 (압력 줄이 HUD 와 같은 형식인 것과 같은 이유)
      ...row('being.vitality', `${Math.round(vitality.health)} / ${Math.round(vitality.healthMaximum)}`),
      ...(ratio === undefined ? {} : { progress: ratio }),
    });
    // 쓰러진 몸은 쓰러졌다는 것이 읽힌다 — 지목은 풀리지 않고 이 줄이 선다 (SPEC-004)
    if (vitality.downed) rows.push(row('being.downed', ''));
  }

  // ③ 무엇을 주는가 — 그 대상을 겨냥한 것만, 봉투의 차례 그대로 (SPEC-003)
  for (const offer of reading.offers) rows.push(offerRow(offer));
  return rows;
}

/**
 * 그 행동 하나의 줄. 이름표는 표의 것이고, **id 는 그 행동의 것**이다 —
 * 같은 대상에 행동이 둘이면 줄도 둘이고, 하나가 사라지면 그 줄만 사라진다.
 */
function offerRow(offer: BeingOffer): SceneFrameRow {
  return { ...row('being.offer', offerText(offer)), id: `being.offer:${offer.id}` };
}

/**
 * 그 행동 하나를 적는 말 — 걸 수 있으면 이름 그대로, 못 하면 **사유가 함께** (spec R2).
 *
 * 행동의 이름은 이미 있는 표(interaction-presentation)의 것이다. 이름이 없는 행동은 role
 * 코드 그대로 뜨고, 세계가 사유를 주지 않았으면 사유 없이 이름만 선다 (지어내지 않는다).
 */
function offerText(offer: BeingOffer): string {
  const name = interactionPresentation(offer.role).prompt ?? offer.role;
  if (offer.available || offer.reason === undefined) return name;
  return `${name}${VALUE_SEPARATOR}${codeText(offer.reason)}`;
}

/** 자리를 부르는 말은 좌표다 — 어느 칸인지가 갈리는 자릿수까지 */
function coordText(point: GameViewPosition): string {
  return `${point.x.toFixed(COORD_DIGITS)}, ${point.z.toFixed(COORD_DIGITS)}`;
}

/**
 * RULE-PLACE-READING-001 — 자리의 사실 → 판의 줄들 (C026 R2 · C028 R5 CHANGED).
 *
 * **차례가 곧 이 함수의 차례다** (Play §5.4). 값이 의미 코드면 codeText 로 옮기고,
 * 모르는 코드는 코드 그대로 남는다 (지어내지 않는다).
 *
 * C028 CHANGED — 규칙을 품은 방의 줄에 **마지막 재배열이 얼마 전인지**가 함께 실린다
 * (spec R5 · SPEC-007). 세계 시각을 모르거나 재배열이 한 번도 없었던 방에서는 그 값이
 * 서지 않는다 — 0 으로도 "방금" 으로도 지어내지 않는다 (SPEC-007 경계).
 */
export function placeRows(reading: PlaceReading, worldTime?: number): SceneFrameRow[] {
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
    // 지금 길과 **그 길이 언제부터인지**. 재배열의 나이는 기록 줄과 같은 함수(agoText)가
    // 적는다 — 같은 값이 두 자리에서 다르게 적히면 둘 중 하나를 믿을 수 없다 (압력 줄이
    // HUD 와 같은 형식인 것과 같은 이유). 잰 값이 없으면 길 이름만 선다
    const rearranged = agoText(rule.rearrangedAt, worldTime);
    rows.push(
      row(
        'place.pattern',
        rearranged === undefined
          ? codeText(rule.pattern)
          : `${codeText(rule.pattern)}${VALUE_SEPARATOR}${rearranged}`,
      ),
    );
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
  return { id, label: ROW_LABELS[id] ?? id, value };
}
