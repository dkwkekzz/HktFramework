# C01 — TranquilWilds (강과 산이 있는 풀숲)

> **상태**: Skeletal. 구체적 Story 작성 전. 본 폴더는 컨셉 → 자연 → 상호작용 → Story 디스패치 순으로 채워나간다.
> **상위 설계**: [`Docs/Design-VoxelSpawner.md`](../../Design-VoxelSpawner.md)
> **선행 자료(참고)**: [`Docs/Concept01_TranquilWilds/`](../../Concept01_TranquilWilds/) — 동일 주제의 이전 시리즈. 본 폴더는 *Terrain Spawner V2 + Story dispatch* 컴플라이언스로 재시작한 skeletal 라인.
> **시작**: 2026-05-13

---

## 0. 컨셉 한 줄

강과 산이 있는 풀숲 위에 **자연 spawner** 가 entity 를 깔고, 각 entity 가 시드한 **Story 가 다른 Story 로 dispatch** 되면서 **미지·도파민·무한 성장** 이 누적된다.

---

## 1. 사고 단계 (이 폴더의 진행 순서)

```
[Step 1] 자연 — 지형이 자체적으로 만들어내는 entity 들의 카탈로그
            └─ 01-natural-entities.md
[Step 2] 자연 성장 — 그 entity 들이 시간/지형 조건에 따라 변하는 규칙
            └─ 02-natural-growth.md
[Step 3] 자연 Spawner Spec — 각 spawner Story 의 분포·dispatch·영속 hook 상세
            └─ 03-natural-spawners.md
[Step 4] Region 영속 상태 — 03 이 도입한 region 카운터의 store/read 시스템
            └─ 04-region-state.md
[Step 5] 상호작용 — 플레이어 행위가 어느 Event 를 발화하는가
            └─ 05-interactions.md
[Step 6] 도구 — 05 의 도구 요구 컬럼 + Material tier ladder
            └─ 06-tools.md
[Step 7] Story 본문 — 03 의 11 spawner 를 schema 2 JSON 으로 (1 PR 1 spawner)
            └─ (TBD) 07-story-bodies/
```

본 PR 시리즈는 **Step 1 + 2 + 3** 까지 채운다. 나머지는 후속.

---

## 2. 절대 가드레일 (이 폴더 전체 적용)

| # | 항목 | 근거 |
|---|---|---|
| **G1** | 모든 spawner 는 `FHktTerrainSpawnerSpec` (Story V2) 로만 직렬화. `EHktSpawnRule` 부활 금지. | Design-VoxelSpawner.md §데이터 모델 |
| **G2** | 모든 entity 진입은 `FGameplayTag` (`Entity.Natural.*`) 기반. cpp 하드코딩 enum 금지. | 루트 CLAUDE.md "GameplayTag" 규약 |
| **G3** | Story 본문은 schema 2 JSON 만. cpp 스니펫 신규 작성 금지. | Design-VoxelSpawner.md 부록 A D4 |
| **G4** | spawner 컨텍스트는 `FHktEvent::Param0~3` 만 사용. 별도 EntryArgs 메커니즘 도입 금지. | Design-VoxelSpawner.md §Runtime 진입 메커니즘 |
| **G5** | 자연 entity 의 "성장/소멸" 도 결정론 시뮬레이션 결과. 클라이언트 측 자체 판정 금지 (절대 원칙 3). | 루트 CLAUDE.md "Absolute Principles" |
| **G6** | 바이옴 파라미터로 추출 가능해야 한다. 풀숲 전용 하드코딩은 L6(시드 인과) 한정. | Concept01 시리즈 §1 결정 계승 |

---

## 3. 네임스페이스 약속 (이 폴더에서 새로 도입)

| Tag 접두 | 의미 | 예시 |
|---|---|---|
| `Entity.Natural.Flora.*` | 식물군 | `Entity.Natural.Flora.Oak` |
| `Entity.Natural.Geology.*` | 암석/지질 | `Entity.Natural.Geology.Boulder` |
| `Entity.Natural.Water.*` | 수계 feature | `Entity.Natural.Water.Ford` |
| `Entity.Natural.Mountain.*` | 산악 feature | `Entity.Natural.Mountain.Peak` |
| `Entity.Natural.Trace.*` | 동물/자연 흔적 | `Entity.Natural.Trace.AnimalTrail` |
| `Spawner.Story.Natural.*` | 자연 entity 를 깔거나 성장시키는 Story | `Spawner.Story.Natural.OakGrove` |
| `Event.Natural.*` | 자연 entity 가 발화하는 이벤트 | `Event.Natural.TreeFelled` |

세부 카탈로그는 [`01-natural-entities.md`](./01-natural-entities.md).

---

## 4. 본 PR 산출물

- [x] `README.md` (이 문서)
- [x] `01-natural-entities.md` — ~20 종 자연 entity 사양 skeleton
- [x] `02-natural-growth.md` — 자연 성장 컨텐츠 설계 skeleton
- [x] `03-natural-spawners.md` — 11 spawner Story 의 분포·dispatch·영속 hook 상세 spec
- [x] `04-region-state.md` — 03 의 region 카운터를 SoA virtual entity 로 모델링하는 ADR
- [x] `05-interactions.md` — 플레이어 행위 → `Event.Natural.*` 매핑 + 판정 책임 분리
- [x] `06-tools.md` — `Entity.Tool.*` 카탈로그 + Action↔Tool 매트릭스 + Material tier ladder
- [x] `Implementation-Plan.md` — 03~06 ADR 을 코드로 옮기는 4 PR 핸드오프 (PR-1 ~ PR-4+)

## 5. 후속 (TBD)

- `07-story-bodies/` — 03 의 11 spawner 를 schema 2 JSON 으로 작성 (04 의 RegionWrite helper + 05 의 Event.Natural.* + 06 의 도구 분기 통합).
- `08-durability.md` — 시즌 1+. 도구 내구도 hot attribute.
- `09-crafting.md` — 시즌 1+. 자연 재료 → 도구 제작.
- 위 G1~G6 가드레일을 위반하는 설계가 발견되면 본 README §2 를 인용해 차단.
