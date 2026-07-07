// ============================================================================
// 시뮬레이션 상수 — 서버·클라 공용 단일 출처
//
// 결정론에 영향을 주는 값은 전부 여기 고정한다 (런타임 튜닝 금지 영역).
// 에너지 단위는 전부 정수. 보존 불변식: 전 풀 합계 = WORLD_SOURCE_INITIAL 고정.
// ============================================================================

// --- 월드 (공간은 3D — x,y 수평 + z 높이. region/필드 격자는 (x,y) 컬럼, z 는 컬럼 내 자유) ---
export const WORLD_SIZE = 2000;          // 월드 수평 한 변 (px)
export const WORLD_HEIGHT = 1000;        // 월드 수직 범위 (z, px)
export const REGION_SIZE = 500;          // 관심영역/체크섬 격자 한 변 → 수평 4x4 컬럼
export const WORLD_SEED = 20260702;      // 결정론 월드 시딩 (서버·클라 동일 유도)
export const SPAWN_POS = { x: 1000, y: 1000, z: WORLD_HEIGHT / 2 };

// --- 틱 / 네트워크 ---
export const TICK_RATE = 10;             // 서버 원장 틱 (Hz) — 서버는 이 빈도로만 깨어난다
export const BEACON_INTERVAL_MS = 200;   // 클라 좌표 비콘 5Hz
export const CHECKSUM_INTERVAL_TICKS = 30; // 3초마다 지역 보존 체크섬
export const REGEN_INTERVAL_TICKS = 50;    // 5초마다 자원 노드 재충전 tx
export const RELEVANCY_RADIUS = 1;       // 자기 지역 기준 (2R+1)^2 = 3x3 구독

// --- 이동 (에너지 지출 = 스피드핵 예산 검증의 근거) ---
export const MAX_SPEED = 240;            // px/s
export const MOVE_COST_STRIDE_PX = 50;   // 50px 이동당 에너지 1 소모
export const BEACON_TOLERANCE = 1.5;     // 속도 검증 허용 배율 (지터 흡수)
export const BEACON_SLACK_PX = 24;       // 속도 검증 고정 여유

// --- 플레이어 풀 ---
export const PLAYER_MAX_ENERGY = 1000;
export const SPAWN_GRANT = 300;          // 스폰/리스폰 시 WORLD_SOURCE 에서 인출
export const RESPAWN_DELAY_MS = 3000;
// A6-1 대사(metabolism): 생명은 매 주기 이만큼 SINK 로 지불한다. 못 채우면 잔고 0 → 아사.
// "지속 소모·세계를 갈구·유지 못하면 죽음" — 소산 구조의 압력 엔진. (구조 스케일링은 A6-3)
export const UPKEEP_INTERVAL_TICKS = 10; // 1초마다 대사
export const UPKEEP_AMOUNT = 5;          // 주기당 player→SINK (플랫; 향후 구조 함수)

// --- 성장 / 구조 (A6-2) — 성장 = 자유 에너지를 잠긴 질서(구조 풀)로 재분배 ---
// 예치는 `player→STRUCT` 이체 — 창조가 아니라 자유 에너지의 질서화다(총합 불변).
// 사망 시 지속(영구 성장), 접속 종료 시 SINK 로 환원.
// A7-1 구조 분화: 성장은 단일 스칼라가 아니라 조직(organ)별 예치다 — 조직 풀 id 는
// `S:<playerId>#<organ>` (POOL.STRUCT 접두 유지 → 클라 자동 물질화 동일). 각 조직은 서로 다른
// 흐름 계수에 결합하므로, 예치가 "어느 장기를 키울지" 선택이 되어 빌드가 구조적으로 분화한다.
export const ORGANS = ['atk', 'meta'];   // 발산 조직(공격) / 대사 조직(획득) — 조직 추가 지점
export const STRUCT_MAX = 10_000;        // 조직 풀 용량 상한 (조직당, 성장 여지)
export const GROW_AMOUNT = 50;           // GROW 인텐트 기본 예치량 (msg.amount 로 재정의 가능)
// A6-3 스탯 = 흐름 계수: 스탯은 저장 숫자가 아니라 구조 예치의 결정론 함수 (shared/growth.js).
export const GROWTH_ATK_DIVISOR = 100;    // 발산(atk) 조직 100 당 공격 +1 (피격자 클램프 내)
export const GROWTH_META_DIVISOR = 40;    // 대사(meta) 조직 40 당 채집 +1 (구조적 획득 증폭)
export const GROWTH_UPKEEP_DIVISOR = 200; // 총 구조 200 당 대사 +1 (큰 질서일수록 유지 비용↑)

