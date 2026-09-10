# CONTENT — 컨텐츠 코드 구조

`content/` (이 세계의 컨텐츠 코드) 와 그것을 부르는 조립(`app/` · `server/`) · 공정 도구(`tools/`)의 **코드 구조**를 적는다.
코드에 있는 것을 구조로만 적는다 · Cycle 번호·경위 없음 · 갱신은 Cycle 을 main 에 합친 직후 구조가 바뀐 것만.
경계는 `npm run boundary:check` 가 강제한다 (engine→content · content→조립 · regions→world/view import 금지).

| 폴더 | 역할 | engine 의존 |
|---|---|---|
| `content/world/` | 세계 시뮬레이션 — State · 규칙 · 세계 과정 · interaction · 관찰 투영 | world-kernel · world-authoring · physics · view-kernel(형만) |
| `content/view/` | 결정 Layer — Snapshot → SceneState · 문구 · 키 · 그림표 · 모션 | view-kernel · world-authoring(땅 컴파일) · protocol-core |
| `content/protocol/` | 봉투(engine/protocol-core)를 확장한 이 세계의 World↔View 계약 | protocol-core |
| `content/regions/` | Region 데이터 — world 와 view 가 함께 읽는 정적 사실 (State 에 넣지 않는다) | world-authoring 만 |
| `content/authoring/` | 작성 도구가 기반(engine/world-authoring)에 건네는 계약 · 기본형 · 프롬프트 · brief | world-authoring |
| `content/motions/` | 캐릭터 모션 시트(PNG) — 등록 코드 없음, 폴더/파일 이름이 규약 | 없음 (데이터) |
| `content/active*.ts` | 조립이 컨텐츠를 부르는 유일한 자리 (재수출만) | 없음 |
| `content/roadmap/` | 문서 — plan/ 이 관리 (이 문서 범위 밖) | — |
| `app/` · `server/` | 조립 — 클라이언트 루트와 세계 호스트. 컨텐츠의 속을 알지 못한다 | view-kernel · protocol-core · world-kernel |
| `tools/` | 공정 도구 — 경계 검사 · 카탈로그 · 모션 아틀라스 · 세계 편집 · 촬영 · 랩 | world-authoring · view-kernel |

## 계약 파일

CLAUDE.md "기반이 컨텐츠에게 요구하는 것" 이 지목한 파일들.

| 파일 | export | 채우는 engine 계약 |
|---|---|---|
| `world/index.ts` | `createWorld(setup, restored?)` · `restoreWorld(snapshot)` · `WorldSetup` · `NpcSetup` · `World` | `WorldContent<WorldState>` (engine/world-kernel/content) — tickInterval · stateVersion · spawnObserverBody · interactions · systems · postTimeSystems · projectObserver → `createWorldKernel` |
| `view/resolve.ts` | `resolvePresentation(observed, motions, options)` · `PresentationOptions` · `CommandSurfaceInput` | 결정 Layer 의 유일한 진입점 — `CoreGameViewSnapshot` 을 팩 `GameViewSnapshot` 으로 좁혀 `SceneState` 를 낸다 |
| `view/code-text.ts` | `codeText(code)` | 의미 코드 → 문구. 코드 목록의 단일 출처는 engine/view-kernel/presentation/text-codes.ts · 미등록 코드는 코드 그대로 |
| `view/bindings.ts` | `KEY_BINDINGS` (`KeyBinding[]`) | engine/view-kernel/input/bindings — ShiftLeft/ShiftRight 로 move-mode walk↔run 요청 |
| `view/sprites.ts` | `SPRITE_SHEET` · `REGISTERED_SPRITE_IDS` | engine/view-kernel/assets/registry 가 그리는 16×16 절차 픽셀아트 표 (Role(:State) 별) |
| `view/motion-source.ts` | `motionLibrary` (`MotionLibrary`) | engine/view-kernel/motion/motion-library — `import.meta.glob('/content/motions/**')` + `MOTION_ATLAS` 로 자동 발견 |
| `protocol/gameview.ts` | `GameViewSnapshot` 과 하위 View 형 | engine/protocol-core/gameview 봉투 확장 (아래 §protocol) |
| `protocol/actions.ts` | `ActionRequest` · `ActionResult`(재수출) | engine/protocol-core/actions 봉투 확장 — `mode` · `attribute` |
| `protocol/semantic-id.ts` · `semantic-id-core.ts` | `RULE_*` · `INTENT_*` 식별자 | engine/protocol-core/semantic-id 재수출 + 이 팩의 Traceability 식별자 |

정적 CharacterKind 데이터 셋 (`npm run catalog:check`): `world/semantic/character-catalog.ts` · `view/kind-presentation.ts` · `motions/<kind>/`.

## world/

### index.ts — 조립

| 항목 | 내용 |
|---|---|
| `WorldSetup` | actorPosition · actorRegion · actorItems · actorCharacterKind · npcs · debugAuthority · npcRegion · regionPatterns · sourcePhases · disturbances · clock · presences · lifeSitePhases · populations (검증·촬영용 초기 배치 — 세계 규칙을 바꾸지 않는다) |
| `DEFAULT_NPCS` | wanderer 둘 (npc-1 · npc-2, 순회 경로 포함) |
| `SYSTEMS` | Tick 순서 하나의 배열 — npc-decide → move-progress → maze-connection → track-lay → season-turn → population-decline → presence → disturbance-decay → track-fade → source-recovery → life-binding → action-progress → swing-strike → body-push → body-momentum → cp-run-drain → region-fall |
| `POST_TIME_SYSTEMS` | strike-event-expire |
| `createWorld` | setup 또는 restored State 로 `WorldState` 를 조립해 `createWorldKernel(state, content)` |
| `restoreWorld` | `restoreState(snapshot, STATE_VERSION)` — 버전 불일치면 null |

### semantic/ — State 와 유도 사실

