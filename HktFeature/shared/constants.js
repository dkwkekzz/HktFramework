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
export const CREATURE_DEATH_THRESHOLD = 60;          // 최소 예비 에너지(size 1 기준) — 갈구 후에도 이 아래면 질서 붕괴(죽음). 0 보다 위라 죽을 때 잔해가 남는다
export const CREATURE_METABOLISM_INTERVAL_TICKS = 1; // 대사(갈구+소모+생사판정) 주기(틱) — 확산과 같은 리듬

// feature-0006 step2 — 성장·스탯: 질서 유지에 흑자가 쌓이면 성장한다. 스탯(size)은 에너지 이력의 창발 지표다.
//   용량·갈구·대사·예비가 전부 size 에 비례한다 — 큰 몸은 더 많이 담고 더 많이 갈구하되 더 많이 대사한다.
//   그래서 큰 몸을 유지하려면 세계가 그만큼 받쳐줘야 하고, 세계 풍요도가 개체 크기의 상한을 자연히 정한다.
//   성장은 hard-won — 굶주리면 성장점이 깎여 진척이 되돌아간다. 큰 몸은 대사도 커서 세계가 못 받치면 굶어 죽는다.
//   결정론 시뮬 상수(rng 미사용) — size·growth 는 순수 상태 변수(에너지 풀이 아님)라 보존과 무관하게 창발한다.
export const CREATURE_SIZE_MAX = 5;                  // 스탯 상한(size 1~5)
export const CREATURE_GROWTH_FULL_FRACTION = 0.9;    // 잔고가 용량의 이 비율 이상이면 흑자(성장점 +1 적립)
export const CREATURE_GROWTH_HUNGRY_FRACTION = 0.25; // 잔고가 용량의 이 비율 미만이면 적자(성장점 −2, 0 에서 클램프 = 진척 되돌아감)
export const CREATURE_GROWTH_THRESHOLD = 300;        // 성장 문턱 — 흑자로 이 값에 닿으면 size +1(용량·능력 확장)

// feature-0007 채집·섭취 — 생명체가 근접 결정(=아이템, 에너지의 결정체)을 흡수한다. 결정은 원래 정적·면역
//   (feature-0005)이지만 생명이 가까이 오면 그 정적 질서가 풀린다 — 결정 → 생명체로 농축 에너지가 흘러든다.
//   확산장 갈구(feature-0006)가 옅은 에너지를 조금씩 긁는 것이라면, 채집은 결정에 뭉친 에너지를 크게 들이켜는
//   것(증폭). 그래서 결정 곁의 생명체는 훨씬 빨리 채워지고 성장한다. 결정을 다 먹으면 그 결정은 소멸한다.
//   결정론 시뮬 상수(rng 미사용, 순수 클램프) — 확산·성장 결정론에 영향 없다.
export const CREATURE_HARVEST_RADIUS = 300;    // 이 반경 안의 결정을 채집한다(px) — 정적 질서가 풀리는 근접 거리
export const CREATURE_HARVEST_RATE = 40;       // 매 대사 틱 결정에서 흡수하는 최대량(size 비례) — 확산 갈구(5)보다 훨씬 크다(농축=증폭)

// feature-0007 step2 — 종별 효과: 아이템(결정)의 종(species)에 따라 채집이 다르게 작용한다.
//   "아이템은 나의 에너지에 영향을 줄 수 있는 형태" — 같은 잔고의 결정이라도 종마다 흡수 배율(증폭 세기)이 다르다.
//   순수 클램프·결정론(rng 미사용) — 배율은 종에서 결정론적으로 유도한다(색과 같은 씨앗). 종별 색 옥타가
//   곧 "어떤 아이템인지"의 표식이 되고, 고효율 종 곁의 생명체는 같은 결정을 더 크게 들이켜 빨리 성장한다.
export const CREATURE_HARVEST_YIELD = [3, 1, 2, 1, 2, 3, 1, 2, 1, 3, 2, 1]; // 종별 흡수 배율(길이=CRYSTAL_SPECIES_COUNT)

// 결정 종 → 채집 흡수 배율. 종을 CRYSTAL_SPECIES_COUNT 로 감싸 항상 유효 범위. (feature-0007 step2)
export function crystalYield(species) {
  const n = CRYSTAL_SPECIES_COUNT;
  return CREATURE_HARVEST_YIELD[((species % n) + n) % n] ?? 1;
}

// --- 발산·전투 = 포식(predation) (feature-0008) — 저항하는 저엔트로피 섬에서 뜯어내는 흡수 ---
// forage(국소장)·harvest(결정)는 수동적 저장고에서 긁는다. 생명체는 능동적으로 질서를 유지하므로,
// 그 에너지를 뺏으려면 먼저 그 질서를 무너뜨려야 하고 무질서를 만드는 일에는 비용이 든다(발산). 그래서
// "채집"이 아니라 "전투"로 보인다 — 대상이 저항하기 때문일 뿐, 물리적으로는 세 번째 free energy 수입이다.
//   회계(전부 ledger.transfer → 보존): ① 발산 비용 A→SINK(질서 깨는 일 = 열) ② 상대 질서 붕괴 damage
//   ③ 손실적 회수 — damage 중 CAPTURE_PCT 만 A 로(강탈), 나머지는 국소장으로 흩어진다(못 붙잡은 몫).
//   효율<1 이라 A 가 얻는 것 < victim 이 잃는 것 = 열역학적으로 정직(2법칙). 생태학의 영양 전달 ~10% 법칙의
//   결 — 포식으로 무한히 커질 수 없다(먹이사슬이 짧아지는 창발적 상한). 결정론(rng 미사용, 순수 클램프).
export const CREATURE_ATTACK_INTERVAL_TICKS = 2;  // 발산(전투) 판정 주기 — 이따금 터지는 근접전(대사보다 느슨)
export const CREATURE_ATTACK_RADIUS = 200;        // 근접 사거리(px) — 채집(300)·반응(400)보다 가깝다(밀착 포식)
export const CREATURE_ATTACK_POWER = 40;          // 한 번의 발산이 무너뜨리는 상대 질서(×attacker size)
export const CREATURE_ATTACK_COST = 6;            // 발산 비용 = 질서를 깨는 일(×attacker size) → SINK(열, 되돌아오지 않음)
export const CREATURE_ATTACK_CAPTURE_PCT = 40;    // 붕괴 에너지 중 붙잡는 비율(효율<1) — 나머지는 국소장으로 흩어진다

