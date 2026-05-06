# Tasks Index

> ⚠️ 자동 생성 — 직접 수정 금지. `python -m goalsys.cli render-task-index` 로 재생성한다.
> Last generated: 2026-05-06T10:59:24+00:00
> Total tasks: 16

## By Status

### todo (16)

- T-00001 GravitySystem 컬럼 포인터 호이스팅 _(→ G-0100)_
- T-00002 MovementSystem 컬럼 포인터 호이스팅 _(→ G-0100)_
- T-00003 PhysicsSystem 컬럼 포인터 호이스팅 _(→ G-0100)_
- T-00004 VM Distance OpCode FHktFixed32 마이그레이션 _(→ G-0101)_
- T-00005 VM Yaw 회전 OpCode FHktFixed32 마이그레이션 _(→ G-0101)_
- T-00006 VM 부동소수점 정적 가드 회귀 테스트 _(→ G-0101)_
- T-00007 AdvanceFrame to UndoDiff round-trip 회귀 테스트 _(→ G-0102)_
- T-00008 다중 프레임 누적 UndoDiff 회귀 테스트 _(→ G-0102)_
- T-00009 Task 시스템 단위 테스트 작성 _(→ G-0000)_
- T-00010 agent-goal-binding / skill.md 에 Task 명령 통합 _(→ G-0000)_
- T-00011 HktUI → HktPresentation 모듈 의존 제거 _(→ G-0111, G-0020)_
- T-00012 런타임 LoadSynchronous 제거 — VoxelUnit / VFXAssetBank _(→ G-0106, G-0020)_
- T-00013 UHktVFXAssetBank::Resolve(Intent, OnLoaded) 비동기 API 신설 _(→ G-0110, G-0106)_
- T-00014 hkt.Sprite.Renderer CVar 등록 + CrowdHost Niagara dispatch 분기 _(→ G-0108, G-1002, G-1003)_
- T-00015 Sprite Terrain PR-D — StyleSet 도입 + deprecated 제거 + 표면 재추출 트리거 _(→ G-0117)_
- T-00016 HktTerrainPreviewCommand FHktTerrainGenerator 직접 인스턴스화 제거 _(→ G-0109, G-0020)_

### in_progress (0)

_(없음)_

### done (0)

_(없음)_

### cancelled (0)

_(없음)_

## By Goal

### G-0000 Goal/Task 시스템 무결성 — 의도→일감 추적의 신뢰성 (2)

- T-00009 Task 시스템 단위 테스트 작성 _(status: todo)_
- T-00010 agent-goal-binding / skill.md 에 Task 명령 통합 _(status: todo)_

### G-0020 엔터티 시각화 — Tag/DataAsset 기반 리소스 연결과 대량 엔터티 렌더링 성능 (3)

- T-00011 HktUI → HktPresentation 모듈 의존 제거 _(status: todo)_
- T-00012 런타임 LoadSynchronous 제거 — VoxelUnit / VFXAssetBank _(status: todo)_
- T-00016 HktTerrainPreviewCommand FHktTerrainGenerator 직접 인스턴스화 제거 _(status: todo)_

### G-0100 SOA WorldState — Property별 컬럼 기반 시뮬레이션 스냅샷 (3)

- T-00001 GravitySystem 컬럼 포인터 호이스팅 _(status: todo)_
- T-00002 MovementSystem 컬럼 포인터 호이스팅 _(status: todo)_
- T-00003 PhysicsSystem 컬럼 포인터 호이스팅 _(status: todo)_

### G-0101 결정론 바이트코드 VM 인터프리터 — VReg IR + byte-identical 컴파일 (3)

- T-00004 VM Distance OpCode FHktFixed32 마이그레이션 _(status: todo)_
- T-00005 VM Yaw 회전 OpCode FHktFixed32 마이그레이션 _(status: todo)_
- T-00006 VM 부동소수점 정적 가드 회귀 테스트 _(status: todo)_

### G-0102 FHktSimulationDiff — 가역적 프레임 변경 추적과 UndoDiff (2)

- T-00007 AdvanceFrame to UndoDiff round-trip 회귀 테스트 _(status: todo)_
- T-00008 다중 프레임 누적 UndoDiff 회귀 테스트 _(status: todo)_

### G-0106 시각 리소스가 GameplayTag 만으로 비동기 해결된다 — 동기 로드 0 (2)

- T-00012 런타임 LoadSynchronous 제거 — VoxelUnit / VFXAssetBank _(status: todo)_
- T-00013 UHktVFXAssetBank::Resolve(Intent, OnLoaded) 비동기 API 신설 _(status: todo)_

