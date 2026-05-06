# Goal Tree

> ⚠️ 자동 생성 — 직접 수정 금지. `python -m goalsys.cli build-views` 로 재생성한다.
> Last generated: 2026-05-06T06:36:47+00:00

- G-0010 결정론적 멀티플레이어 시뮬레이션 프레임워크
  - G-0100 SOA WorldState — Property별 컬럼 기반 시뮬레이션 스냅샷
  - G-0101 결정론 바이트코드 VM 인터프리터 — VReg IR + byte-identical 컴파일
  - G-0102 FHktSimulationDiff — 가역적 프레임 변경 추적과 UndoDiff
  - G-0103 GGPO 30Hz 클라이언트 롤백/예측/빨리감기
  - G-0104 HktStory JSON 정의 — GameplayTag → FHktVMProgram 컴파일 파이프라인
- G-0020 엔터티 시각화 — Tag/DataAsset 기반 리소스 연결과 대량 엔터티 렌더링 성능
- G-0030 LLM 기반 게임플레이 월드 제작 — 컨셉 입력에서 지형/스토리/에셋 자동 생성
- G-0040 개발 관련 디버깅 시각화 — Insights 패널과 에디터 도킹 탭
- G-0050 LLM 기반 검증 테스트 자동화 — 헤드리스 Automation 러너 + 자동 수정 사이클

## Constraints (횡단 제약)

- G-0001 HktCore 순수 C++ — UObject/UWorld/UE 런타임 의존 0
- G-0002 시뮬레이션 결정성 보존 — 동일 입력 시퀀스에 동일 상태 산출
- G-0003 서버 권위 모델 — 클라이언트는 읽기 전용 FHktWorldView 만 수신
- G-0004 ISP 3-Layer 분리 — Intent → Simulation → Presentation 단방향
- G-0005 VM 의 WorldState 쓰기는 FHktVMWorldStateProxy::SetPropertyDirty 경유
- G-0006 지형 데이터 단일 출처 — UHktTerrainSubsystem 경유