// A6-4 스킬 = 발산 패턴: 각 스킬은 비용·증폭·흡수비·쿨다운이 다른 이체 패턴이다.
// 데미지 = base + floor(struct/structDiv) — 구조가 위력을 키운다(여전히 피격자 클램프).
// leechPct 로 흡수(피격자→공격자) vs 소각(피격자→SINK) 비율이 갈린다.
export const SKILLS = {
  smash: { cost: 20, base: 35, structDiv: 60,  leechPct: 20, cooldownMs: 2500 }, // 강타: 큰 소각 버스트
  drain: { cost: 8,  base: 15, structDiv: 120, leechPct: 90, cooldownMs: 1500 }, // 흡정: 큰 흡수(지속)
};

// --- 필드 확산 (A1: 노드 재충전을 세계→노드 주입이 아니라 이웃 셀 간 이체로) ---
// 셀 격자는 원장 안의 풀들이다 (id `F:cx_cy`). 확산은 이웃 셀 간 zero-sum 정수
// 이체 — 별도 동기화 채널 없이 원장에 편입된다. 보존은 transfer 클램프가 강제한다.
export const FIELD_CELL_SIZE = 250;                        // 셀 한 변 (px)
export const FIELD_GRID = WORLD_SIZE / FIELD_CELL_SIZE;    // 8x8 = 64 셀
export const FIELD_CELL_MAX = 100_000;                     // 셀 용량 상한
// 확산 흐름 = floor(기울기 * NUM / DEN). NUM/DEN ≤ 1/2 여야 오버슛·진동 없이 평형 수렴.
export const FIELD_DIFFUSE_NUM = 1;
export const FIELD_DIFFUSE_DEN = 4;
export const FIELD_CELL_SEED = 3000;       // 창세 시 SOURCE→셀 초기 적립 기준량 (풍요도 배수로 스케일)
export const FIELD_INJECT_AMOUNT = 40;     // 재충전 틱당 SOURCE→셀 보충 기준량 (풍요도 배수로 스케일)
// A7-2 필드 이질화: 필드 셀은 균질하지 않다. 지역별 풍요도(배수)가 시드에서 유도되어
// 부유/빈곤 지역이 갈린다 — 셀 목표 잔고·주입량이 이 배수에 비례한다. "지구 같은 복합계"의
// 공간 에너지 구배: 부유 셀은 높은 정상상태로 채워져 노드를 잘 먹이고, 빈곤 셀은 낮게 유지.
// 순수 원장 구조(셀은 서버 내부 저수지·region=null) — 리소스/렌더 아님·미러 무관.
export const FIELD_RICH_MIN = 1;           // 빈곤 셀 풍요도 배수
export const FIELD_RICH_MAX = 4;           // 부유 셀 풍요도 배수 (풍요도 = [MIN..MAX] 시드 유도)

