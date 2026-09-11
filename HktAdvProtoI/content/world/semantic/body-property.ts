// World Semantic — **몸의 성질은 물음의 답이다** (C039 ADDED · L3-Subject-Body §4.2 · §6 · §7 · R2).
//
// 몸의 최대 HP · 최대 CP · 인지 범위는 지금까지 태어날 때 박히는 **닫힌 필드**였다. 이제 그
// 셋은 저장되지 않고 **묻는 것**이다 — 세계가 이름 하나를 건네면 그 몸에 걸린 Source 들이
// 각자의 몫(상한 · 더함 · 참거짓)으로 답하고, 합치는 산수는 기반
// (engine/world-authoring/property.ts)이 한다.
//
// **이 파일이 이 세계의 것을 소유한다** — 성질의 **이름** 셋 · 몸의 종류가 무엇을 거는가 ·
// 때와 자락이 인지에 무엇을 거는가. 기반은 그 이름의 뜻을 하나도 알지 못하고, 이름 하나로
// Source 들을 모아 몫 셋을 합칠 뿐이다 (spec 규칙 9 — 명사 0).
//
// 지키는 것 넷.
//   ① **아무것도 저장되지 않는다** — 답은 언제나 유도된다. 같은 몸 · 같은 Source · 같은 때면
//      언제나 같은 답이고, 되살린 세계도 같은 답을 낸다 (STATE_VERSION 이 오른 것은 사라진
//      자리 셋 때문이지 이 파일 때문이 아니다).
//   ② **없는 것과 모르는 것이 다르다** — 답할 Source 가 하나도 없는 성질은 「없음」이다.
//      「0」도 「거짓」도 아니다 (spec 규칙 2 ③).
//   ③ **표가 손잡이다** (spec 규칙 8) — 몸의 종류 표 · 때의 상한 표 · 자락의 상한 줄.
//      셋 다 인자로 갈아 끼울 수 있고 코드는 한 줄도 달라지지 않는다.
//   ④ **Source 의 차례는 언제나 같다** — 몸의 종류 → 몸에 걸린 것 → 때 → 자락.
//      합성의 답은 차례를 타지 않지만(상한은 최솟값 · 더함은 합) 목록을 읽는 쪽(도구 · 시험)이
//      두 번 물어 같은 차례를 보아야 한다 (결정론).

import {
  resolveProperty,
  type PropertyAnswer,
  type PropertySource,
} from '../../../engine/world-authoring/property';
import type { DayPhaseId, RegionPhase } from '../../regions';
import type { ActorState } from './actor';
import {
  CHARACTER_CATALOG,
  DEFAULT_CHARACTER,
  type CharacterDefinition,
} from './character-catalog';
import { dayPhaseAt } from './clock';
import type { WorldPosition } from './position';
import { passingOverlaysIn } from './presence';
import { hazardEffectsAt } from './region-phase';
import { depletedOverlaysIn } from './resource';
import type { WorldState } from './world-state';

// ── 이 세계가 지금 유도하는 성질의 이름 셋 (spec 기본형 ④) ────────────
//
// 원문 §4.2 의 예 가운데 지금 코드에 값이 있는 것이다. 이동 속도 · 무게처럼 이름을 더하는
// 것은 **데이터의 일**이고 (spec 규칙 9 ②), 더해도 이 파일의 물음 · 합성 · 검사는 한 줄도
// 달라지지 않는다.

/** 그 몸이 견디는 생명의 최대 — 몸의 종류가 「더함」으로 답한다 */
export const PROPERTY_MAX_HP = 'maxHp';
/** 그 몸이 담는 기력의 최대 — 몸의 종류가 「더함」으로 답한다 */
export const PROPERTY_MAX_CP = 'maxCp';
/** 그 몸이 무엇을 감지하는가 — 종류 · 때 · 자락이 「상한」으로 답한다 (작은 쪽이 이긴다) */
export const PROPERTY_AWARENESS = 'awareness';

/** 이 세계가 지금 유도하는 성질 이름 셋 — 더하는 것은 데이터다 (spec 규칙 9 ②) */
export const BODY_PROPERTY_NAMES: readonly string[] = [
  PROPERTY_MAX_HP,
  PROPERTY_MAX_CP,
  PROPERTY_AWARENESS,
];

