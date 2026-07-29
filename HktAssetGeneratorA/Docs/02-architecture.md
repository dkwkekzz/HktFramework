# 02 — 수정 반영 아키텍처 (공통 규약)

원본 설계에 [01-review.md](01-review.md) 의 결정 D-1~D-12 를 반영한 **구현 기준 문서**.
모든 Phase 문서(03~08)는 이 문서의 타입·규약·검증 정의를 전제로 한다.
Phase 문서와 이 문서가 어긋나면 **이 문서가 우선**하고, 어긋남 자체를 STATE.md 에 기록한다.

## 1. 시스템 정의 (원본 §1 계승)

```text
참조 이미지에서 자산의 구조적 제약을 추출하고,
도메인별 생성기 안에서 형상 파라미터를 최적화하며,
메시와 표면 의미 좌표를 동시에 생성하고,
물질·제작·사용 상태를 PBR 채널로 결정적으로 변환하는
게임용 3D 자산 제작 시스템
```

5원칙(원본 §1)은 전부 유지. 추가로 이 트랙의 **결정성 계약**을 6번째 원칙으로 둔다:

> **원칙 6. 결정적 산출물 경로에는 GPU·Canvas 2D·시각 API 를 쓰지 않는다.**
> 메시 버퍼와 베이크 텍스처는 자체 CPU 코드만으로 만든다 (D-4, D-5).
> GPU(three.js)는 미리보기·평가용 렌더에만 쓴다.

## 2. 트랙 구조 (D-12)

브라우저 우선, 단일 폴더, 무-프레임워크. 서버·AI 워커는 Phase 6+ 에서 필요가 생기면 도입.

```text
HktAssetGeneratorA/
├─ CLAUDE.md            트랙 가이드 (얇게)
├─ STATE.md             현황·다음 작업 (매 세션 갱신)
├─ Docs/                본 설계 문서들 (00~08)
├─ index.html           앱 진입
├─ package.json         vite + three + vitest, engines 로 Node 버전 고정
├─ src/
│  ├─ core/             math(vec/mat), curve, rng, hash, noise  ← 결정 코드의 뿌리
│  ├─ mesh/             MeshBuilder, blade.js, guard.js, grip.js, pommel.js, assembly.js
│  ├─ uv/               atlas.js(레이아웃·적용), validate.js(overlap·padding·밀도)
│  ├─ material/         primitives.js, operations.js, compile.js (MaterialGraph→베이크 입력)
│  ├─ bake/             raster.js(CPU 래스터라이저), channels.js, dilate.js, normalmap.js, pack.js
│  ├─ eval/             silhouette.js(CPU 투영·IoU), metrics.js, quality.js
│  ├─ export/           glb.js (three GLTFExporter 래핑 + 속성 스트립)
│  ├─ app/              viewer.js, panels.js, state.js (순수 DOM UI)
│  └─ verify/           check 스크립트 (캡처·해시 게이트)
└─ test/                vitest — geometry/ uv/ bake/ golden/
```

- `src/core`~`src/eval` 은 **DOM·three.js 를 import 하지 않는다**(순수 계산 — Node 테스트 가능).
  three.js 의존은 `src/export`, `src/app` 에만 허용.
- 원본 §4 의 packages 논리 경계는 위 디렉터리 경계로 계승. 실제 패키지 분리는 다른 도메인
  생성기(창·도끼)가 생길 때(Phase 8) 수행.
- 언어: JS(ES 모듈) + JSDoc 타입 주석. 리포 관례상 TS 빌드 체인 없이 시작한다.
  (아래 타입 정의는 TS 표기를 사양 언어로 쓴다 — 구현은 JSDoc 로 대응.)
- 주석 한국어, 튜닝 노브는 하드코딩 금지(UI 슬라이더/파라미터로 노출 — UE CVar 관례의 웹 대응).

## 3. 좌표·단위 규약

- 단위: **미터**. 검은 +Y 가 칼끝 방향, 칼날 폭이 ±X, 두께가 ±Z. 원점 = 칼날 뿌리(가드 접합점).
- 부품 메시는 각자 로컬 원점에서 생성하고 소켓 정렬(assembly)로 배치한다 (원본 §11).
- 삼각형 감김: 바깥에서 볼 때 CCW.
- glTF 출력 시 +Y up 유지(glTF 규약과 일치).

## 4. 핵심 데이터 구조 (원본 §6 확장판)