| 파일 | 주요 타입 · export | 하는 일 |
|---|---|---|
| `world-state.ts` | `WorldState extends CoreWorldState` { actors · strikeEvents · debugAuthority · regionStates · turnsApplied · seasonsApplied · presences } · `TICK_INTERVAL` · `STATE_VERSION` · `SPAWN_POINTS` · 상수(INTERACTION_RANGE · OBSERVE_RANGE_NIGHT · DISTURBANCE_* · TRACK_* · PRESENCE_SECONDS_PER_NODE …) | 세계 State 의 전체 형과 결정론 상수 (헤더 상수 고정) |
| `actor.ts` | `ActorState` (id · name · characterKind · control · regionId · position · body* · facing · velocity · hp/cp · moveMode · tempo · wanderPath · inventory · currentAction …) · `ActorControl` | 몸 하나의 State |
| `action.ts` | `ActionKind`(idle·move·attack·heavy-attack·mine·hit·downed) · `CurrentAction` · `ACTION_DEFINITIONS` | 모든 Actor 는 언제나 행동 하나 안에 있다 |
| `combat.ts` | `MoveMode` · `SkillKind` · `SKILL_DEFINITIONS` · `StrikeEvent` · `Modifiers` · `MUTABLE_ATTRIBUTES` · 상수(RUN_CP_DRAIN · STRIKE_EVENT_TTL …) | 전투 자원 · 스킬 · 템포 배율 합성 |
| `collision.ts` | `ActionCollider` · `actionCollider` · `faceToward` · 상수(PUSH_STIFFNESS · SWING_* …) | 캡슐 몸의 밀어냄 · 휘두름 판정 상수 |
| `character-catalog.ts` | `CHARACTER_CATALOG` · `DEFAULT_CHARACTER` · `CharacterDefinition`(Body·Tempo·Resource) | CharacterKind 정적 시뮬 데이터의 단일 출처 |
| `spawn.ts` | `spawnActor(ActorSpawn)` | 카탈로그에서 몸을 만드는 유일한 경로 |
| `inventory.ts` · `item.ts` | `Inventory`(plain object) · `ItemKind`(pickaxe · BIO_ORE · ORE_EATER_MOLT) · `hasMiningCapability` | 소지품 |
| `command-catalog.ts` | `COMMAND_CATALOG` · `CommandDefinition` · `projectCommandCatalog` | 세계 밖에서 세계에 손댈 수 있는 것의 목록 |
| `position.ts` | `WorldPosition` · `WorldBounds` · `inBounds` | 좌표 |
| `region.ts` | `START_REGION` · `regionSpecOf` · `isConnectorOpen` · `connectorClosedReason` · `connectorReasonCodes` · `lockTraceCodesAt` · `regionExitsOf` · `anchorPosition` · `regionHash` | Region 데이터(content/regions) 를 세계가 읽는 유도 사실 — State 에 넣지 않는다 |
| `region-state.ts` | `RegionState` { rule? · sources? · disturbance · tracks? · lifeSites? · populations? · history } · `RegionMemory`(sources[id]{takenTotal · depletedTimes · lastDepletedAt?} · turns · awakenings · passages[routeId] · births[탄생지]) · `recordMemory`(셈을 올리는 한 자리 — RULE-REGION-MEMORY-001) · `RegionRuleState` · `ResourceSourceState` · `RegionDisturbanceState` · `Track` · `LifeSiteState` · `PopulationState` · `createRegionStates` · `apply*Setup` | 방 하나가 기억하는 것 (저장된다) |
| `region-phase.ts` | `regionPhaseAt` · `depthOverlayAt` · `hazardOverlayTagsAt` · `hazardEffectsAt` · `standingConditionTagsAt` | 방이 시계를 읽어 얻는 위상(깊이 · 위험 · 선 자리 조건) |
| `terrain.ts` | `regionTerrain` · `isTraversable` · `blockedReason` · `conditionTagsAt` · `TerrainBlockReason` | Description 을 `compileRegion(space, COMPILE_RULES)` 로 컴파일한 유도 사실 (통행 · 막힘 사유 · 조건) |
| `persistence.ts` | `PERSISTENCE_TABLE` · `PersistenceRow` · `ERASER_*`(transient · observer-held · buried-by-turn · kept · indelible) | State 경로마다 "무엇이 그것을 지우는가" 하나 — 검사 ㊼ 의 입력 (Foundation G7) |
| `condition.ts` | `lockCondition`(원본은 regions/opportunity.ts — 여기서 재수출) · `sourceOccurrenceCondition` · `phaseSeasonCondition` · `lifeRequirementCondition`(RULE-CONDITION-READ-001 — 조건 자리 넷을 engine Condition 형으로 **읽는다** · 데이터는 그대로) · `worldConditionReader`(clock · region · source · route · history · **area**(자락이 지금 걸려 있는가) · **connector**(문이 열려 있는가) · **process**(되돌아옴의 마디 · 진행) Target 의 값 — **모르는 이름은 여덟 갈래 모두 판정 불가** · 아는 것에 값이 없는 것은 없는 것(EXISTS 의 거짓) — RULE-CONDITION-HISTORY-001: history 는 `RegionState.history` 의 경로 `passages.<routeId>` · `turns` · `awakenings.*` · `sources.<id>.*`) · `worldConditionVerdict` · `sourceMemoryConditionCodes`(원천이 밝힌 기억 조건이 서지 않으면 `needs-passage` — 투영만 읽는다) · `worldConditionSites` · `worldConditionVocabulary`(검사 ㊹ · observe 조건 표의 입력) · `NEEDS_PASSAGE` | 조건은 하나의 형이다 — 판정은 지금의 함수(connectorClosedReason · sourceConditions · regionPhaseAt · lifeUnmetCodes)와 같다 · 문 · 원천 · 결속을 열고 닫지 않는다 |
| `mutation.ts` | `MUTATION_BINDINGS` — 지금 그것인 Transition 이 §4.2 표의 어느 op 인가 (군 여섯 · op · RULE id · 무엇). 코드를 옮기지 않고 이름만 준다 |
| `opportunity-open.ts` | 기회가 지금 열려 있는가 — `isOpportunityOpen` · `opportunityStanding`(availability 를 평가해 **유도**한다 · 판정 불가는 열지 않는다 · 저장 0 — RULE-OPPORTUNITY-OPEN-001) |
| `clock.ts` | `seasonAt` · `dayPhaseAt` · `worldClockAt` · `turnsStartedAt` · `seasonsStartedAt` · `clockSetupTime` · 상수(DAY/NIGHT/철 길이 · CYCLE_SECONDS) | 때(낮밤 · 철 · 며칠째 · 몇 바퀴째)는 `state.time` 에서 유도된다 |
| `rain.ts` | `isRainingAt(time)` | 지금 비가 오는가 (물음 하나) |
| `resource.ts` | `ResourceSource` · `sourcesInRegion` · `findResourceSource` · `sourceStateOf` · `sourcePositionOf` · `nextStandableSite` · `traceStrengthAt` · `isCollapsedAt` · `inflowOf` · `recoveryLifeSpeed` · `sourceConditions` · `depletedOverlaysIn` | 원천(이 방이 무엇을 낳는가)과 흙의 흔적 |
| `life.ts` | `LifeSite` · `Population` · `lifeSitesInRegion` · `findLifeSite` · `findPopulation` · `lifeUnmetCodes` · `populationLinks` · `populationLinkStands` · `swarmAreasIn` · `isBindablePhase` | 탄생지 · 개체군 · 개체군 관계 |
| `presence.ts` | `PresencePassState` · `createPresenceStates` · `isScheduledAt` · `presenceCycleAt` · `bendRoute` · `passingNodeIndex` · `passingIn` · `passingOverlaysIn` · `leavingRouteOf` · `findPresenceRoute` | 지나가는 것(현상)의 지금 |

