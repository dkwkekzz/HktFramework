# 04 — Phase 2: 가드·손잡이·폼멜·조립·Atlas

전제: [02-architecture.md](02-architecture.md), Phase 1 완료. 원본 §8~§12 의 수정판.
핵심 변경: 가드 앞/뒷면 UV 분리(D-1), 폼멜 폴 처리(D-2 동일 규칙), Atlas 종횡비 보정(D-8).

## 목표

검 전체(칼날+가드+손잡이+폼멜)를 소켓으로 조립하고, 4부품을 하나의 고정 Atlas 에 배치,
전체 검증 통과 + GLB 출력.

완료 조건 (원본 §32 유지): 검 전체 조립 / 부품별 의미 UV 생성 / Atlas 경계 정상
(overlap 0 · padding ≥ 4텍셀 · 경계 밖 0).

## Step 2.1 — 손잡이 Sweep (`src/mesh/grip.js`)

원본 §8 을 거의 그대로 구현한다. 차이점만:

- `lengthSegments`·`radialSegments` 는 하드코딩(32/16) 대신 `GripDesign.segments` 로 노출
  (하드코딩 금지 관례).
- seam 복제(`j = radialSegments` 정점)는 칼날과 동일 규칙. 원통이라 crease 없음 —
  전체 스무딩 그룹 1개.
- 양 끝 캡: 위쪽은 가드에, 아래쪽은 폼멜에 가려지므로 **캡을 만들지 않는다**(열린 원통).
  non-manifold 검사에서 경계 엣지(1-삼각형 엣지)는 개방 경계로 허용하되, **개방 경계는
  부품별 기대 개수와 일치**해야 한다(손잡이 = 링 2개). 02§6 의 non-manifold 정의에 이
  예외를 반영해 구현한다.
- `uvMetric` 은 원본대로 1단위 = 5cm (손 근접 부품이라 밀도 2배).
- `contactWeight = evaluateGripContact(v)`: 중앙 0.8, 양 끝 0.4 (손이 잡는 곳).
- 가죽 감기(wrap)는 원본대로 메시가 아니라 머티리얼 마스크(Phase 3)로.

## Step 2.2 — 가드 Extrude (`src/mesh/guard.js`)

원본 §9 구조 + D-1 반영. 아일랜드 3개를 명시적으로 만든다:

- **앞면** (`islandId=GuardIsland.Front`): `triangulatePolygon(outline)` (ear-clipping,
  자체 구현 — 외부 의존 최소화. 단순 다각형 가정, 자기 교차 outline 은 입력 검증에서 거부).
  uvLocal = outline 을 [0,1]² 로 정규화한 좌표.
- **뒷면** (`Back`): 같은 삼각분할, z = -depth, 감김 반전. uvLocal 은 **U 를 미러**
  (`u' = 1 - u`) — Atlas 에서 앞면과 다른 영역에 가므로 겹치지 않는다 (D-1).
- **측면** (`Side`): outline 을 따라 quad 스트립. uvLocal = [윤곽 누적 거리 / 전체 둘레,
  깊이 0~1]. 윤곽 시작점이 seam (outline[0] 을 검 뒤쪽에 두는 것을 규약으로).
- **crease**: 앞면↔측면, 뒷면↔측면 경계는 항상 다른 스무딩 그룹(별도 아일랜드 = 별도
  정점이라 자동 분리). bevel 은 MVP 에서 **경사 1스텝**(outline 을 bevel 만큼 안쪽으로
  offset 한 링을 앞/뒤에 삽입) — offset 은 정점 노멀 방향 이동(miter), 오목 outline 에서
  자기 교차하면 bevel=0 으로 강등하고 경고.
- 의미값: edge/ridge/fuller = 0. `contactWeight`: 칼날 소켓 주변 0.6.
  `cavity`: bevel 안쪽 모서리 0.3.
- `uvMetric`: 앞/뒷면은 정규화 좌표 × (outline 실측 bbox / 0.1), 측면은 [누적 거리/0.1,
  depth/0.1].

검증: 볼록/오목 outline 프리셋 각 2종에서 검증기 통과, 외부 뷰어에서 노멀 방향 확인.

## Step 2.3 — 폼멜 Lathe (`src/mesh/pommel.js`)

원본 §10 의 `buildLatheMesh`. 회전축 = Y.

- `profile: Vec2[]` = (반지름, y) 폴리라인, 위(손잡이 쪽)에서 아래로.
- 프로파일 양 끝의 반지름이 0 이면 **칼끝과 동일한 폴-팬 규칙** (D-2): 폴 정점을 radial
  세그먼트 수만큼 복제, uvLocal.u = 각 팬 중점 각도.
- 반지름 0 이 아닌 위쪽 끝은 손잡이에 가려지므로 개방 경계 허용 (기대 개방 경계 1개).
- uvLocal = [회전 각도 0~1, 프로파일 누적 거리 0~1] (원본 uvRule 유지). seam 복제 동일.
- 프로파일 폴리라인의 꺾임각 > 40° 인 정점은 crease (스무딩 그룹 분리).
- `uvMetric`: [각도 × 해당 정점 반지름 / 0.05, 프로파일 누적 거리 / 0.05].