// ── Source 의 출처 코드 넷 — **기계가 읽는 코드**다 (사람이 읽는 말이 아니다) ──
//
// 사람이 읽을 말(「몸의 종류가 준 것」)을 짓는 것은 도구와 화면의 몫이다 (원칙 2).

/** 몸의 종류가 걸었다 (character-catalog 의 그 항목) */
export const PROPERTY_ORIGIN_KIND = 'kind';
/** 그 몸에 걸려 있다 (ActorState.propertySources — 개체마다 다른 것) */
export const PROPERTY_ORIGIN_BODY = 'body';
/** 지금의 때가 걸었다 (TIME_AWARENESS_CAPS 의 줄) */
export const PROPERTY_ORIGIN_TIME = 'time';
/** 선 자리의 자락이 걸었다 (그 자락이 밝힌 observeRange) */
export const PROPERTY_ORIGIN_AREA = 'area';

/**
 * **때가 인지에 거는 상한** — 표 한 줄이 손잡이다 (spec 규칙 8 ②).
 *
 * 지금은 한 줄이다: 밤이면 20. 낮에는 줄이 없고, 줄이 없다는 것이 곧 「때는 아무것도 걸지
 * 않는다」다 (밝히지 않은 것을 무제한으로 지어내지 않는다 — 없는 줄은 Source 가 없는 것이다).
 *
 * **투영의 밤 관찰 범위(OBSERVE_RANGE_NIGHT)와 같은 수를 두 자리가 든다.** 까닭 —
 * 지금 밤에 잘리는 것은 **관찰**이고(무엇이 판에 실리는가 · RULE-OBSERVE-PROJECTION),
 * 여기 서는 것은 **몸의 인지**다(무엇을 감지하는가 · RULE-AWARENESS-001). 둘은 C040 에서
 * 하나가 된다 — 관찰이 몸의 인지 범위를 읽게 되는 것이 그 Cycle 의 일이고, 그때 저쪽 상수가
 * 이 줄로 옮겨 와 자리가 하나가 된다. 그때까지는 **두 자리가 같은 수를 든다**.
 */
export const TIME_AWARENESS_CAPS: readonly { dayPhase: DayPhaseId; cap: number }[] = [
  { dayPhase: 'NIGHT', cap: 20 },
];

/**
 * **인지에 상한 하나를 거는 Source** — 개체별 재정의가 몸에 걸리는 모양 (C039 ADDED).
 *
 * 몸을 만드는 자리(spawnActor)와 검증 손잡이가 같은 한 줄을 쓴다 — 두 벌로 적으면 어느 날
 * 몫의 갈래가 갈린다 (상한과 더함은 다른 산수다).
 */
export function awarenessCapSource(
  cap: number,
  origin: string = PROPERTY_ORIGIN_BODY,
): PropertySource {
  return { origin, property: PROPERTY_AWARENESS, share: { kind: 'cap', value: cap } };
}

/**
 * 성질이 읽는 표들 — **변형 데이터가 이 값을 갈아 끼운다** (코드 diff 0 · spec 규칙 8).
 *
 * 셋 다 이 세계의 **데이터**이고 규칙이 아니다: 몸의 종류마다의 기본값 · 때가 거는 상한 ·
 * 그 몸에 더 걸린 Source 들. 갈아 끼운 표로 물으면 같은 물음이 다른 답을 내고, 그것이
 * 「경험 값은 데이터가 돌린다」의 뜻이다.
 */
export interface BodyPropertyTables {
  /** 몸의 종류 표 — 기본은 CHARACTER_CATALOG */
  kinds: Readonly<Record<string, CharacterDefinition>>;
  /** 때가 인지에 거는 상한 — 기본은 TIME_AWARENESS_CAPS */
  timeAwarenessCaps: readonly { dayPhase: DayPhaseId; cap: number }[];
  /**
   * **자락이 인지에 거는 상한** — 없으면 자락은 아무것도 걸지 않는다 (spec 규칙 8 ② 뒷절).
   *
   * 때의 것이 「표의 줄들」이라면 이것은 **줄 하나**다: 자락이 거는 수는 그 자락이 밝힌
   * 값(hazardEffectsAt 의 observeRange)에서 오므로 수의 목록으로 적을 수 없고, 갈아 끼울 수
   * 있는 한 줄로 둔다. 언제나 `undefined` 를 내는 표로 갈면(=그 줄을 지우면) 어느 자락도
   * 감각을 걸지 않고, 그때 인지 범위는 종류와 때만이 정한다.
   */
  areaAwarenessCap: (state: WorldState, actor: ActorState) => number | undefined;
}

