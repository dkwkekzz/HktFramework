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
// 엔트로피는 양이 아니라 "품질/등급"의 문제다 — 에너지는 열린 흐름으로 세 등급을 지난다:
//   SOURCE → 생명 → 국소장(엔트로픽 확산으로 균일화) → (복사) → SINK.
//   고(저엔트로피) SOURCE=태양(영원한 저엔트로피 원천, 스폰으로만 방출)
//   중            국소장 M:<voxel>=흩어진 에너지가 국소에 쌓인 것(거름·재료의 씨앗, 재응집 가능)
//   저(고엔트로피) SINK=심우주(복사로 새어나간 진짜 손실 — 되돌아오지 않는다)
// SINK 는 단조 증가한다(엔트로피의 화살). 영속은 태양의 방대함이 주는 실용적 영속이다.
export const WORLD_SOURCE_INITIAL = 1_000_000_000;

// --- 국소장 엔트로픽 확산/복사 (feature-0004) — 결정론 시뮬 상수 (런타임 튜닝 금지) ---
export const MATERIAL_DIFFUSE_INTERVAL_TICKS = 1;   // 국소장 확산·복사 주기(틱)
export const MATERIAL_DIFFUSE_QUANTUM_DIVISOR = 64; // 한 번에 옮기는 양자 = floor((a+b)/이 값)
export const MATERIAL_RADIATE_DIVISOR = 4096;       // 심우주 복사 세금의 역수 (기대 복사율 = 국소장/이 값, 확률 반올림으로 정수화)

// --- 결정화 (feature-0005) — 결정론 시뮬 상수 (런타임 튜닝 금지) ---
// 결정 = 엔트로픽 조류에 맞서 맺히는 정적 저엔트로피 섬. 확산·복사 순회 대상이 아니라 면역이다.
// 과포화(국소장 농도 > 포화 임계)일 때만 초과분의 일부가 석출(precipitate)되어 결정으로 동결한다.
// 석출은 자기 제한 — 장을 포화까지 끌어내리면 멈춘다(현실의 침전 평형). 결정론(rng 미사용).
//   포화 임계는 국소장 평형 농도보다 조금 위로 둔다: 에너지가 국소에 몰린 뜨거운 지점(hotspot)에서만
//   결정이 맺히고, 평형(균일)에 이른 장에서는 맺히지 않는다 — "과포화 = 국소 저엔트로피 요동".
//   석출 속도는 상한(MAX)으로 묶어 아무리 몰려도 조류(확산)를 압도하지 않게 한다(장은 매질로 남는다).
export const CRYSTAL_SATURATION = 200;           // 복셀당 포화 임계 — 이 농도를 넘어야 석출 가능(과포화). 평형(~수십)보다 위, hotspot 에서 넘긴다
export const CRYSTAL_PRECIPITATE_DIVISOR = 64;   // 석출량 곡선 = floor((농도−포화)/이 값) (과포화가 클수록 빠르게, 단 MAX 로 상한)
export const CRYSTAL_PRECIPITATE_MAX = 8;        // 한 복셀이 한 틱에 석출하는 최대량 — 확산을 이기지 않게 하는 속도 상한
export const CRYSTAL_INTERVAL_TICKS = 1;         // 석출 판정 주기(틱) — 확산과 같은 리듬

// feature-0005 step2 — 결정은 개별 discrete 객체(I:<seq>)이며 여러 경로로 다양하게 생성된다:
//   (1) 과포화 석출(hotspot), (2) 죽음의 분해(생명체의 응집이 잔해 결정으로). 각 결정은 "종(species)"을 갖는다.
export const CRYSTAL_SPECIES_COUNT = 12;         // 결정 종 수 — 생성 다양성(색·후속 반응 규칙의 씨앗)
export const DEATH_CRYSTAL_FRACTION = 0.5;       // 죽을 때 결정(단단한 잔해)으로 응결되는 비율 — 나머지는 국소장으로 흩어진다(무른 조직)

// feature-0005 step3 — 반응(화학): 반경 안의 두 결정이 종에 따라 반응한다.
//   같은 종끼리 만나면 융합(순수 응집, 반응열 없음), 다른 종끼리 만나면 새 화합물 종으로 결합하며
//   반응열 일부를 국소장으로 방출(발열)한다. 규칙은 결정론(rng 미사용) — 같은 종쌍이면 같은 산물.
export const CRYSTAL_REACT_INTERVAL_TICKS = 5;   // 반응 판정 주기(틱) — 점진적(급격한 연쇄 방지)
export const CRYSTAL_REACT_RADIUS = 400;         // 두 결정이 이 거리 안이면 반응(px)
export const CRYSTAL_REACT_RELEASE_DIVISOR = 8;  // 다른 종 반응의 반응열 = floor(합/이 값) 을 국소장으로 방출

