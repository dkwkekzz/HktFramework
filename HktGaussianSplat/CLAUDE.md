# CLAUDE.md — HktGaussianSplat

3D Gaussian Splatting **자체 렌더러** 플러그인. 기존 Hkt 플러그인(HktGameplay 등)과 **완전히 독립** — 상호 의존 없음. Postshot 같은 외부 플러그인 대신 PLY 를 직접 로드해 자체 래스터라이저로 그린다.

## 구성

| 모듈 | 역할 |
|---|---|
| `HktSplatCore` | 런타임 — PLY 로드, GPU 업로드, SceneViewExtension 컴포짓 래스터 |

LoadingPhase 는 `PostConfigInit` — 렌더러/글로벌 셰이더 선행 준비 목적(HktVoxelCore 와 동일 관례).

## 아키텍처 (데이터 흐름)

```
.ply ─► FHktSplatPlyLoader ─► FHktSplatCloud (CPU, SoA)
                                    │  (M=R·S, Cov=M·Mᵀ 선계산 → 상삼각 6)
                                    ▼
UHktSplatComponent ─► FHktSplatRenderProxy (RT: StructuredBuffer<FHktSplatData>)
        │  (등록/트랜스폼 = 렌더 커맨드)        │
        ▼                                       ▼
UHktSplatSubsystem ─소유─► FHktSplatSceneViewExtension
                                    │  PrePostProcessPass_RenderThread
                                    ▼
        back-to-front CPU 정렬 → SortedIndices → 인스턴스드 쿼드 래스터
        (2D 공분산 투영, 가우시안 falloff, premultiplied over, 씬 깊이 오클루전)
```

## 핵심 파일

- `Data/HktSplatTypes.h` — `FHktSplatVertexGPU`(64B, HLSL `FHktSplatData` 와 바이트 일치), `FHktSplatCloud`, 임포트 옵션
- `IO/HktSplatPlyLoader.*` — 3DGS 표준 binary PLY 파서 (프로퍼티 이름→오프셋 맵)
- `Rendering/HktSplatRenderProxy.*` — RT GPU 버퍼 + back-to-front 정렬
- `Rendering/HktSplatSceneViewExtension.*` — 전역 셰이더 + RDG 래스터 패스 + 프록시 레지스트리
- `Scene/HktSplatComponent.*`, `Scene/HktSplatActor.*`, `Scene/HktSplatSubsystem.*`
- `Shaders/HktSplat.usf`, `Shaders/HktSplatCommon.ush` — VS/PS + EWA 투영

## 컨벤션

- 네이밍: `FHkt`/`UHkt`/`AHkt` prefix, 로그 카테고리 `LogHktSplat`
- CVar: `hkt.Splat.<Knob>` (`hkt.Splat.Enable`, `hkt.Splat.MaxCountPerProxy`)
- 셰이더 가상 경로: `/Plugin/HktSplat/...` (모듈 StartupModule 에서 매핑)
- 주석: 한국어

## 사용법

1. 플러그인 활성화 후 레벨에 `AHktSplatActor` 배치
2. `SplatComponent.PlyFilePath` 에 `.ply` 경로 지정 (프로젝트 상대 또는 절대)
3. 자동 로드 → 렌더. 런타임에서는 `UHktSplatComponent::LoadPlyFromFile()` 호출

지원 포맷: PLY `binary_little_endian`·`ascii` (x,y,z / scale_0..2 / rot_0..3 / opacity / f_dc_0..2), antimatter15 `.splat`(32B). 공통 `EmitSplat()` 이 좌표변환·공분산·컬링 담당.

## 좌표계

3DGS/COLMAP(오른손, y-down, m) → UE(왼손, z-up, cm). 로더가 `p'=(x,-z,y)` 리매핑 + `UniformScale`(기본 100) 적용. 공분산도 동일 변환. 컴포넌트 트랜스폼으로 미세 조정.

## 마일스톤 상태 (v0.1)

**구현 완료 (검증 필요)**
- PLY 로드 → GPU 업로드 → SVE 컴포짓 래스터 파이프라인 전체
- EWA 2D 공분산 투영, premultiplied over 블렌딩, 씬 깊이 오클루전
- back-to-front CPU 정렬 (렌더 스레드, 프레임마다)

**첫 인-에디터 컴파일/검증 포인트** (UE 렌더 API 는 마이너 버전 민감 — 로컬 빌드로 확인 필요)
- `PrePostProcessPass_RenderThread` 의 씬 텍스처 접근(`Inputs.SceneTextures->GetParameters()`) 및 필요 include
- `FRHIBufferCreateDesc` / `CreateShaderResourceView(FRHIViewDesc)` 버퍼·SRV 생성 API
- 뷰포트 rect: `View.UnscaledViewRect` — 스크린 퍼센티지 시 실제 렌더 rect 와 상이 가능
- 역-Z 깊이 비교(`CF_GreaterEqual`), 쿼터니언 순서(rot_0=w 가정), NDC y 부호

**로드맵**
- GPU radix sort (CPU 정렬 대체 — 대용량 클라우드 성능)
- 타일 기반 래스터 (원조 3DGS 방식, 오버드로 절감)
- 뷰 의존 SH (f_rest 고차 계수 — 현재 DC only)
- 프록시 간 전역 통합 정렬, 컬링(프러스텀/거리 LOD)
- `.spz` 포맷, 에디터 임포터(UFactory)
