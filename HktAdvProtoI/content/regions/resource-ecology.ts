// content/regions — 이 숲의 **재료 계통** (C011 ADDED · RoomBearsMaterial §6 W17 · 부록 A.1 · A.2).
//
// world 와 view 가 함께 읽는 정적 사실이다. 세계 State 에 들어가지 않고 저장되지도 않는다 —
// 원천이 어디에 서고 무엇을 내는지는 언제나 이 데이터에서 다시 온다 (terrain-rules 와 같은 갈래).
//
// **규칙 코드는 어떤 재료도 이름으로 알지 못한다** (L2-World-Region R13). 규칙이 아는 것은
// "원천을 가진 방" 과 "그 원천이 내는 Material Seed 의 코드" 뿐이고, 그것이 생체 광석인지
// 광식충 허물인지는 이 파일과 View 의 문구 표에만 있다.
//
// 재료를 하나 더 만드는 것 · 원천을 더하는 것 · 흔적을 옮기는 것은 전부 데이터 편집이다
// (Play 불변 조건 — 코드 변경 없이 폴리싱).

import type { HazardOverlay, SeasonId } from './phases';
import type { StatementKind } from './properties';
import {
  ASPECT_FLESH,
  ASPECT_HEAT,
  ASPECT_LIGHT,
  RELATION_ABSORBS,
  RELATION_EMITS,
  RELATION_GROWS_ON,
  RELATION_STORES,
  propertyTag,
} from './properties';

/**
 * 그 원천을 무엇이 지고 있는가 (A.2 Carrier). 살아 있는 것(CREATURE)은 3층의 몫이다 (확정 2).
 *
 * C018 ADDED — `phenomenon`. 몸도 생명도 아닌 것이 지나가며 두고 간 것을 지는 갈래다
 * (Material §6.3 이 이미 이름해 둔 칸이고, 이 Cycle 이 그것을 처음 쓴다 — 어휘를 새로
 * 짓는 것이 아니라 비어 있던 칸을 채우는 것이다 · 기본형 ⑨).
 *
 * C020 ADDED — `atmosphere`. 공기가 지고 있다가 내려놓는 것을 지는 갈래다 (눈보라가 쌓고
 * 간 결정 가루). **어휘를 새로 짓는 것이 아니라** Material §6.2 가 이미 이름해 둔 여덟 중
 * 비어 있던 칸을 채우는 것이다 — C018 이 `phenomenon` 에 한 그대로다 (spec SPEC-001 경계 ②).
 * 밝히지 않으면 이 세계에 대기가 지는 원천이 없다는 뜻일 뿐이다.
 */
export type CarrierKind =
  | 'residue'
  | 'terrain'
  | 'plant'
  | 'fungus'
  | 'water'
  | 'phenomenon'
  | 'atmosphere';

/**
 * 그 원천이 기회의 지형에서 맡은 자리 (A.3).
 *
 * C018 ADDED — `world-event`. 때를 맞춰야만 얻는 자리다: 캘 수 있는가가 몸의 사정도
 * 방의 사정도 아니라 **세계에 무슨 일이 있었는가**로 갈린다 (Material §6.2 의 칸).
 */
export type OpportunityRole = 'baseline' | 'risk' | 'conditional' | 'by-product' | 'world-event';

/** 무엇이 그것을 되돌리는가 (§5.6 Supply Mode). 실제 회복은 C013 이 굴린다 */
export type SupplyMode =
  | 'baseline-renewable'
  | 'conditional-renewable'
  | 'migratory'
  | 'event-scarce';

/**
 * 그 재료가 **가진 성질** 하나 (C029 ADDED · L2-World-Access §4.2 · K7).
 *
 * `tag` 는 성질 어휘의 축:관계이고(properties.ts), `from` 은 그것이 그 재료의 **어느 문장에서
 * 나왔는가**다 (Material §6.1 의 다섯 항). 문장에 없는 성질을 태그가 말하지 않게 하는 자리이고,
 * 검사 ㉞ 가 그 짝을 묻는다.
 *
 * 태그는 **문장의 색인이지 문장이 아니다** — 같은 `light:emits` 라도 생체 광석은 "쌓인 자리를
 * 붉게 물들인다" 이고 빙정석은 "푸르게 빛난다" 다. 사람이 읽을 말은 View 의 표가 그 재료의
 * 문장으로 옮긴다 (spec R5 경계 ② · propertyPhraseCode).
 */
export interface SeedProperty {
  tag: string;
  from: StatementKind;
}

/**
 * Material Seed — 이 세계가 내는 재료 하나 (A.1).
 *
 * **쓰임을 적지 않는다** (S10 · unresolvedUses). 무엇으로 만드는지는 4층 이후가 정하고,
 * 이 층이 넘기는 것은 "무엇이 · 어디서 · 어떤 형태로 나는가" 까지다.
 */
export interface MaterialSeed {
  id: string;
  /**
   * 이 재료가 **어느 세계 원인에서 나는가** (C014 ADDED · §6.1 origin.worldCause).
   *
   * 이 숲의 재료 셋은 전부 하나의 사슬(FOREST_CHAIN)에서 난다 — 종류를 늘린 것이 아니라
   * 사슬의 세 자리(축적 · 소비 · 분해)를 옮겨 적은 것이기 때문이다 (A.1).
   * 코드일 뿐이고 사람이 읽을 문구는 View 의 표가 옮긴다 (재료 이름의 선례 그대로).
   */
  worldCause: string;
  /** 자연 형태 코드들 — 같은 것의 다른 순도다 (종류를 늘린 것이 아니다) */
  forms: readonly string[];
  /**
   * 그 재료가 **가진 성질**들 (C029 ADDED · Access §9.2).
   *
   * 밝히지 않으면 **성질이 없는 재료**다 — 고래 비늘이 그렇고(Access §9.2 "성질 미정" ·
   * 빈칸 4) 그것은 결손이 아니라 아직 적히지 않은 자리다. 지목한 판은 그 재료의 이름까지만
   * 말한다 (spec SPEC-005 경계 ①).
   *
   * **규칙 코드는 이 태그를 읽지 않는다** — 성질이 실제로 요구에 답하는가는 3 · 4층의 것이고
   * (K12), 2층에서 이 값을 읽는 것은 도구의 검사와 지목한 판뿐이다.
   */
  properties?: readonly SeedProperty[];
}

