# 05 — Phase 3: 절차적 머티리얼과 CPU 베이크

전제: [02-architecture.md](02-architecture.md), Phase 2 완료. 원본 §14~§20 의 수정판.
핵심 변경: 베이크는 WebGL 이 아니라 **자체 CPU 래스터라이저** (D-4). 원본의 GLSL 셰이더
(§18)는 폐기가 아니라 **TS/JS 프래그먼트 함수의 사양서**로 계승한다 — 수식은 동일하게 이식.

## 목표

MaterialGraph(탄소강·청동·가죽) → 5채널(BaseColor/Normal/Roughness/Metallic/AO) CPU 베이크
→ dilate → ORM 패킹 → 뷰어에서 PBR 미리보기 → GLB 에 텍스처 포함 출력.

완료 조건 (원본 §32 유지): AI 없이 일관된 검 머티리얼 출력 / 형상 크기가 변해도 패턴
실측 크기 유지 / 같은 seed → 같은 텍스처 해시.

## Step 3.1 — 결정적 노이즈 (`src/core/noise.js`)

원본 §18.2 의 `hash21/valueNoise` 를 JS 로 이식 + 확장:

- `hash21(x, y, seed)` — 원본 수식 + seed 혼합. **Math.sin 기반 해시 금지**(엔진 편차) —
  원본의 fract/dot 방식은 곱셈·덧셈만이라 안전.
- `valueNoise2(x, y, seed)` — 원본 그대로 (smoothstep 보간).
- `fbm(x, y, octaves, lacunarity, gain, seed)`.
- `directionalNoise(x, y, angle, stretch, seed)` — 연마 흔적용: 좌표를 회전·비등방 스케일 후
  valueNoise (탄소강 microNormal 의 "directional_noise").
- `periodicValueNoise2(x, y, periodY, seed)` — 둘레 방향(V) 주기 버전: 격자 좌표를
  `mod(iy, periodY)` 로 감아 seam 불연속 제거 (D-10). 둘레 방향으로 타일되는 채널
  (microNormal·colorVariation)에 사용. 길이 방향은 비주기 유지.

검증: 같은 인자 → 같은 값(vitest 스냅샷), 주기 버전이 y=0 과 y=period 에서 연속.

## Step 3.2 — MaterialGraph·Primitive (`src/material/`)

원본 §14·§15 를 그대로 구현한다 (`SwordMaterialGraph`, `MaterialInstanceSpec`,
`SurfaceState`, `CARBON_STEEL`, `BRONZE` + `LEATHER` 추가):

```js
export const LEATHER = {
  id: "leather",
  baseColor: [0.30, 0.18, 0.10],
  metallic: 0.0,
  roughness: 0.75,
  microNormal:   { type: "fbm", scale: 60, strength: 0.12, seedOffset: 101 },
  colorVariation:{ type: "fbm", scale: 6,  strength: 0.06, seedOffset: 103 },
  rules: {
    edgePolishResponse: 0.0,
    cavityOxidationResponse: 0.15,   // 가죽은 산화 대신 때 축적으로 해석
    moistureRoughnessResponse: -0.35,
    scratchNormalResponse: 0.2,
  },
};
```

- `compileSurfaceGraph({parts, materialGraph, seed})` (`compile.js`):
  MaterialGraph + Operation 로그(Phase 4 전까지는 빈 배열)를 **부품별 베이크 입력**으로
  변환 — 프래그먼트 함수가 참조할 uniform 묶음(물질 상수, 상태값, 파생 seed, 감기 마스크
  파라미터 등)을 만든다. 파생 seed = `deriveSeed(seed, partName + primitiveId)`.
- 가죽 감기 마스크(원본 §8): `wrapMask(u, v) = triangleWave(fract(v × turns + u))` 를 손잡이
  프래그먼트에서 평가 — 감기 골은 cavity 가산 + 높이 필드 감산.

## Step 3.3 — CPU 래스터라이저 (`src/bake/raster.js`) — D-4 의 핵심

UV 공간 베이크 = 2D 삼각형 래스터라이즈 + 정점 속성 보간 + 프래그먼트 함수 평가.

```js
/**
 * @param mesh    GeneratedMesh (uvAtlas 기준)
 * @param size    텍스처 한 변 (512|1024|2048)
 * @param shade   (frag) => void — frag 에 결과 기록
 * @param targets { name: Float32Array(size*size*4) }  누적 대상
 */
export function rasterizeUV(mesh, size, shade, targets) { ... }
```

- 삼각형별: uvAtlas × size 로 픽셀 좌표 → AABB 순회 → edge function 3개로 내부 판정
  (top-left rule 로 공유 엣지 이중 채움 방지 — **이 규칙이 결정성의 일부**이므로 명시 구현).
- 무게중심 좌표로 보간하는 속성: uvMetric, uvLocal, 의미값 6종, curvature, cavity,
  partId/islandId (평면 보간 아님 — 삼각형의 첫 정점 값 그대로, 정수 속성이므로).
- `frag` 컨텍스트: `{ x, y, uvAtlas, uvLocal, uvMetric, partId, islandId, edgeWeight, ...,
  out: {...} }`. 프래그먼트 함수는 순수 — 전역 상태 금지, 노이즈는 core/noise 만.
