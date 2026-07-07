# CLAUDE.md — HktSplatGenesis

캡처 없는 절차적/창발 3DGS 실험장. **스플랫 = 세포** — 시뮬 상태가 유일한 원본이고 렌더 속성은 항상 유도된다. `HktGaussianSplatWeb`(PLY 뷰어)과 별개 프로젝트지만 무-빌드 컨벤션과 EWA 렌더 수학을 공유한다.

이 문서는 **얇게** 유지한다 — 목표·지켜야 할 사항·문서 인덱스만 담는다. 현황/다음 단계는 ROADMAP, 세션 진행 방식은 SKILL, 설계 근거·구조는 DESIGN 으로 분리한다. **여기에 쌓지 않는다** — 새 내용을 어디에 쓸지는 [SKILL.md](SKILL.md) 「기록 라우팅」 표를 따른다 (CLAUDE 는 거의 안 변하는 원칙·불변 제약만).

## 목표

- **비전**: 존재를 "모델링"하지 않고 **유전자(속성)로부터 배양**한다. 스플랫 = 세포 — 시뮬 상태가 유일한 원본, 렌더 속성은 항상 셰이더에서 유도된다.
- **2층 세계**(2026-07): **무대**(worldlabs Marble 생성 3DGS 지형, Spark 렌더로 로드) + **생명**(배양). "캡처 없음"은 생명에만 적용된다. — [Docs/PLAN-SparkTerrain.md](Docs/PLAN-SparkTerrain.md)
- **최종 지향**: UE5 이식의 설계도 — 이 compute 파이프라인이 `HktGaussianSplat` 플러그인의 래스터 + Niagara/compute 시뮬로 그대로 옮겨진다. 그 다리로 hikito-flesh 에셋 파이프라인(뼈대→살 자동 생성)을 스플랫 생명 위에 얹는다.

## 지켜야 할 사항

### 절대 원칙

1. **렌더 속성 직접 생성 금지** — 공분산·색·불투명도는 반드시 시뮬 상태(pos/vel/age/energy)와 유전자로부터 셰이더에서 유도한다. "모양을 그리는" 코드가 생기는 순간 이 프로젝트의 존재 이유가 사라진다.
   단 하나의 예외 — **무대(stage)**: 외부 생성 3DGS 지형 월드(worldlabs Marble)는 Spark 레이어로 로드한다. 무대는 로드하고 생명은 배양한다 — 생명(우리 풀의 스플랫)에는 이 원칙이 그대로 적용된다. ([Docs/PLAN-SparkTerrain.md](Docs/PLAN-SparkTerrain.md))
2. **개체 정의 = 유전자 벡터** — 새 존재(슬라임/골렘/나무)는 새 코드 경로가 아니라 새 유전자 값 + (필요 시) 새 국소 규칙으로 만든다. 프리셋은 유전자 공간의 점일 뿐.
3. **GPU 상주** — 시뮬→정렬→렌더 사이 CPU 왕복 금지. 상태 readback 은 디버그 한정.

### 불변 조건 (깨지면 화면이 즉시 무너짐)