```ts
export interface GeneratedMesh {
  positions: Float32Array;   // 3 * vertexCount
  normals: Float32Array;     // 3 * vertexCount — crease 분리 반영 (D-6)
  tangents: Float32Array;    // 4 * vertexCount — Atlas UV 기준, w = handedness (D-9)
  indices: Uint32Array;

  uvLocal: Float32Array;     // 2 * vertexCount — 부품 논리 좌표 0~1
  uvAtlas: Float32Array;     // 2 * vertexCount — 최종 텍스처 좌표
  uvMetric: Float32Array;    // 2 * vertexCount — 1단위 = 10cm (칼날/가드), 5cm (손잡이/폼멜)

  attributes: {
    partId: Float32Array;
    islandId: Float32Array;      // [추가] UV 아일랜드 구분 (가드 앞/뒤/측면, 캡 등 — D-1, D-2)

    longitudinal: Float32Array;  // t (칼날 뿌리→끝 0~1)
    perimeter: Float32Array;     // s (단면 둘레 0~1)

    edgeWeight: Float32Array;
    ridgeWeight: Float32Array;
    fullerWeight: Float32Array;
    contactWeight: Float32Array;

    curvature: Float32Array;     // 노멀 편차 근사 (원본 §16.1)
    cavity: Float32Array;        // 오목 근사 — 곡률 음수 성분 + fuller
  };

  bounds: Bounds3;
}
```

원본과의 차이: `islandId` 추가. 아일랜드 = "UV 상 연결된 삼각형 집합". overlap 검사·padding
측정·dilate 가 전부 아일랜드 단위로 동작한다.

### PartId / IslandId

```ts
export const PartId = { Blade: 0, Guard: 1, Grip: 2, Pommel: 3 };

// islandId 는 부품 내 일련번호. 예: 가드 = { Front: 0, Back: 1, Side: 2 },
// 칼날 = { Body: 0, RootCap: 1 } (tip 팬은 Body 에 연속 — 폴 정점 복제로 연결 유지)
```

### 3종 UV 의 역할 (원본 §6 계승)

| UV | 생성 시점 | 용도 |
|---|---|---|
| `uvLocal` | 부품 생성기 | Operation/문양 배치의 논리 공간 (부품마다 0~1) |
| `uvAtlas` | `applyAtlasUV` | 베이크 래스터 위치 + 런타임 샘플링 + 탄젠트 기준 |
| `uvMetric` | 부품 생성기 | 노이즈·긁힘·연마 패턴의 실측 타일링 (형상 크기 불변) |

## 5. 결정성 계약 (D-4, D-5 + 잔여 조건)

1. 결정 경로(core/mesh/uv/material/bake/eval)는 **자체 코드만** — GPU, Canvas 2D, WebGL,
   외부 이미지 디코더 사용 금지. (PNG 인코딩은 자체 또는 결정적 라이브러리로 — 픽셀 버퍼가
   해시 대상이므로 인코딩 결과 자체는 해시하지 않아도 됨.)
2. 난수는 전부 seeded RNG 하나로: `mulberry32(seed)` (32bit, 충분). 파생 seed 는
   `seed ^ fnv1a(scopeName)` 로 만든다 — 호출 순서가 바뀌어도 scope 별 스트림이 안정.
3. 해시: `fnv1a64` 를 TypedArray 바이트에 적용. 메시 해시 = positions·normals·tangents·
   indices·uv 3종·attributes 순서 고정 연결. 텍스처 해시 = RGBA 픽셀 버퍼.
4. 시간·`Math.random`·로캘 의존 API 를 결정 경로에서 금지.
5. golden 해시의 기준 실행은 **Node(vitest), package.json `engines` 버전** — 브라우저 실행과의
   일치는 목표가 아니라 관찰 대상.
6. `generatorVersion` 문자열을 모든 산출물에 기록. 생성 알고리즘이 바뀌면 버전을 올리고
   golden 해시를 갱신한다(갱신 커밋에 사유 명시).

## 6. 검증 정의 (D-2, D-3 — 원본 §13 의 미정의 해소)

### UV overlap
- 대상: 같은 메시(부품 병합 후) 내 모든 삼각형 쌍 중 **정점을 하나도 공유하지 않는** 쌍.
- 판정: Atlas UV 공간에서 SAT(분리축) 교차 검사 → 교차 시 클리핑으로 교차 다각형 면적 계산.
- overlap 카운트 조건: 교차 면적 > `(0.5 텍셀)² = (0.5 / textureSize)²`.
- 가속: 텍셀 그리드 버킷팅(삼각형 AABB → 버킷) — O(n²) 전수 비교 금지.

