# I-0019 NPC 출현 및 분포 정책 — 구현 상태

[I-0019 의도 문서](intents/I-0019.md) 의 구현 진척·격차·기술 메모를 분리해 보관한다. 의도(왜) 문서가 일감 추적기로 비대해지는 것을 막기 위한 디자인 문서다.

부모 의도 I-0014 의 구현 문서와의 관계: [Design-I0014-Implementation.md](Design-I0014-Implementation.md) — I-0014 는 "Placement → Spawner → Entity" *인프라* 를 제공하고, 본 문서는 그 위에서 NPC 가 *왜·언제·어디서* 등장하는가의 정책 축을 다룬다.

## 핵심 흐름

NPC 출현은 두 경로가 **공존** 한다. 두 경로는 같은 NPC 정의 (classTag · lifecycle story) 를 공유하되, 다른 정책 축에서 트리거된다. [I-0020](intents/I-0020.md) 에 따라 두 경로의 *합류 지점* 은 voxel attribution 이다 — voxel 이 spawn 주체이므로, 어느 입구로 들어오든 결국 "이 voxel 의 template 을 활성화한다" 로 환원된다.

```
[자연 발생 경로]                              [트리거 기반 발생 경로]
   │                                              │
   ├─ ChunkLoaded                                 ├─ Event.NPC.Spawn.Requested
   │     (BiomeId, SlotHash31)                    │     (classTag, posXY, contextId)
   │                                              │     ⇐ Quest / Cinematic / Encounter
   ▼                                              ▼
[NPC_Placement_<World>.json]                  [NPC_Trigger_<Context>.json]
   │  biome × 진척도 분기                          │  context 분기 → 대상 voxel 선정
   │  → voxel 에 SpawnTemplateId 부여              │  → 대상 voxel 의 SpawnTemplateId 갱신
   ▼                                              ▼
                  [Voxel Attribution] (voxel.SpawnTemplateId = NpcGoblin)
                       │  voxel 평가 시점에 활성화
                       ▼
                  [NpcGoblin_Spawn.json]   (terrain story template — voxel 이 참조)
                       │  voxel 시드 (좌표·SlotHash31·lineage·contextId)
                       │  Region 메모리 (NPC density / faction 누적)
                       │  관계 축 결정 (Hostile / Neutral / Friendly)
                       │  SpawnEntity + 위치/속성
                       │  DispatchEventFrom(NpcGoblin_Lifecycle, spawnedEntity)
                       ▼
                  [Story_NPCLifecycle / NpcGoblin_Lifecycle]
                       (I-0010 / I-0011 위임)
```

**핵심 단언**: 자연 발생용 `Placement_<World>` 와 트리거용 `NPC_Trigger_<Context>` 는 *입구* 만 다르고, voxel attribution 으로 합류한다. 두 입구의 차이는 "어느 voxel 의 template id 를 무엇으로 정하는가" 뿐이며, 활성화 이후 정책 축 (density / faction / encounter design) 은 template 1곳에서 일괄 적용된다.

## 구현 완료

| 항목 | 위치 |
|---|---|
| NPC GameplayTag 체계 (`Entity.NPC.Goblin/Skeleton/Zombie`) | `HktGameplay/Source/HktStory/Public/HktStoryTags.h:22-23` · `HktCoreDefs.h` |
| NPC 속성 태그 (`Tag_NPC_Hostile` = `Entity.Attr.NPC.Hostile`) | `HktStoryTags.h:26` |
| `Story_NPCLifecycle.json` (사망 → 드롭 → 제거 패턴) | `HktGameplay/Content/Stories/Story_NPCLifecycle.json` |
| `SpawnEntity` opcode 의 NPC classTag 분기 (`NpcGoblin`/`NpcSkeleton`/`NpcZombie`) | `Story_WorldInit.json:24-26` 에서 사용 사례 |
| Region 메모리 opcode (`FindOrCreateRegionAt`, `RegionMapRead/Write`, `RegionAddScalar`) — 자연물용 검증 완료 | HktCore VM opcode 군 |
| 부모 I-0014 의 placement-story / spawner-story dispatch 인프라 | [Design-I0014-Implementation.md](Design-I0014-Implementation.md) "구현 완료" 표 전체 |

## 부분 / 의도-구현 격차

