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
// 구조 풀 `S:<playerId>` 는 플레이어당 1개. 예치는 `player→STRUCT` 이체 — 창조가 아니라
// 자유 에너지의 질서화다(총합 불변). 사망 시 지속(영구 성장), 접속 종료 시 SINK 로 환원.
export const STRUCT_MAX = 10_000;        // 구조 풀 용량 상한 (성장 여지)
export const GROW_AMOUNT = 50;           // GROW 인텐트 기본 예치량 (msg.amount 로 재정의 가능)
// A6-3 스탯 = 흐름 계수: 스탯은 저장 숫자가 아니라 구조 예치의 결정론 함수 (shared/growth.js).
export const GROWTH_ATK_DIVISOR = 100;    // 구조 100 당 공격 +1 (피격자 클램프 내)
export const GROWTH_UPKEEP_DIVISOR = 200; // 구조 200 당 대사 +1 (큰 질서일수록 유지 비용↑)

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
export const FIELD_CELL_SEED = 3000;       // 창세 시 SOURCE→셀 초기 적립 (셀당)
export const FIELD_INJECT_AMOUNT = 40;     // 재충전 틱당 SOURCE→셀 보충 (필드 지속)

// --- 채집 ---
export const NODE_COUNT = 40;
export const NODE_MIN_MAX = 400;         // 노드 용량 하한
export const NODE_MAX_MAX = 1200;        // 노드 용량 상한
export const NODE_REGEN_AMOUNT = 40;     // 재충전 틱당 SRC→노드 이체량
export const GATHER_RANGE = 80;
export const GATHER_AMOUNT = 25;         // 채집 1회 요청량 (잔고·수용량으로 클램프)

// --- 전투 ---
export const ATTACK_RANGE = 120;
export const ATTACK_COST = 5;            // 시전 비용: 공격자 → SINK
export const ATTACK_DAMAGE = 30;         // 맨손 데미지 (결정론 롤의 중앙값)
export const ATTACK_DAMAGE_VAR = 10;     // A2: 데미지 롤 분산 → 위임 판정이 의미를 갖는 폭 [30±10]
export const WEAPON_BONUS = 30;          // 무기 소지 시 추가 데미지
export const WEAPON_WEAR = 5;            // 공격 1회당 무기 내구(=에너지) → SINK
export const LEECH_PERCENT = 50;         // 데미지 중 공격자가 흡수하는 비율 (%), 나머지는 SINK
export const ATTACK_COOLDOWN_MS = 800;

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
  SOURCE: 'W:SRC',
  SINK: 'W:SINK',
};

// --- 이체 원인 태그 ---
export const CAUSE = {
  SPAWN: 'spawn', MOVE: 'move', GATHER: 'gather', REGEN: 'regen',
  ATTACK_COST: 'atk-cost', DAMAGE_LEECH: 'leech', DAMAGE_BURN: 'burn',
  WEAPON_WEAR: 'wear', CONDENSE: 'condense', DISSOLVE: 'dissolve',
  DEATH_DROP: 'death-drop', DIFFUSE: 'diffuse', RECYCLE: 'recycle', UPKEEP: 'upkeep',
  GROW: 'grow',
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
