# C01-03 — 자연 Spawner Story 상세 Spec

> **목적**: [`01-natural-entities.md`](./01-natural-entities.md) 의 20 entity 를 *지형 베이크 + 청크 로드 dispatch* 만으로 깔되, 각 spawner 가 단순 "시간 지나면 생성" 이 아니라 **자체적인 미지/도파민/성장 메커니즘**을 갖도록 설계.
> **상태**: Detail spec. Story JSON 본문은 아직 X — 본 문서가 그 본문의 청사진.
> **상위**: [`README.md`](./README.md) · **이전**: [`02-natural-growth.md`](./02-natural-growth.md)

---

## 0. 디자인 원칙 (이 폴더 전체 적용)

| # | 원칙 | 이유 |
|---|---|---|
| **P1** | spawner 마다 **단일 가치 책임** (미지·도파민·성장 중 하나) 를 1차로 진다 | 가치 충돌(미지 vs 도파민) 을 spawner 레벨에서 분리해야 region 전체 톤이 무너지지 않음 |
| **P2** | 분포는 **결정론적 노이즈 + 비대칭** 만 쓴다. 균일 random 금지 | 균일 분포는 "왜 여기에" 의 미지를 죽임 — 풀이 결을 갖고, 강이 굽이를 갖는 식으로 *읽을 수 있는 패턴* 을 만든다 |
| **P3** | 모든 spawner 는 **하나 이상의 region 영속 카운터**를 건드린다 | 무한 성장 가치를 위한 누적 — 청크 단위 휘발 X |
| **P4** | dispatch 가지는 **조건부**. 항상 발화하는 dispatch 는 그냥 같은 story 본문에 넣는다 | 조건부 dispatch 만이 인과 그래프를 만든다 |
| **P5** | 신규 opcode 0 (G3) — 분포·조건 계산은 `RandomInt` / `Add` / `Mul` / `Cmp` 등 기존 60+ opcode 조합 | Design-VoxelSpawner.md 부록 A 신규 OpCode 정책 |
| **P6** | Param0/1 은 항상 anchor 위치 (cm 정수). Param2/3 만 spawner 별 의미 자유 | Design-VoxelSpawner.md §데이터 모델 - 명시 배치 / `SpawnerParams::` 컨벤션 |

---

## 1. 공통 Spec 양식

본 문서의 각 spawner 섹션은 다음 항목을 반드시 채운다.

```
가치               : 미지 | 도파민 | 성장        (단일 1차 책임)
Trigger            : 청크 로드 | 부모 dispatch | region 카운터 임계
Param0..3 의미     : SpawnerParams::* 별칭으로 표기
분포 패턴          : (균일/노이즈 결/비대칭/줄/원형 등 형태)
Entity 산출        : tag × count formula
Dispatch 가지      : 조건 → target story (Param 전달)
Region 영속 hook   : 어떤 카운터/슬롯이 갱신되는가
시그널 (S1~S4)     : 플레이어가 어느 거리에서 알아차리는가
Theme contract     : 가치를 1줄로 어떻게 시연하는가
```

> `S1=즉시 시야` · `S2=단거리(<50m)` · `S3=중거리(<200m)` · `S4=지평선` — 이전 시리즈(`Concept01_TranquilWilds/07-signal-placement-rules.md`) 어휘 계승.

---

## 2. Spawner Story 목록 (총 11)

| # | Tag | 한 줄 시그니처 | 1차 가치 |
|---|---|---|---|
| S01 | `Spawner.Story.Natural.GrassPlain` | "보이지 않는 결" | 미지 |
| S02 | `Spawner.Story.Natural.OakGrove` | "오래된 그늘" | 성장 |
| S03 | `Spawner.Story.Natural.BerryPatch` | "익는 시각이 다르다" | 도파민 |
| S04 | `Spawner.Story.Natural.MushroomSeed` | "그늘의 손님" | 미지 |
| S05 | `Spawner.Story.Natural.PineSlope` | "송진의 비탈" | 도파민 |
| S06 | `Spawner.Story.Natural.RiverEdge` | "굽이의 비대칭" | 미지 |
| S07 | `Spawner.Story.Natural.AnimalTrailSeed` | "끝점이 숨어있다" | 미지 |
| S08 | `Spawner.Story.Natural.MountainCap` | "정상의 영역" | 성장 |
| S09 | `Spawner.Story.Natural.FallenLogDecay` | "마지막 뼈대" | 성장 |
| S10 | `Spawner.Story.Natural.SpringDiscovered` | "물의 약속" | 성장 |
| S11 | `Spawner.Story.Natural.GrassSuccession` | "다시 깔리는 결" | 성장 |

