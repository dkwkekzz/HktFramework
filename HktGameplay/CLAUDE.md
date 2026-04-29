# CLAUDE.md — HktGameplay

런타임 시뮬레이션 / 네트워킹 / 프레젠테이션. 모듈별 상세·데이터 흐름·트러블슈팅: [README.md](README.md). 프로젝트 절대 원칙: [../CLAUDE.md](../CLAUDE.md).

## Module Dependency Graph

```
HktGameplay (Runtime)
├── HktCore             — 순수 C++ SOA 결정론적 VM (UObject 0). 지형은 IHktTerrainDataSource 로만 소비
├── HktStory            — 바이트코드 스니펫 라이브러리 (fluent API)
├── HktRule             — 서버/클라 룰 인터페이스
│   └── HktRuntime      — 네트워킹, GGPO 롤백 (30Hz)
├── HktAsset            — GameplayTag → DataAsset 비동기 로딩
├── HktPresentation     — 읽기 전용 시각화 (OnWorldViewUpdated)
│   └── HktVFX          — Niagara 인텐트 해석 (클라 전용)
├── HktUI               — 데이터 드리븐 Slate (anchor strategy)
├── HktTerrain          — 지형 데이터 단일 출처 (UHktTerrainSubsystem). [Source/HktTerrain/CLAUDE.md]
│   ├── HktLandscapeTerrain — Landscape 경로 (Subsystem 경유 SamplePreview)
│   └── HktSpriteTerrain    — 스프라이트(HISM) 경로 (AcquireChunk + 표면 셀)
├── HktSpriteCore       — 스프라이트 렌더링
└── HktVoxelCore        [PostConfigInit 고정]
    ├── HktVoxelTerrain — Voxel 경로 (Subsystem 경유 → RenderCache)
    ├── HktVoxelSkin    — 메시 스키닝 (Editor UnrealEd 조건부)
    └── HktVoxelVFX     — 파괴 VFX (Niagara)
```

## Plugin-Local Constraints

루트 절대 원칙에 더해 다음을 추가 준수.

1. **HktVoxelCore PostConfigInit** — Default 보다 선행. `LoadingPhase` 변경 금지.
2. **HktVoxelSkin Editor 의존** — Editor 빌드 한정. Runtime/Shipping 누설 금지.
3. **HktUI ↔ HktPresentation 단방향** — UI 는 Presentation 미의존 (인터페이스/델리게이트만).
4. **HktCore 단방향 의존** — `HktCore` 는 `HktTerrain` 헤더 include 금지. 지형은 `IHktTerrainDataSource` 로만 소비.
5. **지형 데이터 단일 출처** — Voxel/Sprite/Landscape Actor 가 직접 `FHktTerrainGenerator` 인스턴스화 금지. 모든 청크/프리뷰는 `UHktTerrainSubsystem::AcquireChunk` / `SamplePreview` 경유.

## Conventions (HktGameplay 전용)

- **엔티티 타입**: `HktType` 네임스페이스 — Unit, Projectile, Equipment, Building.
- **GameplayTag**: 이벤트(`FHktEvent::EventTag`), UI 위젯(`Widget.LoginHud`), 에셋 해석에 사용.
- **신규 Story 코드**: `FHktVar` API 사용 (구 `RegisterIndex` 는 PR-3 에서 JSON schema 2 로 마이그레이션 예정).

## Debug Event Log

`HKT_EVENT_LOG` → 링 버퍼(8192). 파일 `Saved/Logs/HktEventLog.log`. 콘솔: `hkt.EventLog.Start/Stop/Dump/Clear`. AI: `/debug-logs <증상>`.
