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

/** 그 원천을 무엇이 지고 있는가 (A.2 Carrier). 살아 있는 것(CREATURE)은 3층의 몫이다 (확정 2) */
export type CarrierKind = 'residue' | 'terrain' | 'plant' | 'fungus' | 'water';

/** 그 원천이 기회의 지형에서 맡은 자리 (A.3) */
export type OpportunityRole = 'baseline' | 'risk' | 'conditional' | 'by-product';

/** 무엇이 그것을 되돌리는가 (§5.6 Supply Mode). 실제 회복은 C013 이 굴린다 */
export type SupplyMode =
  | 'baseline-renewable'
  | 'conditional-renewable'
  | 'migratory'
  | 'event-scarce';

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
}

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
   * 백왕령이 안전한 이유와 **같은 조건**이다 (Concept W2). 원천을 가진 방에는 이 자리가
   * 없다 — 스스로 낳는 방은 고립을 밝힐 것이 없기 때문이다 (검사 ㉒ 가 그렇게 묻는다).
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

// ── 이 숲의 재료 셋 (D1 · D2) ────────────────────────────────────────

export const BIO_ORE = 'BIO_ORE';
export const ORE_EATER_MOLT = 'ORE_EATER_MOLT';
/** 거목균 — 포식수의 사체에서 자라 거목을 키우는 균류 (C014 ADDED · D1 · A.1) */
export const GIANT_TREE_FUNGUS = 'GIANT_TREE_FUNGUS';

/** 자연 형태 코드 — 같은 Seed 가 자리마다 다른 순도로 난다 (A.1 "같은 것의 세 순도") */
export const FORM_OUTCROP = 'outcrop';
export const FORM_ROOT_NODULE = 'root-nodule';
export const FORM_MOLT_LITTER = 'molt-litter';
export const FORM_SPOIL_PILE = 'spoil-pile';
/** 어귀의 알갱이 — 원석이 물에 갈려 붉은빛을 잃은 것 (C014 ADDED · D2 ③) */
export const FORM_RIVER_GRAIN = 'river-grain';
/** 호수 바닥의 침전 — 거목 속에서 계속 가라앉는 것 (C014 ADDED · A.2) */
export const FORM_SILT_BED = 'silt-bed';
/** 사체 위 흰 균사 (C014 ADDED · A.1 거목균의 자연 형태) */
export const FORM_NEST_MYCELIUM = 'nest-mycelium';

export const MATERIAL_SEEDS: readonly MaterialSeed[] = [
  // 생체 광석 — 거대 수목이 뿌리로 빨아올리는 그 광물. 살아 있는 것을 따라 옮겨 다니며 쌓인다.
  // C014 CHANGED — 형태가 넷이다. 물에 갈린 알갱이와 호수 바닥의 침전도 **같은 Seed** 다
  // (A.1 "같은 것의 세 순도" · D2 ③) — 종류를 늘린 것이 아니라 순도를 늘린 것이다.
  {
    id: BIO_ORE,
    worldCause: FOREST_CHAIN,
    forms: [FORM_OUTCROP, FORM_ROOT_NODULE, FORM_SILT_BED, FORM_RIVER_GRAIN],
  },
  // 광식충 허물 — 생체 광석을 먹는 벌레가 벗은 것. 폐허의 선광 더미에 섞인 것도 이것이다
  // (Play §4 Breath 의 추측 — "버려진 더미에도 같은 것이 섞여 있다")
  {
    id: ORE_EATER_MOLT,
    worldCause: FOREST_CHAIN,
    forms: [FORM_MOLT_LITTER, FORM_SPOIL_PILE],
  },
  // 거목균 — 포식수의 사체에서만 자라 사체를 삭이고 흙을 붉게 되돌린다 (C014 ADDED · D2).
  // 사슬의 **끝이자 시작**이다: 이것이 멎으면 거목의 축적이 멎고, 그러면 노두도 멎는다
  {
    id: GIANT_TREE_FUNGUS,
    worldCause: FOREST_CHAIN,
    forms: [FORM_NEST_MYCELIUM],
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
 */
export function soilStainLevel(tag: string): number {
  if (!tag.startsWith(SOIL_STAIN_PREFIX)) return 0;
  const level = Number(tag.slice(SOIL_STAIN_PREFIX.length));
  return Number.isFinite(level) && level > 0 ? level : 0;
}