---

## 3. Spawner 상세

### S01. `Spawner.Story.Natural.GrassPlain` — "보이지 않는 결"

**가치**: 미지
**Trigger**: 청크 로드 (1 회). biome ∈ {grass, transition} 인 모든 청크.
**Param 의미**
- `Param0` = anchor X (cm)
- `Param1` = anchor Y (cm)
- `Param2` = `WindAngleRaw` — region wind 의 결 방향 (Q16, 0..360°)
- `Param3` = `ChunkSeed` — 청크 결정론 해시

**분포 패턴**
- chunk 내 Grass(F01) 셀이 `WindAngleRaw` 방향으로 정렬된 **노이즈 등고선** 을 따라 깔린다.
- 결의 *끝* — 노이즈 피크 셀 1~2 개 — 가 후속 시드 후보 슬롯이 된다.
- 균일 random 금지 (P2).

**Entity 산출**
```
Grass         : ~chunk 면적 * Density_grass(biome)
Shrub (F02)   : 결의 측면 (수직 방향) 셀에서 5~10% 확률. count ≤ 8
```

**Dispatch 가지**
| 조건 | target | 전달 Param |
|---|---|---|
| 결 끝 셀이 풀숲↔숲 경계면 && `ChunkSeed % 7 == 0` | `Spawner.Story.Natural.OakGrove` | anchor=결끝셀, Param2=lineage_id(=ChunkSeed) |
| 결 끝 셀이 노이즈 피크 && `ChunkSeed % 13 < 2` | `Spawner.Story.Natural.BerryPatch` | anchor=결끝셀, Param2=cluster_n(5..7) |
| 결 측면 셀에 희소 Herb(F07) 후보 (`ChunkSeed % 31 == 0`) | (단일 SpawnEntity, dispatch 아님) | — |

**Region 영속 hook**
- 플레이어가 결의 끝에서 Herb / BerryPatch 를 발견하면 region counter `Region.SeenTheGrain` +1.
- 임계 5 도달 시 region 전체의 `WindAngleRaw` 가 시각적으로 강조 (VFX, 후속 PR).

**시그널**: S1 (눈앞 결의 짧은 시각 큐) → S3 (먼 결의 일관성). S4 없음 — 평지의 가장 낮은 시그널 레이어.

**Theme contract (미지)**
> "왜 풀이 저쪽으로 누워있는가" — 알아챈 플레이어는 Herb/Berry 위치를 *추론* 할 수 있다. 풀숲은 균일하지 않다.

---

### S02. `Spawner.Story.Natural.OakGrove` — "오래된 그늘"

**가치**: 성장
**Trigger**: S01 의 dispatch 분기. 또는 청크 로드 + biome=풀숲 + slope 작음 + `ChunkSeed % 11 == 0`.
**Param 의미**
- `Param0/1` = grove 중심 anchor
- `Param2` = `LineageId` — 노목 가계 ID (region 영속 카운터 연동)
- `Param3` = `ChildCount` (3..5)

**분포 패턴**
- **중심 1 개 + 자식 N 개의 원형 배치**.
- 중심에 *Elder Oak* — 일반 `Entity.Natural.Flora.Oak` 의 attribute 변형 (`Entity.Attr.Flora.Elder` tag 부착, 후속 PR 정의).
- 자식 Oak 은 반경 12~20m, 각도는 `LineageId` 해시로 결정 (재로드 동일).
- *자식 중 1 그루* 만 "후계자 마커" 슬롯이 부착됨 (자식 인덱스 = `LineageId & 0x7` 매핑).

**Entity 산출**
```
Oak (F04, Elder)        : 1 (중심)
Oak (F04)               : ChildCount  (그 중 1 그루는 successor mark)
```

**Dispatch 가지**
| 조건 | target | 전달 Param |
|---|---|---|
| 항상 (1 회) | `Spawner.Story.Natural.MushroomSeed` | anchor=Elder 그늘 셀, Param2=variant_seed(=LineageId ^ FireCounter) |
| Elder 가 베이는 이벤트 `Event.Natural.TreeFelled` 수신 시 | `Spawner.Story.Natural.FallenLogDecay` | anchor=Elder pos, Param2=Oak tag id, Param3=stage=0 |
| Elder 사멸 + region counter `FelledElders[LineageId] >= 1` 이후 시간 누적 임계 | `Spawner.Story.Natural.ElderPromotion` *(별도 후속 — 본 PR 에서는 hook 만)* | successor child pos |