### rules/ — 요청이 부르는 규칙

| 파일 | Rule | RULE id |
|---|---|---|
| `action-begin.ts` | 행동 시작의 공통 관문 — 대체 가능 판정 후 CurrentAction 교체 | RULE-ACTION-BEGIN-001 |
| `attack.ts` | 피격 반응 — 행동 중단 → hit (ACTION-BEGIN 을 거치지 않는 유일한 진입) | RULE-HIT-001 |
| `attribute-set.ts` | DebugAuthority 아래 속성 변경 | RULE-ATTRIBUTE-SET-001 |
| `emergency-return.ts` | 세계 밖에서 거는 비상 자리(emergencyAnchor)로의 옮김 | RULE-EMERGENCY-RETURN-001 |
| `mine.ts` | 채취 시작(원천 존재 · 거리 · 도구 · phase) 과 완료(소지품 · 원천 고갈 · 소란 · 기억) | RULE-MINE-001 · RULE-MINE-COMPLETE-001 · RULE-REGION-MEMORY-001 |
| `move-mode.ts` | walk ↔ run 전환 (run 은 Cp > 0 · 쓰러지지 않음) | RULE-MOVE-MODE-001 |
| `move.ts` | 이동 시작 — 목표가 Region extent 안 · 통행 판정 | RULE-MOVE-001 |
| `observer-body.ts` | 관찰자 몸 생성(종류 · 자리 · 소지품) — `spawnObserverBody` · `DEFAULT_BODY` | RULE-OBSERVER-JOIN-001 (몸 부분) |
| `skill.ts` | 스킬 시작 전제(기력 · 쓰러짐 · 템포) 와 기력 예산 | RULE-SKILL-BEGIN-001 · RULE-SKILL-BUDGET-001 |
| `strike-damage.ts` | 스킬의 고정 피해 적용(소란 가산) 과 쓰러짐 | RULE-STRIKE-DAMAGE-001 · RULE-DOWNED-001 |
| `summon-presence.ts` | 세계 밖에서 거는 지나가기의 시작 | RULE-PRESENCE-SUMMON-001 |
| `transit.ts` | 방 사이 건너기 — Connector 판정 · `applyRegionTransition` | RULE-REGION-TRANSIT-001 |

### simulation/ — Tick 이 부르는 세계 과정 (순서는 index.ts `SYSTEMS` 가 하나의 배열로 선언)

| 파일 | 하는 일 | RULE id |
|---|---|---|
| `npc-decide.ts` | 자율 존재의 결정 — 인지 범위의 대상 추적/공격 · 순회 | RULE-NPC-DECIDE-001 |
| `move-progress.ts` | move 행동의 진행 · 향하기 · `movedThisTick` | RULE-MOVE-PROGRESS-001 · RULE-BODY-FACING-001 |
| `maze-connection.ts` | 규칙을 품은 방의 압력 → 패턴 전환 | RULE-MAZE-CONNECTION-001 |
| `track.ts` | 몸이 지나가면 자국을 남기고(`ruleTrackLay`) 나이로 지운다(`ruleTrackFade`) | RULE-TRACK-001 · RULE-TRACK-FADE-001 |
| `season-turn.ts` | 뒤척임(onTurn 을 밝힌 방) — `turnsApplied` 로 사건을 기억 | RULE-SEASON-TURN-001 |
| `population-decline.ts` | 철이 바뀌는 자리의 개체군 내림 · 방향 (`seasonsApplied`) — link 를 이어 부른다 | RULE-POPULATION-DECLINE-001 |
| `population-link.ts` | 개체군 사이 관계(`ecology.links`) 적용 — `applyPopulationLinks` | RULE-POPULATION-LINK-001 |
| `presence.ts` | 시간표 → 지나가기 시작 · 마디 이동 · 휘어짐 · 소란 · 끝나면 남김 · **남긴 것은 한동안만 머문다**(머무는 동안이 지나면 스러지고 그 방의 고갈로 센다 · 되돌리는 것은 다시 지나감뿐) (`beginPass` · `applyPresenceSetup`) | RULE-PRESENCE-SCHEDULE-001 · RULE-PRESENCE-PASS-001 · RULE-PRESENCE-DISTURBANCE-001 · RULE-PRESENCE-BEND-001 · RULE-PRESENCE-LEFT-FADE-001 |
| `disturbance.ts` | 소란의 가라앉음(고요에만) 과 위상(임계에서 깨어나고 비면 잠듦) | RULE-DISTURBANCE-DECAY-001 · RULE-DISTURBANCE-PHASE-001 |
| `source-recovery.ts` | available 이 아닌 원천의 되돌아옴 · 되돌아오는 속도 | RULE-SOURCE-RECOVERY-001 · RULE-RECOVERY-SPEED-001 |
| `life-binding.ts` | 탄생지의 결속 · 태어남(소비 · 남김 · 개체군 +1) · 다 씀 | RULE-LIFE-BINDING-001 · RULE-LIFE-BIRTH-001 · RULE-LIFE-SPENT-001 |
| `action-progress.ts` | 소요 시간이 있는 행동의 진행 → 완료(mine-complete · swing) | RULE-ACTION-PROGRESS-001 |
| `swing-strike.ts` | 휘두름 충돌체 → HIT + 충격량 + STRIKE-DAMAGE + SKILL-BUDGET | RULE-SWING-STRIKE-001 |
| `body-push.ts` | 같은 방 몸 쌍의 겹침 밀어냄 (`groupByRegion`) | RULE-BODY-PUSH-001 |
| `body-momentum.ts` | velocity 적분 · 마찰 | RULE-BODY-MOMENTUM-001 |
| `cp-run-drain.ts` | run 이동 중 기력 소모 | RULE-CP-RUN-DRAIN-001 |
| `region-fall.ts` | 요청 없이 일어나는 전이 — falling transition 의 끝에 든 몸 | RULE-REGION-FALL-001 |
| `strike-event-expire.ts` | TTL 지난 StrikeEvent 제거 (postTimeSystems) | RULE-STRIKE-EVENT-EXPIRE-001 |

