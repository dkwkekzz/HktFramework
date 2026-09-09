// Target Frame Presentation — 지목한 것이 서는 **판의 결정 표** (C026 ADDED · C027 CHANGED).
//
// 사실을 만드는 것은 place-reading(자리)과 being-reading(존재)이고, 여기는 그 사실을
// **어떤 순서로 · 무슨 이름으로 · 무슨 색으로** 세울지만 정한다. 순서와 이름은 아래
// 표(PLACE_ROW_LABELS · BEING_ROW_LABELS)의 것이고 코드 분기가 아니다 — 줄이 늘면 표에
// 한 줄이 는다.
//
// 자리의 차례는 Play §5.4 의 것 그대로다:
//   어디인가(방 · 깊이) → 땅이 어떤가(표면 · 통행 · 사유) → 무엇이 걸렸나(area · 통로) →
//   규칙이 있나(패턴 · 압력) → 방이 지금 어떤가(소란 · 위상)
// 마지막 하나가 C017 이 더한 것이다 — 앞의 넷이 "여기가 무엇인가" 라면 그것은 "이 방이
// 지금 어떤가" 이고, 그래서 방의 값들 가장 뒤에 선다.
// 존재의 차례는 같은 어법의 것이다 (C027 UNRESOLVED "존재 줄의 차례"):
//   무엇인가(종류 · 재료 · 그 재료의 성질) → 어떤 상태인가(하는 일 · 생명 · 쓰러짐 · 걸린 것) →
//   무엇을 주는가(행동과 사유)
// 재료 둘이 **무엇인가 쪽**에 붙는 것은 그것이 "그 존재가 무엇인가" 의 답이기 때문이다
// (C029 R5) — 지금 어떤가도 나에게 무엇을 주는가도 아니다.
// **없는 것은 줄 자체가 없다.** 규칙 없는 방의 압력도, 생명 없는 것의 생명도 0 으로
// 지어내지 않는다 (SPEC-004 · C027 SPEC-002 경계).
//
// 그리고 이 판은 **지목이 없어도 선다** (C027 R3) — 그때의 대상은 내 몸이 선 자리다.

