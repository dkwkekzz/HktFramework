// 포식수 둥지 — depth wild. C002 에서는 출구 하나뿐인 빈 방이다 (01-spec SPEC-001 경계).
//
// anchor NEST_TRAIL 은 동쪽 변 근처 — 숲 안쪽으로 돌아가는 길 하나가 전부다.
//
// C014 ADDED — 이 방이 **사슬의 시작**을 낳는다 (Play §5.0 · A.3 "생태 부산물").
// 포식수가 남긴 사체 위에 균사가 피고, 그 균류가 사체를 삭여 흙을 붉게 되돌린다 —
// 거목이 다시 빨아올릴 것이 거기서 온다 (D2 거목균 ②). 그래서 이 방의 흙은 붉고,
// 이것을 캐 놓으면 두 방 건너 노두까지 멎는다 (spec SPEC-002).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import { DEPTH_LAYER, HAZARD_LAYER } from './phases';
import {
  LIFE_FUNGUS_CROWDED,
  LIFE_NEEDS_CARCASS,
  LIFE_ROLE_DECAY_SUPPLY,
  POPULATION_DECLINE_CONDITION_LOST,
  POPULATION_DECLINE_EATEN,
  RULE_NEST_TRANSFORM,
} from './ecology';
import {
  BIG_BIRD,
  FORM_CARCASS_BLOOM,
  PREDATOR,
  PRESENCE_PREDATOR,
  TREE_FUNGUS,
} from './lives';
import {
  FOREST_CHAIN,
  FORM_CARCASS,
  FORM_GLOW_CAP,
  FORM_HUSK_SHARD,
  FORM_NEST_MYCELIUM,
  GIANT_TREE_FUNGUS,
  NO_DECOMPOSER,
  ORE_EATER_MOLT,
  PRESENCE_LAYER,
  RECOVERY_CARCASS_DECAY,
  RECOVERY_HUSK_SHED,
  RECOVERY_NEST_KILL,
  RECOVERY_NIGHT_BLOOM,
  RESOURCE_LAYER,
  soilStainTag,
  TRACE_LAYER,
} from './resource-ecology';

export const PREDATOR_NEST = 'PREDATOR_NEST';

