# C04 — spatial acceleration (공간 가속 구조)

> **이 챕터가 답하는 질문**: C03 에서 "정밀한 SDF·support 질의는 비싸다"고 거듭 말했다. 그런데 한 씬에 강체가 수천 개라면, 그 비싼 질의를 *모든 쌍*(N²)에 돌릴 수는 없다. "누구와 누가 부딪힐 *가능성*이 있는가"를 어떻게 싸게 추려, 정밀 검사 대상을 소수로 줄이는가?
> **대응 Concepts**: [11 — 공간 자료구조](../Concepts/11-spatial-structures.md)
> **선행 챕터**: [C02 — 파티클·강체 표현](./C02-particle-rigid-body.md) (특히 §3 의 `MSpatialIdx`·world-space inflated bounds), [C03 — implicit geometry](./C03-implicit-geometry.md) (`BoundingBox()`)

---

## 왜 이 챕터를 다섯 번째로 읽는가

충돌 검출은 두 단계로 나뉜다. **broad phase** 는 "부딪힐 가능성이 있는 쌍"을 싸게 추리고, **narrow phase**(C06)는 그 소수 후보에만 GJK 같은 비싼 정밀 검사를 돌린다. 이 2단계 분리가 없으면 강체 N개에 대해 N² 쌍을 전부 정밀 검사해야 하고, 수천 개 규모에서 그건 불가능하다.

C04 는 그 broad phase 를 떠받치는 *자료구조*를 다룬다. 핵심 아이디어 한 문장 — **정밀한 모양 검사에 들어가기 전에, 각 물체를 감싸는 싼 상자(AABB, axis-aligned bounding box)로 후보를 먼저 거른다.** 상자끼리 안 겹치면 모양은 볼 것도 없이 못 부딪힌다. 그리고 그 상자들을 공간적으로 조직(tree·grid·hash)해두면, "이 상자와 겹치는 상자들"을 N² 이 아니라 대략 N log N 이나 그 이하로 찾을 수 있다.

그런데 물리에는 정적 자료구조 교과서에 없는 골칫거리가 하나 있다 — **물체가 매 프레임 움직인다.** 트리를 매 프레임 처음부터 다시 짓는 건 너무 비싸다. 그래서 C04 의 진짜 알맹이는 "어떤 트리를 쓰는가"보다 **"움직이는 세계에서 그 트리를 어떻게 살려두는가"**(§4)에 있다. 이 챕터가 답하는 질문의 절반은 자료구조이고, 절반은 그 갱신 전략이다.

> **AABB 란?** Axis-Aligned Bounding Box — 물체를 감싸는, 월드 축에 정렬된 직육면체. 회전하지 않으므로 겹침 검사가 세 축의 구간 비교 여섯 번이면 끝난다. 정밀 모양(C03)보다 훨씬 헐렁하지만 훨씬 싸다. broad phase 의 통화(currency)가 바로 이 AABB 다.

---

## 1. 두 단계로 나누는 이유 — N² 를 피하는 필터

강체 5000개가 굴러다니는 씬을 상상하자. 순진하게 하면 매 프레임 약 1250만 쌍(5000²/2)에 대해 "이 둘이 겹치나?"를 물어야 한다. 각 질문이 GJK 라면 프레임이 끝나지 않는다.

그래서 **싼 근사 → 비싼 정밀**의 깔때기를 만든다. 먼저 각 물체를 AABB 로 감싸고(C03 `BoundingBox()` 가 그 AABB 를 준다), AABB 들을 공간 구조에 넣어 "서로 겹치는 AABB 쌍"만 뽑는다. 이게 broad phase 다. 그 결과로 남는 후보는 보통 수천 쌍이 아니라 수십~수백 쌍이고, narrow phase(C06)는 그 소수에만 정밀 검사를 돌린다.

C04 는 이 깔때기의 *첫 칸*, 즉 "AABB 들을 어떻게 담고 질의하는가"를 담당한다. 다음 챕터 C05(broad phase)가 이 구조를 실제로 *굴려서* 쌍 목록을 뽑고, C06(narrow phase)가 생존자를 정밀 검사한다. 지금은 자료구조 자체에 집중한다.

---

## 2. 하나의 인터페이스, 여러 구현 — `ISpatialAcceleration`

Chaos 는 공간 구조를 딱 하나로 못박지 않는다. 씬 특성(밀집도·물체 크기 분포·정적/동적 비율)마다 최적의 구조가 다르기 때문이다. 그래서 C02 의 파티클, C03 의 geometry 와 **똑같은 추상화 패턴**을 쓴다 — 공통 인터페이스 + 1바이트 타입.

