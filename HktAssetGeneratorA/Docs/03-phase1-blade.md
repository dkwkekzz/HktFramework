# 03 — Phase 1: AI 없는 칼날 생성기

전제: [02-architecture.md](02-architecture.md) 의 규약. 원본 §7·§32 Phase 1 의 수정판.
**이 문서만 보고 Phase 1 을 구현할 수 있어야 한다.** 각 Step 은 커밋 1~2개 규모이고,
Step 마다 검증 방법이 붙는다. 순서대로 진행할 것.

## 목표

`BladeDesign` 입력 → 칼날 메시(+의미값+Local/Metric UV) → three.js 미리보기 → GLB 다운로드.
UI 슬라이더로 파라미터를 만지면 실시간 재생성.

완료 조건 (원본 §32 유지):
- 파라미터 프리셋 20종의 칼날 생성 (test/golden/blade-*.json)
- UV overlap 0, 비매니폴드 엣지 0, 3D/UV degenerate 0
- 동일 입력 → 동일 메시 해시 (vitest, Node 버전 고정)

## Step 1.1 — 코어 수학·결정성 기반 (`src/core/`)

의존이 없는 뿌리부터. 전부 순수 함수, DOM/three 금지.

- `math.js`: `add3/sub3/scale3/dot3/cross3/normalize3/lerp/clamp01`, `Bounds3` 계산.
- `rng.js`: `mulberry32(seed)` → `() => [0,1)`. 파생 seed: `deriveSeed(seed, scopeName)` =
  `seed ^ fnv1a32(scopeName)`.
- `hash.js`: `fnv1a32(string)`, `fnv1a64(bytes) → hex string`,
  `hashMesh(mesh)` = 02§5-3 의 순서 고정 연결 해시.
- `curve.js`:
  - `Curve1Spec` = 제어점 배열 `{t, value}[]` + Catmull-Rom 보간 (`evaluateCurve1(spec, t)`).
  - `Curve3Spec` = 3D 제어점 Catmull-Rom. `createCurve3(spec)` 는
    `{ evaluate(t), frame(t) }` 를 반환.
  - **frame 은 RMF(회전 최소화 프레임)** 로 계산한다 — Frenet 프레임은 직선 구간(곡률 0)에서
    미정의라 직선검이 기본인 이 도메인에 부적합. 구현: 시작 프레임을
    `tangent(0)` 과 월드 +X 로 고정하고, N 개 샘플을 따라 double-reflection 법으로 전파.
    샘플 수는 `segments.longitudinal` 과 동일 — t 는 샘플 보간으로 조회.
  - `buildArcLengthTable(curve, n)`: t 균등 샘플의 누적 호길이 Float64Array(n+1).

검증: vitest — RMF 가 직선에서 뒤틀리지 않음(모든 t 에서 normal·binormal 일정),
호길이 테이블 단조 증가, 같은 seed 의 RNG 스트림 동일.

## Step 1.2 — MeshBuilder (`src/mesh/builder.js`)

- `addVertex({position, uvLocal, uvMetric, attributes, smoothingGroup})` → index 반환.
  `smoothingGroup`(정수)은 **빌더 내부 전용** 입력이며 `build()` 결과에는 남지 않는다 —
  노멀 계산 시 같은 그룹끼리만 평균 (D-6).
- `addTriangle(a, b, c)` — CCW.
- `recalculateNormals()`: 면 법선을 면적 가중 평균. **위치가 같아도(seam 복제) 정점이 다르면
  따로 계산**하되, 같은 위치·같은 smoothingGroup 인 정점끼리는 노멀을 공유하도록 위치 해시
  (1e-7 격자)로 병합 그룹을 만든다. → seam 정점(UV 만 다름)은 노멀이 이어지고, crease 정점
  (그룹 다름)은 노멀이 갈라진다.
- `recalculateTangents()`: Atlas UV 기준 (D-9). 삼각형별 (dPos/dU, dPos/dV) 축적 →
  정점별 Gram-Schmidt 정규직교화, w = handedness. **Atlas UV 적용(Phase 2) 전에는 Local UV
  로 임시 계산**하고, `applyAtlasUV` 후 재계산을 호출하는 것이 규약.
- `calculateCurvature()`: 원본 §16.1 의 노멀 편차 근사. `cavity` = 이웃 평균 위치가 노멀
  방향으로 자기보다 위에 있는 정도(오목) + `fullerWeight` 반영은 부품 생성기가 수행.
- `build()` → `GeneratedMesh` (02§4). `uvAtlas` 는 이 시점엔 `uvLocal` 복사본.

검증: 단위 사각형 2삼각형으로 노멀/탄젠트 손계산 대조. crease 그룹이 다른 큐브에서
면 노멀 6종이 정확히 나오는지.

## Step 1.3 — 단면 프로파일 (`src/mesh/blade.js` 전반부)

원본 §7.1 의 `ProfilePoint` 에 crease 를 추가 (D-6):