// --- 채집 ---
export const NODE_COUNT = 40;
export const NODE_MIN_MAX = 400;         // 노드 용량 하한
export const NODE_MAX_MAX = 1200;        // 노드 용량 상한
export const NODE_REGEN_AMOUNT = 40;     // 재충전 틱당 SRC→노드 이체량
export const GATHER_RANGE = 80;
// A9-3 흐름 흡수: 채집·채굴량은 손으로 쓴 상수(옛 GATHER_AMOUNT/MINE_AMOUNT=25)가 아니라 노드
// 집중도에서 창발한다. 탭 = floor(노드 잔고 × NUM/DEN)(shared/entropy.js `nodeTap`, 양자 바닥 1).
// DEN=20 → 잔고 500 노드가 옛 상수와 같은 25를 준다(중간 노드 정합). 풍부한 노드는 더, 고갈은 덜.
export const NODE_TAP_NUM = 1;
export const NODE_TAP_DEN = 10;          // 잔고 250 노드 ≈ 옛 상수 25. 풍부한 노드는 더, 고갈은 덜.

// --- 전투 ---
export const ATTACK_RANGE = 120;
export const ATTACK_COST = 5;            // 시전 비용: 공격자 → SINK
export const ATTACK_DAMAGE = 30;         // 맨손 데미지 (결정론 롤의 중앙값)
export const ATTACK_DAMAGE_VAR = 10;     // A2: 데미지 롤 분산 → 위임 판정이 의미를 갖는 폭 [30±10]
// A6-5 아이템 = 결정체 장착: 아이템의 현재 잔고가 유효 스탯을 증폭한다(실재 에너지 읽기, 민팅 없음).
export const WEAPON_ATK_DIVISOR = 8;     // 무기 잔고 8 당 공격 +1 (누수로 잔고 줄면 증폭 감소)
export const CRYSTAL_GATHER_DIVISOR = 10; // 결정 소지 시 잔고 10 당 채집 +1 (획득 증폭)
// A9-2 엔트로픽 누수: 감가(옛 공격당 WEAPON_WEAR 상수)를 법칙으로 대체한다. 집중된 질서(아이템)는
// 쓰지 않아도 자발적으로 SINK로 흩어진다 — 누수 = floor(잔고 × NUM/DEN)(shared/entropy.js). 손으로 쓴
// 상수가 아니라 엔트로피. 매 틱이 아니라 주기로 양자화해 미러 대역폭을 지킨다. 소산분은 태양 순환이 되돌린다.
export const DECAY_INTERVAL_TICKS = 50;  // 5초마다 엔트로픽 이완 (재충전과 같은 주기)
export const ITEM_DECAY_NUM = 1;
export const ITEM_DECAY_DEN = 50;        // 주기당 아이템 잔고의 2% 누수 (NUM/DEN ≤ 1/2)
export const LEECH_PERCENT = 50;         // 데미지 중 공격자가 흡수하는 비율 (%), 나머지는 SINK
export const ATTACK_COOLDOWN_MS = 800;

// A7-3 생명 간 이체: 플레이어끼리 자유 에너지를 증여(협력·교환·부양)한다 = MMO 관계.
// 강제 없는 자발적 이체(`player→player`) — 사거리 안에서만(사회적 근접·전송 검증). 보존은 클램프.
export const GIVE_RANGE = 120;           // 증여 사거리 (근접해야 준다)

// --- A2 판정 감사 (클라 위임 데미지 판정의 샘플링 재시뮬 탐지 — 표본 추출은 서버 정책) ---
export const AUDIT_SEED = 0x5eed;        // 감사 표본 추출 기본 시드 (프로덕션은 서버 비밀로 주입)
export const AUDIT_SAMPLE_NUM = 1;       // 감사 표본 비율 = NUM/DEN
export const AUDIT_SAMPLE_DEN = 4;       // → 25% 표본

// --- 몬스터 (웹 단계: 정적 에너지 덩어리 — 서버는 이동을 시뮬레이션하지 않는다) ---
export const MOB_COUNT = 12;
export const MOB_ENERGY = 200;
export const MOB_RESPAWN_MS = 10000;
// A5: 특권 없는 서버 봇으로 구동하는 몬스터 수 (동일 프로토콜 — server/monster.js)
export const MONSTER_BOT_COUNT = 6;