### G-0108 스프라이트 캐릭터 시각화 — Paper / Crowd 두 경로와 공유 상태기계로 200+ 엔터티 60fps (1)

- T-00014 hkt.Sprite.Renderer CVar 등록 + CrowdHost Niagara dispatch 분기 _(status: todo)_

### G-0109 Voxel 청크가 Greedy Meshing 으로 압축되어 GPU 에 직접 업로드된다 (1)

- T-00016 HktTerrainPreviewCommand FHktTerrainGenerator 직접 인스턴스화 제거 _(status: todo)_

### G-0110 VFX / 파괴 이펙트가 Tag/Intent 기반 Niagara 자산으로 비동기 스폰된다 (1)

- T-00013 UHktVFXAssetBank::Resolve(Intent, OnLoaded) 비동기 API 신설 _(status: todo)_

### G-0111 Slate UI 가 Tag/DataAsset/Strategy 3축으로 동적 생성된다 (1)

- T-00011 HktUI → HktPresentation 모듈 의존 제거 _(status: todo)_

### G-0117 Sprite 기반 지형 렌더링 — TerrainSubsystem 청크에서 top-surface 만 추출하여 단일 HISM 인스턴싱 (1)

- T-00015 Sprite Terrain PR-D — StyleSet 도입 + deprecated 제거 + 표면 재추출 트리거 _(status: todo)_

### G-1002 HISM 스프라이트 크라우드 경로 — atlas 별 1 HISM 으로 200+ 인스턴스 transform 갱신 (1)

- T-00014 hkt.Sprite.Renderer CVar 등록 + CrowdHost Niagara dispatch 분기 _(status: todo)_

### G-1003 Niagara 스프라이트 크라우드 경로 — atlas 별 1 NiagaraComponent + NDI Array push (1)

- T-00014 hkt.Sprite.Renderer CVar 등록 + CrowdHost Niagara dispatch 분기 _(status: todo)_

## Open Backlog (16)

- T-00001 _(created 2026-05-06T07:16:55+00:00)_ — GravitySystem 컬럼 포인터 호이스팅 → G-0100
- T-00002 _(created 2026-05-06T07:16:55+00:00)_ — MovementSystem 컬럼 포인터 호이스팅 → G-0100
- T-00003 _(created 2026-05-06T07:16:55+00:00)_ — PhysicsSystem 컬럼 포인터 호이스팅 → G-0100
- T-00004 _(created 2026-05-06T07:17:07+00:00)_ — VM Distance OpCode FHktFixed32 마이그레이션 → G-0101
- T-00005 _(created 2026-05-06T07:17:07+00:00)_ — VM Yaw 회전 OpCode FHktFixed32 마이그레이션 → G-0101
- T-00006 _(created 2026-05-06T07:17:07+00:00)_ — VM 부동소수점 정적 가드 회귀 테스트 → G-0101
- T-00007 _(created 2026-05-06T07:17:16+00:00)_ — AdvanceFrame to UndoDiff round-trip 회귀 테스트 → G-0102
- T-00008 _(created 2026-05-06T07:17:22+00:00)_ — 다중 프레임 누적 UndoDiff 회귀 테스트 → G-0102
- T-00009 _(created 2026-05-06T07:45:12+00:00)_ — Task 시스템 단위 테스트 작성 → G-0000
- T-00010 _(created 2026-05-06T07:45:12+00:00)_ — agent-goal-binding / skill.md 에 Task 명령 통합 → G-0000
- T-00011 _(created 2026-05-06T10:58:32+00:00)_ — HktUI → HktPresentation 모듈 의존 제거 → G-0111, G-0020
- T-00012 _(created 2026-05-06T10:58:40+00:00)_ — 런타임 LoadSynchronous 제거 — VoxelUnit / VFXAssetBank → G-0106, G-0020
- T-00013 _(created 2026-05-06T10:58:46+00:00)_ — UHktVFXAssetBank::Resolve(Intent, OnLoaded) 비동기 API 신설 → G-0110, G-0106
- T-00014 _(created 2026-05-06T10:58:55+00:00)_ — hkt.Sprite.Renderer CVar 등록 + CrowdHost Niagara dispatch 분기 → G-0108, G-1002, G-1003
- T-00015 _(created 2026-05-06T10:59:03+00:00)_ — Sprite Terrain PR-D — StyleSet 도입 + deprecated 제거 + 표면 재추출 트리거 → G-0117
- T-00016 _(created 2026-05-06T10:59:09+00:00)_ — HktTerrainPreviewCommand FHktTerrainGenerator 직접 인스턴스화 제거 → G-0109, G-0020
