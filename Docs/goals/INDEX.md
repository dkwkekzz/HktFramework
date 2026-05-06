# Goals Index

> ⚠️ 자동 생성 — 직접 수정 금지. `python -m goalsys.cli build-views` 로 재생성한다.
> Last generated: 2026-05-06T09:33:21+00:00
> Total goals: 36

## By Pillar

### G-0000 Goal/Task 시스템 무결성 — 의도→일감 추적의 신뢰성

_(하위 Goal 없음)_

### G-0010 결정론적 멀티플레이어 시뮬레이션 프레임워크

- G-0100 SOA WorldState — Property별 컬럼 기반 시뮬레이션 스냅샷
- G-0101 결정론 바이트코드 VM 인터프리터 — VReg IR + byte-identical 컴파일
- G-0102 FHktSimulationDiff — 가역적 프레임 변경 추적과 UndoDiff
- G-0103 GGPO 30Hz 클라이언트 롤백/예측/빨리감기
- G-0104 HktStory JSON 정의 — GameplayTag → FHktVMProgram 컴파일 파이프라인

### G-0020 엔터티 시각화 — Tag/DataAsset 기반 리소스 연결과 대량 엔터티 렌더링 성능

- G-0105 WorldView 변경이 동일 프레임 내 시각 표현에 반영된다
- G-0106 시각 리소스가 GameplayTag 만으로 비동기 해결된다 — 동기 로드 0
- G-0107 Actor 카테고리 엔터티는 변경된 엔터티에만 작업이 수행된다
- G-0108 스프라이트 캐릭터 시각화 — Paper / Crowd 두 경로와 공유 상태기계로 200+ 엔터티 60fps
- G-0109 Voxel 청크가 Greedy Meshing 으로 압축되어 GPU 에 직접 업로드된다
- G-0110 VFX / 파괴 이펙트가 Tag/Intent 기반 Niagara 자산으로 비동기 스폰된다
- G-0111 Slate UI 가 Tag/DataAsset/Strategy 3축으로 동적 생성된다
- G-0112 Voxel Skin 메시 베이킹은 Editor 한정 — Runtime/Shipping 누설 0
- G-0117 Sprite 기반 지형 렌더링 — TerrainSubsystem 청크에서 top-surface 만 추출하여 단일 HISM 인스턴싱
- G-1000 스프라이트 애니 상태기계 — Paper / Crowd 가 동일 결정 함수를 공유한다
- G-1001 Paper2D 단일 액터 경로 — 엔터티당 1액터, 저밀도/디버그 시각화
- G-1002 HISM 스프라이트 크라우드 경로 — atlas 별 1 HISM 으로 200+ 인스턴스 transform 갱신
- G-1003 Niagara 스프라이트 크라우드 경로 — atlas 별 1 NiagaraComponent + NDI Array push

### G-0030 LLM 기반 게임플레이 월드 제작 — 컨셉 입력에서 지형/스토리/에셋 자동 생성

- G-0118 MCP 서버 ↔ UE5 에디터/런타임 브릿지 — LLM 에이전트 통신 인프라
- G-0119 8-step Generator Pipeline 오케스트레이션 — Step Store + Feature Worker
- G-0120 Tag 디스패치 + Generator Router — 어셋 자동 생성 라우팅
- G-0121 HktMap 빌드 — terrain_spec JSON → Landscape/Spawner/Region 파이프라인
- G-0122 Story Schema 2 컴파일 — JSON → HktCore 바이트코드 + 의존성 추적
- G-0123 Generator Prompt 패널 + Claude CLI Subprocess — 인터랙티브 생성 UI

### G-0040 개발 관련 디버깅 시각화 — Insights 패널과 에디터 도킹 탭

_(하위 Goal 없음)_

### G-0050 LLM 기반 검증 테스트 자동화 — 헤드리스 Automation 러너 + 자동 수정 사이클

_(하위 Goal 없음)_

## By Status

### Active (36)