**Region 영속 hook**
- `Region.Lineages[LineageId]` 에 (Elder 위치 / 자식 위치 / felled count / promoted count) 영속 누적.
- Elder 가 베이면 후계자 마커가 *시간 누적 후* Elder 로 승격 (Quake) — 같은 region 을 떠났다 돌아오면 후계가 노목이 되어 있다.

**시그널**: S2~S3 — 멀리서도 큰 그늘이 보인다.

**Theme contract (성장)**
> Elder 가계는 베어도 *지워지지 않는다*. 후계가 자라 노목이 되고, 그 region 의 *역사* 가 된다.

---

### S03. `Spawner.Story.Natural.BerryPatch` — "익는 시각이 다르다"

**가치**: 도파민
**Trigger**: S01 dispatch 또는 직접 청크 로드(희소).
**Param 의미**
- `Param0/1` = patch anchor
- `Param2` = `ClusterCount` (5..7)
- `Param3` = `RipeningOffset` — 클러스터별 익음 시점 phase

**분포 패턴**
- 패치 anchor 주변에 클러스터 5~7 개. 클러스터 간 간격 4~8m.
- 클러스터마다 *익음 시점 phase* 가 다르다 — 같은 spawner 안에서 시간 차로 익는다.

**Entity 산출**
```
BerryBush (F06) × ClusterCount       (초기 attribute = unripe)
```

**Dispatch 가지**
| 조건 | target | 전달 Param |
|---|---|---|
| 클러스터 i 의 ripening phase 도달 | (자기 자신, ripened attribute 전이) | — (entity attribute 변경) |
| **모든** 클러스터가 채집됨 (`Event.Natural.BerryHarvested` 누적 == ClusterCount) | `Spawner.Story.Natural.BerryPatch` *재시드* | anchor=인접 풀 셀(=WindAngle 방향으로 +offset), Param2=ClusterCount-1 (작아짐) |
| ClusterCount == 0 으로 재시드된 경우 | 발화 없음 (자연 소멸) | — |

**Region 영속 hook**
- `Region.HarvestedClusters` +1 / 채집.
- 재시드 시 ClusterCount 가 1 줄어든다 — *남획하면 줄어든다* 의 무한 성장 반대편 가드.

**시그널**: S1~S2 (붉은 색감).

**Theme contract (도파민)**
> 모든 클러스터를 *지금* 따면 손해. *언제 익는가* 의 마이크로 예측이 보상.

---

### S04. `Spawner.Story.Natural.MushroomSeed` — "그늘의 손님"

**가치**: 미지
**Trigger**: S02 (Elder 그늘) / S09 (FallenLog 단계 1~2).
**Param 의미**
- `Param0/1` = anchor (그늘 셀 또는 통나무 셀)
- `Param2` = `VariantId` — `Region.FireCounter ^ LineageId` 로 결정. 0=일반, 1..N=변종
- `Param3` = `Potency` — 0=식용, 1=약효, 2=환각, 3=독

**분포 패턴**
- anchor 주변 1.5m 반경에 1~3 개. Whisper Tier 시각 큐 (포자) 동반.

**Entity 산출**
```
Mushroom (F08, Variant=VariantId, Potency=Potency)
```

**Dispatch 가지**
| 조건 | target | 전달 Param |
|---|---|---|
| `VariantId != 0` && 인근에 Herb(F07) 가 있으면 | `Spawner.Story.Natural.HerbVariantSeed` *(후속 정의)* | anchor=Herb pos, Param2=VariantId |
| `Event.Natural.MushroomEaten` 수신 && 미발견 variant | `Event.Region.VariantCataloged` (region 카탈로그) | VariantId, Potency |

**Region 영속 hook**
- `Region.VariantCatalog[VariantId]` 갱신 — *처음 식별한 플레이어* 가 명명권 후보 (영속).
- `Region.FireCounter` 가 누적되면 *그 region 의 시그니처 variant* 가 안정화 — 재방문 시 같은 변종이 우세.

**시그널**: S1 (포자 큐).

**Theme contract (미지)**
> 어떤 variant 인지 *식별* 해야 안다. 식별 자체가 컨텐츠. region 마다 다르다.

