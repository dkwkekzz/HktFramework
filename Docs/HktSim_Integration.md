# HktSim — HktCore 통합 계획

> 큰 그림 설계: [HktSim_Design.md](HktSim_Design.md) · 의도: [I-0050](intents/I-0050.md)
> 이 문서는 *설계를 우리 모듈 구조에 어떻게 앉히는가* 를 다룬다. "왜" 가 아니라 "어디·어떤 형태로".
> 상태: 계획 v0.2

---

## 0. 핵심 모델 — bulk(셀) vs discrete(엔터티)

설계 전체에서 **강제된 구분은 단 하나**다. "유체 vs 고체" 가 아니다.

| | 저장 | 비용 | 무엇 |
|---|---|---|---|
| **셀 (bulk)** | 셀당 밀도/충전율 | **O(셀 수)** — 양과 무관 | *안 만지는 배경 전부.* terrain voxel(고체), field(열·수분·원소) 모두 여기 |
| **엔터티 (discrete)** | 개별 identity + 속성 | **O(개수)** — 유한 | *지금 쥐는 소수.* 구체, 던진 돌 |

- **이 구분의 명분은 철학이 아니라 규모/비용이다.** 한 지역의 열·흙은 개념상 수백만~수십억 단위 — 엔터티는 *단위당* 메모리·CPU·네트워크를 먹고, 셀은 *양과 무관하게 셀 수만큼만* 먹는다. "모든 원자를 엔터티로" 는 불가능하다(설계 §0). 그래서 배경은 셀로 싸게, 만지는 것만 엔터티로 비싸게.
- **존재론적으로는 전부 "속성 가진 물질"이다.** 응축/용해는 같은 물질을 두 표현 사이로 옮기는 연산일 뿐. → **응축/용해 = bulk(셀) ↔ discrete(엔터티) 승격/강등.**
- **terrain voxel 도 field 도 같은 "셀" 범주 — 형제다.** 엔터티만 다른 범주. 둘의 차이는 *데이터 구조가 아니라 솔버 규칙* 뿐이다.
- **"유체 vs 고체" 는 솔버 규칙 차이일 뿐이다** (설계 §2.2 자인: "같은 셀 그리드, 같은 추출 API, 같은 보존 원리. 다른 것은 솔버 규칙과 시각화 방식뿐"):
  - 열·수분 → diffusion + advection (퍼지고 흐름)
  - 흙·모래 → 중력 안정성 CA (안식각 넘으면 흘러내림)
  - 암반 → 솔버가 아무것도 안 함 (불변)
- 따라서 "유체 모듈 / 고체 모듈" 로 나누지 않는다. **셀 한 종류 + 레이어별 솔버 규칙.**
- 월드가 작다면 "전부 엔터티" 가 더 단순하고 정답이다. 셀(field)을 도입하는 *유일한 명분은 MMO 규모* 다.

---

## 1. 설계 문서 ↔ 실제 코드 대조

설계 문서가 가정한 일부 전제가 현 코드와 다르다.

| 설계 문서 가정 | 실제 | 결론 |
|---|---|---|
| 구체 = `HktMass` 엔터티 | **HktMass 모듈 없음.** HktCore 가 SOA archetype/trait 엔터티 모델 보유 (`EHktArchetype`: Character/NPC/Item/Projectile/Building/Debris/Natural) | 구체는 **새 archetype + cold property** 로. Mass 도입 안 함 |
| 솔버 = "기존 Niagara 2D compute 8 HLSL 커널 재사용" | **그런 파이프라인 없음.** voxel 렌더 셰이더만 존재 | 권위 솔버는 **CPU 결정론**으로 신규 작성. 서버 권위·결정론 원칙에 오히려 부합. GPU 시각 장은 Phase 2 이연 |
| 장 = 별도 `WorldSubsystem`(런타임 UObject) 소유 | 장은 *고갈·회복·보존* 이라는 **게임플레이 진실** | 권위 장은 **HktCore 결정론 레이어**에. 문서의 'WorldSubsystem' 은 시각용 GPU 장에만 해당하며 이연 |