// --- 아이템 (아이템 = 응축된 에너지 풀. 내구도·가치·회복량이 전부 같은 잔고) ---
export const CRYSTAL_COST = 100;         // 결정 응축: 플레이어 → 아이템 풀 100
export const WEAPON_COST = 250;          // 무기 제작: 플레이어 → 아이템 풀 250
export const PICKUP_RANGE = 60;

// A8-1 타입 채집·합성: "금이 어떻게 아이템이 되나" — 세계가 발산한 결정(노드)을 종류별로 캐서
// (MINE) 재료 창고에 쌓고, 재료 + 생체(속성) 에너지를 결합(FORGE)해 고귀한 결정=아이템으로
// 보존한다. 핵심: **금은 "변환"되지 않는다** — 금 100단위는 아이템이 된 뒤에도 100단위 그대로.
// 바뀌는 건 그 단위에 붙은 라벨(descriptor)뿐이다. 그래서 보존 코어(ledger.js)는 불변:
//   · 양(quantity) = 원장 풀 잔고 (이체로만 변함·보존 강제)
//   · 종류(type)   = 노드·창고·아이템의 라벨 (에너지가 아니라 보존 대상 밖) = 어느 흐름 계수를 고를지
// A9-1 가치 단일화: 아이템 위력은 재료 라벨과 **무관**하고 오직 에너지 잔고로 결정된다(반응성 균일).
// 재료의 차이는 위력 배율이 아니라 (a) affinity = 어느 흐름을 증폭할지(채널 선택·배율 아님)
// (b) abundance = 세계 분포(희소성). "총량이 가치를 결정한다" — 금이 귀한 건 계수가 세서가 아니라
// 세계가 적게 뿜어서다(희소). 배율 상수(옛 div)를 제거해 공리를 코드에 실현한다. (Docs/Design-EntropicFlow.md)
export const MATERIALS = {
  //  종류   → { affinity: 거동('weapon'=발산/'crystal'=획득) · abundance: 세계 분포 가중(클수록 흔함) }
  wood:  { affinity: 'crystal', abundance: 6 }, // 나무: 흔함
  stone: { affinity: 'weapon',  abundance: 6 }, // 돌: 흔함
  herb:  { affinity: 'crystal', abundance: 4 }, // 약초: 보통
  iron:  { affinity: 'weapon',  abundance: 3 }, // 철: 보통
  gem:   { affinity: 'crystal', abundance: 2 }, // 보석: 드묾
  gold:  { affinity: 'weapon',  abundance: 1 }, // 금: 희소
  ember: { affinity: 'weapon',  abundance: 1 }, // 불의 정수: 희소
};
export const MATERIAL_KEYS = Object.keys(MATERIALS); // 7종 (결정론 순서 — 시드 유도 인덱싱)
export const STASH_MAX = 10_000;         // 재료 창고 풀(종류별) 용량 상한
export const FORGE_MAT_REQUIRE = 100;    // 합성 소요 재료량 (창고 → 아이템)
export const FORGE_ATTR_COST = 50;       // 속성 주입 = 생체 에너지 (플레이어 → 아이템)
export const FORGE_ITEM_MAX = FORGE_MAT_REQUIRE + FORGE_ATTR_COST; // 아이템 용량 = 두 이체의 합
// A9-4 엔트로피 세금: 질서를 *만드는*(집중하는) 것은 공짜가 아니다 — 열역학 제2법칙. 재료를 아이템으로
// 잠글 때 일부가 SINK로 소산한다(오르막 집중의 대가). A9-2 누수(질서는 가만두면 무너진다)의 대칭:
// 만들 때도 대가를 치른다. 세금 = entropicLeak(집중량 × NUM/DEN). 소산분은 태양 순환 복귀(보존).
export const FORGE_TAX_NUM = 1;
export const FORGE_TAX_DEN = 5;          // 합성 결정의 20%가 소산(150 투입 → 아이템 120 + SINK 30)