---

### S05. `Spawner.Story.Natural.PineSlope` — "송진의 비탈"

**가치**: 도파민
**Trigger**: 청크 로드 + biome=mountain && `slope ∈ [임계_low, 임계_high]`.
**Param 의미**
- `Param0/1` = 줄 시작 anchor
- `Param2` = `LineLength` (셀 수)
- `Param3` = `ResinDensity` — 화재 가속 계수 (0..255)

**분포 패턴**
- 등고선을 따라 **줄(선)** 로 깔린다. 줄 간격은 노이즈, 같은 줄 위 셀은 일정 간격.
- 균일 random 금지 — *비탈을 읽을 수 있다*.

**Entity 산출**
```
Pine (F05) × LineLength
```

**Dispatch 가지**
| 조건 | target | 전달 Param |
|---|---|---|
| `Event.Natural.FireIgnited` 가 Pine 셀에 닿음 | `Spawner.Story.Natural.FireSpreadLine` *(후속)* | 줄 따라 전파, 속도 ∝ ResinDensity |
| 화재 종료 시 | `Spawner.Story.Natural.FallenLogDecay` × LineLength | 각 Pine 위치 |
| 화재 종료 후 N tick | `Spawner.Story.Natural.GrassSuccession` | 화재 흔적 셀 |

**Region 영속 hook**
- `Region.FireCounter` += 화재 면적. (S04 의 variant 안정화에 연동.)
- 화재 흔적 셀은 영속 표기 — 재방문 시 *결이 바뀌어* 깔린다 (S11 GrassSuccession).

**시그널**: S2~S3 (등고선 줄). 화재 시 S4.

**Theme contract (도파민)**
> 송진 채집의 즉시 보상 + 화재 위험의 긴장. 한번 탄 자리는 *지도를 바꾼다*.

---

### S06. `Spawner.Story.Natural.RiverEdge` — "굽이의 비대칭"

**가치**: 미지
**Trigger**: 청크 로드 + 강 셀 존재.
**Param 의미**
- `Param0/1` = 굽이 anchor (강 곡률 피크)
- `Param2` = `CurvatureSign` — +1=좌굽이 / -1=우굽이 (안쪽/바깥쪽 비대칭)
- `Param3` = `FordCandidate` — 0=없음 / 1=얕은쪽에 Ford 후보

**분포 패턴**
- 강 곡률 큰 지점에서 **안쪽(깊은쪽)** 과 **바깥쪽(얕은쪽)** 의 entity 가 다르다.
- 안쪽: WaterLily(F10) + (희소) Pool. 바깥쪽: Reed(F09) + (조건부) Ford(W01).
- 청크 내 강이 *지평선* 으로 이어지는 경우 그 끝에 Waterfall(W02) 후보 (S4 시그널).

**Entity 산출**
```
Reed × density(바깥쪽 셀)
WaterLily × density(안쪽 셀)
Ford × (FordCandidate ? 1 : 0)
Waterfall × (지평선 경사 임계 ? 1 : 0)
```

**Dispatch 가지**
| 조건 | target | 전달 Param |
|---|---|---|
| `FordCandidate == 1` && Ford 가 청크 내 유일한 횡단점 | `Spawner.Story.Natural.AnimalTrailSeed` | start=Ford pos, Param2=region 미발견 feature hash |
| Waterfall 발생 시 | (시그널 entity 만, dispatch 없음) | — |

**Region 영속 hook**
- `Region.CrossingPoints` 에 Ford 좌표 등록 — region 의 *횡단 비트*.

**시그널**: 강 굽이 S2, Waterfall S3~S4 (음향 큐).

**Theme contract (미지)**
> 강은 *어디로* 이어지는가. Ford 가 없는 청크에선 강을 따라 우회해야 한다.

---

### S07. `Spawner.Story.Natural.AnimalTrailSeed` — "끝점이 숨어있다"

**가치**: 미지
**Trigger**: S06 (Ford) / Shrub 군집 / S02 외곽.
**Param 의미**
- `Param0/1` = trail 시작점
- `Param2` = `EndpointHash` — region seed 로 결정되는 끝점 (Spring 후보 / 인접 region 미발견 feature)
- `Param3` = `TrailLength` (마커 수)