/** 원천 하나가 밝히는 것 — 자리는 여기 없다. 자리는 Description 의 resource point 가 소유한다 */
export interface ResourceSourceSpec {
  /** 그 방 Description 의 resource layer point 태그이기도 하다 (R3 — 같은 id 로 잇는다) */
  id: string;
  materialId: string;
  /**
   * 이 원천이 **어느 세계 원인에서 서는가** (C014 ADDED · §6.2 cause.worldCause).
   *
   * 재료의 worldCause 와 같은 갈래의 코드다 — 이 숲의 원천 일곱은 전부 FOREST_CHAIN 에
   * 매달린다. 검사 ⑪ 이 "원천이 세계 원인과 재료를 가리키는가" 를 여기서 읽는다.
   */
  worldCause: string;
  /** 그 자리에 난 자연 형태 — materialId 의 forms 중 하나 */
  form: string;
  carrier: CarrierKind;
  opportunity: OpportunityRole;
  /**
   * 무엇이 이것을 되돌리는가. **C011~C012 의 규칙은 이 값을 읽지 않는다** —
   * 밝혀만 두고 회복 세계 과정(C013)이 읽는다. 세계 사실이지 기구가 아니다.
   */
  supply: SupplyMode;
  /**
   * **무엇이 그것을 되돌리는가** — 원인의 코드 (C014 ADDED · §6.2 supply.recoveryCause · A.2 회복 원인).
   *
   * 되돌아오는 **길이**(recoverySeconds)와 다른 것이다: 저것은 얼마나 걸리는가이고 이것은
   * 왜 돌아오는가다. 규칙은 이 값을 읽지 않는다 — 검사 ⑭ 가 "되돌아오는 원천에 되돌아옴의
   * 원인이 있는가" 를 묻고, 사람이 읽을 문구가 필요해지면 View 의 표가 옮긴다 (기본형 ⑦).
   */
  recoveryCause: string;
  /**
   * 한 원천에서 **몇 번 캘 수 있는가** (C012 ADDED · 위임된 결정 D4).
   * 그만큼 캐면 phase 가 depleted 가 된다.
   */
  harvests: number;
  /**
   * 캐고 나면 **무너져 그 자리를 막는가** (C012 ADDED · A.2 채취 결과).
   *
   * 참인 원천은 자기 자리에 resource layer **area** 를 하나 가진다 (태그가 자기 id 다) —
   * 고갈된 뒤 그 area 안이 지날 수 없는 자리가 된다. 지금 참인 것은 노두 하나다:
   * 광맥의 머리가 무너져 구덩이가 되는 것이고, 허물·더미·뿌리혹은 흩어지거나 터질 뿐이다.
   */
  collapses?: boolean;
  /**
   * 이것이 **매달린** 원천 (C012 ADDED · Play §5.5 사슬 · A.2 회복 원인).
   *
   * 그 원천이 고갈되면 이것에 `recovery-stalled` 가 걸린다 — 되돌아오는 일이 멎었다는 표시다.
   * 사슬은 셋을 잇지만(균류 → 뿌리혹 → 노두) 지금 서 있는 것은 뒤의 둘뿐이다.
   * 뿌리혹이 매달린 분해된 흙(NEST_FUNGUS)은 그 원천이 서는 C014 가 잇는다.
   */
  dependsOn?: string;
  /**
   * 되돌아오는 데 걸리는 **세계 초** (C013 ADDED · 위임된 결정 D3).
   *
   * 고갈된 뒤 이만큼의 세계 시간이 흐르면 다시 캘 수 있다. 얕은 자리는 빨리, 깊은 자리는
   * 느리게 — 값은 원천마다 다르고 **여기가 유일한 출처**다 (회복 임계를 바꾸는 것은
   * 코드가 아니라 이 자리다 · Play 불변 조건).
   */
  recoverySeconds: number;
  /**
   * 그 원천이 설 수 있는 **마디**마다의 둘레 흔적 op id — 마디 순서 그대로 (C013 CHANGED).
   *
   * C012 의 `traceOp` 하나를 목록으로 넓힌 것이다 — 마디 하나뿐인 원천은 원소 하나다.
   * 그 원천의 **지금 마디**의 op 만 phase 를 따라 옅어지고, 다른 마디의 둘레는 0 으로 친다
   * (spec R7). 방 바닥에 깔린 흔적은 여기 적지 않는다: 옅어지는 것은 원천 둘레뿐이다.
   */
  traceOps?: readonly string[];
  /**
   * 마디마다의 **붕괴** area op id — `collapses` 가 참인 원천만 (C013 ADDED).
   *
   * `traceOps` 와 **같은 순서**다. 그 마디에서 고갈되면 그 번호가 collapsedSites 에 쌓이고,
   * 원천이 다음 마디로 옮겨 가도 그 자리는 무너진 채 남는다 (spec R5).
   */
  collapseOps?: readonly string[];
  /**
   * 그 원천이 마디를 얻는 **presence layer 곡선의 tag** (C013 ADDED).
   *
   * 밝히면 그 곡선의 points 가 곧 마디 목록이고(순서 그대로), 밝히지 않으면 C011 그대로
   * resource layer point 하나가 유일한 마디다 (spec R4).
   */
  siteCurve?: string;
  /**
   * 그 철에만 선다 — 밝히지 않으면 언제나 선다 (C016 ADDED · Time §2.4 ③ 출현).
   *
   * 다른 철에는 그 자리에 원천이 **없다**. 바닥난 것도 되돌아오는 중인 것도 아니라
   * 아직 그 철이 아닌 것이고, 그래서 조건 코드가 갈린다 (spec R6 · R7).
   * 그 자리의 흔적(흙)은 그대로다 — 원천이 없다고 땅이 달라지지 않는다.
   *
   * 활성(Connector)의 철 조건이 graph 의 활성 표에 있는 것과 같은 규율이다: 판정하는
   * 쪽이 하나여야 하므로 조건은 그 대상 곁에 산다.
   */
  occurrence?: { seasons: readonly SeasonId[] };
  /**
   * 마디마다의 **깨진 자리 자락** — `traceOps` 와 **같은 순서** (C020 ADDED · spec R4 · SPEC-005).
   *
   * 그 마디가 깨진 마디 목록(collapsedSites)에 들어 있는 동안에만 걸린다 —
   * 캐기 전에는 이 자락이 아무것도 걸지 않는다 (spec SPEC-005 경계 ①).
   * 형은 C019 의 `HazardOverlay` 그대로다: 위상을 거는 **원인이 다섯째**(고갈)가 되었을 뿐
   * 걸리는 것도 걸리는 자리도 철 · 소란 · 지나가는 것 · 늘 서 있는 것의 것과 같다.
   *
   * `collapseOps` 와 갈리는 자리가 여기다 — 저것은 **길을 막고**(traversable 이 State 로
   * 덮인다) 이것은 **말만 한다**. 그래서 이것을 밝힌 원천은 `collapses` 를 밝히지 않는다:
   * 깨진 결정면은 지날 수 있고, 땅도 통행 격자도 hash 도 한 값 바뀌지 않는다 (spec R4 경계 ③).
   *
   * 밝히지 않은 원천은 몇 번을 캐도 걸리는 것이 한 글자도 늘지 않는다.
   */
  depletedHazards?: readonly HazardOverlay[];
  /**
   * 철마다의 되돌아옴 **배속** — 밝히지 않은 철은 1 이다 (C020 ADDED · spec R3 · SPEC-006).
   *
   * 되돌아옴의 **길이**(recoverySeconds)를 바꾸지 않는다 — 얼마나 남았는가가 그 배로 빨리
   * 줄 뿐이다 (spec R3 경계). 그래서 "긴 밤에 180 이 90 이 된다" 가 아니라 "긴 밤에 흐르는
   * 1 초가 2 초로 실린다" 이다.
   *
   * 밝히지 않은 원천 · 밝히지 않은 철은 한 값도 다르지 않다 (숲의 원천 열이 그렇다) —
   * occurrence 를 밝히지 않은 원천이 어느 철에도 서는 것과 같은 규율이다.
   */
  recoverySpeed?: Readonly<Partial<Record<SeasonId, number>>>;
  /**
   * **처음 마디가 아닌 자리에 서 있는 동안** 실리는 조건 코드 (C021 ADDED · spec R3 · SPEC-005).
   *
   * "여기서 다시 자란 것이다" 까지이고, **어디서 옮겨 왔는지도 몇 번째 마디인지도 싣지
   * 않는다** (경계 ③ · C013 · C020 이 세운 규율 그대로). 캔 뒤 한 번 뜨고 마는 것이 아니라
   * 그 자리에 서 있는 동안 늘 실린다 — 다시 와서 보는 관찰자가 그것을 놓치지 않도록
   * **자리가 말하게** 두었다 (흔적이 늘 그 자리에 있는 것과 같은 어법 · spec 기본형 ④).
   *
   * **밝히지 않은 원천은 어디에 서 있든 아무것도 늘지 않는다** — 마디를 여럿 가진 숲의
   * 노두가 그렇다 (occurrence? · recoverySpeed? 를 밝히지 않은 원천이 그 계통 밖인 것과
   * 같은 규율). 마디가 하나뿐인 원천은 옮겨 설 자리가 없으므로 밝혀도 아무 일이 없다
   * (경계 ②).
   */
  regrownCode?: string;
  /**
   * **고갈된 동안** 실리는 조건 코드 (C030 ADDED · spec R3 · SPEC-003).
   *
   * `regrownCode?` 의 **형제**다 — 저것은 "그 자리가 처음 자리가 아니다" 이고 이것은
   * **"그 자리가 지금 비었다"** 다. 둘 다 원천이 밝혔을 때만 실리고, 둘 다 "지금 없다" 의
   * 사유(recovery-stalled · condition-unmet · not-this-season)와 갈리는 갈래다:
   * 저것들은 되돌아옴을 멎게 하는 **원인**이고 이 둘은 그 자리에 대한 **말**이다.
   *
   * 되돌아오는 중이거나 있는 동안에는 실리지 않는다 — 바닥난 그 동안만이다 (경계 ①).
   *
   * **밝히지 않은 원천은 몇 번을 캐도 한 글자도 늘지 않는다** (지금 세계의 나머지 전부) —
   * occurrence? · recoverySpeed? · regrownCode? 를 밝히지 않은 원천이 그 계통 밖인 것과
   * 같은 규율이다.
   */
  depletedCode?: string;
}

