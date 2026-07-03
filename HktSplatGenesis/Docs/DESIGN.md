# DESIGN — HktSplatGenesis 구현 의도

새 세션은 이 문서를 먼저 읽는다. 순서: 비전 → 레이어 지도(현재 상태) → 설계 결정 → [ROADMAP.md](ROADMAP.md)(다음 단계).

## 비전 (한 줄)

캡처 없는 3DGS: 존재를 "모델링"하지 않고 **유전자(속성)로부터 배양**한다.
스플랫 = 세포 — 시뮬 상태가 유일한 원본, 렌더 속성은 항상 셰이더에서 유도.

최종 목표는 UE5 이식의 설계도: 이 compute 파이프라인이 `HktGaussianSplat` 플러그인의
래스터 + Niagara/compute 시뮬로 그대로 옮겨진다. 그 전 단계로 hikito-flesh 의
에셋 파이프라인(뼈대 → 살 자동 생성)을 스플랫 생명 위에 얹는 것이 L6 이후의 줄기.

## 레이어 지도 — 의도 → 구현 → 검증 → 한계

각 레이어는 독립 데모를 가진다 (레이어 = 데모 원칙). 모두 ✅ 구현 완료.

| 층 | 의도 | 구현 (파일 · 심볼) | 데모 | 알려진 한계 |
|---|---|---|---|---|
| L0 렌더 | GPU 상주 3DGS 래스터 | engine.js 파이프라인, wgsl KEY/SORT/RENDER | 모든 프리셋 | bitonic O(N log²N) — radix 후보 |
| L1 자율 | 이웃 없는 per-splat 규칙 | wgsl SIM (cohesion/flow/updraft), 필멸 세대 교대 | 불·숲의 정령 | flow 는 발산 있는 가짜 curl |
| L2 이웃 | 응집/분리/점성 → 형태 창발 | wgsl SIM `E.binding` 블록 + dense grid | 슬라임·물 | in-place 갱신 지터, SLOTS 초과 누락(의도) |
| L3 골격 | shape matching + 본드 파단/재흡수 | wgsl CLUSTER, engine `_initGolem` | 돌골렘 | 본드 Jacobi 혼재 — 더블 버퍼 후보 |
| L4 성장 | rest 부착 + birth 성장 시계 + 연소 | wgsl SIM `E.growRate` 조기 경로, `_initTree` | 나무 | — |
| L5 상호작용 | 다중 개체 + 공유 격자 창발 | Entity 테이블, `heatEmit`, `setScene` | 불×나무 | 개체 8 상한 |
| L6 뼈대 살 | 뼈대의 순수 함수로 살이 자란다 | skeleton.js(IR/FK/문법/FBX), wgsl SIM `E.fleshK`, `_initFleshCloud`, OVERLAY | 히키토(+FBX 드롭) | 관절 이음새 단차, 부피 보존 없음, Evaluator 없음 |

## L6 의 구조 (hikito-flesh 3층 매핑)

hikito-flesh 는 살을 SDF **레이마칭으로 그리고**, 여기서는 같은 round-cone 부피를
스플랫 세포의 **성장 자리로 매개변수 샘플**한다 — 절대 원칙 1(렌더 속성 직접 생성 금지) 유지.

- **Skeleton IR** = `Skeleton`(built-in 53관절 FK) / `ExternalSkeleton`(Mixamo FBX) — 소스가 달라도 같은 세그먼트 스트림.
- **Flesh grammar** = `radiusForName(name)` — 이름 기반 반지름. 이것이 "일관된 스타일"의 정의. grammar 가 같으면 리그가 달라도 스타일이 같다.
- **살 성장** = 스플랫마다 (뼈 친화 rest.w, 시드 성장 자리 축 t·방위 θ·깊이 u)를 *현재 포즈에서 매 프레임 유도* → 스프링 추종. L4 나무 rest 부착점과 같은 원리.
- **Evaluator** = 미구현 (ROADMAP R2) — hikito 도 동일하게 미구현.

## 설계 결정 (되돌리지 말 것)

| 결정 | 이유 |
|---|---|
| 살은 뼈대의 함수 — 메시/웨이트 손 바인딩 금지 | 모델링·리깅·스키닝 붕괴가 프로젝트 존재 이유 |
| grammar 는 이름 기반, 특정 리그 하드코딩 금지 | 임의 리그(FBX 드롭)가 깨지지 않아야 스타일=grammar 가 성립 |
| 살 힘 = 성장 자리 스프링 (전역 SDF 최근접 추종 아님) | 전역 최근접은 축 방향 힘 0 → 중력에 뼈당 방울 하나로 붕괴 (검증 사진으로 확인) |
| 히키토 프리셋 binding 0 | L2 인력(표면장력)이 자리 스프링을 이기면 방울 재발 |
| damping ≈ 임계 감쇠 2√fleshK | 미달 시 자리 주위 궤도 진동(밝은 블롭) |
| `pose()` 는 항상 전체 세그먼트를 같은 순서로 (필터 금지) | 순서가 뼈 친화 인덱스의 기준 — 소스 전환 시엔 재시드 |
| vendor three 는 FBX 파싱/FK 전용 | 렌더·시뮬은 자체 WebGPU — three 는 뼈대라는 입력만 만든다 |
| 스플랫 수 2^n, 슬라이스 256 배수 | bitonic 정렬·CLUSTER 워크그룹 균일성 전제 |

## 검증 방법

`test/` 하니스로 눈 검증을 재현한다 (헤드리스 컴포지터가 WebGPU 표면을 못 잡는 환경 대응 —
스왑체인 텍스처 readback 으로 PNG 촬영). 사용법: [test/README.md](../test/README.md).
행동 검증(응축 수렴 등)은 스플랫 버퍼 readback 통계로 — 위치 분포만으론 방울 뭉침을
못 잡으니(전부 "표면 근접"으로 나옴) 반드시 사진도 함께 볼 것.
