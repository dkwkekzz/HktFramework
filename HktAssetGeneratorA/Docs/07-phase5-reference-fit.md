# 07 — Phase 5: 참조 이미지 형상 맞춤

전제: Phase 2 완료(Phase 3~4 와 독립 — 병행 가능). 원본 §23·§26·§27 의 수정판.
핵심 변경: 수동 어노테이션이 정식 MVP 경로 (D-11), 실루엣 평가는 CPU 직교 투영, 최적화는
Nelder-Mead.

## 목표

참조 검 이미지 1장 + 수동 어노테이션 → SwordTargetSpec → 수치 최적화로 SwordDesign 의
연속 파라미터를 맞춘다.

완료 조건 (원본 §32 수정): 검 20종 참조에서 평균 실루엣 IoU ≥ 0.9 —
**수동 어노테이션 포함 기준**(자동 분할 기준이 아님을 명시).

## Step 5.1 — 참조 어노테이션 UI (`src/app/reference.js`)

원본 §5.2 ReferenceSpec 을 유지하되 `manuallyConfirmed` 4항목을 UI 로 직접 만든다:

- 이미지 로드(로컬 파일) → 캔버스 표시.
- **객체 마스크**: MVP 는 다각형 라소(클릭으로 윤곽 폴리곤) — 브러시보다 구현이 싸고 검은
  윤곽이 단순하다. 폴리곤 → 비트마스크 래스터(자체, 결정적일 필요는 없음 — 입력물임).
- **칼날 양 끝점**(tip·뿌리) 2클릭, **부품 경계**(가드 상/하단, 손잡이 하단) 3클릭 →
  `Landmark2D[]`.
- **카메라**: MVP 가정 = 옆모습(side) 직교 투영. 이미지 내 검 축 = 두 끝점을 잇는 선.
  스케일·회전·평행이동은 끝점에서 유도 — 별도 추정 없음. three_quarter 뷰는 스코프 밖
  (unknown 으로 받되 경고).
- 저장: referenceSpec.json (마스크는 RLE 인코딩).

## Step 5.2 — TargetSpec 생성 (`src/eval/targetspec.js`)

- 마스크 + 랜드마크 → `SwordTargetSpec` (원본 §5.3):
  - 검 축 기준으로 마스크를 정규화(회전·스케일 보정) → 축 방향 스캔라인별 폭 프로파일
    추출 → 부품 경계 랜드마크로 blade/guard/grip/pommel 구간 분할.
  - `silhouetteTargets` = 정규화 마스크(256² 비트마스크) + 부품별 폭 프로파일.
  - `landmarks` = 정규화 좌표의 제약점.
  - `materialTargets`·`hiddenStructureHypotheses` 는 Phase 6 까지 빈 배열/기본 가설
    (단면 = diamond 기본).
- `createInitialSwordDesign(targetSpec)`: 폭 프로파일에서 직접 초기값 —
  길이·뿌리/중간/끝 폭·가드 폭·손잡이 길이를 프로파일 읽기로 산출(최적화의 좋은 출발점 =
  반복 수 절감).

## Step 5.3 — CPU 실루엣 평가 (`src/eval/silhouette.js`)

렌더러 없이 (D-11):

- 조립된 검(부품 Transform 적용)의 삼각형을 X-Y 평면(side 뷰)에 직교 투영 →
  256² 비트마스크 래스터(bake 의 edge-function 코드 재사용, 커버리지만 기록).
- `silhouetteIoU(target, candidate)` = 비트 AND / OR 카운트 (Uint32 워드 연산).
- `landmarkError` = 대응 랜드마크(끝점·부품 경계의 축상 위치) L2.
- `partProportionError` = 부품별 축 길이 비율 차.
- `aggregateLoss` = `(1 - IoU) + 0.5 × landmarkError + 0.3 × proportionError`
  (가중치는 상수 모듈에 노출 — 튜닝 노브).
- 목표 성능: 1회 평가 < 20ms.

## Step 5.4 — 수치 최적화 (`src/eval/optimize.js`)

원본 §26 의 랜덤 후보 루프 대신:

- 파라미터 벡터 = 원본 `SwordOptimizationVector` (10차원, 각 파라미터에 [min,max] 정의 —
  정규화된 [0,1] 공간에서 최적화).
- **Nelder-Mead** (자체 구현 ~80줄) + 수렴 시 최고점 주변 재시작 2회.
  종료: IoU ≥ 0.92 또는 200 평가 (원본 조기 종료 기준 계승).
- 결정성: 초기 심플렉스와 재시작 섭동은 `deriveSeed(seed, "optimize")` 스트림 —
  같은 참조 + 같은 seed → 같은 결과.
- 이산 선택(단면 유형·tip 유형·가드 템플릿)은 이 단계에서 **전수 시도**(4×3×4=48 조합의
  각각에 짧은 최적화 → 최고 선택)로 시작한다. AI 가설 선택은 Phase 6 에서 이 전수 루프를
  대체(비용 절감)하는 위치다.
- 진행 UI: 반복별 IoU 그래프, 현재 후보 실루엣 vs 참조 마스크 오버레이(원본 Reference
  Overlay 계승), 언제든 중단→수동 슬라이더 미세조정.

## Step 5.5 — 평가 리포트·테스트

- `EvaluationMetrics`(원본 §27) 구현 — Phase 2 검증기 + 실루엣 지표 통합.
  `assertBuildQuality` 하드 컨스트레인트 유지 (triangleCount ≤ 15,000 포함).
  `seamVisibility`(중립 조명 렌더에서 seam 픽셀 대비)는 Phase 6+ 로 유예 — MVP 는 0 보고.
- 테스트: 합성 참조(우리가 만든 검을 투영한 마스크)로 라운드트립 — 정답 파라미터를 아는
  상태에서 IoU ≥ 0.95 회복 확인 (자기 일관성). 실사진 20종은 수동 평가 세트로
  `test/golden/references/` 에 축적.