/**
 * 조건 코드 — **여기서 다시 자랐다** (C021 ADDED · Play V18 · spec SPEC-005).
 *
 * 되돌아옴이 멎은 것(RECOVERY_STALLED) · 아직 그때가 아닌 것(CONDITION_UNMET)과 갈린다 —
 * 저것들은 "지금 없다" 이고 이것은 **"있는데 그 자리가 처음 자리가 아니다"** 다.
 * 사람이 읽을 문구는 View 의 표가 옮긴다 (조건 코드의 선례 그대로).
 */
export const FROST_VEIN_REGROWN = 'frost-vein-regrown';

/**
 * 조건 코드 — **자리가 식었다** (C030 ADDED · Play V25 · spec SPEC-003).
 *
 * 다시 자란 자리(FROST_VEIN_REGROWN)와 갈린다 — 저것은 "있는데 그 자리가 처음 자리가
 * 아니다" 이고 이것은 **"그 자리가 지금 비었다"** 다. 되돌아옴이 멎은 것(RECOVERY_STALLED) ·
 * 아직 그때가 아닌 것(CONDITION_UNMET)과도 갈린다: 저것들은 **왜 없는가**의 사유이고
 * 이것은 그 자리가 지금 어떠한가다 (열이 빠져나간 벽이다).
 * 사람이 읽을 문구는 View 의 표가 옮긴다 (조건 코드의 선례 그대로).
 */
export const EMBER_COOLED = 'ember-cooled';

/** 조건 코드 — 되돌아오는 일이 멎었다 (Play §5.5 의 코드 그대로) */
export const RECOVERY_STALLED = 'recovery-stalled';

/** 조건 코드 — 지금 실려 오는 중이다 (C014 ADDED · 유입 흐름이 활성인 동안) */
export const FLOW_ARRIVED = 'flow-arrived';

/** 조건 코드 — 아직 그때가 아니다 (C014 ADDED · 유입 흐름이 활성이 아닌 동안) */
export const CONDITION_UNMET = 'condition-unmet';

/** 거절 사유 코드 — 무너진 자리라 지날 수 없다 (Play §5.4 의 코드 그대로) */
export const BLOCK_COLLAPSED = 'collapsed';