```ts
interface ProfilePoint {
  x: number;            // ±폭 방향 (프레임 normal 축)
  y: number;            // ±두께 방향 (프레임 binormal 축)
  edgeWeight: number;
  ridgeWeight: number;
  fullerWeight: number;
  crease: boolean;      // true 면 이 점에서 스무딩 그룹이 갈라짐 (정점 복제)
}
```

`buildCrossSectionProfile(type, width, thickness, ridgeHeight, fuller, segmentCount)`:

- 4종 프로파일의 정점 배치 규칙 (둘레를 s=0 에서 시작해 CCW):
  - **diamond**: 꼭짓점 4개 — 날(±X, edgeWeight=1, crease), 능선(±Z 는 ridgeHeight 로 스케일,
    ridgeWeight=1, crease). 꼭짓점 사이는 직선 보간, 보간점은 가중치를 거리 기반 falloff
    (인접 꼭짓점 가중치의 선형 감쇠)로 받는다.
  - **lenticular**: 타원 둘레 샘플. 날 위치(±X)만 edgeWeight=1 + crease, 나머지 smooth.
  - **hexagonal**: 6 꼭짓점(날 2 + 평면 경계 4), 전부 crease. 평면 경계는 ridgeWeight 0.5.
  - **flat**: 사각형 + 날 방향 짧은 베벨. 4 crease.
- **fuller(홈)**: `fuller.enabled` 이고 `t ∈ [start, end]` 이면, 프로파일의 옆면 중앙 구간
  (|x| < fuller.width/2 에 해당하는 s 구간)을 y 방향으로 `fuller.depth × 깊이 프로파일(사인)`
  만큼 파고 해당 점의 fullerWeight = 파인 깊이 비율. **t 는 프로파일 함수의 인자로 전달**
  (링마다 프로파일이 달라짐).
- s=0 위치 = seam. **seam 은 날이 아니라 한쪽 능선/평면 뒤쪽에 고정** (원본 §7 의도 계승).
- 반환 배열 길이 = segmentCount (닫힌 루프, 마지막→첫 점 연결은 호출자가).
- `calculateProfileDistance(profile, i)`: s=0 부터 i 까지 둘레 실측 누적 거리 (uvMetric 용).

검증: 각 타입에서 둘레 폐곡선 면적 > 0, crease 수 일치, fuller 구간에서 fullerWeight 합 > 0.

## Step 1.4 — 링 스윕과 인덱싱 (`buildBladeMesh` 본체)

원본 §7.2 구조를 계승하되 다음이 다르다:

1. **정점 복제 규칙**: 링 하나에서 실제 생성되는 정점 수 =
   `segmentCount + 1 (seam 복제) + crease 수 (노멀 분리 복제)`.
   구현 단순화: 프로파일을 "정점 리스트 + 각 정점의 (s, smoothingGroup)" 로 미리 전개하는
   `expandProfile(profile)` 을 두고, crease 점은 (같은 위치, 이전 그룹)과 (같은 위치, 다음
   그룹) 2개로, seam 점은 s=0 과 s=1 2개로 전개한다. 링 간 인덱싱은 전개된 리스트 기준
   등간격이라 원본의 2중 루프 quad 연결이 그대로 성립한다.
2. **tip 처리 (D-2)**: `tipScale` 이 `tip.start` 이후 감소하는 것은 유지하되 **0 까지 가지
   않는다** — 마지막 일반 링은 `t = 1 - 1/ringCount`, `tipScale ≥ 0.15` 를 유지. 그 다음:
   - 폴 정점을 **전개 정점 수만큼 복제** 생성: 위치는 모두 칼끝 한 점, uvLocal 은
     `[1, (s_i + s_{i+1})/2]` (각 팬 삼각형의 s 중점), 노멀 그룹은 인접 정점 그룹 따라감.
   - 마지막 링과 폴 복제 정점들로 팬 삼각형 연결. → 3D 면적 있음, UV 면적 있음, degenerate 0.
   - `tip.type` 은 `tip.start~1` 구간의 tipScale 감쇠 곡선 모양으로 구현:
     needle=지수 감쇠, spear=선형, rounded=코사인.
3. **root 캡**: 칼날 뿌리는 가드/탱에 가려지므로 최소 처리 — 뿌리 링을 중심점 1개로 닫는
   팬. 중심점 uvLocal 은 별도 소영역이 필요하므로 `islandId = RootCap` 으로 표시하고
   uvLocal 은 `[0,0]~[1,1]` 의 원판 매핑(중심 [0.5,0.5], 링 정점은 각도 따라 원 둘레).
   Atlas 배치는 Phase 2 에서 이 아일랜드에 소영역을 준다.
4. `contactWeight`: 칼날은 `evaluateBladeContactWeight(t) = smoothstep(0.15, 0, t)` —
   뿌리 근처(가드 접촉)만 약간.
5. 마무리: `recalculateNormals()` → `calculateCurvature()` (탄젠트는 Atlas 적용 후).