// 두 종이 만나 태어나는 화합물 종 — 결정론적 규칙(가환: a,b 순서 무관). 후속 규칙 확장의 진입점.
export function reactSpecies(a, b) {
  return (a + b + 1) % CRYSTAL_SPECIES_COUNT;
}

// feature-0005 step4 — 물질 상태(기체/액체/고체)는 새 물질이 아니라 국소장 에너지의 밀도 regime 이다.
//   저밀도=기체(등방 확산, 잘 샌다), 중밀도=액체(중력 따라 아래로 흐르고 고여 수면, 응집해 덜 샌다),
//   고밀도(포화 초과)=고체(결정 석출, feature-0005 step1). 상태는 농도 임계로 갈리고 상전이는 임계 통과로 창발.
export const LIQUID_CONDENSE = 100;      // 기체→액체 응축 임계 — 이 농도 이상이면 응집해 흐른다(액체). 국소장 평형(수십)보다 위 = 몰린 곳만 액체
export const LIQUID_CAPACITY = 180;      // 한 복셀이 액체로 담는 용량 — 아래가 이만큼 차면 넘쳐 위로(수면 상승). 포화(석출=200)보다 아래
export const LIQUID_SETTLE_MAX = 12;     // 한 틱에 아래 복셀로 가라앉는 최대량(점진적 = 수면이 서서히 형성)
export const LIQUID_COHESION = 6;        // 액체는 응집해 등방 확산이 1/이 값 (기체처럼 퍼지지 않고 뭉쳐 중력으로 흐른다)
export const LIQUID_RADIATE_DIVISOR = 16384; // 액체는 응집해 덜 증발한다 — 기체(MATERIAL_RADIATE_DIVISOR=4096)보다 4배 큰 = 손실 1/4

// --- 생명체(creature) (feature-0006) — 능동적 저엔트로피 섬(dissipative structure) ---
// 생명체는 스스로 에너지 질서를 유지한다: 살아있음 자체가 비용(물질대사)이고, 그 비용을 대기 위해
// 세계로부터 에너지를 갈구(forage)하며, 대지 못하면(최소 예비 아래로 떨어지면) 질서가 붕괴해 죽는다.
//   흐름: SOURCE →(스폰)→ 생명체 →(대사)→ 심우주(SINK)  +  국소장 →(갈구)→ 생명체.
//   즉 생명체는 세계의 흩어진 에너지(국소장)를 제 몸으로 끌어와 질서를 유지하고, 그 유지 비용은
//   되돌아오지 않는 손실(심우주)로 export 한다 — 저엔트로피를 유지하려면 반드시 엔트로피를 밖으로 버려야 한다.
//   그래서 자기 폐기물을 재섭취할 수 없고(심우주로 새 나감), 계속 세계로부터 갈구해야만 산다.
//   결정론 시뮬 상수(런타임 튜닝 금지) — rng 미사용(순수 클램프)이라 확산 결정론에 영향 없다.
export const CREATURE_MAX_ENERGY = 1000;             // 내부 에너지 용량(질서의 상한 = setpoint)
export const CREATURE_SPAWN_GRANT = 400;             // 스폰 시 SOURCE 에서 인출(저엔트로피 주입 — feature-0003)
export const CREATURE_BASAL_COST = 3;                // 매 대사 틱 심우주로 방출하는 질서 유지 비용(살아있음의 엔트로피 세금)
export const CREATURE_FORAGE_RATE = 5;               // 매 대사 틱 국소장에서 흡수 시도하는 최대량(갈구) — 대사보다 커야 풍요 환경에서 산다
export const CREATURE_DEATH_THRESHOLD = 60;          // 최소 예비 에너지 — 갈구 후에도 이 아래면 질서 붕괴(죽음). 0 보다 위라 죽을 때 잔해가 남는다
export const CREATURE_METABOLISM_INTERVAL_TICKS = 1; // 대사(갈구+소모+생사판정) 주기(틱) — 확산과 같은 리듬

// 국소장 복셀의 상태(고체는 그 자리 결정 유무로 별도 판정) — 서버·클라 공용(뷰어 라벨 정합).
export function fieldPhase(balance) {
  if (balance >= CRYSTAL_SATURATION) return 'dense'; // 과포화 — 석출(고체)로 향하는 고밀도
  if (balance >= LIQUID_CONDENSE) return 'liquid';   // 중밀도 — 흐르고 고인다
  if (balance > 0) return 'gas';                     // 저밀도 — 퍼진다
  return 'empty';
}