| 갭 | 의도 표현 | 현 구현 |
|---|---|---|
| **NPC Placement story 부재** | biome × 진척도 × 관계 축으로 voxel 에 NPC `SpawnTemplateId` 를 부여 | `Placement_TranquilWilds.json` 은 Oak/Birch 분기까지만, 그리고 voxel attribution 이 아닌 청크 단위 dispatch. NPC 분기 / voxel 단위 모두 부재. |
| **NPC Placement 출력 형식 마이그레이션** ([I-0020](intents/I-0020.md)) | NPC placement 도 즉시 dispatch 없이 attribution 만 부여 — 자연물과 동일 형식 | 위 부재 항목과 묶임. 새 형식이 [Design-I0014-Implementation.md](Design-I0014-Implementation.md) 의 "Placement Story 패턴 마이그레이션" 으로 정의되면, NPC 측은 그 형식을 그대로 따른다. |
| **NPC Spawn template 부재** | `<Npc>_Spawn.json` 이 voxel 이 참조하는 terrain story template 라이브러리의 한 항목으로 등록 | `Story_NPCLifecycle.json` 만 존재. template 측 entry 및 라이브러리 등록 부재. |
| **트리거 기반 발생 채널** | `Event.NPC.Spawn.Requested` (혹은 동등 채널) 로 Quest / Cinematic / Encounter 가 대상 voxel 의 `SpawnTemplateId` 를 갱신·활성화 | 미정의. `HktStoryEventParams.h` 에 채널 없음. voxel attribution 갱신 opcode 도 부재 ([I-0020](intents/I-0020.md) 인프라 의존). |
| **RegionRecord NPC 필드** | NPC 밀도 / faction / 최근 조우 시각 등을 누적 추적 | `Entity.RegionRecord.Lineage / Variant / OreSpecies` 만 존재 (`HktCoreDefs.h:51-54`). NPC 축 부재. |
| **관계 축 (Faction / Reputation / Relation)** | 우호 / 적대 / 중립이 결정론적으로 산출되어 spawner-story 가 참조 | 시스템 부재. `Tag_NPC_Hostile` flat tag 만 존재. faction/reputation 누적 없음. |
| **서사 트리거 (Quest / Progress)** | 진척도 차이가 NPC 출현 분기로 *증폭* ([I-0017](intents/I-0017.md) 의 적용 영역) | 시스템 부재. |
| **HktMapGenerator NPC 카탈로그 입력 포맷** | 디자이너가 의도 수준으로 "이 World 에 어떤 NPC 가 어떤 밀도로" 를 표현 | `FHktMapLandscape`, `FHktTerrainRecipe` 류만 존재. NPC 분포 정책 입력 구조 부재 ([I-0007](intents/I-0007.md) 위임). |
| **NPC 자동 생성 파이프라인 단계** | feature_design → NPC catalog → Placement / Trigger JSON 자동 산출 | `HktGameplayGenerator/` 에 NPC 카탈로그 생성기 부재. |

## 구현 단계

격차를 한 번에 메우지 않고, 작은 수직 슬라이스로 진행한다. 각 단계는 독립 PR 단위.

1. **자연 발생 경로 vertical slice** — `NPC_Placement_TranquilWilds.json` + `NpcGoblin_Spawn.json` + (기존) `Story_NPCLifecycle.json` 보강. RegionRecord NPC 필드는 *최소* (예: `Entity.RegionRecord.NpcDensity`) 만 추가. biome 1개·NPC 1종으로 출구까지 검증.
2. **트리거 채널 정의** — `Event.NPC.Spawn.Requested` 채널 + `NpcGoblin_Spawn.json` 의 두 입구 합류 검증. Quest 시스템 부재이므로 *수동 dispatch* 테스트로 한정.
3. **관계 축 1단계** — Faction enum + RegionRecord 누적 + Hostile/Neutral/Friendly 분기. 시범 1종.
4. **HktMapGenerator NPC 입력 포맷** — `FHktMapNpcCatalog` 도입, baked asset 까지 흘려보냄.
5. **자동 산출 파이프라인** — feature_design 의 NPC 절을 NPC_Placement / NpcGoblin_Spawn JSON 으로 자동 변환 ([I-0007](intents/I-0007.md) 본체).
6. **Quest / Progress 시스템** — 트리거 채널을 실제 진척도와 연결. 별도 일반 의도로 끌어올릴 가능성 검토.

단계 1·2 는 본 의도(I-0019) 가 직접 책임지고, 3 이후는 일반 의도들 ([I-0007](intents/I-0007.md), [I-0015](intents/I-0015.md), [I-0017](intents/I-0017.md)) 의 적용 영역으로 위임될 수 있다.

## 점검 메모

- **합류 지점의 결정론** — 두 입구 (자연 / 트리거) 가 voxel attribution 으로 합류한 뒤 template 이 활성화될 때, 시드는 *voxel 좌표* 를 기준 축으로 삼는다 ([I-0020](intents/I-0020.md) + [I-0017](intents/I-0017.md)). 자연 발생의 `SlotHash31`, 트리거의 `contextId` 는 모두 *voxel 시드의 보조 입력* 으로 흡수되어야 하며, 두 보조 입력을 혼합하지 않는다 — 한 voxel 의 활성화에는 한 입구만 결정 인자로 사용한다 (마지막 attribution 갱신이 우선).
- **classTag 일관성** — `SpawnEntity` 의 `classTag` 는 NPC / Item / 자연물 공통이므로, NPC 전용 분기를 별도 opcode 로 만들지 않는다. 정책 차이는 *template 분기* 로 흡수.