핵심 단언: **권위 셀(field)·솔버·변환·구체는 전부 결정론 레이어(HktCore)에 속한다.** 순수 C++ SOA 이므로 HktCore 순수성(UObject 0)을 깨지 않고, `FHktSimulationDiff` 동기화·서버 권위를 공짜로 얻는다.

---

## 2. 디렉터리 구조 (HktCore 내부)

문서 §8 의 `Field / Particle / Transform / Solver` 4구획을, "그 코드가 무엇을 읽고 쓰는가" 기준으로 매핑한다.

| 문서 §8 | 개념 | 읽고/쓰는 대상 | 집 |
|---|---|---|---|
| **Field** | 동적 셀(유체·원소) 데이터 | 장 셀 | `Field/` (데이터) |
| **Solver** | 장 동역학 | **오직 장만** | `Field/` (시스템) — 장 연산이므로 정당 |
| **Particle** | discrete 엔터티 | **엔터티** SoA | 엔터티 모델(archetype) — 폴더 아님 |
| **Transform** | 응축/용해 = bulk↔discrete 가교 | 셀(장+voxel) **과** 엔터티 양쪽 | **Field 밖** — 어느 층에도 전속되지 않음 |

```
HktCore/
├─ Public/
│  ├─ Field/                        ← 동적 셀(유체·원소) 데이터 전용
│  │   ├─ HktFieldTypes.h           EHktFieldLayer, FHktFieldChunk(SoA)
│  │   ├─ HktFieldState.h           FHktFieldState — Sample / SampleGradient / AddSplat / Extract(보존 클램프)
│  │   └─ HktFieldDelta.h           FHktFieldDelta — 청크 요약 동기화 DTO
│  ├─ HktCoreArchetype.h            (확장) EHktArchetype::Substance — discrete 구체
│  └─ HktCoreProperties.h           (확장) ElementType / ElementAmount / ThermalCharge cold property
├─ Private/
│  ├─ Field/
│  │   ├─ HktFieldState.cpp
│  │   ├─ HktFieldSeeding.cpp       지형(IHktTerrainDataSource) → 장 초기값 유도
│  │   └─ HktFieldSolverSystem.*    장 동역학 (장만 만짐 → Field 소속 정당)
│  └─ HktTransformSystem.*          ← bulk↔discrete 가교. Field 밖, 기존 시스템들과 나란히
```

- **`Sim/` 폴더 금지** — HktCore 자체가 시뮬레이션이므로 동어반복. 새 시스템은 기존 `Private/HktSimulationSystems.h` 시스템 규약을 따른다.
- **Solver 가 `Field/` 인 이유**: 솔버는 장 셀만 만진다(엔터티를 모른다) → 순수 장 연산.
- **Transform 이 `Field/` 밖인 이유**: 셀에서 빼서 엔터티를 만들고(응축) 그 역(용해). 두 범주를 동시에 건드리는 경계 연산 — 정체성은 "파이프라인 스테이지"이지 "장의 일부"가 아니다.
- 결합도가 높아 처음엔 HktCore 내부. 성장하면 이 트리째 별도 모듈로 추출. 추출 시 모듈명은 `HktSim` 보다 `HktField`/`HktEnvironment` 재고 — 추후 결정.

---

## 3. 엔터티(구체) — archetype + property 확장

- `EHktArchetype` 에 `Substance`(작명 확정 필요: Substance vs Orb) 추가. 기존 `Natural`/`Debris` 와 구분.
- 신규 cold property (`HKT_DEFINE_PROPERTY(..., Cold)`): `ElementType`, `ElementAmount`, `ThermalCharge` 등 — SoA cold tier 자동 배치.
- 신규 trait `HktTrait::Substance`(위 property 묶음) + 기존 `Spatial/Movable/Collidable` 조합 → 응축된 구체가 즉시 중력·충돌·인력 물리에 진입.
- **이득**: 구체 스폰/소멸이 기존 `SpawnedEntities`/`RemovedEntities` 델타로 자동 동기화. 클라 시각화도 기존 `FHktActorProcessor` 경로 재사용. 추가 시스템 0.

---