공통 인터페이스는 `ISpatialAcceleration<TPayload, T, d>` 다(`ISpatialAcceleration.h:266`). 여기서 `TPayload` 가 흥미롭다 — 구조에 담기는 원소는 파티클 그 자체가 아니라 **`FAccelerationStructureHandle`**(`ParticleHandle.h:212`)라는 가벼운 손잡이다. 이 손잡이는 게임 스레드 파티클과 물리 스레드 핸들(C02) 양쪽으로의 참조 + 캐시된 `UniqueIdx` 를 담아, 질의 결과를 다시 파티클로 되돌려 준다. 즉 **공간 구조는 "AABB → 파티클 손잡이"의 색인**이다.

구조의 종류는 1바이트로 표시된다 — `ESpatialAcceleration`(`ISpatialAcceleration.h:179`, 밑바탕 타입이 `SpatialAccelerationType = uint8` `:178`), 값은 `BoundingVolume·AABBTree·AABBTreeBV·Collection`. C02 의 `EParticleType`, C03 의 `EImplicitObjectType` 과 판박이다(1바이트 타입 + 그걸로 분기).

인터페이스가 제공하는 연산은 두 갈래다:

- **질의(query)**: `Raycast`·`Sweep`·`Overlap`·`FindAllIntersections`(`ISpatialAcceleration.h:295~298`). 눈여겨볼 점은 이들이 결과를 배열로 돌려주기보다 **visitor** 에게 흘려보낸다는 것이다 — `ISpatialVisitor`(`:119`)의 `Overlap`/`Raycast`/`Sweep` 콜백(`:129,136,143`)이 후보를 하나씩 받아 처리·조기중단한다. 큰 결과를 모으느라 할당하지 않으려는 설계다.
- **갱신(mutation)**: `UpdateElement`·`RemoveElement`·`NeedUpdateElement`(`:317,306,312`). 이 셋이 §4 "움직이는 세계"의 손잡이다.

---

## 3. 인터페이스 뒤의 실제 구현 — tree 와 grid, 그리고 그 하이브리드

폴리모픽 `ISpatialAcceleration` 계열에는 성격이 다른 **두 전략(tree·grid)과 그 하이브리드**가 들어 있다 — `ESpatialAcceleration` 열거값이 정확히 `AABBTree`·`BoundingVolume`·`AABBTreeBV` 셋이다(§2). 여기에, 계열 *밖*에 있는 세 번째 전략 hash grid 를 뒤에서 따로 짚는다.

**AABBTree — 계층 트리 (기본값).** `TAABBTree`(`AABBTree.h:785`)는 AABB 들을 재귀적으로 감싸 이진 트리 비슷한 계층을 만든다. 루트가 전체를 감싸고, 아래로 내려갈수록 좁은 영역으로 갈라진다. 질의는 루트에서 시작해 겹치지 않는 가지를 통째로 쳐내며 내려가므로 대략 O(log N). 잎(leaf) 하나에 원소를 몇 개까지 담을지(`DefaultMaxChildrenInLeaf = 12`), 트리를 몇 단까지 내릴지(`DefaultMaxTreeDepth = 16`)가 튜닝 손잡이다(`:795,796`). 밀집도가 불균일한 일반 씬에 두루 잘 맞아 기본으로 쓰인다.

**BoundingVolume — 균일 격자 (uniform grid).** `TBoundingVolume`(`BoundingVolume.h:117`)은 공간을 규칙적 셀 격자(`MGrid`)로 쪼개고, 각 셀이 자기와 겹치는 원소 목록(`MElements`)을 든다. 트리와 달리 계층이 없어 **빌드가 매우 싸고 단순**하지만, 두 약점이 있다 — 물체 크기 분포가 넓으면(작은 돌과 거대한 지형이 섞이면) 격자 해상도를 맞추기 어렵고, 빈 셀까지 메모리를 먹는다. 그래서 너무 큰 물체는 `DefaultMaxPayloadBounds`(`:126`) 넘으면 아예 격자에서 빼 별도 처리한다.

**AABBTreeBV — 하이브리드.** 트리인데 잎이 낱개 원소가 아니라 *작은 BoundingVolume* 인 변종이다(`ESpatialAcceleration::AABBTreeBV`, `AABBTree.h:798~799`). 위쪽은 트리로 넓게 쳐내고, 잎 근처의 밀집 구역은 격자로 훑는 절충이다.