export const BODY_PROPERTY_TABLES: BodyPropertyTables = {
  kinds: CHARACTER_CATALOG,
  timeAwarenessCaps: TIME_AWARENESS_CAPS,
  areaAwarenessCap: (state, actor) => bodyHazardEffects(state, actor).observeRange,
};

/**
 * 그 몸이 선 자리의 **자락이 밝힌 것** — 인자 조립을 한 자리에 둔다 (C039 ADDED).
 *
 * 성질을 묻는 쪽(인지 범위의 자락 Source)과 투영(관찰 범위를 자르는 자리)이 **같은 함수**를
 * 부른다 — 두 벌로 적으면 어느 날 두 자리의 답이 갈린다. 자락을 거는 원인(소란 · 지나가는
 * 것 · 깨진 마디)을 여기서 새로 판정하는 것은 하나도 없고, 그것을 모으는 함수들을 그대로
 * 부를 뿐이다.
 *
 * `overlays` 를 받는 까닭 — **투영은 그것을 이미 한 번 얻어 두었다** (한 관찰 안에서 두 번
 * 물으면 답이 갈릴 수 있다는 그 규율). 주지 않으면 여기서 얻는다: 같은 State · 같은 시각이면
 * 같은 목록이므로 답은 한 값도 다르지 않다.
 *
 * 낮과 밤 중 어느 수를 읽을지는 **시계 하나**가 안다 — dayPhaseAt(state.time) 이고, 투영이
 * 읽는 worldClockAt(state.time).dayPhase 와 같은 함수의 같은 답이다.
 */
export function bodyHazardEffects(
  state: WorldState,
  body: { regionId: string; position: WorldPosition },
  overlays?: { passing: readonly RegionPhase[]; depleted: readonly RegionPhase[] },
): { observeRange?: number; contacts: string[] } {
  const passing = overlays?.passing ?? passingOverlaysIn(state.presences, body.regionId, state.time);
  const depleted = overlays?.depleted ?? depletedOverlaysIn(state, body.regionId);
  return hazardEffectsAt(
    body.regionId,
    body.position,
    state.time,
    state.regionStates[body.regionId]?.disturbance,
    passing,
    dayPhaseAt(state.time) !== 'DAY',
    depleted,
  );
}

/**
 * RULE-BODY-PROPERTY-001 (C039 ADDED · spec 규칙 2) — **그 몸에 걸린 Source 전부.**
 *
 * 차례는 언제나 같다 (지키는 것 ④).
 *   ① 몸의 종류   그 종류의 항목 — 생명 「더함」 · 기력 「더함」 · 인지 「상한」
 *   ② 몸에 걸린 것 ActorState.propertySources (개체별 재정의가 여기로 들어온다)
 *   ③ 때          지금 낮밤이 표의 줄과 맞으면 인지에 「상한」
 *   ④ 자락        선 자리를 덮은 위험 자락이 밝힌 관찰 범위가 있으면 인지에 「상한」 (표의 줄)
 *
 * **더 거는 자리를 따로 두지 않는다** — 변형 데이터가 그 몸에 Source 를 더 거는 길은 ② 하나다
 * (WorldSetup.actorSources → ActorState.propertySources · spec 규칙 2 ④).
 *
 * **저장되는 자리가 하나도 늘지 않는다** — 부를 때마다 다시 선다 (spec 규칙 2 ④).
 */