### actions/ · projection/

| 파일 | 하는 일 |
|---|---|
| `actions/interactions.ts` | `INTERACTIONS` — `InteractionHandler` 목록: move · mine · attack · skill-heavy · move-mode · transit · set-attribute · emergency-return · summon-presence. 파라미터 검증은 핸들러가 한다 |
| `projection/observer-view.ts` | `projectObserverView(state, observerId)` · `SPEC_ID` — 관찰자 한 사람의 Semantic Snapshot. 방으로 잘리고(같은 Region 의 몸 · 원천 · 출구), 밤엔 OBSERVE_RANGE_NIGHT 로 한 번 더 잘린다. 의미 코드만 싣는다 (표현 없음). 안에서 부르는 id: RULE-OBSERVE-PROJECTION · RULE-OBSERVE-RANGE-001 · RULE-REGION-PHASE-001 · RULE-STANDING-CONDITIONS-001 · RULE-LOCK-REASON-001 · RULE-EXIT-REQUIREMENT-001 · RULE-RESOURCE-PLACEMENT-001 · RULE-SOURCE-CONDITION-001 · RULE-LIFE-SITE-PHASE-001 · RULE-WORLD-CLOCK-001 · RULE-OBSERVE-MEMORY-001(원천의 셈 · 방의 셈이 봉투에) · RULE-CONDITION-HISTORY-001(원천이 밝힌 기억 조건이 서지 않으면 conditions 에 `needs-passage` — sourceMemoryConditionCodes) · RULE-OPPORTUNITY-NAME-001(harvest-source · transit-connector 에 그 기회의 id 와 discovery — `opportunityNameOf` · **discovery 가 HIDDEN 이면 싣지 않는다**) 등 |

### tests/ — 시나리오 · 단위

`drive.ts` (검증용 시계 — 관찰자 하나를 들여보내고 Tick 을 직접 부르는 Driver).

| 시나리오 파일 |
|---|
| c003-small-door-big-room · c004-polish-is-data · c005-land-rises · c006-land-blocks-and-flows · c007-observe-and-remake · c008-a-room-with-a-rule · c009-reach-by-the-rule · c010-one-world · c011-trace-leads-to-source · c012-the-mark-remains · c013-the-world-brings-it-back · c014-condition-and-flow · c015-the-world-has-a-clock · c016-a-season-changes-the-room · c017-others-were-here · c018-something-passes-over |
| c036-a-room-offers.scenario · c019-beyond-the-pass.scenario · c020-what-the-cold-makes.scenario · c021-cold-crosses-the-pass.scenario · c022-owner-of-the-molt.scenario · c023-birth-is-consumption.scenario · c024-not-a-spawn-but-a-recovery.scenario · c025-the-forest-turns-on-its-own.scenario · c029-a-room-asks.scenario · c030-the-answer-in-the-world.scenario · c031-the-answer-is-not-one.scenario · many-exits.scenario |
| 단위: action · attack · collision · combat · command · mine · move · npc · observer · observer-mark · persistence · play-judgement-rooms · region · world-tick |

## view/

결정 Layer 파이프라인 한 줄: `resolvePresentation(Snapshot)` → (regionZones + phaseZones + presenceAreaZones + presenceLineZones + trackZones) · clockAmbience→shadedAmbience · entities(rolePresentation · resolveMotion · nameplate) · interactions(interactionPresentation) · hud(hudPresentation) · commands(commandEntries) · targetFrame · answerLogLines → `SceneState`.