**분포 패턴**
- 시작점 → 끝점 사이 경사·노이즈를 따라 **AnimalTrail(T02) 마커 entity** 가 간헐 배치.
- 마커는 *발견 가능* 하지만 *연속된 길* 은 플레이어가 마커를 *따라가야만* 머릿속에 그려진다.
- 끝점 자체는 *spawn 되지 않은 슬롯* — 발견 이벤트로만 활성화.

**Entity 산출**
```
AnimalTrail (T02) × ~TrailLength       (시작↔끝 사이 듬성듬성)
```

**Dispatch 가지**
| 조건 | target | 전달 Param |
|---|---|---|
| 플레이어가 끝점 셀에 도달 (`Event.Natural.TrailEndpointReached`) | `Spawner.Story.Natural.SpringDiscovered` | endpoint pos, Param2=NPC 만남 시드, Param3=quality |
| 끝점이 *인접 region* 인 경우 | (region 경계 dispatch — 후속 PR) | — |

**Region 영속 hook**
- 끝점 도달 시 `Region.HardenedTrails[trail_id]` 에 trail 등록 — *마커 entity 가 사라지고* trail 이 영속 지형 변경으로 표시 (지형 베이크 patch 는 별도 PR).
- 같은 region 재방문 시 굳어진 trail 이 보인다.

**시그널**: S1~S2 (마커 단위). 연속성 자체는 시그널 X — 추적 능력 필요.

**Theme contract (미지)**
> 끝점은 *모른다*. 따라가야 안다. 발견하면 *길이 굳어진다*.

---

### S08. `Spawner.Story.Natural.MountainCap` — "정상의 영역"

**가치**: 성장
**Trigger**: 청크 로드 + biome=mountain + elevation 상위 N%.
**Param 의미**
- `Param0/1` = Peak anchor
- `Param2` = `OreSpeciesId` — region seed 해시 (광종)
- `Param3` = `CapBits` — bit0=CaveMouth 존재 / bit1=2nd Peak / bit2~7=cliff 갯수 등

**분포 패턴**
- Peak(M01) 1 + Cliff 1~2 + OreOutcrop(G02) 1~3 + CaveMouth(G04) 0~1.
- OreOutcrop 은 Peak 으로부터 Cliff 방향 — 미지 (어디에 묻혔는가) 가 아닌 *읽힘* (cliff = 광맥 단서).

**Entity 산출**
```
Peak × 1
Cliff × popcount(CapBits & cliff_mask)
OreOutcrop × ore_count(OreSpeciesId)         // 광종마다 다른 분포 함수
CaveMouth × (CapBits.bit0 ? 1 : 0)
```

**Dispatch 가지**
| 조건 | target | 전달 Param |
|---|---|---|
| `Event.Natural.PeakReached` (플레이어 도달) | `Spawner.Story.Natural.PeakClaimed` *(후속)* | peak pos, region id |
| OreOutcrop 채광 누적 임계 | `Event.Region.OreVein Depleted` | OreSpeciesId |

**Region 영속 hook**
- `Region.NamedPeaks` — 명명권 첫 도달자가 이름 부여. *서버 영속* (다른 플레이어가 region 진입 시 표시).
- `Region.OreDepleted[OreSpeciesId]` 카운트 — 일정 임계 시 *광종 변경* (다음 채광부터 다른 ore).

**시그널**: S4 (지평선 핵심 시그널).

**Theme contract (성장)**
> Peak 명명은 *영속 카탈로그* 의 시드. region 의 *이름표* 가 누적된다.

---

### S09. `Spawner.Story.Natural.FallenLogDecay` — "마지막 뼈대"

**가치**: 성장 (천이 시드)
**Trigger**: `Event.Natural.TreeFelled` (Oak/Pine 베임) / 수명 만료.
**Param 의미**
- `Param0/1` = 원래 나무 위치
- `Param2` = `OriginalEntityTagId` — Oak vs Pine
- `Param3` = `DecayStage` (0=신선 / 1=이끼 / 2=쪼개짐 / 3=흙)

**분포 패턴**
- 단일 entity. 단계가 진행되면 *attribute 만* 바뀐다 (entity tag 는 유지).

**Entity 산출**
```
FallenLog (T01, decay=DecayStage)
```

**Dispatch 가지**
| 조건 | target | 전달 Param |
|---|---|---|
| 단계 1 진입 시 (1 회) | `Spawner.Story.Natural.MushroomSeed` | 통나무 위 셀, Param2=variant_seed |
| 단계 3 도달 (소멸 직전) | `Spawner.Story.Natural.GrassSuccession` | 통나무 위치 |
| 단계 3 종료 시 | (entity 삭제) | — |