export function bodyPropertySources(
  state: WorldState,
  actor: ActorState,
  tables: BodyPropertyTables = BODY_PROPERTY_TABLES,
): PropertySource[] {
  const sources: PropertySource[] = [];

  // ① 몸의 종류 — 모르는 종류도 크기 · 자원 없이 서 있지 않게 한다 (characterDefinition 의 규율 그대로)
  const definition = tables.kinds[actor.characterKind] ?? DEFAULT_CHARACTER;
  sources.push({
    origin: PROPERTY_ORIGIN_KIND,
    property: PROPERTY_MAX_HP,
    share: { kind: 'add', value: definition.resources.hpMax },
  });
  sources.push({
    origin: PROPERTY_ORIGIN_KIND,
    property: PROPERTY_MAX_CP,
    share: { kind: 'add', value: definition.resources.cpMax },
  });
  sources.push({
    origin: PROPERTY_ORIGIN_KIND,
    property: PROPERTY_AWARENESS,
    share: { kind: 'cap', value: definition.perceptionRange },
  });

  // ② 몸에 걸린 것 — **원인의 자리**다 (최종값의 자리가 아니다 · R2)
  sources.push(...actor.propertySources);

  // ③ 때 — 표의 줄과 맞으면 건다. 맞는 줄이 없으면 때는 아무것도 걸지 않는다
  const dayPhase = dayPhaseAt(state.time);
  for (const row of tables.timeAwarenessCaps) {
    if (row.dayPhase !== dayPhase) continue;
    sources.push({
      origin: PROPERTY_ORIGIN_TIME,
      property: PROPERTY_AWARENESS,
      share: { kind: 'cap', value: row.cap },
    });
  }

  // ④ 자락 — 선 자리를 덮은 자락이 밝힌 관찰 범위 (밝히지 않은 자락은 아무것도 걸지 않는다).
  // 표의 줄 하나가 이것을 짓는다 — 그 줄을 지운 표로 물으면 자락은 아무것도 걸지 않는다
  const areaRange = tables.areaAwarenessCap(state, actor);
  if (areaRange !== undefined) {
    sources.push({
      origin: PROPERTY_ORIGIN_AREA,
      property: PROPERTY_AWARENESS,
      share: { kind: 'cap', value: areaRange },
    });
  }

  return sources;
}

/**
 * RULE-BODY-PROPERTY-001 (C039 ADDED · spec 규칙 2) — **그 몸의 그 성질.**
 *
 * 답할 Source 가 하나도 없으면 **없음**(undefined)이다 — 「0」도 「거짓」도 아니다 (규칙 2 ③).
 * 합치는 산수는 기반이 한다: 상한은 작은 쪽이 이기고 · 더함은 합이고 · 참거짓은 하나라도
 * 참이면 참이다.
 */
export function bodyProperty(
  state: WorldState,
  actor: ActorState,
  property: string,
  tables: BodyPropertyTables = BODY_PROPERTY_TABLES,
): PropertyAnswer | undefined {
  return resolveProperty(property, bodyPropertySources(state, actor, tables));
}

/**
 * RULE-BODY-PROPERTY-001 (C039 ADDED · spec 규칙 2 ②) — **그 몸의 최대 HP.**
 *
 * 답이 수가 아니면(답할 Source 가 하나도 없으면) **제한 없음**(+Infinity)이다 — 「0」이
 * 아니다 (규칙 2 ③): 아무도 한계를 말하지 않은 것과 한계가 0 인 것은 다르고, 이 자리는
 * 현재값을 자르는 **상한**이므로 아무도 말하지 않았으면 아무것도 자르지 않는다.
 * 지금 세계에서는 몸의 종류가 언제나 답하므로(모르는 종류도 기본 항목이 답한다) 그 자리에
 * 닿지 않는다.
 */
export function bodyMaxHp(
  state: WorldState,
  actor: ActorState,
  tables: BodyPropertyTables = BODY_PROPERTY_TABLES,
): number {
  return numeric(bodyProperty(state, actor, PROPERTY_MAX_HP, tables));
}

/** RULE-BODY-PROPERTY-001 (C039 ADDED · spec 규칙 2 ②) — 그 몸의 최대 CP (없으면 제한 없음) */
export function bodyMaxCp(
  state: WorldState,
  actor: ActorState,
  tables: BodyPropertyTables = BODY_PROPERTY_TABLES,
): number {
  return numeric(bodyProperty(state, actor, PROPERTY_MAX_CP, tables));
}