| 파일 | 하는 일 |
|---|---|
| `resolve.ts` | 진입점 — 봉투를 팩 Snapshot 으로 좁혀 SceneState 를 만든다 (순수 함수 · Fixture 검증) |
| `code-text.ts` | 의미 코드 → 문구. 재료 계통 코드는 content/regions 의 이름을 그대로 받아 쓴다 |
| `bindings.ts` | 특수 키 규칙 — Shift 로 move-mode 토글 |
| `sprites.ts` | Role(:State) 절차 픽셀아트 표 |
| `motion-source.ts` · `motion-atlas.generated.ts` | motions/ 자동 발견 · 생성물(프레임 사각형 · 발 기준점 · 입력 지문) — 직접 고치지 않는다 |
| `role-presentation.ts` | Entity Role → 카메라·꼬리·라벨·크기 (`ROLE_PRESENTATIONS` · `DEFAULT_ROLE_SIZE`) |
| `kind-presentation.ts` | CharacterKind → 표현 (`KIND_PRESENTATIONS` · `DEFAULT_KIND_PRESENTATION`) |
| `interaction-presentation.ts` | Interaction Role → 입력 바인딩 · 프롬프트 |
| `hud-presentation.ts` | HUD id → 라벨 · 아이콘 · 토스트 · `clockHudEntries` |
| `combat-presentation.ts` | 이름표 · 검사 줄 · 타격 표식 · 자기 패널 (`nameplate` · `inspectLines` · `strikeMark` · `selfPanel`) |
| `command-request.ts` | 명령 한 줄 → ActionRequest (`commandActionRequest`) |
| `region-presentation.ts` | 방 이름 · 깊이 · 정착지/셀/통로/흔적/붕괴 구역 · `regionNotice` · `regionEntryTitle` · `regionRuleHint` · `regionZones` |
| `terrain-presentation.ts` | 땅 — 관찰자가 Description 을 `compileRegion` 으로 컴파일해 그린다 (`regionTerrain` · `TERRAIN_PALETTE` · `CLOCK_AMBIENCES` · 랜드마크/단서 인스턴스) |
| `biome-rules.ts` | regions/terrain-rules 를 다시 내보내는 얇은 자리 |
| `phase-presentation.ts` | 방의 지금 위상(깊이 오버레이 · 위험 구역)을 땅에 · `clockChangeNotice` |
| `presence-presentation.ts` | 지나가는 것 — 그늘(ambience) · 선 · 면 구역 |
| `track-presentation.ts` | 자국 → 지면 표식 (`trackStage` · `trackZones`) |
| `resource-reading.ts` | 원천의 지금을 읽는다 (`sourcePhases` · `traceLevelOfArea` · `collapsedAreas`) |
| `life-reading.ts` | 탄생지의 지금을 읽는다 (`lifeSitePhases` · `observedLifeSite` · `lifeSiteStateCode`) |
| `place-reading.ts` | 지목한 자리 하나의 사실 (`readPlace` — 세계에 묻지 않는다) |
| `being-reading.ts` | 지목한 존재 하나의 사실 (`readBeing`) |
| `movement-reading.ts` | 나아가지 못하는 몸이 왜 서 있는가 (`createStallWatch` · `watchStall` · `stallNotice`) · `keyLookahead` |
| `target-frame-presentation.ts` | 지목한 것이 서는 판 (`targetFrame` · `placeRows` · `beingRows` · `designationHighlight`) |
| `pointer-rules.ts` | 클릭이 무슨 뜻인가 (`pointerRules` · `Designation` · `PointerOutcome`) — 조립이 기반에 주입 |
| `answer-log.ts` | 세계가 나에게 한 말의 그릇 (`KeptAnswer` · `ANSWER_LOG_LIMIT` · `answerLogLines`) |
| `tests/` | resolve · region · region-c002 · region-c003 · combat · command · facing · motion · motion-atlas · collision-debug · play-judgement-view · c005/c006-terrain-view · c011~c014 · c024~c031 · `fixtures/*.fixture.json` |

## protocol/

| 파일 | 봉투 확장 내용 |
|---|---|
| `gameview.ts` | `GameViewSnapshot extends CoreGameViewSnapshot` — entities: `EntityView`(+ vitality · attributes · material · conditions · siteIndex · collapsedSites · memory?: `SourceMemoryView`) · interactions: `InteractionView`(+ profile · opportunity?: `OpportunityView`{id · discovery · event · open}) · strikes: `StrikeEventView[]` · region: `RegionView`{ id · hash · state?: `RegionStateView`(pattern · pressure · pressureLimit · rearrangedAt) · disturbance: `RegionDisturbanceView`(value · threshold · phase) · memory: `RegionMemoryView`(turns · awakenings · passages[]: `PassageMemoryView` · births[]: `BirthMemoryView`) } · standingConditions · tracks: `TrackView[]`(at · heading · since) · presences: `PresenceView[]`(presence · curve? · area?) · clock: `WorldClockView`(dayPhase · season · dayIndex · seasonCycle) |
| `actions.ts` | `ActionRequest extends CoreActionRequest` — `mode?: 'walk'|'run'` · `attribute?: { id, value }` · `ActionResult` 재수출 |
| `semantic-id.ts` | engine 소유 id(RULE_OBSERVER_JOIN/LEAVE/MARK · RULE_REQUEST_REPLY · RULE_WORLD_TICK) 재수출 + `semantic-id-core` 전체 — 소비처는 이 파일 하나만 import |
| `semantic-id-core.ts` | 이 팩의 `RULE_*` · `INTENT_*` 식별자 (몸 · 이동 · 행동 · 명령 · 링크 · 채광 · 전투 · 전이) |

## regions/

`index.ts` 가 전부를 재수출한다. world 와 view 가 함께 읽고 State 에 넣지 않는다.

| 방 파일 | id | depth | RegionSpec 에 밝힌 것 |
|---|---|---|---|
| `white-king-domain.ts` | WHITE_KING_DOMAIN (`START_REGION_ID`) · `WHITE_GIANT_TREE` | civil | resourceEcology |
| `forest-edge.ts` | FOREST_EDGE | outer | resourceEcology · phases |
| `ice-canyon.ts` | ICE_CANYON | outer | resourceEcology · phases |
| `forest-deep.ts` | FOREST_DEEP | wild | resourceEcology · ecology · access · phases |
| `explorer-ruin.ts` | EXPLORER_RUIN | wild | resourceEcology · phases |
| `predator-nest.ts` | PREDATOR_NEST | wild | resourceEcology · ecology · phases |
| `bio-ore-field.ts` | BIO_ORE_FIELD | wild | resourceEcology · phases |
| `red-eye-tree.ts` | RED_EYE_TREE | wild | resourceEcology · ecology · phases |
| `frost-canyon.ts` | FROST_CANYON | wild | resourceEcology · phases · ecology · access |
| `tree-inner-world.ts` | TREE_INNER_WORLD | deep | resourceEcology |
| `heart-lake.ts` | HEART_LAKE | deep | resourceEcology |
| `fantasy-maze.ts` | FANTASY_MAZE (+ MAZE_PATTERN_* · CELL/PASSAGE/CLUE_LAYER · *_FERN) | deep | rule · emergencyAnchor · access |
| `maze-heart.ts` | MAZE_HEART | deep | (없음 — 규칙 없는 작은 방) |

