// 이 세계의 World — 채광 · 캐릭터 행동 · 세계/클라이언트 분리 · 다중 관찰자 ·
//                  몸 충돌 · 기본 전투 · 개발 명령 표면이 여기에 등록되어 있다.
//
// P1 CHANGED — 세계의 껍데기(요청 큐·관찰자 인과·Tick 프레임)는 Engine 의
// world-kernel 이 소유한다. 이 파일은 이 팩의 세계에 **무엇이 있는지**를 등록한다:
// 초기 배치, interaction 목록, 시스템 진행 순서, 관찰자 몸, 투영.

import { createWorldKernel, type World } from '../../engine/world-kernel/kernel';
import type { WorldContent } from '../../engine/world-kernel/content';
import { restoreState, type WorldSnapshot } from '../../engine/world-kernel/persistence';
import { INTERACTIONS } from './actions/interactions';
import { projectObserverView } from './projection/observer-view';
import { DEFAULT_BODY, spawnObserverBody, type BodyDefaults } from './rules/observer-body';
import type { ActorState } from './semantic/actor';
import type { ItemKind } from './semantic/item';
import type { WorldPosition } from './semantic/position';
import { START_REGION } from './semantic/region';
import {
  applyPatternSetup,
  applySourcePhaseSetup,
  createRegionStates,
} from './semantic/region-state';
import { spawnActor } from './semantic/spawn';
import {
  SPAWN_POINTS,
  STATE_VERSION,
  TICK_INTERVAL,
  type WorldState,
} from './semantic/world-state';
import { ruleActionProgress } from './simulation/action-progress';
import { ruleBodyMomentum } from './simulation/body-momentum';
import { ruleBodyPush } from './simulation/body-push';
import { ruleCpRunDrain } from './simulation/cp-run-drain';
import { ruleMazeConnection } from './simulation/maze-connection';
import { ruleMoveProgress } from './simulation/move-progress';
import { ruleNpcDecideAll } from './simulation/npc-decide';
import { ruleRegionFall } from './simulation/region-fall';
import { ruleStrikeEventExpire } from './simulation/strike-event-expire';
import { ruleSwingStrike } from './simulation/swing-strike';

export type { World } from '../../engine/world-kernel/kernel';

export interface NpcSetup {
  id: string;
  name?: string; // 밝히지 않으면 세계가 종류 + 순번으로 정한다
  characterKind?: string;
  position: WorldPosition;
  wanderPath?: WorldPosition[];
  perceptionRange?: number;
}

export interface WorldSetup {
  /** 첫 번째 관찰자의 몸이 놓일 자리 — 검증용 초기 배치 (SPAWN_POINTS[0] 를 대신한다) */
  actorPosition?: { x: number; z: number };
  /** 첫 번째 관찰자의 몸이 설 Region — 검증·촬영용. 밝히지 않으면 START_REGION 이다 */
  actorRegion?: string;
  actorItems?: Partial<Record<ItemKind, number>>;
  actorCharacterKind?: string;
  npcs?: NpcSetup[];
  /** 속성 변경을 허용할 것인가 (World.DebugAuthority). 요청으로는 바꿀 수 없다 */
  debugAuthority?: boolean;
  /**
   * 밝힌 방을 갖지 않은 자율 존재를 **모두 이 방에** 놓는다 — 검증·촬영용 초기 배치 (C010 ADDED).
   *
   * 자리도 순회 경로도 그대로 두고 **방만** 옮긴다. actorRegion · regionPatterns 와 같은 갈래의
   * 배치 손잡이이고 **세계 규칙이 아니다** — 놓인 뒤로는 기존 순회(RULE-NPC-DECIDE-001)와
   * 기존 규칙이 그대로 굴린다.
   *
   * 왜 필요한가 — "세계는 플레이어 없이도 돈다"(Concept W9 · RuleBoundRoom 확정 6)를 그 방 안에서
   * 보려면 그 방에 몸 하나가 있어야 한다. C008 은 그 자리를 스냅샷을 고쳐 되살리는 길로 에둘렀다
   * (C008 TODO ③ 이 하네스 결손으로 적어 두었다).
   */
  npcRegion?: string;
  /**
   * 규칙을 품은 방이 **어느 패턴으로 서는가** — 검증·촬영용 초기 배치 (C009 ADDED).
   *
   * actorPosition · actorRegion 과 같은 갈래의 손잡이다: 걸어서 닿을 수 있는 State 를
   * 걸어가지 않고 시작하기 위한 것이며 **세계의 규칙을 하나도 바꾸지 않는다.**
   * 여기서 세운 패턴도 그 다음부터는 압력이 굴린다 (RULE-MAZE-CONNECTION-001 그대로).
   *
   * 왜 필요한가 — 심장 쪽 문이 열리는 P2 는 임계를 **두 번** 넘겨야 온다. 소프트웨어 GPU 로
   * 도는 촬영 하네스에서 그것은 몇 분의 걷기이고, 넘겨서 세 번째가 오면 문이 다시 잠긴다.
   * 규칙이 그 문을 여는 것(압력 → 패턴 → 문)은 시나리오 테스트가 증명하고,
   * 그림은 **그 State 에서 무엇이 보이는가**를 보인다.
   *
   * 모르는 방 이름 · 그 방에 없는 패턴 이름은 조용히 무시한다 — 손잡이가 세계를 깨뜨리지 않는다.
   */
  regionPatterns?: Record<string, string>;
  /**
   * 원천이 **어느 phase 로 서는가** — 검증·촬영용 초기 배치 (C012 ADDED).
   * 예: `{ ORE_OUTCROP: 'depleted' }`
   *
   * regionPatterns 와 **같은 갈래**의 손잡이다: 캐서 닿을 수 있는 State 를 캐지 않고
   * 시작하기 위한 것이며 **세계의 규칙을 하나도 바꾸지 않는다.** 여기서 세운 phase 위에서도
   * 채취와 자국의 셋(외형 · 흔적 · 통행)이 그대로 굴러간다.
   *
   * 왜 필요한가 — 노두는 **세 번** 캐야 고갈되고, 소프트웨어 GPU 로 도는 촬영 하네스에서
   * 요청 한 번의 왕복이 길어 세 번이면 10초를 넘긴다. 규칙이 그것을 고갈시키는 것
   * (캘 수 있는 횟수 → phase → 외형 · 흔적 · 통행)은 시나리오 테스트가 증명하고,
   * 그림은 **그 State 에서 무엇이 보이는가**를 보인다 (regionPatterns 와 같은 논리).
   *
   * depleted 로 세운 원천은 taken 도 harvests 에 맞춰 선다 — 어긋난 State 를 만들지 않는다.
   * 모르는 원천 id · 모르는 phase 이름은 조용히 무시한다 — 손잡이가 세계를 깨뜨리지 않는다.
   */
  sourcePhases?: Record<string, string>;
}

