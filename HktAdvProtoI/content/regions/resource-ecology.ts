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
  /** 자연 형태 코드들 — 같은 것의 다른 순도다 (종류를 늘린 것이 아니다) */
  forms: readonly string[];
}

/** 원천 하나가 밝히는 것 — 자리는 여기 없다. 자리는 Description 의 resource point 가 소유한다 */
export interface ResourceSourceSpec {
  /** 그 방 Description 의 resource layer point 태그이기도 하다 (R3 — 같은 id 로 잇는다) */
  id: string;
  materialId: string;
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

/** 거절 사유 코드 — 무너진 자리라 지날 수 없다 (Play §5.4 의 코드 그대로) */
export const BLOCK_COLLAPSED = 'collapsed';

/** 그 방이 낳는 것 — 없으면 이 계통이 닿지 않는 방이다 (백왕령이 그렇다 · 확정 5) */
export interface RegionResourceEcology {
  sources: readonly ResourceSourceSpec[];
}

// ── 이 숲의 재료 둘 (D1 · D2) ────────────────────────────────────────
//
// 거목균(GIANT_TREE_FUNGUS)은 아직 이 표에 없다 — 그것을 내는 원천(둥지의 균사)이
// C014 의 것이므로, 원천 없는 재료를 미리 세우지 않는다.

export const BIO_ORE = 'BIO_ORE';
export const ORE_EATER_MOLT = 'ORE_EATER_MOLT';

/** 자연 형태 코드 — 같은 Seed 가 자리마다 다른 순도로 난다 (A.1 "같은 것의 세 순도") */
export const FORM_OUTCROP = 'outcrop';
export const FORM_ROOT_NODULE = 'root-nodule';
export const FORM_MOLT_LITTER = 'molt-litter';
export const FORM_SPOIL_PILE = 'spoil-pile';

export const MATERIAL_SEEDS: readonly MaterialSeed[] = [
  // 생체 광석 — 거대 수목이 뿌리로 빨아올리는 그 광물. 살아 있는 것을 따라 옮겨 다니며 쌓인다
  { id: BIO_ORE, forms: [FORM_OUTCROP, FORM_ROOT_NODULE] },
  // 광식충 허물 — 생체 광석을 먹는 벌레가 벗은 것. 폐허의 선광 더미에 섞인 것도 이것이다
  // (Play §4 Breath 의 추측 — "버려진 더미에도 같은 것이 섞여 있다")
  { id: ORE_EATER_MOLT, forms: [FORM_MOLT_LITTER, FORM_SPOIL_PILE] },
];

export function materialSeed(id: string): MaterialSeed | undefined {
  return MATERIAL_SEEDS.find((seed) => seed.id === id);
}

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