| 공용 표 파일 | 역할 |
|---|---|
| `spec.ts` | `RegionSpec` { id · depth · space(engine Description) · rule? · emergencyAnchor? · resourceEcology? · phases? · access? · ecology? · opportunities? } · `RegionRuleSpec` · `ANCHOR_LAYER` |
| `specs.ts` | `REGION_SPECS` (방 열셋 목록) · `regionSpec(id)` |
| `index.ts` | 재수출 진입점 — 방 id · 패턴 · 레이어 · Connector 이름 · 공용 표 |
| `graph.ts` | `REGION_GRAPH` — Connector 열아홉(FOREST_PATH … FROST_DEPTH_DOOR) · `FRONTIER_REGIONS`(RED_WASTE · INVERTED_GARDEN · WALKING_FOREST · FROST_DEPTH — 이름만 있는 경계) · `CLOSED_CONNECTORS` · `START_REGION_ID` |
| `terrain-rules.ts` | 지면 규칙 표 — `SURFACE_RULES` · `BLOCK_RULES` · `PASS_RULES` · `COMPILE_RULES` · 레이어/태그 상수(FEATURE · LANDMARK · CLUE · SETTLEMENT · CONDITION_*) · `weakenedConditionTag` |
| `phases.ts` | 철이 방을 바꾸는 방식 — `RegionPhases` · `RegionPhase`(DepthOverlay · HazardOverlay · ConditionOutflow) · `RegionTurn` · `SeasonId` |
| `access.ts` | 방이 묻는 것 — `RegionAccess` · `Lock`(LOCK_AT_CONNECTOR · LOCK_AT_AREA) · `LockRequirement` · `LockTrace` · `LOCKS` · `locksOfRegion` · `lockOfConnector` |
| `properties.ts` | 성질 어휘(세계에 하나) — `PROPERTY_VOCABULARY` · ASPECT_* · RELATION_* · ANSWER_* · `propertyTag` · `propertyPhraseCode` |
| `resource-ecology.ts` | 재료 계통 — `MaterialSeed`/`MATERIAL_SEEDS` · `ResourceSourceSpec`(`condition?` — 원천이 밝힌 Condition · 기억을 읽는 첫 사례는 숲 가장자리 비늘 `passages.SKY_WHALE_ROUTE EXISTS`) · FORM_* · RECOVERY_* · `RESOURCE_FLOWS` · 흔적 태그(`soilStainTag` · `frostBreathTag` · `emberWarmthTag` · `traceLevel`) · 레이어 상수 |
| `lives.ts` | 생명 계통 — `LifeSeed`/`LIFE_SEEDS`(ORE_EATER · TREE_FUNGUS · BIG_BIRD · PREDATOR) · FORM_* · PRESENCE_* · `LIFE_FORMATION_MODES` |
| `ecology.ts` | `RegionEcology`(lifeFormation · populations · links) · `LifeSiteSpec` · `PopulationSpec` · `PopulationLink` · `LifeSitePhase` · 조건/역할 코드(LIFE_NEEDS_* · POPULATION_DECLINE_* · LIFE_ROLE_*) · `REGION_RULE_IDS`(RULE_FOREST_CLUTCH · RULE_NEST_TRANSFORM) |
| `opportunity-shape.ts` | 기회와 조건의 **형을 짓는** 순수 함수·어휘 — `gatherOpportunity`(기본형) · `timedGatherOpportunity`(Event — 시간 잎 + 서 있음 잎) · `lockCondition` · `occurrenceCondition` · 경로 글자. 세계를 훑지 않는다 (방 데이터가 부르므로 REGION_SPECS 를 읽으면 초기화가 돈다) |
| `opportunity.ts` | 방이 내미는 것 — `opportunitiesOf(regionId)`(원천마다 `gather:<원천>` · Lock 이 걸린 문마다 `cross:<문>` 을 기본형으로 유도하고 `RegionSpec.opportunities` 가 같은 id 를 덮는다) · `ALL_OPPORTUNITIES` · `opportunityForAction` · 조건 짓기(`lockCondition` · 때 조건 — world/semantic/condition.ts 가 이것을 부른다) |
| `presence-routes.ts` | 지나가는 것의 경로 — `PresenceRoute`(id · presence · nodes · schedule · effectWhilePassing?) · `PRESENCE_ROUTES`(SKY_WHALE_ROUTE · BLIND_HUNTER_ROUTE) · `presenceRoute(id)` |

## authoring/

작성 도구(tools/world-editor)가 기반(engine/world-authoring)에 건네는 것의 유일한 자리. regions 를 **쓰는** 쪽이지 읽히는 쪽이 아니다.

| 항목 | 역할 |
|---|---|
| `index.ts` | 셋(templates · contracts · prompts)을 모아 내보내는 진입점 |
| `contracts.ts` | `WORLD_CONTRACTS` — 이 세계가 이미 가진 어휘(갈래 · 깊이 · 생명 형성 · 되돌아옴 원인 · 관계 종류). 등급 판정기(engine grade.ts)가 형만 알고 값은 여기서 받는다 |
| `templates/index.ts` | `WORLD_AUTHOR_TEMPLATES` — 갈래별 땅 묶음 · 역할별 원천 기본형 (뼈대 생성기 engine author.ts 의 입력) |
| `prompts/index.ts` | `DRAFT_PROMPT` — 초안기(engine draft.ts)가 읽을 확정 문서 경로 목록 (요약본 없이 경로만) |
| `briefs/*.json` | 방 하나의 brief (id · name · depth · kinds · answers …) — 지금 있는 방 열셋 |
| `examples/*.json` | brief 예시 (GAS_VILLAGE · GHOST_CITY · MAGIC_CITY) |
| `tests/briefs.spec.ts` | brief 형이 현실(content/regions · content/view)을 담는가 |

## motions/

`motions/<CharacterKind>/<ActionKind>[.<열x행>][.<N>f][.<N>fps][.once].png|webp` — 등록 코드 없음. 폴더 이름 = `Actor.CharacterKind`, 파일 첫 토큰 = `ActionKind`.
지금 있는 것: `rabbit-swordsman/` · `wanderer/` 각각 idle · move · attack · hit · downed (mine 없음 → idle 대체). 프레임 기하는 `tools/motion-atlas` 가 `view/motion-atlas.generated.ts` 로 미리 구한다. 규약 상세는 `content/motions/README.md`.