> **계열 밖의 세 번째 전략: hash grid.** 위 셋이 `ISpatialAcceleration` 폴리모픽 계열이라면, `THierarchicalSpatialHash`(`HierarchicalSpatialHash.h:213`)는 **그 계열에 속하지 않는 별개 구현**이다(다른 베이스 `TSpatialHashGridBase`, `ESpatialAcceleration` 값도 없음). 여러 해상도(LOD, level-of-detail)의 격자 셀을 해시 맵(`FHashIndex` = 셀 좌표 + LOD)으로 담아, 물체 크기 편차가 클 때 각 물체를 자기 크기에 맞는 레벨에 넣는다. 솔버 broad phase 가 골라 끼우는 대상이 아니라, 천·파티클 self-collision 처럼 특정 서브시스템이 직접 쓰는 유틸이다. 즉 "공간 분할의 대표 전략은 tree·grid·hash 세 가지지만, 그중 폴리모픽 broad phase 구현은 tree·grid 계열뿐"으로 정리하면 된다.

왜 이렇게 여러 개인가? 한 문장으로 — **어떤 구조도 모든 씬에서 최적이 아니라서.** 그래서 폴리모픽 인터페이스로 두고, 솔버가 상황에 맞는 구조를 골라 끼운다(§5).

---

## 4. 움직이는 세계 — 이 챕터의 진짜 알맹이

정적 자료구조 강의는 여기서 끝난다. 하지만 물리에서는 **매 프레임 수천 개가 움직인다.** 움직인 물체는 AABB 가 바뀌고, 트리에서의 자리도 바뀌어야 한다. 트리를 매 프레임 처음부터 다시 지으면(수 밀리초) 프레임 예산을 통째로 날린다. Chaos 는 세 가지 장치로 이 문제를 푼다.

**(1) inflated bounds — 작은 이동은 무시한다.** C02 §3 에서 파티클이 `MWorldSpaceInflatedBounds` 라는 *부풀린* 바운드 열을 든다고 했다. 실제 AABB 보다 속도·여유만큼 크게 부풀려 트리에 넣어두면, 물체가 그 여유 안에서만 움직이는 한 트리 원소를 건드릴 필요가 없다. `NeedUpdateElement`(`ISpatialAcceleration.h:312`)가 "새 바운드가 기존 부풀린 바운드를 삐져나갔는가"만 보고, 안 삐져나갔으면 갱신을 건너뛴다. 대부분의 프레임에서 대부분의 물체는 이 검사로 조용히 넘어간다.

**(2) dirty tree — 움직인 것만 따로 모은다.** 그래도 삐져나간 물체는 처리해야 한다. 이때 본 트리를 헤집는 대신, 최근 움직인 원소들만 담는 **별도의 작은 트리** `DirtyElementTree`(`AABBTree.h:3975`)에 넣는다. 질의는 이제 **본 트리(안정) + dirty 트리(최근 이동)** 둘 다를 훑는다. 본 트리는 그대로 두니 헤집는 비용이 없고, dirty 트리는 작아서 싸다. dirty 가 너무 커지면 그때 한 번 본 트리를 다시 최적화한다.

**(3) time-slicing — 재빌드를 여러 프레임에 나눈다.** 결국 본 트리를 다시 지어야 할 때, 그걸 한 프레임에 몰아서 하지 않고 **밀리초 예산 안에서 조금씩, 여러 프레임에 걸쳐** 짓는다 — `PrepareCopyTimeSliced`/`ProgressCopyTimeSliced`(`ISpatialAcceleration.h:288,289`), 예산은 `FAABBTimeSliceCVars::bUseTimeSliceMillisecondBudget`(`AABBTree.h:63~66`)로 제어. 새 트리가 완성되는 동안 옛 트리로 계속 질의하다가, 다 되면 갈아끼운다.

이 셋을 O(1) 로 지탱하는 것이 **역인덱스** `FAABBTreePayloadInfo`(`AABBTree.h:719`)다 — 각 payload 가 지금 어디 사는지(전역 목록 idx·dirty idx·leaf idx·node idx)를 `PayloadToInfo` 맵(`:3988`)에 적어둔다. 덕분에 "이 파티클을 갱신/삭제하라"는 요청이 트리를 뒤지지 않고 곧장 제자리를 찾아간다 — C02 §2 에서 본 "인덱스는 변하니 핸들로 되짚는다"의 공간 구조판이다.