// --- 풀 ID 접두 ---
export const POOL = {
  PLAYER: 'P:',    // 플레이어 생체 에너지 (region=null — 좌표는 권위가 아니다)
  SOURCE: 'W:SRC', // 태양 — 유일한 저엔트로피 원점(생성기 아님, 스폰으로만 방출)
  SINK: 'W:SINK',  // 심우주 — 복사로 새어나간 진짜 손실 (단조 증가, 복귀 없음)
  MATERIAL: 'M:',  // 국소장 접두 — M:<regionKey> 가 그 지역의 흩어진 에너지(중등급, 재응집 가능)
  CRYSTAL: 'I:',   // 결정 접두 — I:<voxel> 가 그 복셀에 석출된 정적 저엔트로피 형태(확산·복사 면역, feature-0005)
  CREATURE: 'C:',  // 생명체 접두 — C:<seq> 가 능동적 저엔트로피 섬(대사로 질서 유지, 갈구로 보충 — feature-0006)
};

// --- 이체 원인 태그 ---
export const CAUSE = {
  SPAWN: 'spawn',       // SOURCE → 플레이어 (스폰 인출)
  MOVE: 'move',         // 플레이어 → 국소장 (이동 소산 — 활동 에너지가 국소로 흩어진다)
  DEATH: 'death',       // 플레이어 → 국소장 (접속 종료 = 응집 소멸 → 그 자리 국소장으로, 태양행 아님)
  DIFFUSE: 'diffuse',   // 국소장 ↔ 국소장 (엔트로픽 확산 — 이웃으로 높은 확률로 흩어짐)
  RADIATE: 'radiate',   // 국소장 → SINK (심우주 복사 — 되돌아오지 않는 엔트로피 세금)
  CRYSTALLIZE: 'crystallize', // 국소장 → 결정 (과포화 석출 · 죽음의 응결 — 정적 저엔트로피 형태로 동결, feature-0005)
  REACT: 'react',       // 결정 ↔ 결정 / 결정 → 국소장 (반응: 융합·화합·반응열 방출, feature-0005 step3)
  SETTLE: 'settle',     // 국소장 → 아래 국소장 (액체 중력 침강 — 아래로 흐르고 고인다, feature-0005 step4)
  FORAGE: 'forage',     // 국소장 → 생명체 (갈구 — 세계의 흩어진 에너지를 흡수해 내부 질서를 보충, feature-0006)
  METABOLIZE: 'metabolize', // 생명체 → 심우주 (물질대사 — 살아있음의 엔트로피 세금, 되돌아오지 않는 손실, feature-0006)
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

// 국소장은 3D 복셀 격자다 (feature-0004 step2) — 수평은 지역 컬럼(x,y), 수직은 z 를
//   FIELD_Z_LAYERS 층으로 나눈다. 세계가 3D 이므로 에너지도 3D 로 흩어지고 확산한다.
export const FIELD_Z_LAYERS = 4;         // 국소장 복셀의 수직 분할 수 (층 높이 = WORLD_HEIGHT / 이 값)

export function fieldLayer(z) {
  const h = WORLD_HEIGHT / FIELD_Z_LAYERS;
  return Math.max(0, Math.min(FIELD_Z_LAYERS - 1, Math.floor(z / h)));
}

// 좌표가 속한 국소장 복셀 id — M:<cx>_<cy>_<cz>. (feature-0004)
export function materialKey(x, y, z) {
  return `${POOL.MATERIAL}${regionKey(x, y)}_${fieldLayer(z)}`;
}

// 결정 종 유도 — 결정론 rng(형성 문맥) 으로 종을 뽑는다. 종은 색·후속 반응 규칙의 씨앗. (feature-0005 step2)
export function pickSpecies(rng) {
  return Math.floor(rng() * CRYSTAL_SPECIES_COUNT);
}

// 엔트로픽 이체 방향 확률 (feature-0004 의 핵심 법칙) —
//   이웃한 두 국소장 사이에서 한 양자가 from→to 로 갈 확률. concFrom/(concFrom+concTo).
//   고농도 쪽에서 나갈 확률이 높다(down-gradient 편향). 농도가 같으면 1/2 → 순 흐름 0(평형).
//   "엔트로픽 법칙에 따라 높은 확률로 이동할 뿐" — 강제가 아니라 확률적 경향이다.
export function entropicOutProb(concFrom, concTo) {
  const total = concFrom + concTo;
  return total > 0 ? concFrom / total : 0.5;
}