### degenerate 삼각형
- 3D degenerate: 면적 < 1e-10 m². **생성기가 만들면 버그** — 폴은 팬 구조라 면적이 있다 (D-2).
- UV degenerate: Atlas UV 면적 < `(0.25 텍셀)²`. 검출 시 빌드 차단(원본 §13 유지).

### padding
- 아일랜드별 Atlas 상 최소 간격(텍셀). 아일랜드 경계 엣지 간 최소 거리로 측정.
- 차단 기준: < 4 텍셀 (원본 유지). dilate 반복 횟수(8)와 mipmap 레벨을 고려한 값.

### texel density (D-8)
- 삼각형별로 U 방향/V 방향 밀도(텍셀/미터)를 따로 계산. 부품 내 중앙값 대비 편차를
  방향별로 보고. 차단 기준(초기): 같은 부품 내 방향별 편차 > 2.0배. 방향 간(이방성)은
  경고만 — 칼날은 구조적으로 이방성이 있고 D-8 보정으로 완화한다.

### non-manifold / self-intersection (원본 §27)
- non-manifold: 3개 이상 삼각형이 공유하는 엣지 수. **위치 기준 병합 후** 계산한다 —
  seam/crease 로 복제된 정점은 위치 해시(1e-7 격자)로 같은 정점으로 본다.
- self-intersection: 부품 내 비인접 삼각형 쌍의 3D 교차(BVH 가속). 부품 **간** 교차는
  소켓 접합부에서 의도적(끼워 넣기)이므로 검사 대상이 아니다.

## 7. 파이프라인 (수정판)

원본 §24 의 스테이지를 유지하되 실행 주체가 전부 브라우저(+Web Worker)다.

```text
[입력] SwordDesign (Phase 1~4: UI 슬라이더 / Phase 5: 참조 이미지 최적화 결과)
   ↓ mesh/            부품 4종 생성 — 메시·의미값·Local/Metric UV 동시 (§원칙 2)
   ↓ uv/              고정 Atlas 배치(D-1 서브영역, D-8 보정) → 검증(§6) → 실패 시 차단
   ↓ material/        MaterialGraph + Operation 로그 → 베이크 입력으로 컴파일
   ↓ bake/  [Worker]  CPU 래스터라이저로 5채널 합성(D-4) → dilate → ORM 패킹
   ↓ eval/            CPU 실루엣·품질 지표 + (미리보기) three.js 이중 조명 렌더
   ↓ export/          의미 속성 스트립(D-9) → GLB → (Phase 7) KTX2·LOD
[출력] GLB + PNG/KTX2 + design.json + operations.json + quality.json + seed + generatorVersion
```

프로젝트 저장(MVP): `design.json` + `operations.json` + seed 를 localStorage 및 파일
다운로드/업로드로. 원본 §29 의 HTTP API 는 서버 도입 시(08 문서) 같은 형태로 승격한다.

## 8. 성능 예산

- 메시: 부품 4종 합계 ≤ 15,000 삼각형 (원본 유지). 기본 세그먼트로는 ~4,000 수준을 목표.
- 베이크: 1024² × 5채널, Web Worker 1개에서 < 5초 (초과 시 스캔라인 최적화·타일 분할).
- 파라미터 슬라이더 조작 → 메시 재생성 미리보기: < 100ms (베이크는 명시적 버튼으로).
- Phase 5 최적화 1 후보 평가(실루엣만): < 20ms (256² 마스크 래스터).

## 9. 문서 지도

| 문서 | 내용 |
|---|---|
| [00-original-design.md](00-original-design.md) | 원본 설계 (변경 금지) |
| [01-review.md](01-review.md) | 검토·결정 D-1~D-12 |
| **02 (본 문서)** | 공통 규약·데이터 모델·검증 정의 |
| [03-phase1-blade.md](03-phase1-blade.md) | Phase 1 — 칼날 생성기 (코어 수학 포함) |
| [04-phase2-parts-assembly.md](04-phase2-parts-assembly.md) | Phase 2 — 가드·손잡이·폼멜·조립·Atlas |
| [05-phase3-material-bake.md](05-phase3-material-bake.md) | Phase 3 — 머티리얼·CPU 베이크 |
| [06-phase4-surface-state.md](06-phase4-surface-state.md) | Phase 4 — 표면 상태 Operation |
| [07-phase5-reference-fit.md](07-phase5-reference-fit.md) | Phase 5 — 참조 이미지 형상 맞춤 |
| [08-phase6-plus.md](08-phase6-plus.md) | Phase 6~8 — AI 보조·빌드 최적화·도메인 확장 |