마지막으로 **바운드가 없는 물체**(무한 평면, 월드를 덮는 거대 trimesh 등)는 트리에 넣을 AABB 가 없다. 이들은 `GlobalPayloads`(`AABBTree.h:3987`)에 따로 모아 *모든 질의에 항상* 포함시킨다.

---

## 5. Collection 과 async 스왑 — 솔버가 실제로 드는 것

솔버가 질의하는 최상위 구조는 사실 위의 단일 트리가 아니라 **여러 하위 구조의 묶음**이다 — `ISpatialAccelerationCollection`(`ISpatialAccelerationCollection.h:22`)/`SpatialAccelerationCollection`. 이 묶음은 하위 구조들을 **bucket** 단위로 든다. 여기서 C02 의 조각이 맞물린다 — 파티클이 들고 있던 `MSpatialIdx`(=`FSpatialAccelerationIdx`, `bucket:3 / innerIdx:13`)가 바로 "나는 이 collection 의 몇 번 bucket, 그 안 몇 번 원소에 산다"는 좌표였다.

왜 나누는가? **정적 물체와 동적 물체를 다른 구조에 담기 위해서**가 대표적이다. 안 움직이는 레벨 geometry 는 한 번 지어 재빌드 없이 재사용하고(정적 bucket), 매 프레임 움직이는 강체만 dirty·time-slice 로 갱신하는 동적 bucket 에 둔다. 질의는 두 bucket 을 모두 훑되, 비싼 재빌드는 동적 쪽에만 든다.

그리고 이 전체가 **비동기**로 돈다. 물리 스레드가 새 가속 구조를 백그라운드 태스크에서 (time-slice 로) 짓고, 다 되면 기존 것과 **교체(double-buffer swap)** 한다. 게임 스레드·물리 스레드가 낡은 구조로 질의하는 동안 새 구조가 준비되는 식이다. 이 async 빌드·스왑·마샬링의 본론은 **C12(Solver 프런트엔드·스레딩)** 이고, 여기서는 "공간 구조는 매 프레임 즉석에서 고쳐지는 게 아니라, 비동기로 지어져 통째로 갈아끼워진다"는 골격만 챙긴다.

---

## 6. C02·C03·다음 챕터와의 접속

- **C02 로**: 파티클의 `MSpatialIdx`(collection 안 좌표)와 `MWorldSpaceInflatedBounds`(부풀린 AABB)는 전부 이 챕터를 위한 저장이었다. C02 에서 "왜 파티클이 이런 열을 드나" 미뤄둔 답이 여기다.
- **C03 으로**: 각 원소의 AABB 는 geometry 의 `BoundingBox()`(C03)에서 나온다. 그리고 C03 에서 본 Union 의 *내장 BVH* 는 이 챕터 구조의 **per-body 축소판**이다 — 한 몸 안 여러 shape 를 좁히는 미니 트리.
- **C05·C06 으로**: C05(broad phase)가 이 구조를 `Overlap` 질의로 굴려 "겹치는 AABB 쌍" 목록을 뽑고, C06(narrow phase)가 그 생존자에만 GJK·SDF 정밀 검사를 돌린다. C04 는 도구를 놓았고, C05 가 그 도구를 쓴다.

---

## 7. 결정론·스레딩·성능 메모

- **async 빌드 + 스왑이 재현성의 변수다.** 가속 구조는 별도 태스크에서 time-slice 로 지어져 갈아끼워지므로(§5), 어느 프레임에 스왑이 완료되는지가 타이밍에 따라 달라질 수 있다. 질의 결과 자체는 보수적(후보를 더 많이 뽑을지언정 놓치진 않음)이라 시뮬 정확도는 지켜지지만, 비트 단위 재현이 필요한 경로(C13 resim)에서는 빌드·스왑 시점을 통제해야 한다.
- **dirty·빌드 순서 의존.** 원소가 dirty 트리에 들어가는 순서, 본 트리 재최적화 시점은 삽입·삭제 이력에 의존한다(C02 의 `RemoveAtSwap` 순서 문제와 같은 결). 같은 씬이라도 경로가 다르면 트리 형태가 달라질 수 있다.
- **CVar 밀림.** `p.Chaos` 아래 dirty grid 셀 크기·time-slice 예산·최대 dirty 원소 수 등 다수의 튜닝 손잡이가 있다(`AABBTree.h:28~66` 의 `FAutoConsoleVariableRef` 무리). 이들이 broad phase 성능을 좌우하며, 카탈로그·ChaosVD 관찰은 C17.
- **bounds 는 부풀림 여유가 성능·정확도 트레이드오프.** inflated 여유가 크면 재삽입은 줄지만 후보 쌍이 늘어(헐렁한 상자끼리 더 자주 겹침) narrow phase 부담이 는다. 반대면 재삽입이 잦아진다.