- 스플랫 수 N 은 **2의 거듭제곱** (바이토닉 정렬 전제, `setCount` 가 검증).
- 셰이더/엔진 **바이트 일치**: `Splat`(48B)=`SPLAT_STRIDE`(12 float) · `SimParams`(64B) · `Entity`(144B)=`ENTITY_STRIDE`(36) · `Cluster`(96B)=`CLUSTER_STRIDE`(24), 격자 상수(GD=64, SLOTS=16)·`CLUSTER_K`=256 — wgsl.js ↔ engine.js 동기 필수 (상세 코드 지도: [Docs/DESIGN.md](Docs/DESIGN.md)).
- L2 이웃 힘은 프레임 시작 시점 격자를 기준으로 하되 위치는 in-place 갱신(Jacobi/Gauss-Seidel 혼합) — 프로토타입 허용 오차. 지터가 문제 되면 위치 더블 버퍼가 정석 (로드맵).
- 격자 셀 초과분(SLOTS 넘는 스플랫)은 이웃 힘에서 조용히 누락 — 우아한 저하가 의도.
- L3 본드는 이웃 클러스터 com 을 프레임 혼재(Jacobi 근사)로 읽고, 파단 판정도 클러스터별 독립(비대칭 허용). 강한 정합이 필요해지면 본드 상태 더블 버퍼가 정석 (로드맵).
- 클러스터 회전은 Müller 반복 추출 — 이전 프레임 쿼터니언에서 시작하므로 quat 초기값은 반드시 identity(0,0,0,1) 로 업로드할 것.
- 정렬 키: 카메라 앞 = 음수 뷰 z → orderable uint 오름차순 = **far→near** (back-to-front over 블렌딩 전제).
- 블렌딩 premultiplied over: FS 출력 `vec4(rgb*B, B)` + (one, one-minus-src-alpha).
- 렌더 VS 의 퇴화 처리: 컬 시 네 꼭짓점 동일 위치 반환 (discard 아님).
- L6 살은 자리 스프링 + 친화 분포 + 임계 감쇠 전제 — 전역 SDF 최근접 추종·L2 인력 우세·저감쇠 중 무엇이든 살이 방울로 붕괴한다 (근거: [Docs/DESIGN.md](Docs/DESIGN.md), 함정 3종 상세: wgsl.js SIM L6 주석).
- L6 뼈대는 **하나의 스켈레톤 정의를 여러 캐릭터가 참조** — 살 개체마다 제 위치에 인스턴스를 세우고 단일 `boneBuf` 에 이어붙인다. 개체 뼈 친화(`rest.w`)는 제 구간 `[boneBase, boneBase+count)` 의 절대 인덱스(공용 뼈로 뭉치던 버그의 해법). `MAX_BONES`(engine.js, 장면 전체 뼈 합계 상한 512) ↔ render 셰이더 `rest.w` clamp(511u) 동기 필수 (E2, [Docs/DESIGN.md](Docs/DESIGN.md)).

### 컨벤션

- classic `<script>` 전역 네임스페이스(`HktGenesisEngine`/`HktGenesisWGSL`/`HktMat`/`HktOrbitCamera`/`HktGenesisSkeleton`), 빌드 스텝 없음, 주석 한국어.
- `vendor/` 는 유일한 서드파티 예외 — ① three r147 UMD(+FBXLoader/fflate): **FBX 파싱/FK 전용**. ② `vendor/spark/`(S 트랙): Spark + three r180+ ESM — **무대 렌더 전용**, 모듈 스코프로 격리. 두 three 사본 혼용 금지. 생명 렌더·시뮬 경로에서 three 사용 금지.
- 튜닝 노브는 하드코딩하지 않고 `GENE_DEFS` 슬라이더로 노출 (UE CVar 관례의 웹 대응).

## 문서

| 문서 | 역할 | 언제 읽나 |
|---|---|---|
| [SKILL.md](SKILL.md) | 세션 진행 방식 — 진입 순서·작업 규약·검증·닫기 | 세션 시작 시 |
| [Docs/ROADMAP.md](Docs/ROADMAP.md) | **구현 현황 + 다음 단계 TODO** — 매 세션 갱신 | 다음 작업을 고를 때 |
| [Docs/DESIGN.md](Docs/DESIGN.md) | 설계 근거·결정(되돌리지 말 것) + 아키텍처·코드 지도 | 제약·구조를 확인할 때 |
| [Docs/PLAN-SparkTerrain.md](Docs/PLAN-SparkTerrain.md) | S 트랙(무대) 심층 계획 | 무대 작업 시 |
| [Docs/PLAN-OpenWorldTerrain.md](Docs/PLAN-OpenWorldTerrain.md) | T 트랙(오픈월드 지형) 심층 계획 — 현황 진단 포함 | 지형 확장 작업 시 |
| [Docs/PLAN-CharacterGenesis.md](Docs/PLAN-CharacterGenesis.md) | C 트랙(캐릭터 배양: 이미지→게놈→살) 심층 제안 | 캐릭터 확장 작업 시 |
| [test/README.md](test/README.md) | 검증 하니스 사용법 | 검증할 때 |
| [README.md](README.md) | 외부 공개 개요 | — |
| 코드 주석 | 세부 설계·함정의 원본 | 구현 파고들 때 |