/** 그 방이 낳는 것 — 없으면 이 계통이 닿지 않는 방이다 (백왕령이 그렇다 · 확정 5) */
export interface RegionResourceEcology {
  sources: readonly ResourceSourceSpec[];
  /**
   * 원천도 유입도 없는 방이 **왜 그러한가** (C014 ADDED · §6.4 · 확정 5).
   *
   * 백왕령이 그런 방이다 — 이유를 새로 짓지 않는다: 산맥과 강이 막기 때문이고 그것이
   * 백왕령이 안전한 이유와 **같은 조건**이다 (Concept W2). 검사 ㉒ 는 원천도 유입도 없는
   * 방에만 이 자리를 요구한다.
   *
   * C020 CHANGED — **스스로 낳는 방도 밝힐 수 있다** (spec SPEC-009). 협곡 둘이 그렇다:
   * 원천은 넷이나 서 있지만 그 계통이 밖에서 아무것도 받지 않는다 — 얼음 절벽이 양옆을
   * 막고 고개 하나로만 이어지므로 실려 오는 것이 없다. 검사가 묻지 않는 자리에 답을 적는
   * 것이고, 그래서 **요구가 협곡에 없다**는 것이 결손이 아니라 밝혀진 사실이 된다.
   */
  isolationReason?: string;
}

// ── 이 숲의 세계 원인 하나 (C014 ADDED) ──────────────────────────────
//
// **숲의 사슬** (Play §5.0 · Concept §4). 포식수가 먹고 · 그 사체를 균류가 삭이고 · 삭은 흙에서
// 거목이 빨아올리고 · 그것을 광식충이 먹는다. 재료 셋과 원천 일곱이 전부 여기 매달린다 —
// 그것이 "이 숲에 계통이 하나 있다" 의 데이터 쪽 얼굴이다 (기본형 ①).
//
// 관계(축적 · 잔류 · 퇴적 …)는 적지 않는다 — 검사 열셋 중 아무도 읽지 않고, 없는 형을
// 미리 세우지 않는다 (선행 추상화 금지).

export const FOREST_CHAIN = 'FOREST_CHAIN';

// ── 이 세계의 세계 원인 하나 더 (C018 ADDED) ─────────────────────────
//
// **하늘을 지나가는 것** (Play §5.6 · Concept §9). 숲의 사슬과 갈리는 원인이다 — 사슬은
// 이 숲 안에서 먹고 삭고 빨아올리며 도는 것이고, 이것은 **바깥에서 지나가며 두고 가는 것**
// 이다. 그래서 되돌아옴도 시간이 아니라 그것이 **다시 지나는가**에 매달린다.

export const SKY_PASSAGE = 'SKY_PASSAGE';

// ── 이 세계의 세계 원인 셋째 (C020 ADDED) ────────────────────────────
//
// **결정이 자라며 열을 먹는다** (Play 확정 2 · Concept §6 "위험을 만든 환경 자체가 보상을
// 만든다" 를 원인으로 읽은 것). 숲의 사슬도 하늘의 지나감도 아닌 셋째다 — 사슬은 먹고 삭고
// 빨아올리며 이 숲 안에서 돌고, 지나감은 바깥에서 와서 두고 가고, 이것은 **그 자리에서
// 자란다**. 협곡이 추운 이유와 협곡이 내는 것이 같은 하나이고, 그래서 위험을 만든 그것이
// 곧 여기의 보상이다.
//
// 관계(무엇의 열을 먹는가 · 얼마나 자라는가)는 적지 않는다 — 검사 열셋 중 아무도 읽지
// 않고, 없는 형을 미리 세우지 않는다 (FOREST_CHAIN 이 그런 그대로 · 선행 추상화 금지).

export const CRYSTAL_GROWTH = 'CRYSTAL_GROWTH';

// ── 이 숲의 재료 셋 (D1 · D2) ────────────────────────────────────────

export const BIO_ORE = 'BIO_ORE';
export const ORE_EATER_MOLT = 'ORE_EATER_MOLT';
/** 고래 비늘 — 하늘을 지나가는 것이 흘리고 간 것 (C018 ADDED · 확정 9) */
export const WHALE_SCALE = 'WHALE_SCALE';
/** 거목균 — 포식수의 사체에서 자라 거목을 키우는 균류 (C014 ADDED · D1 · A.1) */
export const GIANT_TREE_FUNGUS = 'GIANT_TREE_FUNGUS';
/**
 * 빙정석 — 협곡의 재료 하나 (C020 ADDED · spec SPEC-001).
 *
 * 이름은 L2-World-Region §5.1 의 **이름 표에 이미 있는 것**을 그대로 쓴다 — 지어낸 이름이
 * 아니다. 숲의 사슬 밖이고 하늘의 지나감 밖이다: 결정이 자라며 열을 먹는 그 원인에서 난다.
 * **쓰임은 적지 않는다** (S10) — 무엇으로 만드는지는 4층 이후가 정한다.
 */
export const FROST_CRYSTAL = 'FROST_CRYSTAL';

/**
 * 열을 저장하는 결정 — 거목 속이 낳는 것 (C030 ADDED · spec SPEC-001).
 *
 * 이름은 빙정석이 그랬듯 L2-World-Region §5.1 의 **이름 표에 이미 있는 것**을 그대로 쓴다 —
 * 지어낸 이름이 아니다. 협곡의 결정이 열을 **먹는** 것과 갈리는 자리가 여기다: 이것은
 * 살아 있는 것 안에서 열이 **쌓여** 굳은 것이고, 그래서 세계 원인이 숲의 사슬이다
 * (Access D2 · Play §5.0).
 * **쓰임은 적지 않는다** (S10) — "빙결 Region 에서 체온을 유지한다" 는 무엇에 쓰이는가이고,
 * 그것은 4층 이후의 것이다 (spec 기본형 ⑦).
 */
export const HEAT_CRYSTAL = 'HEAT_CRYSTAL';

/** 자연 형태 코드 — 같은 Seed 가 자리마다 다른 순도로 난다 (A.1 "같은 것의 세 순도") */
export const FORM_OUTCROP = 'outcrop';
export const FORM_ROOT_NODULE = 'root-nodule';
export const FORM_MOLT_LITTER = 'molt-litter';
export const FORM_SPOIL_PILE = 'spoil-pile';
/** 어귀의 알갱이 — 원석이 물에 갈려 붉은빛을 잃은 것 (C014 ADDED · D2 ③) */
export const FORM_RIVER_GRAIN = 'river-grain';
/** 호수 바닥의 침전 — 거목 속에서 계속 가라앉는 것 (C014 ADDED · A.2) */
export const FORM_SILT_BED = 'silt-bed';
/**
 * 배어 나와 굳은 껍질 — 축적이 지표까지 밀려 올라와 마른 것 (C016 ADDED).
 * 노두·뿌리혹과 **같은 Seed** 이고 순도만 다르다 (A.1 "같은 것의 여러 순도" · D2 ③).
 */
