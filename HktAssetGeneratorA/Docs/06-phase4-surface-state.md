# 06 — Phase 4: 표면 상태 Operation

전제: Phase 3 완료. 원본 §17·§21 의 수정판. 핵심 변경: 긁힘은 Canvas 2D 스트로크가 아니라
캡슐 SDF 스탬핑 (D-5).

## 목표

Polish / Scratch / Oxidize / Dirt / Engrave 5종 `MaterialOperation` 을 로그로 쌓고
재생(replay)하여, 같은 검에 상태값만 바꿔 다양한 표면을 만든다. 되돌리기 = 로그 잘라내기
+ 재베이크.

완료 조건 (원본 §32 유지): 상태 변화로 표면 다양화 / 동일 seed·동일 로그 → 동일 텍스처.

## Step 4.1 — Operation 모델·재생 (`src/material/operations.js`)

- 타입은 원본 §17 그대로 (`PolishOperation`, `ScratchOperation`, `OxidizeOperation`,
  `DirtOperation`, `EngraveOperation` + `AssignMaterialOperation`).
- **의미론 확정**: Operation 은 베이크 입력의 **중간 버퍼에 대한 순수 변환**이다.
  compile 단계가 로그를 순서대로 적용해 부품별 상태 필드/스탬프 목록을 만들고, 베이크는
  그 결과만 본다. Operation 실행에 자체 난수가 필요하면 반드시 op 자신의 `seed` 필드에서
  파생 (전역 seed 오염 금지) — 로그 중간 삽입/삭제에도 나머지 op 결과가 불변.
- `operations.json` 직렬화 + 로그 UI(목록·삭제·재정렬·재베이크).

## Step 4.2 — 필드형 Operation (Polish / Oxidize / Dirt)

셋 다 "selector → 마스크 → 상태 필드 가산" 구조:

- selector (원본 §17): `edge` → edgeWeight, `ridge` → ridgeWeight, `local_uv bounds` →
  uvLocal 사각 영역(부드러운 경계 falloff 0.05).
- 상태 필드는 텍스처 해상도가 아니라 **정점 단위가 아닌 저해상 필드(256²/부품, uvLocal
  공간)** 에 축적 — Operation 수가 늘어도 베이크 비용 불변, 프래그먼트에서 bilinear 샘플.
- 프래그먼트 반영은 Phase 3 수식의 uniform(uOxidationAmount 등)을 이 필드 샘플로 대체.
  물질별 반응 계수(rules.cavityOxidationResponse 등)와 곱해 물질 간 차이 유지.

## Step 4.3 — Scratch: 캡슐 SDF 스탬핑 (D-5)

원본 §21 의 ScratchSpec 은 유지, 구현만 교체:

- `generateScratchStamps(spec)` → `{ a: Vec2, b: Vec2, width, depth, alpha }[]`
  (uvMetric 공간 좌표 — 실측 크기 유지가 목적이므로 **긁힘 좌표계는 metric**).
  위치·길이·각도·강도는 `mulberry32(spec.seed)` 스트림에서 순서 고정으로 추출.
  direction: longitudinal = metric U 축 ±10°, perpendicular = V 축 ±10°, random = 균등.
- 베이크 시 프래그먼트에서 평가하지 않는다(스탬프 수 × 픽셀 수 폭발) —
  **높이 필드에 사전 스탬프**: 각 캡슐의 metric AABB → Atlas 픽셀 영역으로 변환(아일랜드의
  metric↔atlas 선형 관계 이용) → 해당 픽셀만 순회하며
  `depth × smoothstep(width/2, width/4, distToSegment)` 를 높이 필드에서 감산.
  겹침은 min 누적(가장 깊은 긁힘 승리) — 순서 무관이라 결정성에 유리.
- roughness 에도 같은 스탬프를 약하게 가산(긁힌 자리 거칠어짐), BaseColor 는 미세하게 밝게
  (금속 노출).
- seam 처리: 캡슐이 metric V 둘레를 넘으면 mod 둘레로 감아 한 번 더 스탬프(둘레 연속).

## Step 4.4 — Engrave: 마스크 스탬핑

원본 §17·§22 의 EngraveOperation. Phase 4 에서는 AI 없이 **내장 프리셋 마스크**(간단한 룬·
문장 흑백 PNG 를 리포에 동봉)로 파이프라인을 완성한다 — AI 생성은 Phase 6.

- 마스크는 로드 시 Float32 그레이 배열로 변환(결정 경로에서 이미지 디코딩이 유일하게
  허용되는 지점 — **로드 후 배열 자체를 프로젝트에 저장**해 디코더 편차를 격리).
- 배치는 uvLocal 공간(원본 유지): op.transform 역변환 → 마스크 bilinear 샘플 →
  높이 감산(depth) + roughness 가산 + BaseColor 미세 어둡게.
- 적용 픽셀 범위 = transform 된 마스크 AABB 만.

## Step 4.5 — UI·테스트

- UI: SurfaceState 슬라이더(polish/oxidation/dirt/moisture) = 전역 상태 + Operation 로그
  패널(추가 다이얼로그: 종류·selector·강도·seed). "낡은 검 프리셋"(로그 묶음) 3종.
- 테스트:
  - 같은 로그 + 같은 seed → 텍스처 해시 동일. 로그 마지막 op 제거 → 그 op 만 사라진 결과
    (스탬프 min 누적 덕에 순서 교환도 검증 가능).
  - 긁힘 실측 크기: 길이 0.8 vs 1.6 검, 같은 ScratchSpec → 긁힘 픽셀 길이가 metric 비율대로.
  - golden: 낡은 검 프리셋 3종 해시.