// --- 발산·파괴 = 방출형 (feature-0009) — 회수 없는 원거리 파괴 ---
// 강탈(feature-0008)이 표적 에너지를 커플링해 일부 포획(수입)하는 것이라면, 방출은 표적의 질서를 *파괴만* 한다 —
// 붕괴 에너지가 캐스터가 아니라 세계(심우주 열 + 국소장 연기)로 흩어진다. 캐스터는 순수 지출(먹지 않음). 그래서
// "내가 얻는가"가 곧 검증 명제 — 강탈은 내가 크고, 방출은 내가 줄 뿐이다. 표적은 **먹을 수 없는 상대**(size ≥
// 자신) — 강탈(먹이=size<)과 겹치지 않게 갈랐다. 그래서 약자·동급이 강자를 어쩌는 유일한 수단이 방출이다
// (포식의 한계를 뚫는 값비싼 반격). 세게 맞은 표적은 완전 연소(잔해 결정조차 없이 전소). 결정론(rng 미사용).
export const DISCHARGE_INTERVAL_TICKS = 4;   // 방출 판정 주기 — 폭발적이라 강탈(2)보다 뜸하다
export const DISCHARGE_RADIUS = 500;         // 원거리 사거리(px) — 근접 강탈(200)보다 길다(투사체)
export const DISCHARGE_POWER = 70;           // 한 발이 파괴하는 표적 질서(×caster size) — 순간 파괴는 강탈보다 크다
export const DISCHARGE_COST = 20;            // 발산 비용(×caster size) → SINK. 강탈(6)보다 비싸다(회수 없는 순수 지출)
export const DISCHARGE_BURN_PCT = 60;        // 파괴 damage 중 심우주로 태우는 비율(열) — 나머지는 국소장(연기)

// --- 제어·욕망 (feature-0010) — 플레이어/봇이 하나의 생명체를 제어한다 ---
// 제어의 핵심은 "욕망(desire)"이다: 생명체에 부여하는 동기 — 무엇을 향해 에너지를 얻으러 갈지.
//   욕망은 표적(에너지원)을 정하고, 생명체는 그 표적으로 **이동**한다. 이동은 활동 에너지를 그 자리
//   국소장으로 흩는 소산(생명체→국소장, feature-0004 의 MOVE 와 같은 원리)이다 — 즉 "이동은 욕망을
//   이루기 위한 수단이고, 그 수단은 에너지로 지불된다". 표적에 도달하면 기존 획득 규칙(채집 0007·사냥
//   0008)이 수입을 만든다. 그래서 한 욕망은 **수입 > 이동 비용**일 때만 값어치가 있다 — 제어의 전
//   과정이 에너지 흐름으로 닫힌다(feature-0001~0009 정합). 욕망은 확장의 근간이다: 채집·사냥을 먼저
//   세우고 제조(craft) 등 새 표적은 후속 step 에서 얹는다. 순수 클램프(rng 미사용) → 확산·성장 결정론 불변.
export const DESIRE = {
  NONE: 'none',       // 대기 — 자율 추적 없음. 소유 생명체는 주인 곁을 따른다(수동 이동=방향키의 목적지)
  FORAGE: 'forage',   // 채집 — 가장 가까운 결정을 향한다(도달 시 흡수, feature-0007)
  HUNT: 'hunt',       // 사냥 — 가장 가까운 더 작은 생명체를 향한다(도달 시 포식, feature-0008)
};
export const CREATURE_PURSUE_INTERVAL_TICKS = 1; // 욕망 추적(이동) 판정 주기(틱) — 매 틱(부드러운 이동)
export const CREATURE_STRIDE = 24;               // 한 추적 틱에 나아가는 최대 거리(px) — 240px/s @ 10Hz(플레이어 속도감)
export const CREATURE_SEEK_RADIUS = 900;         // 욕망의 표적을 감지하는 반경(px) — 무한 시야가 아니라 국소적 인지
export const CREATURE_LEASH_STOP = 48;           // 소유 생명체가 주인 곁 이 거리 안이면 멈춘다(수동 추종의 도달 반경)

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
  HARVEST: 'harvest',   // 결정 → 생명체 (채집 — 근접 결정의 농축 에너지를 흡수, 정적 질서를 푼다, feature-0007)
  ATTACK: 'attack',     // 생명체 → 생명체 / 생명체 → 국소장 (강탈=포식: 붕괴 에너지의 손실적 회수·흩어짐, feature-0008)
  BURST: 'burst',       // 생명체 → 심우주 (발산 비용 = 상대 질서를 깨는 일, 열로 손실, feature-0008·0009 공용)
  DISCHARGE: 'discharge',// 생명체 → 심우주 / 생명체 → 국소장 (방출=파괴: 표적 질서를 열·연기로 흩음, 회수 없음, feature-0009)
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