**Region 영속 hook**
- `Region.DeadTrees` +1 / 사멸. S02 의 후계 promotion 임계에 연동.

**시그널**: S1~S2.

**Theme contract (성장)**
> 사멸도 시드. 뼈대 위에 *다음 세대* 가 자란다.

---

### S10. `Spawner.Story.Natural.SpringDiscovered` — "물의 약속"

**가치**: 성장 (Quake — 영속 변형)
**Trigger**: S07 의 endpoint 도달 dispatch (단발).
**Param 의미**
- `Param0/1` = Spring 위치
- `Param2` = `WaterQuality` — 회복재 효율
- `Param3` = `NPCSeedHash` — NPC 만남 시드 (행상인/은둔자, 후속 사회 레이어)

**분포 패턴**
- Spring(W03) 1 + 주변 Herb / Reed 군집.

**Entity 산출**
```
Spring × 1
Herb × 2..4              (Spring 인접, region variant 적용)
Reed × ~5                (Spring 가장자리)
```

**Dispatch 가지**
| 조건 | target | 전달 Param |
|---|---|---|
| NPCSeedHash != 0 && region NPC 카운트 < 임계 | `Spawner.Story.Social.RecluseOrTrader` *(후속 사회 레이어)* | Spring pos, NPCSeedHash |
| Spring 음용 시 | (entity attribute 갱신 — Player buff) | — |

**Region 영속 hook**
- `Region.KnownSprings[id]` 등록. trail 굳음 (S07) 과 한 쌍.

**시그널**: S2 (음향) + S1 (시각).

**Theme contract (성장)**
> trail 의 끝은 *약속* 이다. 발견은 region 영속 변경 + 사회 레이어 시드.

---

### S11. `Spawner.Story.Natural.GrassSuccession` — "다시 깔리는 결"

**가치**: 성장 (천이)
**Trigger**: S05 화재 종료 / S09 단계 3.
**Param 의미**
- `Param0/1` = 천이 시작 셀
- `Param2` = `SuccessionKind` — 0=화재 후 / 1=사멸목 후
- `Param3` = `WindAngleRaw` — 새 결 방향 (이전과 *달라질 수 있음*)

**분포 패턴**
- S01 과 동일 결 분포지만 *결 방향이 다르다*. 화재 흔적은 *지도를 바꾼다* (P3).

**Entity 산출**
```
Grass × density(succession_kind)
Shrub × 5..10%          (이전보다 조금 더 많음 — 천이 단계 강조)
```

**Dispatch 가지**
| 조건 | target | 전달 Param |
|---|---|---|
| 누적 succession 셀이 임계 도달 | `Spawner.Story.Natural.OakGrove` *(재시드, 천이 단계 후)* | 그리드 중심, Param2=새 LineageId |

**Region 영속 hook**
- `Region.SuccessionPatches` — region 지도의 *결이 바뀐 면적*.

**시그널**: S1~S3 (결 방향 변화).

**Theme contract (성장)**
> 풀숲은 *재생되지만 같은 풀숲이 아니다*. 결 방향이 바뀌고, 그것이 region 의 역사.

---

## 4. Dispatch 그래프 (갱신)

본 spec 반영 후 그래프:

```
[청크 로드]
   ├─▶ S01 GrassPlain (미지)
   │     ├─▶ S02 OakGrove        (조건: 경계+seed)
   │     └─▶ S03 BerryPatch      (조건: 결 끝 피크)
   │
   ├─▶ S05 PineSlope  (도파민)
   │     └─[화재]─▶ FireSpreadLine → S09 FallenLogDecay × N → S11 GrassSuccession
   │
   ├─▶ S06 RiverEdge  (미지)
   │     └─[Ford 단일]─▶ S07 AnimalTrailSeed
   │                       └─[끝점 발견]─▶ S10 SpringDiscovered → (사회 레이어)
   │
   └─▶ S08 MountainCap (성장)
         └─[Peak 도달]─▶ PeakClaimed (명명권)

[entity 이벤트 기반]
   S02 Elder felled    ─▶ S09 FallenLogDecay → S04 MushroomSeed → S11 GrassSuccession ⤴ S02 재시드
   region FireCounter↑ ─▶ S04 VariantId 안정화
   region DeadTrees↑   ─▶ S02 ElderPromotion (후계 노목화)
```