// 세계의 기본 배치 — 자율 캐릭터 둘이 각자의 순회 경로를 돈다. 자리는 START_REGION 의 Local Space 좌표다 (C001 R4).
// characterKind 를 바꾸면 그 캐릭터가 쓰는 모션 집합이 바뀐다 (motions/<종류>/ 폴더).
//
// C006 CHANGED — 두 사람의 순회 경로가 강을 비켜 간다. 자리는 그대로 배치 데이터이지만
// (규칙은 하나도 늘지 않는다), C005 까지의 경로는 이제 강 한복판을 지난다 — 이동 진행은
// traversable 을 보지 않으므로(spec R1 은 요청만 판정한다) 그대로 두면 사람이 물 위를 걷는다.
//   npc-1 강 남쪽 — 도시와 그 남쪽 들을 돈다 (실측: 네 꼭짓점 다 중심선에서 6.8 이상)
//   npc-2 강 북쪽 — 건너편에 사는 사람. 다리를 건너기 전에는 만날 수 없다
const DEFAULT_NPCS: NpcSetup[] = [
  {
    id: 'npc-1',
    characterKind: 'wanderer',
    position: { x: -8, z: 0 },
    wanderPath: [
      { x: -8, z: 0 },
      { x: -8, z: -6 },
      { x: 2, z: -6 },
      { x: 2, z: 0 },
    ],
  },
  {
    id: 'npc-2',
    characterKind: 'wanderer',
    position: { x: 12, z: 14 },
    wanderPath: [
      { x: 12, z: 14 },
      { x: 4, z: 16 },
    ],
  },
];

// Tick 진행 순서 — 결정론은 이 한 배열이 지킨다 (설계 반전 ② · RULE-WORLD-TICK-001).
// 의도한 이동(move-progress)이 먼저 자리를 정하고, 물리(swing~momentum)가 그 자리를
// 세계 규칙으로 보정한다. 기력 누수가 물리 뒤에 오는 이유: 이 Tick 에
// 실제로 달려 움직인 결과에 값을 치른다.
const SYSTEMS: WorldContent<WorldState>['systems'] = [
  (state) => ruleNpcDecideAll(state), // RULE-NPC-DECIDE-001
  (state, dt) => ruleMoveProgress(state, dt), // RULE-MOVE-PROGRESS-001
  // 걸음이 그 방의 압력이 된다 — move-progress 가 적은 movedThisTick 을 바로 뒤에서 읽는다.
  // 다른 무엇이 자리를 건드리기 전이고, 관찰(투영)보다는 당연히 앞이다 (C008 spec R1 Priority).
  (state) => ruleMazeConnection(state), // RULE-MAZE-CONNECTION-001
  (state, dt) => ruleActionProgress(state, dt), // RULE-ACTION-PROGRESS-001
  (state) => ruleSwingStrike(state), // RULE-SWING-STRIKE-001 (STRIKE-DAMAGE → SKILL-BUDGET → DOWNED 를 함께 부른다)
  (state, dt) => ruleBodyPush(state, dt), // RULE-BODY-PUSH-001
  (state, dt) => ruleBodyMomentum(state, dt), // RULE-BODY-MOMENTUM-001
  (state, dt) => ruleCpRunDrain(state, dt), // RULE-CP-RUN-DRAIN-001
  // 이 Tick 의 자리가 다 정해진 뒤에 세계가 떨어질 사람을 본다 — 그래서 맨 끝이다 (C003 R1).
  (state) => ruleRegionFall(state), // RULE-REGION-FALL-001
];