export const FORM_SEEP_CRUST = 'seep-crust';
/** 사체 위 흰 균사 (C014 ADDED · A.1 거목균의 자연 형태) */
export const FORM_NEST_MYCELIUM = 'nest-mycelium';
/** 떨어진 비늘 — 지나간 것이 흘리고 간 것 (C018 ADDED) */
export const FORM_FALLEN_SCALE = 'fallen-scale';
/**
 * 먹이 잔해 — 지나간 것이 먹다 남긴 것 (C018 ADDED).
 * **새 Seed 가 아니다** — 광식충 허물의 다른 형태다 (확정 13 · A.1 "같은 것의 여러 순도").
 */
export const FORM_PREY_REMAINS = 'prey-remains';

// 빙정석의 자연 형태 넷 (C020 ADDED · spec SPEC-001 · 기본형 ⑦).
//
// Design 은 사람이 읽을 이름만 준다 (서리 결정 · 결정면 · 결정 가루 · 언 사체 곁의 결정) —
// 코드는 숲의 형태 코드와 **같은 어법**으로 지었다. 넷은 종류가 넷인 것이 아니라 **같은
// 것의 네 순도**다 (A.1) : 밤마다 얇게 끼는 것 · 벽에서 두껍게 자란 것 · 바람이 쌓은 가루 ·
// 언 것에 매달려 자란 것.
/** 고개에 밤마다 끼는 얇은 서리 결정 */
export const FORM_RIME = 'rime';
/** 절벽 벽면을 따라 자란 결정면 — 가장 두껍다 */
export const FORM_FROST_VEIN = 'frost-vein';
/** 눈보라가 쌓고 간 결정 가루 — 가장 옅다 */
export const FORM_DRIFT_DUST = 'drift-dust';
/** 언 사체에 매달려 자란 결정 */
export const FORM_CORPSE_RIME = 'corpse-rime';

/**
 * 서리가 앉지 않는 **벽의 잉걸** (C030 ADDED · Play §5.3 Trace).
 *
 * 열 결정의 자연 형태 하나뿐이다 — 순도가 여럿인 재료(생체 광석 다섯 · 빙정석 넷)와 달리
 * 이 재료가 나는 자리가 이 세계에 하나뿐이기 때문이고, 그것은 결손이 아니라 지금의 사실이다.
 */
export const FORM_WALL_EMBER = 'wall-ember';

export const MATERIAL_SEEDS: readonly MaterialSeed[] = [
  // 생체 광석 — 거대 수목이 뿌리로 빨아올리는 그 광물. 살아 있는 것을 따라 옮겨 다니며 쌓인다.
  // C014 CHANGED — 형태가 넷이다. 물에 갈린 알갱이와 호수 바닥의 침전도 **같은 Seed** 다
  // (A.1 "같은 것의 세 순도" · D2 ③) — 종류를 늘린 것이 아니라 순도를 늘린 것이다.
  {
    id: BIO_ORE,
    worldCause: FOREST_CHAIN,
    // C016 CHANGED — 형태가 다섯이다. 지표로 배어 나와 굳은 껍질도 **같은 Seed** 다
    // (순도를 늘린 것이지 종류를 늘린 것이 아니다 — C014 가 알갱이에 쓴 길 그대로)
    forms: [
      FORM_OUTCROP,
      FORM_ROOT_NODULE,
      FORM_SILT_BED,
      FORM_RIVER_GRAIN,
      FORM_SEEP_CRUST,
    ],
    // C029 ADDED — 이 재료가 가진 성질 둘 (Access §9.2). **문장에 있는 것만 태그로 옮겼다.**
    //   flesh:stores  "살아 있는 것의 몸을 따라 옮겨 다니며 쌓인다" (거동)
    //   light:emits   "쌓인 자리를 붉게 물들인다" (보이는 것)
    // "물에 갈리면 붉은빛을 잃는다" 는 성질이 아니라 그 성질이 옅어지는 자리라 태그가 없다.
    properties: [
      { tag: propertyTag(ASPECT_FLESH, RELATION_STORES), from: 'behavior' },
      { tag: propertyTag(ASPECT_LIGHT, RELATION_EMITS), from: 'appearance' },
    ],
  },
  // 광식충 허물 — 생체 광석을 먹는 벌레가 벗은 것. 폐허의 선광 더미에 섞인 것도 이것이다
  // (Play §4 Breath 의 추측 — "버려진 더미에도 같은 것이 섞여 있다")
  // C018 CHANGED — 형태가 셋이다. 지나간 것이 먹다 남긴 잔해도 **같은 Seed** 다
  // (확정 13 — "맹목의 사냥꾼은 행을 놓지 않는다: 경로만 있고 남기는 것은 M3 계통이다").
  {
    id: ORE_EATER_MOLT,
    worldCause: FOREST_CHAIN,
    forms: [FORM_MOLT_LITTER, FORM_SPOIL_PILE, FORM_PREY_REMAINS],
    // C029 ADDED — 성질 하나 (Access §9.2). "붉은 결이 있되 옅다" — 먹은 것의 빛이 남아 있다.
    // "마르면 부서진다" · "밑동 그늘에 모인다" 는 어휘 일곱 중 가리키는 관계가 없어 태그가 없다.
    properties: [{ tag: propertyTag(ASPECT_LIGHT, RELATION_EMITS), from: 'appearance' }],
  },
  // 거목균 — 포식수의 사체에서만 자라 사체를 삭이고 흙을 붉게 되돌린다 (C014 ADDED · D2).
  // 사슬의 **끝이자 시작**이다: 이것이 멎으면 거목의 축적이 멎고, 그러면 노두도 멎는다
  {
    id: GIANT_TREE_FUNGUS,
    worldCause: FOREST_CHAIN,
    forms: [FORM_NEST_MYCELIUM],
    // C029 ADDED — 성질 둘 (Access §9.2).
    //   flesh:absorbs   "사체에서만 자라 사체를 삭인다" (거동 — 몸을 먹는다)
    //   light:absorbs   "그늘에서만 산다" (조건에 대한 응답 — 빛이 있으면 서지 못한다)
    properties: [
      { tag: propertyTag(ASPECT_FLESH, RELATION_ABSORBS), from: 'behavior' },
      { tag: propertyTag(ASPECT_LIGHT, RELATION_ABSORBS), from: 'conditionResponse' },
    ],
  },
  // 고래 비늘 — 이 숲이 낳지 않는 유일한 재료다 (C018 ADDED · 확정 9).
  // 사슬 밖에서 온다: 하늘을 지나가는 것이 흘리고 간 것이고, 그래서 세계 원인이 다르다.
  // **쓰임은 적지 않는다** (S10) — 무엇으로 만드는지는 4층 이후가 정한다.
  // C029 — **성질도 밝히지 않는다** (Access §9.2 "성질 미정" · 빈칸 4). 이 재료가 무엇을
  // 가졌는지는 아직 어느 문서도 말하지 않았고, 없는 것을 지어내지 않는다. 지목한 판은
  // 이름까지만 말한다 (spec SPEC-005 경계 ①).
  {
    id: WHALE_SCALE,
    worldCause: SKY_PASSAGE,
    forms: [FORM_FALLEN_SCALE],
  },
  // 빙정석 — 고개 너머가 낳는 것 (C020 ADDED · spec SPEC-001).
  // 세계 원인이 셋째다: 사슬에서 나지도 지나가며 떨어지지도 않고 **자란다**.
  // 형태 넷은 같은 것의 네 순도다 (A.1) — 종류를 넷으로 늘린 것이 아니다.
  {
    id: FROST_CRYSTAL,
    worldCause: CRYSTAL_GROWTH,
    forms: [FORM_RIME, FORM_FROST_VEIN, FORM_DRIFT_DUST, FORM_CORPSE_RIME],
    // C029 ADDED — 성질 셋 (Access §9.2 · RoomOfAnotherKind 확정 3). 이 세계에서 성질을
    // 가장 많이 진 재료이고, 셋 다 확정 3 의 문장 셋을 그대로 가리킨다.
    //   heat:absorbs    "열을 먹는다 — 닿은 것을 식히고 숨이 언다" (거동)
    //   light:emits     "푸르게 빛난다" (보이는 것)
    //   heat:grows-on   "열이 닿으면 자란다" (조건에 대한 응답)
    // **빙결 심층의 문이 묻는 `heat:hides` 에 이 셋 중 하나(heat:absorbs)가 SUPPORTS 로
    // 답한다** (properties.ts 의 answers) — 그러나 2층은 그것을 판정하지 않고, 이 재료를
    // 지녀도 그 문은 열리지 않는다 (K12).
    properties: [
      { tag: propertyTag(ASPECT_HEAT, RELATION_ABSORBS), from: 'behavior' },
      { tag: propertyTag(ASPECT_LIGHT, RELATION_EMITS), from: 'appearance' },
      { tag: propertyTag(ASPECT_HEAT, RELATION_GROWS_ON), from: 'conditionResponse' },
    ],
  },
  // 열을 저장하는 결정 — 거목 속이 낳는 것 (C030 ADDED · spec SPEC-001).
  // 세계 원인이 **숲의 사슬**이다: 협곡의 결정처럼 그 자리에서 자라는 것이 아니라 살아 있는
  // 것 안에 열이 쌓여 굳은 것이다 (Access D2 "살아 있는 것 안에 쌓인다").
  // 형태는 하나 — 이 재료가 나는 자리가 이 세계에 하나뿐이다 (경계 ②).
  {
    id: HEAT_CRYSTAL,
    worldCause: FOREST_CHAIN,
    forms: [FORM_WALL_EMBER],
    // C030 ADDED — 성질 하나 (Access §9.2 의 HEAT_CRYSTAL 행).
    //   heat:stores  "열을 담는다 — 둘레가 식어도 제 열을 지닌다" (거동)
    // **빙결 심층의 문이 묻는 `heat:hides` 에 이것이 SUPPORTS 로 답한다** (properties.ts 의
    // answers) — 그러나 2층은 그것을 판정하지 않고, 이 재료를 지녀도 그 문은 열리지 않는다
    // (K12 · spec SPEC-007). 빙정석의 heat:absorbs 와 **같은 요구에 답하는 다른 성질**이고,
    // 그래서 답이 둘이 된다 (SPEC-006).
    // **쓰임은 적지 않는다** (S10) — 무엇으로 만드는지는 4층 이후가 정한다.
    properties: [{ tag: propertyTag(ASPECT_HEAT, RELATION_STORES), from: 'behavior' }],
  },
];