// --- 월드 소스/싱크 (닫힌 열역학 루프의 두 끝: SOURCE=태양 원점, SINK=소산) ---
export const WORLD_SOURCE_INITIAL = 1_000_000_000;
// A6-0 태양 순환: 소산된 에너지(SINK)를 이 주기마다 SOURCE 로 되돌린다.
// 서버는 유일한 에너지 원점(태양)이되 생성기가 아니라 순환의 원점 — SOURCE→생명→SINK→SOURCE
// 로 영원히 돈다(총합 불변). 이 순환이 없으면 이동·전투·(향후)대사가 세계를 SINK 로 말린다.
export const RECYCLE_INTERVAL_TICKS = 50;   // 5초마다 소산 재순환

// --- 풀 ID 접두 ---
export const POOL = {
  PLAYER: 'P:',   // 플레이어 생체 에너지
  NODE: 'N:',     // 자원 노드 (필드 풀)
  CELL: 'F:',     // 필드 셀 (확산 격자 풀)
  MOB: 'M:',      // 몬스터
  ITEM: 'I:',     // 아이템 (응축 에너지)
  STRUCT: 'S:',   // A6-2 구조 풀 (성장 = 잠긴 질서, 플레이어당 1)
  STASH: 'G:',    // A8-1 재료 창고 (종류별 채집물, region=null·플레이어당 종류마다 1)
  SOURCE: 'W:SRC',
  SINK: 'W:SINK',
};

// --- 이체 원인 태그 ---
export const CAUSE = {
  SPAWN: 'spawn', MOVE: 'move', GATHER: 'gather', REGEN: 'regen',
  ATTACK_COST: 'atk-cost', DAMAGE_LEECH: 'leech', DAMAGE_BURN: 'burn',
  WEAPON_WEAR: 'wear', CONDENSE: 'condense', DISSOLVE: 'dissolve',
  DEATH_DROP: 'death-drop', DIFFUSE: 'diffuse', RECYCLE: 'recycle', UPKEEP: 'upkeep',
  GROW: 'grow', CATABOLISM: 'catabolism', GIVE: 'give',
  MINE: 'mine', FORGE: 'forge',   // A8-1: 타입 채집(노드→창고) · 합성(창고+생체→아이템)
  DECAY: 'decay',                 // A9-2: 엔트로픽 누수(아이템→SINK) — 질서의 자발적 소산
};

// 3D 거리 — 위치·속도·사거리는 전부 3D. (Math.hypot 은 3인자 지원)
export function dist3(ax, ay, az, bx, by, bz) {
  return Math.hypot(ax - bx, ay - by, az - bz);
}

// 지역 키 유도 — 서버·클라 동일 함수 사용 (체크섬 정합의 전제).
// 컬럼형: 파티션은 (x,y) 수평 격자 — z 는 같은 컬럼 안에서 자유(수직은 분할하지 않는다).
export function regionKey(x, y) {
  return `${Math.floor(x / REGION_SIZE)}_${Math.floor(y / REGION_SIZE)}`;
}

export function regionNeighbors(x, y, radius = RELEVANCY_RADIUS) {
  const cx = Math.floor(x / REGION_SIZE), cy = Math.floor(y / REGION_SIZE);
  const keys = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++)
      keys.push(`${cx + dx}_${cy + dy}`);
  return keys;
}

// 이동 비용 — 잔여 거리 누적형. 서버·클라가 같은 양자화 비콘열에서 같은 값을 얻는다.
export function moveCost(debtPx, distPx) {
  const total = debtPx + distPx;
  return { cost: Math.floor(total / MOVE_COST_STRIDE_PX), debt: total % MOVE_COST_STRIDE_PX };
}