// 만료가 시간 진행 뒤에 오는 이유: 방금 일어난 결과가 최소 한 번은 관찰되어야 한다.
const POST_TIME_SYSTEMS: WorldContent<WorldState>['postTimeSystems'] = [
  (state) => ruleStrikeEventExpire(state), // RULE-STRIKE-EVENT-EXPIRE-001
];

/**
 * 스냅샷에서 이 팩의 State 를 되살린다 — 버전이 다르면 null (복구 포기, 새 세계).
 * 되살린 State 는 createWorld 의 restored 로 넘긴다. 팩은 복구 State 를 해석하지
 * 않는다 — 초기 배치 대신 그것으로 커널을 조립할 뿐이다.
 */
export function restoreWorld(snapshot: WorldSnapshot): WorldState | null {
  return restoreState<WorldState>(snapshot, STATE_VERSION);
}

export function createWorld(setup: WorldSetup = {}, restored?: WorldState): World {
  // 세계가 시작할 때 조종되는 몸은 없다.
  // 몸은 관찰자가 들어올 때 RULE-OBSERVER-JOIN-001 이 만든다.
  // 자율 존재도 자기 종류의 자원·템포 능력치를 갖는다 (character-catalog).
  // 이름은 종류 + 순번이다.
  const npcs: ActorState[] = (setup.npcs ?? DEFAULT_NPCS).map((npc, ordinal) =>
    spawnActor({
      id: npc.id,
      name: npc.name ?? `Wanderer ${ordinal + 1}`,
      characterKind: npc.characterKind ?? 'wanderer',
      control: 'autonomous',
      // 밝힌 방이 있으면 거기, 없으면 시작 방 (02-world R4 — 기본 자율 존재는 백왕령에 있다)
      regionId: setup.npcRegion ?? START_REGION,
      position: npc.position,
      wanderPath: npc.wanderPath,
      ...(npc.perceptionRange === undefined ? {} : { perceptionRange: npc.perceptionRange }),
    }),
  );

  // 복구된 State 가 있으면 초기 배치는 일어나지 않는다 — 세계는 스냅샷의 그 순간부터
  // 이어진다 (design/Design-World-Persistence.md). setup 은 새 세계에만 뜻이 있다.
  const state: WorldState = restored ?? {
    actors: npcs,
    // C011 CHANGED — 광맥이 사라졌다. 캘 것은 이제 방이 낳는 **원천**이고, 그것은 초기 배치가
    // 아니라 content/regions 의 데이터다 (semantic/resource.ts) — 배치 손잡이가 필요 없다.
    time: 0,
    observers: [],
    strikeEvents: [],
    // 규칙을 품은 방마다 첫 패턴 · 압력 0 으로, 원천을 가진 방마다 원천이 available 로 선다
    // (C008 · C012). 되살린 세계는 이 자리에 오지 않는다 — Region State 는 저장되는 State 이므로
    // 스냅샷의 그 순간 값이 그대로 이어진다.
    regionStates: applySourcePhaseSetup(
      applyPatternSetup(createRegionStates(), setup.regionPatterns),
      setup.sourcePhases,
    ),
    // 속성 변경 권한은 세계 밖(세계를 띄우는 쪽)이 정한다.
    // 기본은 열려 있다: 이 프로토타입은 관찰과 시험이 목적이며, 닫으려면 세계를 그렇게 띄운다.
    debugAuthority: { open: setup.debugAuthority ?? true },
  };

  // 관찰자의 몸이 처음 만들어질 때 쓰는 기본값 — 세계의 초기 설정이다.
  const bodyDefaults: BodyDefaults = {
    characterKind: setup.actorCharacterKind ?? DEFAULT_BODY.characterKind,
    items: setup.actorItems ?? DEFAULT_BODY.items,
    spawnPoints: setup.actorPosition
      ? [{ x: setup.actorPosition.x, z: setup.actorPosition.z }, ...SPAWN_POINTS.slice(1)]
      : SPAWN_POINTS,
    ...(setup.actorRegion ? { spawnRegion: setup.actorRegion } : {}),
  };

  const content: WorldContent<WorldState> = {
    tickInterval: TICK_INTERVAL,
    stateVersion: STATE_VERSION,
    spawnObserverBody: (worldState, ordinal) =>
      spawnObserverBody(worldState, ordinal, bodyDefaults),
    interactions: INTERACTIONS,
    systems: SYSTEMS,
    postTimeSystems: POST_TIME_SYSTEMS,
    projectObserver: projectObserverView,
  };

  return createWorldKernel(state, content);
}