## 조립 (app · server · active*)

| 파일 | 하는 일 | 컨텐츠 진입 |
|---|---|---|
| `content/active.ts` | world 쪽 재수출 — `createWorld` · `restoreWorld` · `WorldSetup` · `NpcSetup` · `World` · `TICK_INTERVAL` · `WorldState` | server 가 부른다 |
| `content/active-view.ts` | view 쪽 재수출 — `resolvePresentation` · `codeText` · `commandActionRequest` · `KEY_BINDINGS` · `SPRITE_SHEET` · `TERRAIN_PALETTE` · `regionTerrain` · `regionNotice` · `regionEntryTitle` · `regionRuleHint` · `clockChangeNotice` · `pointerRules` · `ANSWER_LOG_LIMIT` · `createStallWatch` · `watchStall` · `keyLookahead` | app 이 부른다 (world/ 를 끌어오지 않는다) |
| `content/active-catalog.ts` | 순수 표만 재수출 — `CHARACTER_CATALOG` · `KIND_PRESENTATIONS` · `ROLE_PRESENTATIONS` · `REGISTERED_SPRITE_IDS` | tools/catalog 이 부른다 (Node) |
| `app/main.ts` | 클라이언트 조립 루트 — 식별 · 관찰 결과 그리기 · 입력 → ActionRequest · 이어짐 표시 | active-view 만 |
| `server/main.ts` | 세계 프로세스 진입점 — dist/ 서빙 + `createFileWorldStore` 로 스냅샷 복구/저장 + Host 부착 | active |
| `server/world-host.ts` | `createWorldHost(setup, restored?)` — 세계가 자기 시계로 돈다 · 관찰자 부착/이탈 · 같은 관찰자 재접속 시 교체 | active |
| `server/attach.ts` | `attachWorldServer(httpServer, host)` — WebSocket 위에 Host 를 올린다 (join · ActionRequest 수신 · 관찰 결과 · 대답 송신) | 없음 |
| `server/world-store.ts` | `WorldStore` · `createFileWorldStore` — 스냅샷 JSON 파일 하나 | 없음 |
| `server/tests/world-host.spec.ts` | Host 단위 테스트 | — |
| `vite.config.ts` | 클라이언트 dev 서버 + `motionAtlasPlugin` + (HKT_WORLD_URL 없으면) 같은 프로세스에 세계 Host 부착 | server/ |

## tools/

| npm script | 도구 | 하는 일 |
|---|---|---|
| `dev` · `client` | vite | 세계 + 클라이언트 한 프로세스 (HKT_WORLD_URL 이 있으면 클라이언트만) |
| `world` | `server/main.ts` | 세계 프로세스만 |
| `build` | tsc --noEmit + vite build | 빌드 |
| `test` | `tools/boundary/check.ts` + vitest | 경계 검사 + 전체 테스트 |
| `boundary:check` | `tools/boundary/` | engine/content/조립/regions import 그래프 경계 검사 |
| `catalog` · `catalog:check` | `tools/catalog/print.ts` | CharacterKind 3원소(카탈로그 · 표현 · motions/) 병합 출력 / 정합 검사 (`tests/catalog.spec.ts`) |
| `motions:scan` · `motions:check` | `tools/motion-atlas/` (scan · build-atlas · detect-frames · png-alpha · emit · vite-plugin) | 모션 시트 프레임 검출 → `view/motion-atlas.generated.ts` / 최신 여부 확인 (`tests/detect.spec.ts`) |
| `world:check` | `tools/world-editor/check.ts` | 세계 검사 묶음(마흔여덟 — ①~㊷ + ㊸ memory-refs · ㊼ persistence-summary · ㊹ condition-refs · ㊺ opportunity-refs · ㊻ opportunity-summary · `CheckMemory` · `CheckCondition` · `CheckOpportunity`(`WORLD_CHECK_*`) 계약) → 기계가 읽는 JSON |
| `world:observe` | `tools/world-editor/observe.ts` | Region 그래프 표 · 방 하나의 땅 그림/보고 (`png.ts`) · `--report [--at <철>]` 에 열쇠 × 자물쇠 표 · **조건 표**(잎마다 어디에 · target · query · operator value · qualifier · 지금 — 갓 선 세계) · **기회 표**(어디에 · id · discovery · Event · 지금 · target · 동사 · yield) · **Yield 표**(열 열넷 · 2층 값 넷) · **수명 표**(지우는 손 · State 경로) |
| `world:compile` | `tools/world-editor/compile.ts` | 같은 방 두 번 컴파일 → hash 동일 확인 |
| `world:shot` | `tools/world-editor/shot.ts` | 띄운 게임의 그 방을 찍는다 (HKT_SPAWN_REGION · HKT_SPAWN 사용) |
| `world:run` | `tools/world-editor/run.ts` | 관찰자 없이 세계 시계 N 바퀴 → 값의 궤적 표 |
| `world:draft` | `tools/world-editor/draft.ts` | 미지 한 줄 → brief (authoring/briefs 또는 후보) |
| `world:author` | `tools/world-editor/author.ts` | brief → `content/regions/<방>.ts` 뼈대 |
| `world:lab` | `tools/world-editor/lab.ts` · `candidates.ts` | 후보 방을 한 화면(lab.html)에 모은다 |
| `world:admit` | `tools/world-editor/admit.ts` | 후보 승인/반려 |
| `surface:lab` | `tools/surface-lab/build.ts` | 겹침 표면 capability 만 보는 랩 페이지 |
| `cycle:shot` | `tools/cycle-shot/shot.cjs` | 시나리오 JSON 대로 키를 누르고 PNG 를 남긴다 (판정 없음) |
| `fx:lab` · `fx:shot` · `fx:overlay` · `fx:game` · `terrain:shot` | `tools/fx-lab/test/` | 스플랫 이펙트 랩 스모크 · 이펙트 · 오버레이 · 게임 전 경로 · 지면 구역 촬영 검증 |
| — | `tools/content-root.ts` | 도구가 컨텐츠 자리를 읽는 유일한 경로 |
| — | `tools/world-editor/tests/` | author · check · draft · grade · lab · observe · run · c007/c014/c018/c021 |