export function materialSeed(id: string): MaterialSeed | undefined {
  return MATERIAL_SEEDS.find((seed) => seed.id === id);
}

// ── 되돌아옴의 원인 코드 (C014 ADDED · §6.2 supply.recoveryCause · A.2 회복 원인) ──
//
// A.2 는 사람의 말로 준다("탈피 주기" · "비와 바람이 더미를 씻는다" …). 데이터에는 **코드**로
// 적는다 — 검사는 있는가만 묻고, 사람이 읽을 문구가 필요해지면 View 의 표가 옮긴다
// (재료 이름 · 형태 코드의 선례 그대로 · 기본형 ⑦).

/** 탈피 주기 — 가장 안정된 공급 (MOLT_LITTER) */
export const RECOVERY_MOLT_CYCLE = 'molt-cycle';
/** 비와 바람이 더미를 씻어 새 조각이 드러난다 (RUIN_SPOIL) */
export const RECOVERY_PILE_EROSION = 'pile-erosion';
/** 다음 사체의 분해 (NEST_FUNGUS) — 살아 있는 포식은 3층의 몫이다 */
export const RECOVERY_CARCASS_DECAY = 'carcass-decay';
/** 거목이 삭은 흙에서 다시 빨아올린다 (ROOT_NODULE · ORE_OUTCROP) */
export const RECOVERY_TREE_UPTAKE = 'tree-uptake';
/** 다음 흐름이 실어 온다 (RIVER_SILT) */
export const RECOVERY_FLOW_ARRIVAL = 'flow-arrival';
/** 거목 내부에서 계속 가라앉는다 (LAKE_SILT_BED) */
export const RECOVERY_LAKE_SETTLING = 'lake-settling';
/**
 * 고래가 **다시 지난다** (FALLEN_SCALE · C018 ADDED).
 * 되돌리는 것이 시간이 아니라 **사건**인 첫 원인이다 — 기다린다고 오지 않는다.
 */
export const RECOVERY_WHALE_PASSAGE = 'whale-passage';
/** 그것이 **다시 지난다** (PREY_REMAINS · C018 ADDED) — 같은 갈래의 원인이다 */
export const RECOVERY_HUNTER_PASSAGE = 'hunter-passage';