---

## 8. 무엇을 들고 다음으로 가는가

세 문장으로 압축하면:

첫째, **broad phase 는 정밀 검사 전에 싼 AABB 로 후보를 거르는 필터**이고, 그 AABB 들을 담는 구조가 `ISpatialAcceleration`(1바이트 타입 + payload 손잡이 + visitor 질의)이며, 폴리모픽 구현은 tree(AABBTree, 기본)·grid(BoundingVolume)·하이브리드(AABBTreeBV)이고 hash grid 는 계열 밖 별도 유틸이다. 둘째, **이 챕터의 알맹이는 "움직이는 세계 대응"** — inflated bounds(작은 이동 무시) + dirty tree(움직인 것만 별도) + time-slicing(재빌드 분할) + 역인덱스(O(1) 갱신)로, 매 프레임 재빌드를 피한다. 셋째, **솔버가 드는 건 여러 bucket 의 collection**(정적/동적 분리, C02 `MSpatialIdx` 와 연결)이고, 그 전체는 비동기로 지어져 통째로 스왑된다(→ C12).

다음은 **C05 — broad phase** 다. 이 챕터가 놓은 구조를 실제로 굴려, "겹치는 AABB 쌍"을 뽑아 narrow phase 로 넘기는 과정을 본다. C04 가 "후보를 담고 질의하는 그릇"이었다면, C05 는 "그 그릇을 흔들어 실제 잠재 충돌 쌍을 쏟아내는" 단계다.

---

## 부록 — 앵커 일람 (UE 5.7)

| 주장 | 앵커 |
|---|---|
| 공통 인터페이스 `ISpatialAcceleration<Payload,T,d>` | `Chaos/Public/Chaos/ISpatialAcceleration.h:266`; fwd `SpatialAccelerationFwd.h` |
| payload = `FAccelerationStructureHandle`(GT·PT 참조 + UniqueIdx) | `Chaos/Public/Chaos/ParticleHandle.h:212` |
| 1바이트 타입 `ESpatialAcceleration`(BoundingVolume/AABBTree/AABBTreeBV/Collection) | `ISpatialAcceleration.h:179~186` |
| 질의 연산 Raycast/Sweep/Overlap/FindAllIntersections + visitor | `ISpatialAcceleration.h:295~298,119,129,136,143` |
| 갱신 연산 UpdateElement/RemoveElement/NeedUpdateElement | `ISpatialAcceleration.h:317,306,312` |
| AABBTree(계층 트리) + 잎/깊이 튜닝 | `Chaos/Public/Chaos/AABBTree.h:785,795,796` |
| BoundingVolume(균일 격자) + 큰 물체 제외 | `Chaos/Public/Chaos/BoundingVolume.h:117,126,127` |
| AABBTreeBV(트리+BV 잎 하이브리드) | `AABBTree.h:798~799` |
| HierarchicalSpatialHash(다해상도 hash grid, 별도 계열) | `Chaos/Public/Chaos/HierarchicalSpatialHash.h:213`; base `:15` |
| inflated bounds 로 작은 이동 무시(NeedUpdateElement) | `ISpatialAcceleration.h:312`; C02 `MWorldSpaceInflatedBounds` |
| dirty tree(움직인 것만 별도) | `AABBTree.h:3975`(DirtyElementTree) |
| time-slicing(재빌드 분할) + 밀리초 예산 | `ISpatialAcceleration.h:288,289,283`; `AABBTree.h:63~66,143~145` |
| 역인덱스 FAABBTreePayloadInfo/PayloadToInfo(O(1) 갱신) | `AABBTree.h:719,3988` |
| GlobalPayloads(바운드 없는 무한 객체) | `AABBTree.h:3987` |
| Collection = 여러 bucket, `MSpatialIdx`(bucket:3/inner:13)와 연결 | `ISpatialAccelerationCollection.h:22`; `SpatialAccelerationCollection.h:34`; C02 `FSpatialAccelerationIdx` |
| 튜닝 CVar 무리(dirty grid·time-slice) | `AABBTree.h:28~66` `FAutoConsoleVariableRef` |