가지 끝 (`S03 / S04 / S10 / S11`) 은 entity 생성에서 멈춘다. 그 외는 분기/조건.

---

## 5. Region 영속 카운터 카탈로그

본 PR 에서 도입되는 region 상태 (서버 영속, save/load 정의는 후속):

| 카운터 | 갱신 spawner | 1차 효과 |
|---|---|---|
| `Region.Lineages[LineageId]` | S02 | 후계 promotion |
| `Region.FelledElders[LineageId]` | S02 | promotion 임계 |
| `Region.HarvestedClusters` | S03 | 풍요 태그 |
| `Region.VariantCatalog[VariantId]` | S04 | region 시그니처 변종 |
| `Region.FireCounter` | S05 | variant 안정화 트리거 |
| `Region.CrossingPoints` | S06 | region 횡단 비트 지도 |
| `Region.HardenedTrails[id]` | S07 | trail 영속화 |
| `Region.KnownSprings[id]` | S10 | NPC 시드 |
| `Region.NamedPeaks[id]` | S08 | 명명권 (서버 가시) |
| `Region.OreDepleted[OreId]` | S08 | 광종 변경 |
| `Region.DeadTrees` | S09 | promotion 임계 |
| `Region.SuccessionPatches` | S11 | 결 변형 지도 |
| `Region.SeenTheGrain` | S01 | VFX 강조 |

> 위 카운터들은 `FHktEvent` 와 별도의 영속 store 가 필요. 본 PR 은 *이름만* 합의. 데이터 모델·읽기/쓰기 API·결정론 보장은 [`04-region-state.md`](./04-region-state.md) ADR 에서 결정 — region 은 `FHktWorldState` 안의 *tag-식별 virtual entity* (`Entity.Region` / `Entity.RegionRecord.*`) 로 표현되며, spawner story 는 `FHktStoryBuilder::RegionAddScalar` (PR-2) / `RegionMapRead` / `RegionMapWrite` (PR-3) helper 로 갱신한다. property 어드레싱 모드 신규 0, host-call opcode 1 (`RegionMapFindOrCreate`, PR-3).

---

## 6. 신규 opcode 점검

본 spec 작성에서 *새 opcode 가 필요하다고 느껴진 지점*:

| 후보 | 표현 가능한 기존 opcode 조합 | 결정 |
|---|---|---|
| "결 방향을 따라 N 셀 선형 배치" | `RandomInt` + `Add` 루프 + `SpawnEntityAt` (Builder 헬퍼) | **불요** — Builder 매크로 확장만 |
| "노이즈 피크 셀 검출" | 베이크 시점에 후보 슬롯으로 미리 추출 (§6-d) | **불요** — Generator 책임 |
| "강 곡률 부호 판정" | 베이크 시점에 `CurvatureSign` 을 Param2 로 인라인 | **불요** |
| "region 카운터 read/write" | 서버 측 외부 state — `HktCore` 측 별도 인터페이스 필요 | **별도 ADR** — opcode 가 아닌 *시스템* 추가. 본 PR 범위 밖. |

§5 의 region 카운터 시스템 도입이 **본 spec 의 진정한 신규 요소**. spawner 그래프 자체는 신규 opcode 0 (P5) 으로 표현 가능. region state read/write 는 새로운 데이터 의존이며, → [`04-region-state.md`](./04-region-state.md) ADR 채택 (region = SoA virtual entity). PR-3 구현 시 host-call opcode `RegionMapFindOrCreate` 1 개를 추가하되, property 어드레싱 모드는 기존 그대로 유지 (`LoadStoreEntity`/`SaveStoreEntity`).

---

## 7. 후속 PR 후보

- [x] `04-region-state.md` — region 영속 카운터의 store / read API / determinism (ADR 통과 — tag-식별 virtual entity 모델). PR-3 가 host-call opcode 1 추가, property 어드레싱 모드 신규 0.
- `05-story-dispatch-mechanics.md` — Tremor 임계치 함수, dispatch 큐 우선순위, 청크 언로드 시 in-flight dispatch 처리.
- `06-interactions.md` — 플레이어 행위가 본 spec 의 어느 이벤트(`Event.Natural.*`) 를 발화시키는가.
- `07-story-bodies/` — 본 spec 의 11 spawner 를 schema 2 JSON 으로 실제 작성 (1 PR 1 spawner 권장).