import type {
  SceneFrameRow,
  SceneHighlight,
  SceneTargetFrame,
} from '../../engine/view-kernel/scene/scene-state';
import type {
  GameViewPosition,
  GameViewSnapshot,
  RegionMemoryView,
  SourceMemoryView,
} from '../protocol/gameview';
import { agoText } from './answer-log';
import { readBeing, type BeingOffer, type BeingReading } from './being-reading';
import { codeText, discoveryCode } from './code-text';
import { lifeSiteStateCode } from './life-reading';
import { SETTLEMENT_LAYER } from './biome-rules';
import { materialSeed, propertyPhraseCode, TRACE_LAYER } from '../regions/index';
import { interactionPresentation } from './interaction-presentation';
import { CELL_LAYER, exitHint, passageName, regionName, regionRuleHint } from './region-presentation';
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
  // 흔적 (C011) — 지면에는 글자가 없으므로 이 자리가 흔적이 말이 되는 유일한 곳이다.
  // 이름표는 **무엇을 본 것인지**만 말하고, 짙기는 값(code-text 의 그 단계 줄)이 말한다.
  //
  // C020 CHANGED — 이름표가 '흙' 에서 '흔적' 이 되었다. 흔적의 어휘가 둘이 되었기 때문이다:
  // 숲은 흙이 물드는 것으로, 협곡은 숨이 어는 것으로 같은 것을 말한다. 이름표가 '흙' 이면
  // 협곡에서 「흙: 숨이 눈앞에서 얼어 머문다」가 되어 이름표와 값이 서로 다른 말을 한다.
  // 이름표는 **무엇을 본 것인지** 이므로 두 어휘가 함께 설 수 있는 말이어야 한다 —
  // 무엇으로 읽히는지는 값이 말한다 (그것이 이 표의 규율이다).
  'place.trace': '흔적',
  'place.passage': '통로',
  // 규칙이 있나 — 어떤 규칙인지가 먼저 선다 (RuleBoundRoom 실주행 판정: 규칙이 느껴져야 한다)
  'place.rule': '규칙',
  'place.pattern': '지금 길',
  'place.pressure': '압력',
  // 방이 지금 어떤가 (C017) — 압력이 규칙을 품은 방만의 값인 것과 달리 **어느 방에나 있다**.
  // 이름표가 '압력' 과 갈리는 것은 두 값이 나란히 선 두 값이기 때문이다 (spec R9):
  // 걸음이 올리는 것은 압력이고 캐고 때리고 건너는 것이 올리는 것은 소란이다
  'place.disturbance': '소란',
  // 그 방의 지금 위상 — 값이 없는 줄이 아니라 잠듦/깨어남 한 마디가 값이다
  'place.phase': '지금',
  // 여기 무슨 일이 있었나 (C034) — **위의 둘 뒤 · 아래의 '지나는 것' 앞**에 선다.
  // 앞의 것들(어디인가 · 땅 · 걸린 것 · 규칙 · 소란 · 지금)이 전부 **지금**이라면 이 줄
  // 하나만이 **지나간 일**이고, 뒤의 것들(지나는 것 · 서 있는 것)은 다시 지금이다.
  // 그 사이가 이 줄의 자리다 — 방의 값들이 끝나는 자리이자 순간의 사실이 시작되기 전이다.
  //
  // 이름표가 소란·지금과 갈리는 것은 물음이 다르기 때문이다: 저 둘은 "이 방이 지금
  // 어떤가" 이고 이것은 "이 방에 무엇이 있었나" 다. **한 번도 없던 것은 서지 않고**,
  // 셋(뒤척임 · 깨어남 · 지나감)이 다 없으면 줄 자체가 없다 (spec SPEC-006 경계 ①)
  'place.memory': '기억',
  // 무엇이 지나는가 (C018) — 위의 둘과 갈리는 자리다. 소란도 위상도 **어느 방에나 늘**
  // 있는 값이라 줄이 늘 서지만, 이 줄은 지나가고 있을 때만 선다 (지나는 것이 없으면
  // 줄 자체가 없다 — 없는 것을 지어내지 않는다).
  // 이름표가 무엇이 지나는지도 어디로 가는지도 묻지 않는 것은 세계가 그것을 싣지 않기
  // 때문이다 (Time T8) — 관찰된 사실은 "지금 여기를 이것이 지난다" 하나뿐이다
  'place.presence': '지나는 것',
  // 무엇이 **서 있는가** (C023) — 바로 위 줄과 **같은 자리에서 온다**(presences). 세계가
  // 그 둘을 가르는 것은 실린 것이 선(curve)인가 자락(area)인가 하나뿐이고, 그것이 곧
  // "지나간다" 와 "여기 산다" 의 갈림이다. 이름표를 갈라 두는 것은 그래서다 — 도는 떼를
  // '지나는 것' 이라 부르면 관찰자가 곧 지나갈 것으로 읽는다.
  // **몇인지는 없다** (spec SPEC-005 경계 ① — 개체군의 값도 상한도 실리지 않는다)
  'place.swarm': '서 있는 것',
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
  // 그것이 무엇으로 되어 있는가 (C029 ADDED — C011 이 남긴 부채를 갚는 자리다).
  // 이름표 둘은 spec 이 부르는 말 그대로다("판이 재료의 이름과 성질을 말한다") — 새로
  // 짓지 않는다. 종류(자연 형태)와 재료가 갈리는 것은 세계가 그 둘을 따로 싣기 때문이고
  // (kind = 무엇처럼 생겼는가 · material = 무엇인가), 한 줄로 합치면 같은 Seed 가 자리마다
  // 다른 형태로 난다는 사실이 화면에서 사라진다.
  //
  // **쓰임은 여기에도 어디에도 없다** (spec SPEC-005 경계 ③ · S10) — 무엇으로 만드는지
  // 이 층은 말하지 않는다.
  'being.material': '재료',
  // 그 재료의 성질 문장들 — 태그가 아니라 **문장**이 선다 (spec Observable "투영하지
  // 않는다": Seed 의 성질 태그 그 자체는 화면에 없다). 같은 태그라도 재료마다 말이 다르다
  'being.property': '성질',
  // 어떤 상태인가
  'being.state': '하는 일',
  'being.vitality': '생명',
  'being.downed': '쓰러짐',
  // 그 존재에 지금 걸린 것 (C012) — 자리의 '걸린 것'(place.settlement)과 **같은 말**이다.
  // 걸린 것이 자리에 걸리든 존재에 걸리든 관찰자에게는 같은 종류의 사실이므로 다른 말을
  // 짓지 않는다 (쓰러짐 줄이 기존 문구를 그대로 쓴 것과 같은 규율)
  'being.condition': '걸린 것',
  // 잠긴 문이 **무엇에 열리는가**의 갈래 (RuleBoundRoom 실주행 판정 — 힌트가 있어야 플레이가 된다)
  'being.hint': '힌트',
  // 거기 무슨 일이 있었나 (C034) — **"어떤 상태인가" 의 마지막 줄**이다: 하는 일 · 생명 ·
  // 걸린 것이 **지금** 그것이 어떤가라면 이것은 **지나간 일**이고, 둘 다 "무엇인가"(종류 ·
  // 재료)도 "무엇을 주는가"(행동)도 아니다. 그래서 상태 줄들의 뒤 · 행동 줄들의 앞이다.
  //
  // 자리의 「기억」(place.memory)과 **같은 이름표**인 것은 같은 종류의 사실이기 때문이다 —
  // 걸린 것이 자리에 걸리든 존재에 걸리든 같은 말을 쓰는 그 규율 그대로다.
  // **한 번도 캔 적 없는 원천에는 줄 자체가 없다** (spec SPEC-006 경계 ①)
  'being.memory': '기억',
  // 무엇을 주는가 — C036 부터 그 줄의 **값**이 한 마디 는다 (이름 · 사유 · 어떻게 알게
  // 되는가). 이름표는 그대로다: 늘어난 마디도 여전히 "내가 여기서 무엇을 할 수 있는가" 의
  // 일부이고, 갈래를 물어 줄을 가르면 판이 같은 물음에 두 번 답한다 (걸린 것의 그 규율)
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
    // C034 CHANGED — 존재의 판도 세계 시각을 받는다 (spec SPEC-006 경계 ②). 원천의 기억
    // 줄이 마지막 고갈이 얼마 전인지를 그 값으로 재기 때문이다. 자리의 판이 재배열의
    // 나이를 재는 것과 **같은 값 · 같은 함수**이고, 모르면 때를 지어내지 않는다
    return being ? beingFrame(being, worldTime) : standingFrame(snapshot, worldTime);
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
 * standingConditions** 로 세운다 (SPEC-005 경계 · C006 의 규율: 걸린 것은 세계가 판정한다).
 *
 * C016 — 그 자리에 **위험의 코드도 함께** 실린다 (R3). 이름표는 그대로 '걸린 것' 이다:
 * 안전한 이유와 위험한 이유는 "여기는 무엇인가" 한 물음의 두 얼굴이고, 자리를 가르면
 * 판이 같은 물음에 두 번 답한다. 화면은 여기서 갈래를 묻지 않는다 — 실려 온 코드를
 * 그대로 늘어놓을 뿐이고, 무엇이 안전이고 무엇이 위험인지는 그 말들이 스스로 말한다.
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
 *
 * 코드가 어느 갈래인지 여기서 가리지 않는다 (C016) — 안전의 것도 위험의 것도 같은 목록에
 * 실려 오고, 늘어놓는 차례는 세계가 실은 차례 그대로다. 걸러 내거나 다시 정렬하면 화면이
 * 세계가 하지 않은 판단을 하는 것이 된다.
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
function beingFrame(reading: BeingReading, worldTime: number | undefined): SceneTargetFrame {
  return { title: beingTitle(reading), rows: beingRows(reading, worldTime) };
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
 *
 * C034 CHANGED — 지금 세계 시각을 함께 받는다 (spec SPEC-006). 원천의 「기억」 줄이 마지막
 * 고갈이 얼마 전인지를 그 값으로 재기 때문이다. 모르면(넘기지 않으면) 때를 지어내지 않는다
 * — 자리의 판이 재배열의 나이를 다루는 것과 같은 규율이다.
 */
export function beingRows(reading: BeingReading, worldTime?: number): SceneFrameRow[] {
  const rows: SceneFrameRow[] = [];
  // ① 무엇인가 — **이름이 곧 종류인 것에는 이 줄이 없다.** 제목이 이미 그 말이고,
  // 같은 사실을 두 자리에 적지 않는다 (SPEC-006 의 어법)
  if (reading.name !== undefined && reading.kind !== undefined) {
    rows.push(row('being.kind', codeText(reading.kind)));
  }

  // 그것이 무엇으로 되어 있는가와 그 재료의 성질 (C029 R5 · SPEC-005).
  // **재료가 아닌 것(몸 · 출구 표식)에는 두 줄이 아예 없다** — 세계가 material 을 싣지
  // 않았으면 없는 채로 둔다 (없는 것을 빈 줄로 지어내지 않는 C027 의 어법 그대로).
  // 성질을 밝히지 않은 재료(고래 비늘)는 이름 줄까지만 선다
  const material = reading.material;
  if (material !== undefined) {
    rows.push(row('being.material', codeText(material)));
    const phrases = materialPhrases(material);
    if (phrases.length > 0) {
      // 겹치면 전부 잇는다 — '걸린 것' 줄과 같은 어법이다 (하나로 줄이면 그 재료가 무엇을
      // 하는 것인지가 화면에서 사라진다). 차례는 데이터가 적은 차례 그대로다
      rows.push(row('being.property', phrases.join(VALUE_SEPARATOR)));
    }
  }

  // ② 어떤 상태인가 — 지금 하는 일, 진행이 있으면 함께
  //
  // C022 CHANGED — **어느 말을 할지 형태(kind)가 함께 고른다** (핵심 원칙 2). 세계가 싣는
  // state 코드는 대상마다 같은 글자가 다른 것을 뜻할 수 있고(탄생지의 dormant 와 방의
  // 위상 dormant), 그 갈림은 세계의 것이 아니라 화면의 결정이다. 표에 없는 형태는 실려 온
  // 코드 그대로 지난다 — 사람도 원천도 출구 표식도 한 글자 달라지지 않는다
  rows.push({
    ...row('being.state', codeText(lifeSiteStateCode(reading.kind, reading.state))),
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

  // 지금 걸린 것 (C012 R6 · SPEC-007) — **걸린 것이 없으면 줄이 아예 없다.** 겹치면 전부
  // 잇는다: 자리의 '걸린 것' 이 겹친 조건을 하나로 줄이지 않는 것과 같은 어법이다
  // (하나로 줄이면 무엇이 걸렸는지가 화면에서 사라진다)
  const conditions = reading.conditions;
  if (conditions && conditions.length > 0) {
    rows.push(row('being.condition', conditions.map((c) => codeText(c)).join(VALUE_SEPARATOR)));
  }

  // 잠긴 문의 힌트 (RuleBoundRoom 실주행 판정) — **잠겨 있을 때만** 선다. 열린 문에는 할 말이 없고,
  // 표에 없는 문도 없다. 어느 갈래의 규칙이 이 문을 쥐고 있는지까지이지 답이 아니다
  if (reading.state === 'locked') {
    const hint = exitHint(reading.entityId);
    if (hint !== undefined) rows.push(row('being.hint', hint));
  }

  // 거기 무슨 일이 있었나 (C034 ADDED — spec SPEC-006 · Observable Result ① · ②).
  //
  // **상태 줄들의 마지막이다.** 앞의 것들(하는 일 · 생명 · 걸린 것)이 지금 그것이 어떤가라면
  // 이것은 지나간 일이고, 그래도 "무엇을 주는가"(행동)보다는 앞이다 — 행동은 나에게 무엇이
  // 가능한가이고 이것은 여전히 그 존재에 대한 사실이기 때문이다.
  //
  // **한 번도 캔 적 없는 원천에는 줄이 아예 없다** (봉투에 자리가 없다 — 생명 없는 것에
  // 0 을 지어내지 않는 그 규율). 몸에도 출구 표식에도 이 줄은 서지 않는다.
  const beingMemory = reading.memory === undefined ? undefined : sourceMemoryText(reading.memory, worldTime);
  if (beingMemory !== undefined) rows.push(row('being.memory', beingMemory));

  // ③ 무엇을 주는가 — 그 대상을 겨냥한 것만, 봉투의 차례 그대로 (SPEC-003)
  for (const offer of reading.offers) rows.push(offerRow(offer));
  return rows;
}

/**
 * 그 재료의 성질 문장들 (C029 R5 경계 ② · SPEC-005).
 *
 * 세계가 실어 온 것은 재료의 **코드 하나**뿐이고, 그 재료가 어떤 성질을 지녔는지는 표현이
 * 자기 content/regions 에서 얻는다 (C011 이 형태의 이름을 얻던 그 규율 그대로 — 세계는
 * 같은 사실을 두 번 싣지 않는다).
 *
 * 성질의 말은 **재료마다 다르다** — 태그는 문장의 색인일 뿐이므로(spec R5 경계 ②) 태그가
 * 아니라 `propertyPhraseCode(재료, 태그)` 가 가리키는 그 재료의 문장이 선다. 모르는 재료도
 * 성질을 밝히지 않은 재료도 빈 목록이고, 등록되지 않은 문장은 코드 그대로 뜬다.
 */
function materialPhrases(materialId: string): string[] {
  const seed = materialSeed(materialId);
  return (seed?.properties ?? []).map((property) =>
    codeText(propertyPhraseCode(materialId, property.tag)),
  );
}

/**
 * 그 원천이 겪은 일 한 줄의 말 (C034 ADDED — spec SPEC-006 · Observable Result ① · ②).
 *
 * 마디는 둘이다: **몇 번 캐였는가**와 **마지막 고갈이 얼마 전인가**. 마디를 ' · ' 로 잇는
 * 것은 겹친 조건과 재료의 성질이 잇는 그 어법 그대로다 (하나로 줄이면 무엇이 사실인지가
 * 화면에서 사라진다).
 *
 * **한 번도 없던 것은 마디가 서지 않는다** (SPEC-006 경계 ① — 0 을 말하지 않는다):
 * 한 번도 고갈된 적 없으면 뒤 마디가 없고, 둘 다 없으면 **줄 자체가 없다**(undefined).
 * 나이를 잴 수 없을 때(세계 시각을 모를 때)도 뒤 마디가 서지 않는다 — 판의 규칙 줄이
 * 재배열의 나이를 모르면 길 이름만 세우는 것과 같은 규율이다 (때를 지어내지 않는다).
 *
 * **몇 번 고갈되었는지는 적지 않는다** — spec 이 부른 값은 캐인 횟수와 마지막 고갈의
 * 나이 둘이고, 고갈의 셈은 그 마디가 서는가를 가를 뿐이다. **누가 캤는지도 없다.**
 */
function sourceMemoryText(memory: SourceMemoryView, worldTime: number | undefined): string | undefined {
  const marks: string[] = [];
  if (memory.takenTotal > 0) marks.push(codeText('memory.taken', String(memory.takenTotal)));
  // 고갈된 적이 있어야 그 나이를 묻는다 — 시각만 있고 셈이 0 인 일은 세계에 없지만,
  // 판이 묻는 것은 "고갈된 적이 있는가" 이므로 그 셈으로 묻는다
  const depleted = memory.depletedTimes > 0 ? agoText(memory.lastDepletedAt, worldTime) : undefined;
  if (depleted !== undefined) marks.push(codeText('memory.depleted-last', depleted));
  return marks.length > 0 ? marks.join(VALUE_SEPARATOR) : undefined;
}

/**
 * 그 방이 겪은 일 한 줄의 말 (C034 ADDED — spec SPEC-006 · Observable Result ④ · ⑤).
 *
 * 마디의 차례는 **뒤척임 → 깨어남 → 지나감**이다: 앞의 둘은 방 자체에 일어난 일이고
 * 지나감은 밖에서 든 것이며, 지나감만 여럿일 수 있어 뒤에 선다. 지나간 것들의 차례는
 * 봉투에 실려 온 차례 그대로다 (다시 정렬하면 화면이 세계가 하지 않은 정렬을 한다).
 *
 * **한 번도 없던 것은 마디가 서지 않고**, 셋 다 없으면 **줄 자체가 없다**(undefined) —
 * 처음 든 방마다 "뒤척임 0번 · 깨어남 0번" 이 서면 판이 길어지고, 판이 세로로 길면 몸을
 * 가린다 (SPEC-006 경계 ①).
 *
 * 지나감의 마디는 **여럿이어도 한 줄 안에 선다** — 지나는 것마다 줄이 따로 서는 '지나는
 * 것'(place.presence)과 갈리는 자리다. 저것은 지금 일어나고 있는 **사건 여럿**이지만
 * 이것은 "여기 무슨 일이 있었나" **한 사실의 여러 마디**이기 때문이다.
 *
 * **누가 했는지도, 언제 다시 지나는지도 없다** — 세계가 세지 않는다.
 */
function regionMemoryText(memory: RegionMemoryView, worldTime: number | undefined): string | undefined {
  const marks: string[] = [];
  if (memory.turns > 0) marks.push(codeText('memory.turns', String(memory.turns)));
  // 깨어남은 **셈만** 선다 — 마지막이 언제인지는 세계가 싣지만 Playable Goal 의 문장이
  // 셈까지이고, 한 줄에 담을 마디를 늘리지 않는다 (판이 몸을 가린다는 부채)
  if (memory.awakenings.times > 0) {
    marks.push(codeText('memory.awakenings', String(memory.awakenings.times)));
  }
  for (const passage of memory.passages) {
    if (passage.times <= 0) continue;
    // 지나는 것의 이름은 **이미 있는 표**의 것이다 (place.presence 줄이 부르는 그 말) —
    // 같은 것이 두 자리에서 다른 이름으로 불리면 둘 중 하나를 믿을 수 없다.
    // 이름과 셈 사이를 ' · ' 로 가르지 않는 것은 그 둘이 한 마디이기 때문이다
    const passed = `${codeText(passage.presence)} ${codeText('memory.passage', String(passage.times))}`;
    const last = agoText(passage.lastAt, worldTime);
    // 나이를 잴 수 없으면 그 마디가 없다 — 몇 번 지났는지는 그대로 선다 (때만 지어내지 않는다)
    marks.push(last === undefined ? passed : `${passed} ${codeText('memory.passage-last', last)}`);
  }
  return marks.length > 0 ? marks.join(VALUE_SEPARATOR) : undefined;
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
 *
 * C036 CHANGED — 그 행동이 어느 기회에 속하면 **어떻게 알게 되는가** 한 마디가 뒤에 붙는다
 * (spec SPEC-005). 앞의 것들은 한 글자도 달라지지 않는다: 이름이 먼저이고 못 하는 사유가
 * 그다음이며(C027 · C028 의 형식 · 순서 · 문구 그대로 — 경계 ①), 이 마디는 그 뒤에 같은
 * 구분자로 선다. 붙는 자리가 끝인 것은 앞의 둘이 **무엇을 할 수 있는가**이고 이것만이
 * **그것을 어떻게 아는가**이기 때문이다 — 판정과 섞이는 자리에 두면 discovery 가 사유의
 * 하나로 읽힌다 (경계 ②: discovery 는 무엇을 할 수 있는가를 바꾸지 않는다).
 *
 * **기회가 없는 줄은 지금 그대로다** — 이동에도 스킬에도 마디가 붙지 않는다. 기회의 id 도
 * 붙지 않는다: 그 글자는 코드의 자리이지 사람이 읽을 이름이 아니다 (spec 기본형 ⑥).
 */
function offerText(offer: BeingOffer): string {
  const name = interactionPresentation(offer.role).prompt ?? offer.role;
  const known =
    offer.available || offer.reason === undefined
      ? name
      : `${name}${VALUE_SEPARATOR}${codeText(offer.reason)}`;
  if (offer.discovery === undefined) return known;
  return `${known}${VALUE_SEPARATOR}${codeText(discoveryCode(offer.discovery))}`;
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
 *
 * C017 CHANGED — 마지막에 **소란과 그 방의 지금 위상** 두 줄이 선다 (spec Observable).
 * 압력 줄과 달리 방을 가리지 않는다 — 세계가 어느 방에나 싣는 값이기 때문이다.
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
      // 통로의 이름과 열림을 함께 적는다 (TODO §2 의 결정 — 통로도 이름을 적는다)
      rows.push(
        row(
          'place.passage',
          `${passageName(passage.tag)}${VALUE_SEPARATOR}${codeText(
            passage.open === null
              ? 'place.passage.unknown'
              : passage.open
                ? 'place.passage.open'
                : 'place.passage.closed',
          )}`,
        ),
      );
    }
  }

  // ④ 규칙이 있나 — 품지 않은 방에는 이 셋이 아예 없다 (SPEC-004 경계)
  const rule = reading.rule;
  if (rule) {
    // 어떤 규칙인지가 먼저다 (RuleBoundRoom 실주행 판정) — 표에 없는 방은 이 줄이 없다
    const hint = regionRuleHint(reading.regionId);
    if (hint !== undefined) rows.push(row('place.rule', hint));
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

  // ⑤ 방이 지금 어떤가 (C017 ADDED — spec Observable Result ① · ③).
  //
  // **압력 줄과 같은 형식이다** (값 / 임계 + 막대). 소란은 미로의 압력을 일반형으로 세운
  // 값이므로(spec R9 — 나란히 선 두 값), 같은 사실을 다른 형식으로 적으면 둘이 서로 다른
  // 종류의 값으로 읽힌다. 다른 것은 서는 자리뿐이다: 압력은 규칙을 품은 방에만 서지만
  // **소란은 모든 방에 선다** (기본형 ⑩ — 세계가 어느 방에나 싣는다).
  //
  // 위상은 그 아래 한 줄로 따로 선다. 값 뒤에 붙이지 않는 것은 그것이 같은 축의 값이
  // 아니기 때문이다 — 임계를 **넘은 것**과 **비운 것**이 다르므로(R3 · 기본형 ②) 얼마나
  // 찼는가만 보고는 지금 잠들었는지 깨어났는지 알 수 없다.
  //
  // **무엇이 이 방을 깨웠는지도, 임계까지 얼마 남았는지도 적지 않는다** — 세계가 싣지
  // 않는다 (spec Observable "싣지 않는다"). 여럿이 있었다는 것은 값으로 읽는 세계 사실이다.
  const disturbance = reading.disturbance;
  if (disturbance) {
    const ratio =
      disturbance.threshold > 0
        ? Math.min(1, Math.max(0, disturbance.value / disturbance.threshold))
        : undefined;
    rows.push({
      ...row('place.disturbance', `${Math.floor(disturbance.value)} / ${disturbance.threshold}`),
      ...(ratio === undefined ? {} : { progress: ratio }),
    });
    // 위상의 값 자체가 그 코드다 (기본형 ⑧) — 모르는 값은 코드 그대로 뜬다
    rows.push(row('place.phase', codeText(disturbance.phase)));
  }

  // ⑥ 여기 무슨 일이 있었나 (C034 ADDED — spec SPEC-006 · Observable Result ④ · ⑤).
  //
  // **소란 · 지금 뒤 · 지나는 것 앞**이다. 앞의 것들은 전부 "이 방이 지금 어떤가" 이고
  // 뒤의 것들도 "지금 무엇이 지나는가" 인데, 이 한 줄만이 **"여기 무슨 일이 있었나"** 다.
  // 지금들 사이에 끼우지 않고 그 경계에 세우는 것은 그래서다 — 방의 값들이 끝나는 자리다.
  //
  // 지목한 자리의 판에도 선다. 기억은 **방의 것**이므로(spec 기본형 ⑧) 그 방 어느 자리를
  // 물어도 같은 답이고, 자리 읽기를 두 벌로 만들지 않는 C026 의 규율이 그것을 그대로 지킨다.
  //
  // **한 번도 없던 것은 서지 않는다** — 셋(뒤척임 · 깨어남 · 지나감)이 다 0 이면 줄 자체가
  // 없고, 앞 Cycle 의 봉투에 자리가 없으면 없는 채로 둔다 (SPEC-006 경계 ①).
  const memory = reading.memory === undefined ? undefined : regionMemoryText(reading.memory, worldTime);
  if (memory !== undefined) rows.push(row('place.memory', memory));

  // ⑦ 무엇이 지나는가 (C018 ADDED — spec Observable Result ①).
  //
  // **가장 뒤에 선다.** 앞의 것들은 그 방이 늘 지니고 있는 값(어디인가 · 땅 · 걸린 것 ·
  // 규칙 · 소란)이고 이것만이 **지금 이 순간에만 있는 사실**이다 — 지나가면 이 줄이
  // 사라지고 판은 방금 전과 한 줄도 다르지 않게 된다.
  //
  // 여럿이 지나면 **여럿 다 선다** — 한 줄에 이어 붙이지 않는다. 걸린 조건 여럿이 한
  // 줄에 잇는 것과 갈리는 이유는 그쪽이 "이 자리가 무엇인가" 한 사실의 여러 얼굴인 반면
  // 이쪽은 서로 무관한 **사건 여럿**이기 때문이다 (존재의 '할 수 있는 것' 이 행동마다
  // 한 줄인 것과 같은 어법). id 도 그 어법 그대로 지나는 것의 것이다 — 하나가 지나가면
  // 그 줄만 사라진다.
  //
  // **어느 선을 지나는지는 적지 않는다** (봉투에 함께 오는 curve). 그것은 땅에 그려지는
  // 것이지 판이 읽어 줄 말이 아니다 — 뿌리 선의 자리를 판이 짚어 주지 않는 것과 같다.
  // 언제 다시 오는지도 어디로 가는지도 몇 번째인지도 없다 (세계가 싣지 않는다).
  for (const presence of reading.presences ?? []) {
    // C023 CHANGED — **선을 실은 줄만** 이 자리에 선다. 같은 목록에 서 있는 떼가 실리기
    // 시작했고(자락), 그것은 지나가는 것이 아니므로 아래의 제 줄이 진다
    if (presence.curve === undefined) continue;
    rows.push({
      ...row('place.presence', codeText(presence.presence)),
      id: `place.presence:${presence.presence}`,
    });
  }

  // ⑧ 무엇이 **서 있는가** (C023 ADDED — spec SPEC-006).
  //
  // **코드마다 한 줄이다.** 자락은 값만큼 여럿 실려 오지만(값이 오를수록 넓어진다) 여기서
  // 그 수만큼 줄을 세우면 판이 **개체군의 값을 세어 보여 주는 것**이 된다 — 세계가 싣지
  // 않기로 한 바로 그 값이다 (spec SPEC-005 경계 ① · "투영하지 않는 것"). 판이 답하는
  // 것은 "여기 이것이 산다" 하나이고, 얼마나 되는지는 땅에 겹친 자락이 눈으로만 말한다.
  //
  // 위의 줄들과 같은 어법이다 — 무엇을 먹는지도, 어디서 왔는지도, 언제 는지도 없다.
  const standing = new Set<string>();
  for (const presence of reading.presences ?? []) {
    if (presence.area === undefined || standing.has(presence.presence)) continue;
    standing.add(presence.presence);
    rows.push({
      ...row('place.swarm', codeText(presence.presence)),
      id: `place.swarm:${presence.presence}`,
    });
  }
  return rows;
}

function row(id: string, value: string): SceneFrameRow {
  return { id, label: ROW_LABELS[id] ?? id, value };
}