## 4. 장(field) — 동적 셀 레이어

장 시스템이 새로 소유하는 건 **동적 유체·원소 셀뿐**이다(고체 bulk 는 §5 — 기존 voxel terrain).

- 키 `FIntPoint`(2D 청크). 청크 N=64 (CVar `hkt.Sim.Field.ChunkCells`), 셀 100cm (CVar `hkt.Sim.Field.CellSizeCm`). voxel 32³@15cm 와 **독립** — 게임플레이 진실은 거칠게, 시각 부드러움은 샘플링 단계 bilinear.
- SoA: 레이어별 평평한 `TArray`.
- `bDirty` 청크만 델타 저장. 미변형 청크는 지형 시딩 + settle 로 재생성(문서 §2.5).
- 시딩: `HktFieldSeeding` 이 `IHktTerrainDataSource`(고도·바이옴)를 읽어 열=f(고도·바이옴), 수분=바이옴+수계거리, 원소=지각특징 편향 핫스팟 유도. HktTerrain 은 **읽기 전용 시드/경계 소스** — 변경 0.

---

## 5. 고체의 생애주기 — terrain ↔ entity

물질을 *종류*로 박지 않고 **상호작용 수준에 따라 표현을 바꾸는 생애주기**로 본다(§0). 고체 한 줌은 세 상태를 오간다:

| 상태 | 표현 | 비용 | 전이 |
|---|---|---|---|
| **휴면(배경)** | voxel terrain (`FHktVoxel`) | ~0 | — |
| **활성(쥐는 순간)** | **entity** (구체/덩어리) | 비쌈 | ← **응축**(condense) |
| **재퇴적(놓는 순간)** | 다시 voxel terrain | ~0 | → **용해**(dissolve) |

- 설계 §2.2 의 "느린 고체장" 은 **별도 격자가 아니라 곧 기존 voxel terrain** 이다. entity 성(性)은 *상호작용 순간에만* 잠깐 피어났다 사라진다.
- **단일 출처 원칙 유지**: 고체 진실은 늘 voxel 한 곳. 응축은 일시적 entity 를 낳고, 용해는 기존 voxel 변경 경로(`VoxelDeltas`)로 되돌린다.
- HktTerrain 의 두 역할: ① **불변 골격**(암반·고도·바이옴) — 영원히 terrain, 절대 entity 안 됨(경계조건/시드). ② **휴면 고체**(흙·돌) — terrain 에 싸게 누웠다가 만지면 응축, 놓으면 용해.

---

## 6. 변환(Transform) — bulk↔discrete 2-백엔드 가교

`HktTransformSystem` 은 같은 응축/용해 연산을 **두 백엔드**에 대해 수행한다. 둘 다 각자의 단일 출처를 경유:

| 물질 | 휴면 표현(bulk) | 추출/환원 경로 |
|---|---|---|
| 유체·원소 | `FHktFieldState` | `FHktFieldState::Extract` (보유량 클램프) / `AddSplat` |
| 고체 | voxel terrain | `UHktTerrainSubsystem` / `VoxelDeltas` |

- 흐름: 클라 의도(P,R,Layer) → 서버 검증 → 해당 백엔드에서 추출(보존 클램프) → 구체 `AllocateEntity`. 용해는 역과정.
- **보존이 추출 함수 한 곳에서 강제**(문서 §5). 요청량이 아니라 실제 보유량으로 클램프.

---

## 7. 시스템 파이프라인 삽입 — TerrainSystem 패턴 차용

기존 8단계 루프에서 **`FHktTerrainSystem` 바로 뒤**에 두 시스템 추가:

```
… → TerrainSystem → [FieldSolverSystem] → [TransformSystem] → Gravity → Movement → Physics → …
```

- `FieldSolverSystem` 은 `TerrainSystem` 과 동일하게 **`bIsAuthoritative` 일 때만** 솔버 스텝(저빈도: `FrameNumber % K == 0`). 클라는 델타 수신만.
- `TransformSystem` 은 §6 의 2-백엔드 가교.

---

## 8. 동기화 — `FHktSimulationDiff` 확장