## 경험 손잡이 — 컨텐츠가 코드 없이 바꾸는 것

기반 Cycle 이 세운 축마다, 경험을 가르는 값 · 문구 · 표시 · 배치가 **어느 데이터 · 어느 표**에 사는가 (Design-CycleExecutionWorkflow §21 — 경험은 데이터로 조절된다).
기반 검토가 "손잡이가 컨텐츠 작업에 충분한가" 를 이 표로 묻고, 컨텐츠 Cycle 이 여기서 값을 바꾼다. 검증 · 촬영용 손잡이(`HKT_*`)는 아래 절 — 세계 규칙을 바꾸지 않는 것이라 다르다.
자리가 함수 안의 상수면 손잡이가 아니다 — 그 자리는 공학 부채(plan/CYCLES.md §4)다.

| 축 | 손잡이 | 자리 |
|---|---|---|
| 기억 | State 경로마다 무엇이 그것을 지우는가 (다섯 지우개) | `world/semantic/persistence.ts` `PERSISTENCE_TABLE` |
| 기억 | 판의 「기억」 줄 — 문구 · 숫자 표기(세는 말의 표를 둘지) · 어느 셈을 세우나(깨어난 시각 · 고갈 횟수는 봉투에 있고 표가 안 세운다) · 순서 | `view/code-text.ts`(기억의 말) · `view/place-reading.ts`(방) · `view/target-frame-presentation.ts`(원천) |
| 조건 | 문 · 원천 · 위상 · 결속의 조건 값 (어댑터가 형으로 읽는 넷 — 데이터 모양은 그대로) | `regions/*` — `Lock.requires` · `ResourceSourceSpec.occurrence` · `RegionPhases.seasons` · `LifeSite.requires` |
| 조건 | 원천이 밝힌 조건 한 줄 (기억을 읽는 첫 사례 — 비늘 `passages.SKY_WHALE_ROUTE EXISTS`) | `regions/resource-ecology.ts` `ResourceSourceSpec.condition` |
| 조건 | 조건의 결과 코드 → 문구 (`needs-passage` 등) · 코드 둘이 나란히 설 때의 순서 | `view/code-text.ts` |
| 기회 | 어느 방이 무엇을 내미는가 — 기본형(원천마다 `gather:` · Lock 걸린 문마다 `cross:`) 밖의 기회 · 같은 id 로 덮어쓰기 · discovery(VISIBLE · SIGNAL · TRACE · HIDDEN) · target · possibleActions · outcomes | `regions/<방>.ts` `RegionSpec.opportunities` (형은 `regions/opportunity-shape.ts` · 유도는 `regions/opportunity.ts`) |
| 기회 | 판의 「할 수 있는 것」 줄의 문구 · discovery 를 말하는 어법 | `view/code-text.ts` |
| Event | 어느 기회가 때가 있는가 · 그 창(WITHIN 값) · 무엇이 여는가(history 경로) · progress 가 가리키는 셈 · yield 열 | 같은 자리 — `RegionSpec.opportunities[<id>].availability` (`timedGatherOpportunity` 가 기본형) |
| Event | 닫힌 Event 의 문구 (「지금은 없다」) | `view/code-text.ts` |
| 조건 | 검사 ㊹ · observe 조건 표가 아는 어휘 (Target 종류마다 실제 id · query 마다 허용 속성) | `world/semantic/condition.ts` `worldConditionVocabulary` |

## 검증 손잡이

`vite.config.ts` 의 환경 변수 — 걸어서·캐서·기다려서 닿을 수 있는 State 를 그렇게 하지 않고 시작하기 위한 **검증·촬영용**이며 세계 규칙을 하나도 바꾸지 않는다 (모르는 이름·값은 세계가 조용히 무시). `WorldSetup` 으로 넘어간다.

| 손잡이 | 하는 일 |
|---|---|
| `HKT_WORLD_URL` | 세계가 다른 프로세스에 있다 — `/world` 를 그쪽으로 프록시 (없으면 dev 서버 안에서 세계를 돌린다) |
| `HKT_SPAWN="x,z"` | 관찰자의 몸이 처음 놓일 자리 (`actorPosition`) |
| `HKT_SPAWN_REGION` | 어느 방에서 시작할 것인가 (`actorRegion`) |
| `HKT_REGION_PATTERN="REGION:PATTERN"` | 규칙을 품은 방이 어느 패턴으로 서는가 (`regionPatterns`) |
| `HKT_NPCS="none"` | 자율 존재 없이 띄운다 (`npcs: []`) |
| `HKT_NPC_REGION` | 자율 존재를 어느 방에 놓을 것인가 (`npcRegion`; NPCS=none 이 이긴다) |
| `HKT_SOURCE_PHASE="A:phase,B:phase"` | 원천들이 어느 phase 로 서는가 (`sourcePhases`) |
| `HKT_DISTURBANCE="A:300,B:150"` | 방에 소란이 얼마나 쌓여 있는가 — 값만, 위상은 세계가 정한다 (`disturbances`) |
| `HKT_CLOCK="LONG_NIGHT"` 또는 `"SEEP:NIGHT"` | 세계가 어느 때에서 시작하는가 (`clock`) |
| `HKT_PRESENCE="A,B"` | 어떤 것이 지금부터 지나가고 있는가 (`presences`) |
| `HKT_LIFE_PHASE="SITE:phase"` | 탄생지가 어느 phase 로 서는가 — 진행은 0 (`lifeSitePhases`) |
| `HKT_POPULATION="POP:VALUE"` | 개체군의 값 — 0 과 상한 사이로 잘린다 (`populations`) |

`server/main.ts` 의 손잡이 (세계 프로세스 저장): `HKT_WORLD_SAVE` (스냅샷 파일 경로 · 기본 `.world/snapshot.json`) · `HKT_WORLD_SAVE_INTERVAL_MS` (저장 주기 · 기본 5000).
