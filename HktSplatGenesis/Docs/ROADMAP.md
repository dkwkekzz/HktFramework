# ROADMAP — 단계별 작업 큐

작업 규약: 한 단계 = 한 PR 권장. 시작 전 [DESIGN.md](DESIGN.md) 로 의도를 잡고, 단계의
**완료 기준**을 통과하면 체크(✅)하고 결정·함정을 DESIGN.md 에 반영한다. 순서는 권장이며
독립 단계는 건너뛸 수 있다. 완료 기준은 가능한 한 `test/` 하니스로 재현 가능하게 쓴다.

## R1 — 살 이음새·부피 (L6 품질)

- **왜**: 친화가 뼈 단위라 관절에서 이웃 뼈 살이 겹치거나 벌어진다. 관절 굽힘 시 부피 감각도 없다.
- **구현 지점**: `wgsl.js` SIM L6 블록 (성장 자리 계산), 필요 시 `engine.js _initFleshCloud` (친화 배정).
- **방법 후보**: 관절 근처(t≈0 or 1) 스플랫은 부모/자식 뼈 자리를 t 로 혼합; 굽힘각 기반 자리 반경 보정(bulge 근사).
- **완료 기준**: `node test/render-shot.js out.png walk` 에서 어깨·무릎 이음새 단차가 눈에 안 띄고, idle/walk/wave 모두 방울 재발 없음.

## R2 — Evaluator (정량 로깅)

- **왜**: 지금은 눈 검증뿐. hikito harness 매핑의 Evaluator 축이 비어 있다 (Planner=뼈대, Generator=grammar 는 있음).
- **구현 지점**: `test/` 에 지표 스크립트 추가 (스플랫 buffer readback 기반).
- **지표 후보**: 뼈대 커버리지(뼈별 스플랫 수 분포), 자리 오차 RMS, 실루엣 대비, 자기충돌 부피.
- **완료 기준**: 한 커맨드로 클립별 지표 JSON 출력, R1 이후 회귀 감시에 사용 가능.

## R3 — Detail 층 (스타일 2차 정의)

- **왜**: 자리 스프링 살은 매끄러워 날카로운 특징(손가락 마디, 얼굴, 뿔)이 없다.
- **방법 후보**: 뼈대 세분화(가상 뼈), 자리에 detail 변위(시드 노이즈를 grammar 로 제어), 유전자화.
- **완료 기준**: 히키토 프리셋에서 손/얼굴 부위가 실루엣으로 구분(사진), grammar 값만으로 스타일 변형 가능.

## R4 — 메시화 + 자동 스킨 웨이트 (UE5 다리)

- **왜**: hikito-flesh 로드맵 1번의 이 프로젝트 버전 — 바인드 포즈 살을 메시로 굽고,
  정점 웨이트를 "어느 뼈 친화 스플랫이 근처인가"에서 자동 도출하면 스키닝이 공짜.
- **완료 기준**: 바인드 포즈 → 메시(+웨이트) 내보내기, UE5 에서 Mixamo 클립으로 재생 확인.

## S 트랙 — Spark 지형 무대 (worldlabs Marble)

상세 계획·아키텍처·리스크는 [PLAN-SparkTerrain.md](PLAN-SparkTerrain.md) 참조. 무대(외부 생성
3DGS 지형, Spark 렌더) 위에 생명(기존 WebGPU 배양)이 사는 2층 세계 — R 트랙과 독립 진행 가능.

- ✅ **S1 — 무대 로더 + 카메라 동기**: `vendor/spark/`(spark 2.1.0 + three 0.180 ESM 격리) +
  `js/stage.js`(무대 탭: URL/드롭/정합 노브, `?world=` 딥링크) + WebGPU 캔버스 premultiplied
  투명 합성. 검증: `node test/stage-shot.js` — 절차 지형 fixture(PLY) 위 생명 오버레이 사진.
  함정: SparkRenderer 는 자동 생성이 아니다 — scene 에 명시적으로 추가해야 그려진다.
- ✅ **S2 — collider GLB → heightfield → 시뮬 바닥**: `js/heightfield.js`(최소 GLB 파서 + 최대
  높이 베이크, three 무의존) → `engine.setHeightfield`(r32float 텍스처) → SIM 바닥을
  `terrainH()` bilinear + 법선 반사로 교체 (평면 폴백 = 기존 거동과 일치). emitter y 는 지상고로
  해석(지형 높이 가산) — 나무가 능선에 뿌리내린다. 정합 노브 변경 시 재베이크(디바운스).
  검증: `node test/terrain-shot.js` — 침투 0% + 바닥 포락선 지형 밀착(0.10 vs 평면 0.32) +
  슬라임 경사 정착·불×나무 골짜기 사진. 한계: 골짜기가 격자 바닥(y=-0.8) 아래면 L2 이웃
  규칙이 꺼진다 — S5 시뮬 버블에서 해소.
- **S3 — 오클루전 합성**: collider depth prepass + soft fade, fog 톤 정합.
  완료: 생명이 언덕 뒤로 가려지는 전후 스크린샷.
- **S4 — LoD 스트리밍(.rad) + 성능 예산**: Range 지원 서버로 교체 필수. 완료: 목표 fps 수치.
- **S5 — 상호작용 심화 (선택)**: 흔적 데칼 스폰, 시뮬 버블(GRID_ORIGIN 추종).

## R5 — 엔진 일반 큐 (L6 무관, 독립)

- 장면 편집기 (개체 추가/배치 UI) · 슬라임의 포식(질량 이전)
- 진짜 curl noise (발산 무) · GPU radix sort 로 bitonic 대체
- L2 위치 더블 버퍼 · L3 본드 더블 버퍼 (지터/정합이 문제 될 때)

## 완료 이력

- ✅ L0~L5 (README 로드맵 참조)
- ✅ L6 뼈대 살: Skeleton IR + 살 문법 + 성장 자리 스프링 + 뼈대 오버레이 + Mixamo FBX 드롭 + 패널 탭 (PR #486)
