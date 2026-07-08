// ============================================================================
// 시뮬레이션 상수 — 서버·클라 공용 단일 출처 (최소 원장 코어)
//
// 결정론에 영향을 주는 값은 전부 여기 고정한다 (런타임 튜닝 금지 영역).
// 에너지 단위는 전부 정수. 보존 불변식: 전 풀 합계 = WORLD_SOURCE_INITIAL 고정.
//
// 이 파일은 "규칙"이 아니라 "기반"만 담는다 — 게임플레이(채집·전투·성장 등)는
// feature 로 추가하며 그때 필요한 상수를 여기에 얹는다.
// ============================================================================

// --- 월드 (공간은 3D — x,y 수평 + z 높이. region 격자는 (x,y) 컬럼, z 는 컬럼 내 자유) ---
export const WORLD_SIZE = 2000;          // 월드 수평 한 변 (px)
export const WORLD_HEIGHT = 1000;        // 월드 수직 범위 (z, px)
export const REGION_SIZE = 500;          // 관심영역/체크섬 격자 한 변 → 수평 4x4 컬럼
export const WORLD_SEED = 20260702;      // 결정론 월드 시딩 (서버·클라 동일 유도 — feature 확장용)
export const SPAWN_POS = { x: 1000, y: 1000, z: WORLD_HEIGHT / 2 };

// --- 틱 / 네트워크 ---
export const TICK_RATE = 10;             // 서버 원장 틱 (Hz) — 서버는 이 빈도로만 깨어난다
export const BEACON_INTERVAL_MS = 200;   // 클라 좌표 비콘 5Hz
export const CHECKSUM_INTERVAL_TICKS = 30; // 3초마다 지역 보존 체크섬
export const FIELD_INTERVAL_TICKS = 5;     // 0.5초마다 국소장 그리드 스냅샷 방송 (확산 시각화)
export const RELEVANCY_RADIUS = 1;       // 자기 지역 기준 (2R+1)^2 = 3x3 구독

// --- 이동 (에너지 지출 = 스피드핵 예산 검증의 근거) ---
export const MAX_SPEED = 240;            // px/s
export const MOVE_COST_STRIDE_PX = 50;   // 50px 이동당 에너지 1 소모 (player→국소장 소산)
export const BEACON_TOLERANCE = 1.5;     // 속도 검증 허용 배율 (지터 흡수)
export const BEACON_SLACK_PX = 24;       // 속도 검증 고정 여유

// --- 플레이어 풀 ---
export const PLAYER_MAX_ENERGY = 1000;
export const SPAWN_GRANT = 300;          // 스폰 시 WORLD_SOURCE 에서 인출

// --- 월드 소스/싱크 + 국소장 (에너지의 세 등급 — feature-0004 엔트로픽) ---
// 창세에 전 에너지가 SOURCE 에 적립된다. 이후 전 풀 합계는 영원히 WORLD_SOURCE_INITIAL(보존).
// 엔트로피는 양이 아니라 "품질/등급"의 문제다 — 에너지는 세 등급으로 흐른다:
//   고(저엔트로피) SOURCE=태양(영원한 저엔트로피 원천, 스폰으로만 방출)
//   중            국소장 M:<region>=흩어진 에너지가 국소에 쌓인 것(거름·재료의 씨앗, 재응집 가능)
//   저(고엔트로피) SINK=심우주(복사로 새어나간 진짜 손실 — 되돌아오지 않는다)
// feature-0004 이전(0003)엔 태양 순환(SINK→SOURCE)이 닫힌 루프로 영속을 샀으나, 그 텔레포트는
// "소산이 태양으로 되돌아간다"는 물리적 거짓이라 삭제했다. 이제 흐름은 열린 흐름이다:
//   SOURCE → 생명 → 국소장(엔트로픽 확산으로 균일화) → (복사) → SINK.
// SINK 는 단조 증가한다(엔트로피의 화살). 영속은 태양의 방대함이 주는 실용적 영속이다.
export const WORLD_SOURCE_INITIAL = 1_000_000_000;

// --- 국소장 엔트로픽 확산/복사 (feature-0004) — 결정론 시뮬 상수 (런타임 튜닝 금지) ---
export const MATERIAL_DIFFUSE_INTERVAL_TICKS = 1;   // 국소장 확산·복사 주기(틱)
export const MATERIAL_DIFFUSE_QUANTUM_DIVISOR = 64; // 한 번에 옮기는 양자 = floor((a+b)/이 값)
export const MATERIAL_RADIATE_DIVISOR = 4096;       // 심우주 복사 세금의 역수 (기대 복사율 = 국소장/이 값, 확률 반올림으로 정수화)

// --- 풀 ID 접두 ---
export const POOL = {
  PLAYER: 'P:',    // 플레이어 생체 에너지 (region=null — 좌표는 권위가 아니다)
  SOURCE: 'W:SRC', // 태양 — 유일한 저엔트로피 원점(생성기 아님, 스폰으로만 방출)
  SINK: 'W:SINK',  // 심우주 — 복사로 새어나간 진짜 손실 (단조 증가, 복귀 없음)
  MATERIAL: 'M:',  // 국소장 접두 — M:<regionKey> 가 그 지역의 흩어진 에너지(중등급, 재응집 가능)
};

// --- 이체 원인 태그 ---
export const CAUSE = {
  SPAWN: 'spawn',       // SOURCE → 플레이어 (스폰 인출)
  MOVE: 'move',         // 플레이어 → 국소장 (이동 소산 — 활동 에너지가 국소로 흩어진다)
  DEATH: 'death',       // 플레이어 → 국소장 (접속 종료 = 응집 소멸 → 그 자리 국소장으로, 태양행 아님)
  DIFFUSE: 'diffuse',   // 국소장 ↔ 국소장 (엔트로픽 확산 — 이웃으로 높은 확률로 흩어짐)
  RADIATE: 'radiate',   // 국소장 → SINK (심우주 복사 — 되돌아오지 않는 엔트로피 세금)
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

// 좌표가 속한 국소장 풀 id — 지역 컬럼(x,y)마다 M:<regionKey> 하나. (feature-0004)
export function materialKey(x, y) {
  return `${POOL.MATERIAL}${regionKey(x, y)}`;
}

// 엔트로픽 이체 방향 확률 (feature-0004 의 핵심 법칙) —
//   이웃한 두 국소장 사이에서 한 양자가 from→to 로 갈 확률. concFrom/(concFrom+concTo).
//   고농도 쪽에서 나갈 확률이 높다(down-gradient 편향). 농도가 같으면 1/2 → 순 흐름 0(평형).
//   "엔트로픽 법칙에 따라 높은 확률로 이동할 뿐" — 강제가 아니라 확률적 경향이다.
export function entropicOutProb(concFrom, concTo) {
  const total = concFrom + concTo;
  return total > 0 ? concFrom / total : 0.5;
}