- `FHktSimulationDiff` 에 `TArray<FHktFieldDelta> FieldDeltas` 추가 — 기존 `VoxelDeltas` 패턴 복제(NetSerialize 포함).
- 청크 요약/델타만 전송 → 대역폭 작음(문서 §7).

---

## 9. 클라이언트 시각화 (읽기 전용)

- **HktPresentation**: `FHktFieldProcessor`(신규 `IHktPresentationProcessor`) — `FieldDeltas` → `FHktPresentationState` 신규 Field 뷰 → 디버그 색 박스(Phase 1) → 모트(Niagara).
- **HktVFX**: 응축/용해·모트 Niagara 는 기존 `FHktVFXIntent`/`UHktVFXAssetBank` 파이프라인 재사용.
- GPU 난류 디테일 장은 **Phase 2 이연** (존재하지 않는 "8 HLSL 커널" 신규 작성 대상이며 시각 전용).

---

## 10. ⚠️ 결정론 제약 (Phase 3 에서 확정)

문서는 솔버를 float 로 기술하나, 이 프로젝트는 **HktRuntime GGPO 롤백(30Hz) + HktCore zero-float**. 두 갈래:

- **(택1)** 장이 GGPO 프레임에 포함 → 유체 레이어도 `FHktFixed32`/정수. 고체 충전율은 이미 정수라 안전.
- **(택2)** 장은 GGPO 밖 **서버 권위 전용**(`FHktTerrainSystem` 의 authoritative-only 패턴) + 델타 동기화 + 클라 reconcile.

§7 은 **(택2)** 전제로 그렸다 — 더 단순하고 문서 §7 "클라 예측·서버 화해" 와 일치. 단 구체(엔터티)는 롤백 대상이므로, bulk↔discrete 경계(응축 순간 보존)의 롤백 정합은 **Phase 3 에서 확정**. 초기 3개 마일스톤은 솔버가 없어 이 문제를 건드리지 않는다.

---

## 11. 마일스톤 (문서 §9 로드맵 매핑)

| PR | 범위 | 완료 기준 | 절 |
|---|---|---|---|
| **0→1** | `FHktFieldState` SoA + Sample/AddSplat + `FieldDeltas` 동기화 + `FHktFieldProcessor` 디버그 박스 | 콘솔로 셀에 값 쓰면 화면 색이 변함 | §2·4·8·9 |
| **2** | `HktFieldSeeding` — 지형 고도/바이옴 → 열·수분·원소(Poisson 핫스팟) | 지형과 일관된 장 | §4 |
| **3** | `FieldSolverSystem` diffusion+advection 1스텝 + 결정론 전략 확정 | 장이 흐른다 | §7·10 |
| **4** | `TransformSystem` 응축/용해 + Extract 보존 클램프 + `Substance` archetype | 구체 스폰·고갈·회복 | §3·5·6·7 |

가장 작은 1번 PR이 데이터+시각화를 동시에 세워, 이후 모든 단계가 화면으로 즉시 피드백되게 한다(문서 "다음 작업 권장: 1단계 시각화" 와 일치).

---

## 12. 열린 질문

- **archetype 작명**: `Substance` vs `Orb`.
- **결정론 택1/택2** (§10, Phase 3 에서 확정).
- **골격 vs 휴면 고체의 경계** — voxel TypeID/Flags 로 "응축 가능 여부" 구분? 깊이 임계값? 베이크 단계 마킹?
- **중력 안정성 CA**(모래 흘러내림·안식각, 설계 §2.7) — 휴면 voxel 을 직접 변형하면 *지형 변형 시스템* 인데, HktTerrain 의 일인가 솔버의 일인가? (어느 쪽이든 voxel 단일 출처 경유)
- **AI 통행 가능성** — 거친 2D 고체 요약이 필요하면, voxel 에서 파생된 *읽기 전용 캐시*지 진실원이 아니다.
- **건설/쌓기** — 용해가 임의 위치 voxel 을 *추가* 하는가, 기존 셀 충전만 채우는가.
- **추출 시점 모듈명**: `HktSim` vs `HktField` vs `HktEnvironment` (성장 후 결정).