export const PREDATOR_NEST_SPEC: RegionSpec = {
  id: PREDATOR_NEST,
  depth: 'wild',
  space: {
    id: PREDATOR_NEST,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 5,
    ops: [
      {
        id: 'anchor-nest-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'NEST_TRAIL',
        position: { x: 18, z: 0 },
      },
      // ── C014 ADDED — 흔적과 원천 ──────────────────────────────────────────
      //
      // 바닥 2 · 균사 둘레 4 (spec 데이터 표 · 기본형 ⑧). 중간부(숲 안쪽)와 같은 단계의
      // 바닥 위에 핵심부에 버금가는 둘레가 얹힌다 — 균류가 삭인 흙이 붉게 되돌아오기
      // 때문이다 (D2 거목균 ②). C011 이 세운 사다리를 그대로 잇는다: 방 바닥 위에
      // 원천 둘레가 겹치고, 겹침은 짙기이지 양이 아니다.
      //
      // 자리 (-6, 4) 의 근거 — 이 방은 op 가 anchor 하나뿐이라 어디나 평지이고(컴파일해
      // 격자를 훑어 확인: 방 전체가 통행 가능), 하나뿐인 출구 NEST_TRAIL(18, 0) 에서 24 남짓
      // 떨어져 있어 들어서자마자 밟는 자리가 아니다. 둘레 반지름 7 은 다른 원천의 둘레와
      // 같은 값이고, 그 원이 extent(-20..20) 안에 온전히 든다.
      {
        id: 'trace-nest-base',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(2),
        shape: {
          kind: 'polygon',
          points: [
            { x: -20, z: -20 },
            { x: 20, z: -20 },
            { x: 20, z: 20 },
            { x: -20, z: 20 },
          ],
        },
      },
      {
        id: 'trace-nest-fungus',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: -6, z: 4 }, radius: 7 },
      },
      {
        id: 'source-nest-fungus',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'NEST_FUNGUS',
        position: { x: -6, z: 4 },
      },
      // ── RoomBearsMaterial 실주행 판정 ADDED — 흩어진 것들 ──────────────────────
      //
      // Human 의 답: "재료가 너무 적고 채집하는 재미가 부족하다." 방의 중심이던 원천 곁에
      // **작은 것 여럿**이 흩어져 선다 — 걸어 다니며 줍는 것이다. 자리는 이미 선 것들(원천 · 출구 ·
      // 선의 마디 · 막힌 땅)과 겹치지 않는 평지에서 골랐고, 둘레 흔적은 방 바닥보다 한 단계 짙되
      // 반지름 4 로 작다 (중심 원천의 7 과 갈려 "작은 것" 으로 읽힌다). 규칙은 하나도 늘지 않는다.
      {
        id: 'trace-glow-cap-nest-1',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: 6, z: -8 }, radius: 4 },
      },
      {
        id: 'source-glow-cap-nest-1',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'GLOW_CAP_NEST_1',
        position: { x: 6, z: -8 },
      },
      {
        id: 'trace-glow-cap-nest-2',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: -10, z: -12 }, radius: 4 },
      },
      {
        id: 'source-glow-cap-nest-2',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'GLOW_CAP_NEST_2',
        position: { x: -10, z: -12 },
      },
      {
        id: 'trace-husk-shard-nest',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: 8, z: 8 }, radius: 4 },
      },
      {
        id: 'source-husk-shard-nest',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'HUSK_SHARD_NEST',
        position: { x: 8, z: 8 },
      },
      // ── C024 ADDED — 사체와 그것이 바뀌는 자리 (Play §5.7 · spec 데이터 값 표) ─────
      //
      // 이 방의 이름이 처음부터 말하던 것을 땅에 세운다: 포식수가 두고 간 **사체**가 있고,
      // 그 곁에서 사체가 **균류로 바뀐다** (TRANSFORMATION). C014 가 세운 균사(NEST_FUNGUS)는
      // 그 뒤에 오는 것이고 — 이제 그 되돌아옴이 여기서 난 거목균의 값에 매인다.
      //
      // **자리의 근거** (이 방의 규율 그대로 — 실측은 compileRegion 으로 확인했다).
      //   · 사체 (-15, 10) · 변성지 (-14, 15) 는 이 방의 **북서 안쪽**이다. 하나뿐인 출구
      //     NEST_TRAIL(18, 0) 에서 34.5 · 35.3 떨어져 있어 들어서자마자 밟는 자리가 아니다
      //     (사체는 둥지의 가장 깊은 자리에 있다).
      //   · 둘 다 · 그 둘레 반경 4 의 여덟 방위까지 전부 통행 가능한 평지(surface=flat · 높이 0)다.
      //   · 이미 선 것들과 겹치지 않는다 — 균사 둘레(중심 (-6, 4) · 반경 7)에서 10.82 와 13.60
      //     이라 두 원이 만나지 않고(10 · 11 이 한계), 흩어진 것 셋(반경 4)에서는 22 넘게 멀다.
      //   · 자락이 extent(-20..20) 안에 온전히 든다 — 사체 x -18..-12 · z 7..13 ·
      //     변성지의 가장 넓은 자락 x -18..-10 · z 11..19.
      //
      // **흙 태그는 이 방의 사다리를 따른다** (바닥 2 · 균사 둘레 4). 냄새 3 → 삭는 모양 4 →
      // 붉게 되돌아온 흙 5 로 안으로 갈수록 짙어지고, 겹친 자리는 짙은 쪽이 이긴다(traceStrengthAt).
      // 5 는 이 방에 처음 서는 단계다 — **터진 뒤 120 초뿐**이고(traces.after 는 SPENT 동안만
      // 선다), 그래서 "균사 둘레가 이 방의 정점" 이라는 C014 의 사실은 가만한 세계에서 그대로다.
      {
        id: 'trace-nest-carcass',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: -15, z: 10 }, radius: 3 },
      },
      {
        id: 'source-nest-carcass',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'NEST_CARCASS',
        position: { x: -15, z: 10 },
      },
      // 사체가 균류로 바뀌는 자리 — 자리를 Description 이 소유하는 것은 원천과 **같은 규율**이다
      // (C011 R3): 탄생지의 id 와 이 point 의 tag 가 같은 이름으로 이어진다.
      {
        id: 'source-carcass-bloom',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'CARCASS_TO_FUNGUS',
        position: { x: -14, z: 15 },
      },
      // 전조 ① **삭는 모양** — 사체가 없으면 서지 않고, 결속하는 동안 한 단계 옅어진다
      // (재료가 그리로 간다). 반경 2.5 는 사체의 자리 (-15, 10) 를 덮지 않는다 (5.10 > 2.5)
      {
        id: 'trace-nest-rot',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: -14, z: 15 }, radius: 2.5 },
      },
      // 전조 ② **냄새의 자리** — 조건도 옅어짐도 없다: 여기 무언가 삭고 있다는 것만 말한다.
      // 사체 둘레(반경 3 · 단계 3)와 살짝 겹치지만 **같은 단계**라 이음매가 없다 —
      // 냄새는 사체에서 번지는 것이므로 두 자락이 이어지는 것이 옳다
      {
        id: 'trace-nest-odor',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: -14, z: 15 }, radius: 4 },
      },
      // 뒤 자락 **붉게 되돌아온 흙** — 태어난 뒤 SPENT 인 동안에만 선다
      // (RULE-LIFE-SITE-PHASE-001). 그때 사체는 이미 먹혀 없으므로 위의 삭는 모양은 가려지고,
      // 같은 자리가 4 에서 5 로 **한 단계 짙어진다** — 관찰자가 무엇이 지나갔는지를 흙으로 읽는다
      {
        id: 'trace-nest-returned-soil',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(5),
        shape: { kind: 'circle', center: { x: -14, z: 15 }, radius: 3 },
      },
      // ── RoomNeverSame 실주행 판정 ADDED — 철이 이 방을 바꾸는 자락 ────────────────
      //
      // Human 의 답: "밤낮은 보였는데 다른 변화는 모르겠다 — 확인할 단서 자체가 없다." 철을 타는 방이
      // 숲 가장자리 하나뿐이었다. 이 자락들은 컴파일 결과를 한 값도 바꾸지 않고(높이 · 표면 · 통행 그대로)
      // 철이 그 위에 State 를 덧씌울 뿐이다 (C016 의 형 그대로). 어느 철에 무엇으로 읽히는가는 아래 phases 만이 안다.
      {
        id: 'depth-nest-den',
        kind: 'area',
        layer: DEPTH_LAYER,
        tag: 'NEST_FUNGUS',
        shape: { kind: 'circle', center: { x: -6, z: 4 }, radius: 9 },
      },
      {
        id: 'hazard-nest-den',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'NEST_FUNGUS',
        shape: { kind: 'circle', center: { x: -6, z: 4 }, radius: 9 },
      },
      // ── C025 ADDED — **포식수가 도는 자락 하나** (Play §5.7 · V21 · spec World Change 8) ──
      //
      // 상한이 1 이므로 자락도 하나다 — 거목의 방이 떼에 세운 동심원(presence-swarm-*)의
      // 가장 작은 꼴이고, 값이 0 이면 하나도 서지 않는다.
      //
      // **중심 (-10, 7) · 반경 8 의 근거** — 이 방에서 포식수가 하는 일은 둘이다: 굴에 있고,
      // 사냥한 것을 사체로 두고 간다. 그래서 그 둘 **사이**에 선다 — 균사가 핀 굴(-6, 4)에서
      // 5.0 · 사체(-15, 10)에서 5.83 이라 자락 하나가 두 자리를 함께 품는다.
      //   · 하나뿐인 출구 NEST_TRAIL(18, 0) 에서 28.9 — 들어서자마자 밟는 자리가 아니다.
      //   · 컴파일해 격자를 훑어 확인했다 — 중심과 반지름 8 의 여덟 방위가 전부 통행 가능한
      //     평지(surface=flat · 높이 0)다. 이 방은 anchor 와 흔적뿐이라 어디나 평지다.
      //   · 자락이 extent(-20..20) 안에 온전히 든다 — x -18..-2 · z -1..15.
      //   · **이 layer 에 이미 선 것이 하나도 없다** — 이 방의 첫 presence op 다.
      //
      // 흔적 layer 가 아닌 것은 거목의 방 · 숲 안쪽과 같은 까닭이다: 흙이 짙어지는 것이
      // 아니라 **그것이 거기 돈다**는 말이고, 높이도 표면도 통행도 한 값 건드리지 않는다.
      {
        id: 'presence-predator-1',
        kind: 'area',
        layer: PRESENCE_LAYER,
        tag: PRESENCE_PREDATOR,
        shape: { kind: 'circle', center: { x: -10, z: 7 }, radius: 8 },
      },
    ],
  },
  // 생태 **부산물** — 이 세계의 넷째 기회 자리다 (A.3). 사냥의 결과로 남은 것이지
  // 누가 놓아 둔 것이 아니고, 그래서 살아 있는 포식(3층)이 서면 이 자리의 이유가 완성된다.
  resourceEcology: {
    sources: [
      {
        id: 'NEST_FUNGUS',
        materialId: GIANT_TREE_FUNGUS,
        // 이 숲의 사슬 하나에서 난다 — 사슬의 **끝이자 시작**이 이것이다 (§5.0)
        worldCause: FOREST_CHAIN,
        form: FORM_NEST_MYCELIUM,
        carrier: 'fungus',
        opportunity: 'by-product',
        // 사체의 분해 단계가 와야 다시 핀다 (§5.6 · A.1 거목균의 공급 유형)
        supply: 'conditional-renewable',
        // 다음 사체의 분해 — 살아 있는 포식은 3층의 몫이다 (A.2 회복 원인 · 확정 2)
        recoveryCause: RECOVERY_CARCASS_DECAY,
        // C024 ADDED — **그 분해를 무엇이 하는가**가 이름으로 선다 (Play §5.7 · 검사 ㉛).
        // C022 가 허물에 세운 그 자리와 같은 자리이고, 이제 둘 다 값이 일을 한다:
        // 거목균이 없으면 삭일 것이 없어 균사가 다시 피지 않는다
        recoveryLife: TREE_FUNGUS,
        // 값마다의 배속 (spec 데이터 값 표) — 0 에서 정지 · 상한 2 에서 두 배.
        // 허물의 다섯 자리와 **같은 꼴**이고 눈금만 이 개체군의 상한을 따른다
        recoveryByLife: [0, 1, 2],
        // 배속이 0 이라 멎어 있는 동안 지는 코드 — "삭일 것이 없다"
        noOwnerCode: NO_DECOMPOSER,
        // 한 번에 다 뜯긴다 — 균사 한 무리 = 한 번 (D4 의 뿌리혹과 같은 어법 · spec SPEC-001)
        harvests: 1,
        // 부산물 — 균사가 다시 피는 데 두 바퀴 (D3)
        recoverySeconds: 120,
        // 마디 하나뿐인 원천 — 자리를 옮기지 않는다 (siteCurve 없음)
        traceOps: ['trace-nest-fungus'],
      },
      // ── RoomBearsMaterial 실주행 판정 ADDED — 흩어진 것들 (자리는 위의 point 가 소유한다) ──
      // 어둠에서 희게 빛나는 갓 — 거목균의 밤 형태. **밤에만 선다** (dayPhases): 낮에는 흙 속으로 오므라들어 거기 없다. 밤이 감추는 것이 아니라 종류를 바꾼다 (RoomNeverSame Q25)
      {
        id: 'GLOW_CAP_NEST_1',
        materialId: GIANT_TREE_FUNGUS,
        worldCause: FOREST_CHAIN,
        form: FORM_GLOW_CAP,
        carrier: 'fungus',
        opportunity: 'by-product',
        supply: 'conditional-renewable',
        recoveryCause: RECOVERY_NIGHT_BLOOM,
        harvests: 1,
        recoverySeconds: 90,
        traceOps: ['trace-glow-cap-nest-1'],
        // 낮밤을 탄다 — 밤에만 선다
        dayPhases: ['NIGHT'],
      },
      // 어둠에서 희게 빛나는 갓 — 거목균의 밤 형태. **밤에만 선다** (dayPhases): 낮에는 흙 속으로 오므라들어 거기 없다. 밤이 감추는 것이 아니라 종류를 바꾼다 (RoomNeverSame Q25)
      {
        id: 'GLOW_CAP_NEST_2',
        materialId: GIANT_TREE_FUNGUS,
        worldCause: FOREST_CHAIN,
        form: FORM_GLOW_CAP,
        carrier: 'fungus',
        opportunity: 'by-product',
        supply: 'conditional-renewable',
        recoveryCause: RECOVERY_NIGHT_BLOOM,
        harvests: 1,
        recoverySeconds: 90,
        traceOps: ['trace-glow-cap-nest-2'],
        // 낮밤을 탄다 — 밤에만 선다
        dayPhases: ['NIGHT'],
      },
      // 풀줄기에 걸린 껍질 조각 — 광식충이 줄기를 타고 오르며 벗은 것. 밑동의 허물과 같은 재료의 다른 형태다
      {
        id: 'HUSK_SHARD_NEST',
        materialId: ORE_EATER_MOLT,
        worldCause: FOREST_CHAIN,
        form: FORM_HUSK_SHARD,
        carrier: 'plant',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_HUSK_SHED,
        harvests: 2,
        recoverySeconds: 75,
        traceOps: ['trace-husk-shard-nest'],
      },
      // ── C024 ADDED — 둥지의 **사체** (Play §5.7 · spec 데이터 값 표) ──────────
      //
      // **새 Seed 를 만들지 않는다** — 광식충 허물(ORE_EATER_MOLT)의 일곱째 형태다
      // (A.1 "같은 것의 여러 순도"). 사냥의 결과로 남은 것이므로 이 방의 다른 것들과 같은
      // 부산물이고, 되돌리는 것은 **다음 사냥**이다 — 그 포식수가 세계에 서면 이 원인이
      // 무엇을 전제하는지도 이름으로 서고 검사 ㉛ 의 대상이 셋이 된다 (C025).
      // 지금은 시간이 되돌린다: 240 초는 이 방의 가장 긴 값이다 (깊은 자리가 길다 · D3).
      {
        id: 'NEST_CARCASS',
        materialId: ORE_EATER_MOLT,
        worldCause: FOREST_CHAIN,
        form: FORM_CARCASS,
        // 무언가가 남기고 간 것을 진다 — 이 세계가 잔류로 세는 갈래다 (검사 ㉜ 의 어휘)
        carrier: 'residue',
        opportunity: 'by-product',
        // 사냥이라는 **사건**이 되돌린다 (기다린다고 오는 것이 아니다)
        supply: 'event-scarce',
        recoveryCause: RECOVERY_NEST_KILL,
        // C025 ADDED — **그 사냥을 무엇이 하는가**가 이름으로 선다 (Play §5.7 · spec 데이터 값 표).
        // C022 가 허물에, C024 가 균사에 세운 그 자리와 같은 자리다: 이 원인이 무엇을
        // 전제하는지를 이제 세계가 안다 (C024 가 "그 포식수가 세계에 서면" 이라 적어 둔 자리).
        recoveryLife: PREDATOR,
        // 사체 하나 = 한 번. 캐면 그 자리에 아무것도 남지 않는다 (D4 의 어법)
        harvests: 1,
        // C025 CHANGED — **시간이 되돌리지 않는다.** 이 원천을 세우는 것은 포식수가 거는
        // LEAVES 관계이고(아래 links · spec SPEC-003), 아직 서지 않은 동안에는
        // `condition-unmet` 이 걸려 되돌아옴의 진행이 한 톨도 오르지 않는다 — 탄생이 세우는
        // 원천(EGG_HUSK)과 지나가는 것이 남기는 원천이 그런 그대로다. 그래서 이 길이는
        // 이제 아무 데도 쓰이지 않지만 지운다고 세계가 달라지지 않으므로 값을 그대로 둔다:
        // 되돌아옴의 원인이 다시 시간이 되는 날에 이 눈금이 답이다 (D3 · 이 방의 가장 긴 값)
        recoverySeconds: 240,
        traceOps: ['trace-nest-carcass'],
      },
    ],
  },
  /**
   * 이 방이 품은 **생명 계통** (C024 ADDED · Play §5.7 · Life F3 변성형).
   *
   * 이 세계의 **셋째 탄생 방식**이 여기 선다 — 어떤 것은 맺히고(결속 · 거목의 방), 어떤 것은
   * 잇고(계승 · 같은 방), 어떤 것은 **바뀐다**(변성 · 이 방). **규칙은 한 줄도 늘지 않는다**:
   * 셋을 굴리는 것은 여전히 한 규칙(RULE-LIFE-BINDING-001)이고, mode 는 데이터의 글자일 뿐
   * 규칙이 읽지 않는다 (W40 · spec R4).
   */
  ecology: {
    lifeFormation: [
      {
        // 자리는 위 Description 의 resource point 가 소유한다 (같은 이름으로 잇는다)
        id: 'CARCASS_TO_FUNGUS',
        // 있던 것이 다른 것으로 바뀐다 — 이 세계가 변성을 처음 쓰는 자리다 (Life §3.2)
        mode: 'TRANSFORMATION',
        // 숲의 사슬 하나에 매달린다 — 이 방의 원천들이 밝힌 것과 같은 원인이다 (㉘)
        worldCause: FOREST_CHAIN,
        form: FORM_CARCASS_BLOOM,
        // 무엇으로 맺히는가 — 사체 하나뿐이다 (재료가 아닌 세계 상태는 묻지 않는다)
        source: {
          materials: [ORE_EATER_MOLT],
          states: [],
        },
        condition: {
          regionRule: RULE_NEST_TRANSFORM,
          // 둘이 다 차 있는 동안에만 결속이 오른다.
          requires: [
            // 삭일 사체가 거기 있다 — **바뀔 것이 있어야 바뀐다** (SPEC-006 경계 ③)
            { kind: 'source-available', sourceId: 'NEST_CARCASS', unmetCode: LIFE_NEEDS_CARCASS },
            // 아직 다 피지 않았다 — 상한(2)에서 전이가 통째로 서지 않는 것을 요구로도
            // 밝혀 둔 자리다 (spec 기본형 ⑥). 규칙은 그대로이고 관찰자가 사유를 읽는다
            {
              kind: 'population-at-most',
              populationId: TREE_FUNGUS,
              value: 1,
              unmetCode: LIFE_FUNGUS_CROWDED,
            },
          ],
        },
        transition: { from: 'DORMANT', to: 'BORN' },
        // 태어나는 그 Tick 에 **사체가 고갈된다** — 캔 것과 같은 State 이고 원인만 다르다.
        // 바뀐다는 것은 곧 먹는다는 것이다 (변성형이 결속·계승과 갈리지 않는 자리)
        consumes: ['NEST_CARCASS'],
        // 세우는 것은 없다 — 남는 것은 흙의 자국뿐이다 (아래 traces.after)
        // 터진 채 머무는 길이 — 결속과 같은 120 초 (확정 5 의 눈금 · 깊은 자리)
        spentSeconds: 120,
        traces: {
          before: [
            // 삭는 모양 — 사체가 없으면 서지 않고(단계 0), 결속하는 동안 한 단계 옅어진다
            { op: 'trace-nest-rot', hiddenWhen: LIFE_NEEDS_CARCASS, fadesWhileBinding: true },
            // 냄새의 자리 — 가려짐도 옅어짐도 없다. 걸린 것도 걸지 않는다:
            // 냄새는 몸에 아무 일도 하지 않는다 (거목의 방이 떨림에 준 그 규율의 반대편)
            { op: 'trace-nest-odor' },
          ],
          // 붉게 되돌아온 흙 — **SPENT 인 동안에만** 선다 (RULE-LIFE-SITE-PHASE-001)
          after: ['trace-nest-returned-soil'],
        },
        ecologicalRole: LIFE_ROLE_DECAY_SUPPLY,
        population: TREE_FUNGUS,
        // 결속의 길이 — 120 세계 초 (확정 5 의 가장 긴 눈금 · 이 방은 깊은 자리다)
        bindingSeconds: 120,
      },
    ],
    populations: [
      {
        id: TREE_FUNGUS,
        // 이 방이 감당하는 수 (spec 기본형 ① — 확정 6 의 눈금 4 · 2 · 1 에서 가운데)
        scale: 2,
        // 값이 내리는 세계 안의 원인 — 조건 결핍 (광식충과 같은 원인이다)
        declineCause: POPULATION_DECLINE_CONDITION_LOST,
        // **이것이 차 있어야 산다** — 삭일 사체가 있어야 균류가 산다 (spec R3 · SPEC-003).
        // 한 철 내내 한 번도 사체가 서지 않으면 철이 바뀔 때 값이 1 준다
        declineWhen: [
          { kind: 'source-available', sourceId: 'NEST_CARCASS', unmetCode: LIFE_NEEDS_CARCASS },
        ],
        // **떼의 자락도 소란도 밝히지 않는다** — 균류는 돌지 않는다 (spec 데이터 값 표).
        // 밝히지 않은 개체군은 아무것도 서지 않고 방을 술렁이게 하지도 않는다
      },
      // ── C025 ADDED — 둥지의 주인 (Play §5.7 · Concept §4 의 사슬) ──────────
      {
        id: PREDATOR,
        // 이 방이 감당하는 수 — 하나다 (확정 6 의 눈금 4 · 2 · 1 에서 가장 작은 것).
        // 굴 하나에 주인은 하나이고, 그래서 자락도 하나다
        scale: 1,
        // 값이 내리는 세계 안의 원인 — **먹힘**이다. 이 사슬에서 이것을 먹는 것은 아직
        // 없으므로 지금은 내리지 않는다: 밝혀만 두는 자리이고 규칙은 읽지 않는다
        declineCause: POPULATION_DECLINE_EATEN,
        // **declineWhen 도 소란도 밝히지 않는다** (spec 기본형 ⑤ ⑥) — 이 값을 굴리는 것은
        // 관계이고, 이것은 태어나지 않으므로 방을 술렁이게 할 탄생이 없다
        presence: PRESENCE_PREDATOR,
        // 상한이 1 이므로 자락도 하나다 — 값이 0 이면 하나도 서지 않는다
        presenceOps: ['presence-predator-1'],
      },
    ],
    /**
     * 이 방의 주인이 **거는** 관계 둘 (spec 데이터 값 표 · SPEC-002 · SPEC-003).
     *
     * 하나는 방을 넘고(새를 먹는다 — 그 값이 주는 것은 **숲 안쪽**이다) 하나는 이 방
     * 안이다(사체를 남긴다 — 같은 방이므로 밝힐 이음이 없다).
     *
     * **사슬이 여기서 닫힌다** — 남긴 사체가 위의 변성(CARCASS_TO_FUNGUS)을 먹여 거목균을
     * 세우고, 거목균이 균사(NEST_FUNGUS)를 되돌리고, 그 균사가 거목의 뿌리혹을 되살려
     * 다음 탄생이 선다 (spec SPEC-008). 관찰자가 하나도 없는 채로 그렇게 된다.
     *
     * 문 이름을 **글자로** 적는다 — graph.ts 가 이 방을 부르고 있으므로 되부르면 순환이 난다.
     */
    links: [
      // 둥지의 주인이 새를 먹는다 — 값이 주는 것은 새가 사는 **숲 안쪽**이다 (SPEC-005 경계 ③)
      { from: PREDATOR, to: BIG_BIRD, kind: 'EATS', via: 'NEST_TRAIL' },
      // 그리고 먹은 자리에 **사체를 남긴다** — 같은 방이므로 이음이 없다.
      // 세워지는 것은 개체군이 아니라 **잔류 원천**이다 (검사 ㉜ 이 그것을 묻는다)
      { from: PREDATOR, to: 'NEST_CARCASS', kind: 'LEAVES' },
    ],
  },
  /**
   * 이 방이 철을 타는 방식 (RoomNeverSame 실주행 판정 ADDED).
   *
   * 긴 밤에 균사가 선 사체 둘레가 한 단계 깊어지고(wild → deep) 같은 자락이 위험으로 읽힌다 —
   * 둥지의 주인이 돌아오는 때다 (살아 있는 포식은 3층의 몫이고, 2층은 그 자락이 위험하다고 말하는 것까지다).
   * 깊이와 위험이 같은 자락이다 (Concept §6).
   */
  phases: {
    seasons: {
      LONG_NIGHT: {
        depthOverlay: [{ areaId: 'depth-nest-den', depth: 'deep' }],
        hazardExtend: [{ areaId: 'hazard-nest-den', hazard: 'hazard/creature' }],
      },
    },
  },
};