검증 (vitest):
- 임의 프리셋 5종에서 non-manifold 0 (02§6 위치 병합 기준), 3D degenerate 0.
- 정점 수 = `(ringCount+1) × expandedCount + poleCount + capCount` 정확 일치.
- 같은 입력 2회 → `hashMesh` 동일.

## Step 1.5 — Local / Metric UV (같은 파일)

- `uvLocal = [t, s]` (원본 유지 — U=길이, V=둘레. 주의: 손잡이와 축 방향이 반대인 것은
  원본 정의를 그대로 따른다).
- `uvMetric = [physicalLength / 0.1, metricPerimeter / 0.1]` — 호길이 테이블과
  `calculateProfileDistance` 사용 (1단위 = 10cm).
- seam 복제 정점: s=1 쪽은 `uvLocal.v = 1`, `uvMetric.v = 둘레 전체 길이 / 0.1`.

검증: 원본 §31.3 — 길이 0.8 vs 1.6 칼날에서 `uvMetric` 의 단위 길이당 증가율 동일
(`estimateMetricPatternScale` = 인접 링 간 uvMetric.u 증가량 / 실거리).

## Step 1.6 — UV 검증기 (`src/uv/validate.js`)

02§6 의 정의를 그대로 구현. Phase 1 에서는 `uvAtlas = uvLocal` 상태로 돌린다
(칼날 단독이라 아일랜드는 Body + RootCap 2개 — RootCap 은 임시로 [0,0]~[0.1,0.1] 로 축소
배치해 overlap 을 피한다; 정식 배치는 Phase 2).

- `detectUVTriangleOverlaps` — 버킷팅 + SAT + 클리핑 면적.
- `countOutOfBoundsUVs`, `countDegenerateUVTriangles`, `measureMinimumIslandPadding`,
  `calculateTexelDensityDeviation` (방향별).
- `assertValidUV` — 원본 §13 차단 조건 유지.

검증: 의도적으로 겹친 2삼각형 케이스, 공유 엣지 인접 케이스(=overlap 0 이어야 함),
경계 밖 UV 케이스.

## Step 1.7 — 뷰어·UI·GLB (`src/app/`, `src/export/`)

- `viewer.js`: three.js 씬 — 회색 스튜디오 배경, 키/필/림 3점 조명 + 환경맵 없이 시작.
  `MeshStandardMaterial({metalness:0.9, roughness:0.35})` 임시 재질. 와이어프레임 토글,
  노멀 시각화 토글(crease 확인용), **UV 프리뷰 캔버스**(uvLocal 삼각형을 2D 로 그림 —
  이것은 표시 전용이라 Canvas 2D 허용).
- `panels.js`: BladeDesign 전 파라미터 슬라이더(길이·폭/두께 곡선 제어점·단면 타입·
  ridgeHeight·fuller·tip·세그먼트). 변경 → 디바운스 50ms → 재생성 → 뷰어 갱신.
  프리셋 드롭다운(golden 20종 로드) + design.json 다운로드/업로드.
- `export/glb.js`: GeneratedMesh → `THREE.BufferGeometry` (position/normal/tangent/uv=uvAtlas
  만 — 의미 속성 스트립, D-9) → GLTFExporter binary → 다운로드.

검증 (수동 + verify 스크립트):
- `npm run dev` 로 열어 diamond/lenticular/hexagonal/flat 4종 캡처 — 날 crease 가 선명한가,
  튜브처럼 뭉개지지 않는가 (D-6 의 눈 검증).
- 내보낸 GLB 를 https://gltf-viewer.donmccurdy.com 등 외부 뷰어에서 열어 확인.

## Step 1.8 — Golden 프리셋 20종 + 결정성 게이트

- `test/golden/blade-presets.json`: 20종 (직선 양날검 5, 세검 4, 대검 4, 단날 3, 판타지 4 —
  4개 단면 타입과 fuller 유무를 골고루).
- `test/golden/blade-hashes.json`: 프리셋별 `hashMesh` 기대값.
- vitest: 전 프리셋 생성 → 검증기 전체 통과 + 해시 일치 + 삼각형 수 ≤ 5,000/칼날.
- `npm run check` = vitest 전체. 이 게이트가 이후 모든 Phase 의 회귀 방지선이다.

## Phase 1 산출물 요약

| 파일 | 내용 |
|---|---|
| `src/core/*` | math, curve(RMF), rng, hash |
| `src/mesh/builder.js` | 스무딩 그룹 노멀, Atlas 기준 탄젠트, 곡률 |
| `src/mesh/blade.js` | 프로파일 4종 + fuller + 링 스윕 + 폴-팬 tip + root 캡 |
| `src/uv/validate.js` | overlap/degenerate/padding/밀도 — 02§6 정의 구현 |
| `src/app/*`, `src/export/glb.js` | 뷰어, 슬라이더, GLB 다운로드 |
| `test/*` | 결정성·검증·golden 20종 |