/**
 * RULE-AWARENESS-001 (C039 ADDED · spec 규칙 4) — **그 몸의 인지 범위.**
 *
 * 몸의 종류가 거는 상한 · 때가 거는 상한 · 선 자락이 거는 상한 가운데 **작은 것**이다
 * (합성은 기반이 한다 — 상한은 작은 쪽이 이긴다). 아무도 걸지 않았으면 **제한 없음**
 * (+Infinity)이고, 그것이 「방 전체가 보인다」의 수다.
 *
 * 이 답을 읽는 자리는 지금 자율 존재의 결정 하나다 (RULE-NPC-DECIDE-001) — 관찰이 이것을
 * 읽는 것은 C040 이다 (spec 목표의 「하지 않는 것」).
 */
export function bodyAwareness(
  state: WorldState,
  actor: ActorState,
  tables: BodyPropertyTables = BODY_PROPERTY_TABLES,
): number {
  return numeric(bodyProperty(state, actor, PROPERTY_AWARENESS, tables));
}

/**
 * **자리로 고른 몸**이 성질에 답하는 얼굴 (spec 규칙 6 · 기본형 ⑧).
 *
 * 문의 판정(connectorClosedReason)이 받는 것은 이것뿐이다 — 몸의 State 도 세계도 보지 않고
 * 「이 성질에 뭐라고 답하는가」 하나만 묻는다. 그래서 문의 판정 자리는 몸이 무엇인지 알지
 * 못하고, 성질의 이름도 데이터(Lock 의 요구)에서 온다.
 */
export interface StandingBody {
  property(name: string): PropertyAnswer | undefined;
}

/**
 * 그 몸의 성질에 답하는 얼굴을 짓는다 — **묻지 않으면 아무것도 세지 않는다** (게으르다).
 *
 * 문마다 · Tick 마다 부르는 자리(건너기 · 떨어짐 · 출구 표식)가 있으므로 짓는 값이 아니라
 * 묻는 얼굴로 둔다: 성질을 밝힌 Lock 이 하나도 없는 문은 Source 를 한 번도 모으지 않는다.
 */
export function standingBody(
  state: WorldState,
  actor: ActorState,
  tables: BodyPropertyTables = BODY_PROPERTY_TABLES,
): StandingBody {
  return { property: (name) => bodyProperty(state, actor, name, tables) };
}

/**
 * **현재값은 성질을 넘지 않는다** (C039 ADDED · spec 규칙 3 ②③ —
 * RULE-STRIKE-DAMAGE-001 · RULE-SKILL-BUDGET-001 · RULE-ATTRIBUTE-SET-001 **위의 데이터**).
 *
 * 새 규칙이 아니다: 현재값을 바꾸는 규칙은 한 줄도 옮기지 않았고(규칙 3 ①), 이 함수는 그
 * 규칙들이 값을 바꾼 **뒤**에 그 값이 지금의 성질을 넘었는지만 본다. 최대가 줄어(변형
 * 데이터로 Source 가 줄어) 현재값이 그보다 커지면 그 자리에서 잘린다.
 *
 * 자르는 산수가 **한 자리**에 있어야 하는 까닭 — 최대는 이제 저장된 필드가 아니라 물음의
 * 답이므로, 자르는 쪽마다 다시 물으면 한 Tick 안에서 두 답이 갈릴 수 있다.
 */
export function clampBodyVitals(
  state: WorldState,
  actor: ActorState,
  tables: BodyPropertyTables = BODY_PROPERTY_TABLES,
): void {
  const maxHp = bodyMaxHp(state, actor, tables);
  if (actor.hp > maxHp) actor.hp = maxHp;
  const maxCp = bodyMaxCp(state, actor, tables);
  if (actor.cp > maxCp) actor.cp = maxCp;
}

/** 세계의 모든 몸에 — 이 Tick 의 값이 다 정해진 뒤 한 번 (systems 의 차례가 부른다) */
export function clampBodyVitalsAll(state: WorldState): void {
  for (const actor of state.actors) clampBodyVitals(state, actor);
}

/** 수가 아닌 답(없음 · 참거짓)은 **제한 없음**으로 읽는다 — 위 세 물음의 주석 그대로 */
function numeric(answer: PropertyAnswer | undefined): number {
  return typeof answer === 'number' ? answer : Number.POSITIVE_INFINITY;
}