- G-0000 Goal/Task 시스템 무결성 — 의도→일감 추적의 신뢰성
- G-0001 HktCore 순수 C++ — UObject/UWorld/UE 런타임 의존 0
- G-0002 시뮬레이션 결정성 보존 — 동일 입력 시퀀스에 동일 상태 산출
- G-0003 서버 권위 모델 — 클라이언트는 읽기 전용 FHktWorldView 만 수신
- G-0004 ISP 3-Layer 분리 — Intent → Simulation → Presentation 단방향
- G-0005 VM 의 WorldState 쓰기는 FHktVMWorldStateProxy::SetPropertyDirty 경유
- G-0006 지형 데이터 단일 출처 — UHktTerrainSubsystem 경유
- G-0010 결정론적 멀티플레이어 시뮬레이션 프레임워크
- G-0020 엔터티 시각화 — Tag/DataAsset 기반 리소스 연결과 대량 엔터티 렌더링 성능
- G-0030 LLM 기반 게임플레이 월드 제작 — 컨셉 입력에서 지형/스토리/에셋 자동 생성
- G-0040 개발 관련 디버깅 시각화 — Insights 패널과 에디터 도킹 탭
- G-0050 LLM 기반 검증 테스트 자동화 — 헤드리스 Automation 러너 + 자동 수정 사이클
- G-0100 SOA WorldState — Property별 컬럼 기반 시뮬레이션 스냅샷
- G-0101 결정론 바이트코드 VM 인터프리터 — VReg IR + byte-identical 컴파일
- G-0102 FHktSimulationDiff — 가역적 프레임 변경 추적과 UndoDiff
- G-0103 GGPO 30Hz 클라이언트 롤백/예측/빨리감기
- G-0104 HktStory JSON 정의 — GameplayTag → FHktVMProgram 컴파일 파이프라인
- G-0105 WorldView 변경이 동일 프레임 내 시각 표현에 반영된다
- G-0106 시각 리소스가 GameplayTag 만으로 비동기 해결된다 — 동기 로드 0
- G-0107 Actor 카테고리 엔터티는 변경된 엔터티에만 작업이 수행된다
- G-0108 스프라이트 캐릭터 시각화 — Paper / Crowd 두 경로와 공유 상태기계로 200+ 엔터티 60fps
- G-0109 Voxel 청크가 Greedy Meshing 으로 압축되어 GPU 에 직접 업로드된다
- G-0110 VFX / 파괴 이펙트가 Tag/Intent 기반 Niagara 자산으로 비동기 스폰된다
- G-0111 Slate UI 가 Tag/DataAsset/Strategy 3축으로 동적 생성된다
- G-0112 Voxel Skin 메시 베이킹은 Editor 한정 — Runtime/Shipping 누설 0
- G-0117 Sprite 기반 지형 렌더링 — TerrainSubsystem 청크에서 top-surface 만 추출하여 단일 HISM 인스턴싱
- G-0118 MCP 서버 ↔ UE5 에디터/런타임 브릿지 — LLM 에이전트 통신 인프라
- G-0119 8-step Generator Pipeline 오케스트레이션 — Step Store + Feature Worker
- G-0120 Tag 디스패치 + Generator Router — 어셋 자동 생성 라우팅
- G-0121 HktMap 빌드 — terrain_spec JSON → Landscape/Spawner/Region 파이프라인
- G-0122 Story Schema 2 컴파일 — JSON → HktCore 바이트코드 + 의존성 추적
- G-0123 Generator Prompt 패널 + Claude CLI Subprocess — 인터랙티브 생성 UI
- G-1000 스프라이트 애니 상태기계 — Paper / Crowd 가 동일 결정 함수를 공유한다
- G-1001 Paper2D 단일 액터 경로 — 엔터티당 1액터, 저밀도/디버그 시각화
- G-1002 HISM 스프라이트 크라우드 경로 — atlas 별 1 HISM 으로 200+ 인스턴스 transform 갱신
- G-1003 Niagara 스프라이트 크라우드 경로 — atlas 별 1 NiagaraComponent + NDI Array push

### Proposed (0)

_(없음)_

### Achieved (0)

_(없음)_

### Abandoned (0)

_(없음)_

### Superseded (0)

_(없음)_

## By Tag

### constraint (6)

- G-0001 HktCore 순수 C++ — UObject/UWorld/UE 런타임 의존 0
- G-0002 시뮬레이션 결정성 보존 — 동일 입력 시퀀스에 동일 상태 산출
- G-0003 서버 권위 모델 — 클라이언트는 읽기 전용 FHktWorldView 만 수신
- G-0004 ISP 3-Layer 분리 — Intent → Simulation → Presentation 단방향
- G-0005 VM 의 WorldState 쓰기는 FHktVMWorldStateProxy::SetPropertyDirty 경유
- G-0006 지형 데이터 단일 출처 — UHktTerrainSubsystem 경유

### layer:arch (1)

- G-0004 ISP 3-Layer 분리 — Intent → Simulation → Presentation 단방향

### layer:asset (1)

- G-0106 시각 리소스가 GameplayTag 만으로 비동기 해결된다 — 동기 로드 0

### layer:character (4)

- G-1000 스프라이트 애니 상태기계 — Paper / Crowd 가 동일 결정 함수를 공유한다
- G-1001 Paper2D 단일 액터 경로 — 엔터티당 1액터, 저밀도/디버그 시각화
- G-1002 HISM 스프라이트 크라우드 경로 — atlas 별 1 HISM 으로 200+ 인스턴스 transform 갱신
- G-1003 Niagara 스프라이트 크라우드 경로 — atlas 별 1 NiagaraComponent + NDI Array push

### layer:editor-tool (1)

- G-0112 Voxel Skin 메시 베이킹은 Editor 한정 — Runtime/Shipping 누설 0

### layer:net (2)