// 협곡의 되돌아옴 원인 넷 (C020 ADDED · A.2 회복 원인 · spec 데이터 값 표).
//
// 숲의 원인들과 같은 갈래의 **코드**다 — 규칙은 이 값을 읽지 않고, 검사 ⑭ 가 있는가만 묻고,
// 사람이 읽을 문구는 View 의 표가 옮긴다 (C014 가 세운 그 어법 그대로).
/** 밤마다 다시 낀다 (PASS_RIME) — 가장 안정된 공급 */
export const RECOVERY_NIGHT_RIME = 'night-rime';
/** 열을 먹어 다시 자란다 (CLIFF_FROST_VEIN) — 열이 가장 귀한 철에 가장 빠르다 (확정 7) */
export const RECOVERY_CRYSTAL_GROWTH = 'crystal-growth';
/** 다음 눈보라 (SNOW_DRIFT_DUST) — 그 철이 다시 와야 쌓인다 */
export const RECOVERY_NEXT_BLIZZARD = 'next-blizzard';
/**
 * 그것이 **다시 지난다** (FROZEN_REMAINS) — 고래 · 눈 없는 것의 원인과 같은 갈래다.
 * 다만 그 경로가 아직 세계에 없다 (spec Out of Scope) — 그래서 되돌아옴이 가장 느리고,
 * 원인은 **밝혀만 두었다** (기본형 ④ · C018 이 지나간 자리의 원천에 한 그대로).
 */
export const RECOVERY_PREDATOR_PASSAGE = 'predator-passage';

// ── 흐름 (C014 ADDED · §6.3 · A.4) ────────────────────────────────────

/**
 * 재료가 **방을 건너 실려 오는 길** 하나.
 *
 * 원천의 성질과 같은 갈래의 정적 사실이다 — 세계 State 가 아니고 저장되지도 않는다.
 * 지금 실어 오는 중인가는 **세계 시각에서 유도된다** (RULE-RESOURCE-FLOW-001 ·
 * content/world/semantic/resource.ts). 흐름은 도착 원천의 **매달림**이기도 하다:
 * 출발이 고갈되면 아무리 물길이 불어도 도착에 오는 것이 없다 (spec R3).
 */
export interface ResourceFlowSpec {
  id: string;
  materialId: string;
  from: { regionId: string; sourceId: string };
  to: { regionId: string; sourceId: string };
  /** 어느 Connector 를 타는가 — 이미 그래프에 있는 것을 쓴다 */
  connectorId: string;
  /** 세계 시각의 주기와 활성 구간 (초) — D3 */
  periodSeconds: number;
  activeSeconds: number;
}

/**
 * 이 숲의 흐름 — 하나뿐이다 (A.4).
 *
 * 거목 속 호수의 침전이 물길(HEART_RIVER)을 타고 숲 깊은 곳의 어귀로 간다. 원석이 물에
 * 갈려 **다른 형태**로 도착한다 — 같은 Seed 의 다른 순도다 (D2 ③).
 * 240 초마다 30 초 동안만 불어난다 (D3) — 언제 불어나는지 세계는 말하지 않는다.
 *
 * 방과 원천과 Connector 는 **이름(글자)으로** 가리킨다 — 방 파일들이 이 파일을 읽으므로
 * 여기서 그 파일들을 되읽으면 순환이 된다. 원천의 `dependsOn` 이 이미 같은 어법이고,
 * 그 이름이 실제로 있는지는 검사 ⑱ 이 판정한다 (끊긴 참조는 실패다).
 */
export const RESOURCE_FLOWS: readonly ResourceFlowSpec[] = [
  {
    id: 'FLOW_HEART_SILT',
    materialId: BIO_ORE,
    from: { regionId: 'HEART_LAKE', sourceId: 'LAKE_SILT_BED' },
    to: { regionId: 'FOREST_DEEP', sourceId: 'RIVER_SILT' },
    connectorId: 'HEART_RIVER',
    periodSeconds: 240,
    activeSeconds: 30,
  },
];

// ── layer 와 태그 ────────────────────────────────────────────────────

/** 원천이 선 자리를 적는 layer — point 의 tag 가 원천의 id 다 */
export const RESOURCE_LAYER = 'resource';

/** 흔적(흙의 변색)을 적는 layer — area 의 tag 가 `soil-stain:<단계>` 다 */
export const TRACE_LAYER = 'trace';

/**
 * 땅 위에 **무엇이 지나간다**를 적는 layer (C013 ADDED) — 높이를 건드리지 않는 표시선이다.
 * 지금 여기 서는 것은 거목의 뿌리 곡선 하나뿐이다 (tag 는 ROOT_CURVE_TAG).
 */
export const PRESENCE_LAYER = 'presence';

/**
 * 뿌리 곡선의 tag (C013 ADDED) — 그 방을 지나는 거목의 뿌리다.
 *
 * 자리를 옮기는 원천은 이 곡선의 points 를 **마디 목록**으로 삼는다 (siteCurve). 곡선이
 * 있다고 원천이 옮겨 다니는 것은 아니다 — 뿌리가 그 방을 지난다는 세계 사실일 뿐이고,
 * 그것을 마디로 쓰는지는 원천이 밝힌다 (Play §5.3).
 */
export const ROOT_CURVE_TAG = 'root';

/**
 * 결정면 선의 tag (C020 ADDED) — 절벽 벽면을 따라 난 결정의 줄이다.
 *
 * 뿌리 곡선과 **같은 갈래**다: 높이를 건드리지 않는 표시선이고, 그 points 가 곧 자리를
 * 옮기는 원천의 마디 목록이다 (siteCurve · C013 이 세운 그 형). 지나가는 것의 경로 선
 * (presence-routes 의 것)과 같은 layer 에 살되 지나가는 것이 아니다 — 이 layer 가 지는 것은
 * "땅 위에 무엇이 있다" 이지 "무엇이 움직인다" 가 아니다 (뿌리가 그런 그대로).
 */
export const FROST_VEIN_CURVE_TAG = 'frost-vein-line';

/** 흔적 태그의 접두사. 뒤에 1..5 의 단계가 붙는다 */
export const SOIL_STAIN_PREFIX = 'soil-stain:';

/** 가장 짙은 단계 — 표현의 색 표와 검증이 함께 읽는다 */
export const SOIL_STAIN_MAX = 5;

/** 그 단계의 흔적 태그 — 데이터도 표현도 이 함수 하나로 이름을 짓는다 */
export function soilStainTag(level: number): string {
  return `${SOIL_STAIN_PREFIX}${level}`;
}

/**
 * 흔적 태그가 말하는 단계 — 태그가 아니거나 수가 아니면 0 이다.
 * **모르는 것은 0** 이지 짙기가 아니다 (없는 흔적을 지어내지 않는다).
 *
 * C020 에서도 **한 글자도 바뀌지 않는다** — 숲의 어휘를 읽는 자리는 이 함수를 그대로 부르고
 * 한 값도 달라지지 않는다 (spec SPEC-002 경계 ①). 어휘가 둘이 된 것은 이 위에 선
 * `traceLevel` 이 안다.
 */