- 커버리지 버퍼(Uint8Array)를 함께 기록 — dilate 와 "빈 영역" 판정에 사용.
- 내부 계산 Float32Array(고정밀 필요 채널은 Float64 로 계산 후 기록), 최종 양자화는
  pack 단계에서 한 번만 (이중 양자화 금지).

성능: 1024², 검 전체 ~8k 삼각형, 5채널 → Web Worker 1개에서 목표 < 5초.
채널별 재래스터 대신 **한 번 순회하며 모든 채널을 같이 평가**한다(보간 비용 공유) —
원본 §19 의 "채널별 순차 렌더"는 GPU 전제였으므로 대체.

## Step 3.4 — 채널 프래그먼트 함수 (`src/bake/channels.js`)

원본 §18.3~18.5 수식을 이식. 각 함수는 물질 uniform + frag 입력 → 채널 값:

- `shadeBaseColor`: 원본 §18.3 — colorVariation 노이즈(주기 버전, uvMetric 기준) +
  oxidation/dirt 마스크 mix. **sRGB 로 기록**(pack 단계에서 감마 처리 명시).
- `shadeRoughness`: 원본 §18.4 — polish/oxidation/moisture 반영, clamp [0.04, 1].
- `shadeMetallic`: 원본 §18.5.
- `shadeHeight`: 높이 필드(Float32) — microNormal 노이즈 + fuller 프로파일 + 감기 골 +
  (Phase 4) 긁힘·조각. Normal 은 §3.5 에서 변환.
- `shadeAO`: D-7 근사 — `1 - clamp(cavity × 0.7 + fullerWeight × 0.3 + wrapGroove × 0.4, 0, 0.85)`.
  (레이캐스트 AO 는 Phase 7 선택 항목.)

물질 선택: `partId` → materialGraph 의 부품별 MaterialInstanceSpec.

## Step 3.5 — Normal 변환·dilate·패킹 (`src/bake/`)

- `normalmap.js`: 원본 §20 의 heightToNormal 이식. 주의 —
  - 경계 샘플은 **같은 아일랜드 내부로 클램프**(커버리지 버퍼 참조). 아일랜드 밖 높이를
    읽으면 seam 에 가짜 경사가 생긴다.
  - strength 는 실측 기반: `strength = heightScale(m) / texelSize(m)` — 텍셀 실측 크기는
    uvMetric 밀도에서 파생. 형상이 커져도 노멀 강도가 유지된다.
  - 출력은 탄젠트 공간 — 래스터 시 보간한 uvAtlas 축과 탄젠트 축이 일치(D-9)하므로
    화면 축 편미분 = 탄젠트 공간 편미분.
- `dilate.js`: 원본 §19 의 dilateTexturePadding — 커버리지 기반 1픽셀 확장 × 8회.
  아일랜드 간 침범 방지: 확장 시 islandId 버퍼도 함께 기록, 다른 아일랜드가 이미 쓴 텍셀엔
  쓰지 않음.
- `pack.js`: ORM 패킹 (R=AO, G=Roughness, B=Metallic — 원본 §2.2), BaseColor 는 sRGB
  8bit, Normal/ORM 은 linear 8bit. PNG 인코딩은 자체 무압축(또는 고정 설정) 인코더 —
  해시 대상은 인코딩 전 픽셀 버퍼(02§5).

## Step 3.6 — Worker 통합·뷰어 PBR·GLB

- `src/app/` 에 "Bake" 버튼: SwordDesign + MaterialGraph 를 Worker 로 전송(구조화 복제),
  진행 콜백(채널·행 단위), 완료 시 텍스처를 뷰어 재질에 장착
  (`map/normalMap/aoMap/roughnessMap/metalnessMap` + `configureORMChannels` — three 는
  channel 지정으로 ORM 공유).
- 이중 조명 모드(원본 §23 선행 구현): 중립 스튜디오(고정 3점 조명) ↔ 자유 회전.
  BaseColor 단독 표시 토글("그림자가 색에 구워졌는가" 눈 검사용).
- GLB: 텍스처 포함 내보내기 (KTX2 는 Phase 7).

## Step 3.7 — 테스트·golden

- 원본 §31.5: 같은 seed 2회 베이크 → 픽셀 버퍼 해시 동일 (Node 에서 실행 — 래스터라이저가
  순수 JS 라 가능; 이것이 D-4 의 이득).
- 원본 §31.3 확장: 길이 0.8 vs 1.6 검에서 noise 패턴의 실측 주기 동일(샘플 라인 FFT 또는
  자기상관으로 주기 추정).
- golden 5종 검 × 3물질 배치의 텍스처 해시.
- 성능 회귀: 1024² 5채널 베이크 시간 기록(assert 는 하지 않되 리포트).

## Phase 3 산출물 요약

| 파일 | 내용 |
|---|---|
| `src/core/noise.js` | 결정적 노이즈 (주기 버전 포함, D-10) |
| `src/material/*` | Primitive 3종, MaterialGraph, compile |
| `src/bake/raster.js` | CPU UV 래스터라이저 (top-left rule, D-4) |
| `src/bake/channels.js` | 원본 §18 수식의 JS 이식 + AO 근사 (D-7) |
| `src/bake/normalmap.js, dilate.js, pack.js` | 아일랜드 인지 후처리 |
| Worker + 뷰어 PBR | 베이크 UI·이중 조명 |