- G-0003 서버 권위 모델 — 클라이언트는 읽기 전용 FHktWorldView 만 수신
- G-0103 GGPO 30Hz 클라이언트 롤백/예측/빨리감기

### layer:presentation (2)

- G-0105 WorldView 변경이 동일 프레임 내 시각 표현에 반영된다
- G-0107 Actor 카테고리 엔터티는 변경된 엔터티에만 작업이 수행된다

### layer:rendering (6)

- G-0108 스프라이트 캐릭터 시각화 — Paper / Crowd 두 경로와 공유 상태기계로 200+ 엔터티 60fps
- G-0109 Voxel 청크가 Greedy Meshing 으로 압축되어 GPU 에 직접 업로드된다
- G-0117 Sprite 기반 지형 렌더링 — TerrainSubsystem 청크에서 top-surface 만 추출하여 단일 HISM 인스턴싱
- G-1001 Paper2D 단일 액터 경로 — 엔터티당 1액터, 저밀도/디버그 시각화
- G-1002 HISM 스프라이트 크라우드 경로 — atlas 별 1 HISM 으로 200+ 인스턴스 transform 갱신
- G-1003 Niagara 스프라이트 크라우드 경로 — atlas 별 1 NiagaraComponent + NDI Array push

### layer:terrain (3)

- G-0006 지형 데이터 단일 출처 — UHktTerrainSubsystem 경유
- G-0109 Voxel 청크가 Greedy Meshing 으로 압축되어 GPU 에 직접 업로드된다
- G-0117 Sprite 기반 지형 렌더링 — TerrainSubsystem 청크에서 top-surface 만 추출하여 단일 HISM 인스턴싱

### layer:ui (1)

- G-0111 Slate UI 가 Tag/DataAsset/Strategy 3축으로 동적 생성된다

### layer:vfx (1)

- G-0110 VFX / 파괴 이펙트가 Tag/Intent 기반 Niagara 자산으로 비동기 스폰된다

### layer:vm (7)

- G-0001 HktCore 순수 C++ — UObject/UWorld/UE 런타임 의존 0
- G-0002 시뮬레이션 결정성 보존 — 동일 입력 시퀀스에 동일 상태 산출
- G-0005 VM 의 WorldState 쓰기는 FHktVMWorldStateProxy::SetPropertyDirty 경유
- G-0100 SOA WorldState — Property별 컬럼 기반 시뮬레이션 스냅샷
- G-0101 결정론 바이트코드 VM 인터프리터 — VReg IR + byte-identical 컴파일
- G-0102 FHktSimulationDiff — 가역적 프레임 변경 추적과 UndoDiff
- G-0104 HktStory JSON 정의 — GameplayTag → FHktVMProgram 컴파일 파이프라인

### perf (4)

- G-0108 스프라이트 캐릭터 시각화 — Paper / Crowd 두 경로와 공유 상태기계로 200+ 엔터티 60fps
- G-0117 Sprite 기반 지형 렌더링 — TerrainSubsystem 청크에서 top-surface 만 추출하여 단일 HISM 인스턴싱
- G-1002 HISM 스프라이트 크라우드 경로 — atlas 별 1 HISM 으로 200+ 인스턴스 transform 갱신
- G-1003 Niagara 스프라이트 크라우드 경로 — atlas 별 1 NiagaraComponent + NDI Array push

### pillar:authoring (1)

- G-0030 LLM 기반 게임플레이 월드 제작 — 컨셉 입력에서 지형/스토리/에셋 자동 생성

### pillar:devtools (1)

- G-0040 개발 관련 디버깅 시각화 — Insights 패널과 에디터 도킹 탭

### pillar:meta (1)

- G-0000 Goal/Task 시스템 무결성 — 의도→일감 추적의 신뢰성

### pillar:presentation (1)

- G-0020 엔터티 시각화 — Tag/DataAsset 기반 리소스 연결과 대량 엔터티 렌더링 성능

### pillar:simulation (1)

- G-0010 결정론적 멀티플레이어 시뮬레이션 프레임워크

### pillar:test-automation (1)

- G-0050 LLM 기반 검증 테스트 자동화 — 헤드리스 Automation 러너 + 자동 수정 사이클

### system:authoring (6)

- G-0118 MCP 서버 ↔ UE5 에디터/런타임 브릿지 — LLM 에이전트 통신 인프라
- G-0119 8-step Generator Pipeline 오케스트레이션 — Step Store + Feature Worker
- G-0120 Tag 디스패치 + Generator Router — 어셋 자동 생성 라우팅
- G-0121 HktMap 빌드 — terrain_spec JSON → Landscape/Spawner/Region 파이프라인
- G-0122 Story Schema 2 컴파일 — JSON → HktCore 바이트코드 + 의존성 추적
- G-0123 Generator Prompt 패널 + Claude CLI Subprocess — 인터랙티브 생성 UI