export function soilStainLevel(tag: string): number {
  if (!tag.startsWith(SOIL_STAIN_PREFIX)) return 0;
  const level = Number(tag.slice(SOIL_STAIN_PREFIX.length));
  return Number.isFinite(level) && level > 0 ? level : 0;
}

// ── 협곡의 흔적 어휘 (C020 ADDED · spec SPEC-002 · 기본형 ②) ──────────
//
// **같은 기제 · 다른 태그**다. 숲의 흙 사다리가 색이라면 협곡의 것은 **숨이 어는 정도**이고,
// 기제는 한 줄도 다르지 않다 — 원천 둘레가 방 바닥보다 한 단계 짙고, 고갈되면 한 단계
// 옅어지고, 되돌아오면 제 단계로 돌아온다 (C011 · C012 · C013 이 세운 그것 그대로).
//
// 단계를 셋까지만 두는 이유 — 협곡은 방이 둘뿐이라 숲의 다섯 단계를 놓을 자리가 없다
// (얼음 협곡 바닥 1 · 빙결 협곡 바닥 2 · 원천 둘레가 각각 한 단계 짙게 = 2 와 3).
//
// **두 어휘가 한 자리에서 섞이지 않는다** (SPEC-002 경계 ②) — 협곡의 방에는 흙 사다리
// area 가 하나도 없고, 숲의 방에는 숨의 사다리 area 가 하나도 없다. 그것은 규칙이 아니라
// 데이터의 사실이고, 그래서 아래 `traceLevel` 은 둘 중 어느 것이든 읽을 수 있어도 된다.

/** 협곡 흔적 태그의 접두사. 뒤에 1..3 의 단계가 붙는다 */
export const FROST_BREATH_PREFIX = 'frost-breath:';

/** 가장 짙은 단계 — 표현의 색 표와 검증이 함께 읽는다 (SOIL_STAIN_MAX 의 선례) */
export const FROST_BREATH_MAX = 3;

/** 그 단계의 협곡 흔적 태그 — 데이터도 표현도 이 함수 하나로 이름을 짓는다 */
export function frostBreathTag(level: number): string {
  return `${FROST_BREATH_PREFIX}${level}`;
}

// ── 거목 속의 흔적 어휘 (C030 ADDED · spec R2 · SPEC-002 · 기본형 ④) ──
//
// **같은 기제 · 다른 태그**다 — C020 이 협곡의 숨에 쓴 그 판단의 연장이고 여기서 새로
// 정하는 기제가 하나도 없다. 숲의 흙 사다리가 색이고 협곡의 것이 숨이 어는 정도라면,
// 거목 속의 것은 **온기가 오르는 정도**다: 원천 둘레가 방 바닥보다 한 단계 짙고, 고갈되면
// 한 단계 옅어지고, 되돌아오면 제 단계로 돌아온다 (C011 · C012 · C013 이 세운 그것 그대로).
//
// 단계를 셋까지만 두는 이유 — 이 사다리는 방 **하나 안에서** 나뉜다 (방 바닥 1 · 원천 쪽
// 절반 2 · 원천 둘레 3). 숲의 흙은 방 여섯에 걸쳐 다섯 단계를 놓을 자리가 있었지만 여기는
// 없다. 협곡의 숨이 셋인 것과 같은 이유이고, 그것을 그대로 따랐다.
//
// **세 어휘가 한 자리에서 섞이지 않는다** (SPEC-002 경계 ①) — 이 방에는 흙 사다리도 숨의
// 사다리도 area 가 하나도 없고, 숲과 협곡의 방에는 온기의 area 가 하나도 없다. 그것은
// 규칙이 아니라 데이터의 사실이고, 그래서 아래 `traceLevel` 은 셋 중 어느 것이든 읽어도 된다.

/** 거목 속 흔적 태그의 접두사. 뒤에 1..3 의 단계가 붙는다 */
export const EMBER_WARMTH_PREFIX = 'ember-warmth:';

/** 가장 짙은 단계 — 표현의 색 표와 검증이 함께 읽는다 (SOIL_STAIN_MAX · FROST_BREATH_MAX 의 선례) */
export const EMBER_WARMTH_MAX = 3;

/** 그 단계의 거목 속 흔적 태그 — 데이터도 표현도 이 함수 하나로 이름을 짓는다 */
export function emberWarmthTag(level: number): string {
  return `${EMBER_WARMTH_PREFIX}${level}`;
}

/**
 * RULE-TRACE-STRENGTH-001 (C020 CHANGED · C030 CHANGED · spec R2) — 흔적 태그의 단계.
 * 어휘 **셋 중 어느 것이든** 읽는다. 흔적이 아니면 0 이다.
 *
 * 세계가 흔적의 세기를 묻는 자리는 이 한 함수를 부른다 — 여러 벌로 나누면 방마다 어느
 * 어휘를 쓰는지 세계가 알아야 하고, 그러면 규칙이 방을 이름으로 아는 자리가 생긴다
 * (C004 가 세운 규율). 여기가 아는 것은 "이 세계가 아는 흔적 어휘" 셋뿐이고, 어느 방이
 * 어느 것을 쓰는지는 그 방 Description 의 태그에만 있다.
 *
 * 차례는 **선 차례**다 (흙 · 숨 · 온기) — 순서가 답을 바꾸지는 않지만(접두사가 서로 달라
 * 한 태그가 둘일 수 없다) 먼저 선 어휘가 앞이어야 읽는 사람이 무엇이 더해졌는지 안다.
 * 앞의 두 어휘를 읽던 답은 **한 값도 달라지지 않는다** (spec R2 · SPEC-002 경계 ①) —
 * `soilStainLevel` 은 한 글자도 바뀌지 않았고 숨의 사다리를 읽는 두 줄도 그 자리 그대로다.
 */
export function traceLevel(tag: string): number {
  const soil = soilStainLevel(tag);
  if (soil > 0) return soil;
  if (tag.startsWith(FROST_BREATH_PREFIX)) {
    const level = Number(tag.slice(FROST_BREATH_PREFIX.length));
    return Number.isFinite(level) && level > 0 ? level : 0;
  }
  if (!tag.startsWith(EMBER_WARMTH_PREFIX)) return 0;
  const level = Number(tag.slice(EMBER_WARMTH_PREFIX.length));
  return Number.isFinite(level) && level > 0 ? level : 0;
}