## Step 2.4 — 고정 Atlas 배치 (`src/uv/atlas.js`) — D-1·D-8 반영판

레이아웃은 **아일랜드 단위**다 (원본 §12 는 부품 단위였음):

```js
export const SWORD_ATLAS_LAYOUT = {
  // 칼날: 위쪽 절반. 길이(U)를 가로 전체에, 둘레(V)를 세로에 — 종횡비와 정렬 (D-8)
  "blade/body":    { offset: [0.00, 0.62], scale: [1.00, 0.38] },
  "blade/rootCap": { offset: [0.00, 0.52], scale: [0.08, 0.08] },

  // 가드: 앞/뒤/측면 분리 (D-1)
  "guard/front":   { offset: [0.10, 0.27], scale: [0.28, 0.23] },
  "guard/back":    { offset: [0.40, 0.27], scale: [0.28, 0.23] },
  "guard/side":    { offset: [0.70, 0.27], scale: [0.28, 0.10] },

  // 손잡이·폼멜: 아래 행
  "grip/body":     { offset: [0.00, 0.00], scale: [0.45, 0.25] },
  "pommel/body":   { offset: [0.47, 0.00], scale: [0.30, 0.25] },
};
// paddingPixels = 8 공통. 남는 영역은 향후(장식 메시 등) 예약.
```

`applyAtlasUV(mesh, textureSize)`:
- 아일랜드별로 uvLocal → 영역 내 배치. padding 축소는 원본 §12 공식 유지.
- **종횡비 보정 (D-8)**: 아일랜드의 실측 종횡비(= uvMetric bbox 비율)와 영역 종횡비를
  비교해, 영역 안에서 letterbox 배치(짧은 축을 축소)한다. 늘리지 않는다 — 텍셀 밀도의
  방향 간 불균형을 영역이 흡수하고, 남는 띠는 padding 으로 취급.
- 적용 후 `recalculateTangents()` **재호출** (탄젠트는 Atlas 기준 — D-9).

레이아웃 숫자는 초안이다 — Step 2.6 의 밀도 리포트를 보고 조정하되, **조정하면
generatorVersion 을 올리고 golden 을 갱신**한다.

## Step 2.5 — 소켓 조립 (`src/mesh/assembly.js`)

원본 §11 유지. 구체화:

- 각 부품 생성기는 자신의 소켓 Transform 을 메시와 함께 반환한다
  (`{ mesh, sockets: { name: {position, rotation} } }`).
  - blade: `guardSocket` = 뿌리 원점(-Y 방향), `gripSocket` = 뿌리에서 -Y 로 guard depth.
  - guard: `bladeSocket` = 앞면 중심, `gripSocket` = 뒷면 중심.
  - grip: `guardSocket` = 위 끝, `pommelSocket` = 아래 끝.
  - pommel: `gripSocket` = 프로파일 위 끝.
- `alignSockets(childPart, childSocket, parentPart, parentSocket)`: 부모 소켓 월드 변환에
  자식 소켓이 일치하도록 자식 루트 Transform 을 푼다 (`T_child = T_parentSocket ×
  T_childSocket⁻¹`).
- 조립 결과는 부품별 Transform 만 — 정점을 굽지 않는다(bake 시 uvAtlas 만 쓰므로 무관,
  실루엣 평가 시에는 Transform 적용해 투영).
- 부품 간 3D 겹침은 소켓 접합부에서 의도적(02§6) — self-intersection 검사는 부품 내부만.

## Step 2.6 — 전체 검증·뷰어 확장

- `mergeForValidation(parts)`: 4부품 uvAtlas 를 하나로 합쳐 02§6 전체 검사 실행
  (아일랜드 7개 전부에 대한 overlap/padding/밀도).
- 뷰어: 부품 토글, Atlas 프리뷰(아일랜드 색분리 표시), 소켓 gizmo 표시.
- UI: GuardDesign(outline 프리셋 4종 + depth/bevel), GripDesign, PommelDesign(프로파일
  프리셋 4종) 패널 추가. SwordDesign 전체의 저장/로드.
- golden: 완성 검 5종(원본 §31.6 유형) design.json + 해시. `npm run check` 에 포함.

## Phase 2 산출물 요약

| 파일 | 내용 |
|---|---|
| `src/mesh/grip.js` | Sweep + 개방 경계 규약 |
| `src/mesh/guard.js` | Extrude + 앞/뒤/측 3아일랜드 (D-1) + ear-clipping |
| `src/mesh/pommel.js` | Lathe + 폴-팬 (D-2) |
| `src/uv/atlas.js` | 아일랜드 단위 고정 레이아웃 + 종횡비 보정 (D-8) |
| `src/mesh/assembly.js` | 소켓 정렬 |
| golden | 완성 검 5종 |
