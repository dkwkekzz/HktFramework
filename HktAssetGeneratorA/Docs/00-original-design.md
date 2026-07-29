# 00 — 원본 설계 (변경 금지)

> 이 문서는 트랙 생성 시 입력된 설계 원본을 **그대로** 보존한 것이다.
> 수정·주석 추가 금지. 검토 의견은 [01-review.md](01-review.md),
> 수정 반영 설계는 [02-architecture.md](02-architecture.md) 이후 문서를 볼 것.

---

이미지 감독 기반 3D 자산 생성 시스템
의미 UV와 절차적 머티리얼을 포함한 웹 기반 전체 파이프라인 코드 설계

## 0. 문서의 목적

이 시스템은 임의의 이미지에서 완성된 3D 메시와 텍스처를 한 번에 생성하는 범용 AI 모델을 목표로 하지 않는다.
현재 상용 이미지→3D 도구가 안정적으로 해결하지 못하는 문제는 다음과 같다.

```text
임의 메시의 의미 있는 UV 절개
여러 시점에서 일관된 텍스처 생성
조명과 실제 표면색의 분리
BaseColor·Normal·Roughness·Metallic의 물리적 일관성
가려진 뒷면의 복원
생성 결과의 국소 수정
동일 조건에서의 결과 재현
```

본 시스템은 이 문제를 더 강한 생성형 AI로 직접 해결하지 않는다.
대신 문제를 다음처럼 제한한다.

```text
임의 메시
→ 범용 자동 UV
→ AI 완성 텍스처
```

가 아니라,

```text
도메인별 생성 규칙
→ 메시와 의미 좌표를 동시에 생성
→ 검증된 기본 머티리얼과 절차 규칙으로 PBR 합성
→ AI는 구조 판단과 제한된 문양 생성만 담당
```

첫 번째 구현 대상은 검이다.

```text
참조 검 이미지
→ 구조 분석
→ 파라메트릭 검 생성
→ 생성과 동시에 의미 UV 생성
→ 공유 금속·가죽 머티리얼 적용
→ 형상과 제작 상태로 표면 마스크 계산
→ 절차적으로 PBR 텍스처 합성
→ 렌더 비교
→ 파라미터 수정
→ GLB·KTX2 출력
```

## 1. 시스템의 핵심 정의

이 시스템의 정확한 정의는 다음과 같다.

```text
참조 이미지에서 자산의 구조적 제약을 추출하고,
도메인별 생성기 안에서 형상 파라미터를 최적화하며,
메시와 표면 의미 좌표를 동시에 생성하고,
물질·제작·사용 상태를 PBR 채널로 결정적으로 변환하는
게임용 3D 자산 제작 시스템
```

핵심 원칙은 다섯 가지다.

### 원칙 1. AI가 정점을 직접 생성하지 않는다

AI는 다음을 판단한다.

```text
어떤 자산 유형인가
어떤 부품으로 구성되는가
어떤 생성 템플릿을 선택할 것인가
어떤 구조 가설을 사용할 것인가
어떤 문양과 스타일이 필요한가
어떤 파라미터를 조정해야 하는가
```

결정적 코드가 다음을 수행한다.

```text
정점 생성
인덱스 생성
법선 생성
UV 생성
표면 의미값 생성
머티리얼 합성
텍스처 베이크
GLB 출력
```

### 원칙 2. 임의 메시를 자동 언랩하지 않는다

검 생성기가 메시를 생성할 때 다음을 함께 생성한다.

```text
정점 위치
법선
탄젠트
부품 ID
길이 방향 좌표
단면 둘레 좌표
미터 단위 표면 좌표
날·능선·홈·접촉 부위 의미값
```

UV는 메시가 완성된 뒤 추측하는 정보가 아니다.

```text
메시와 UV는 동일한 파라미터 공간에서 동시에 생성된다.
```

### 원칙 3. AI가 완성 PBR 이미지를 생성하지 않는다

최종 표면은 다음 요소의 합성 결과다.

```text
기본 물질
+ 미세 표면
+ 형상 의미 마스크
+ 제작 흔적
+ 손상 흔적
+ 오염과 산화
+ 고유 문양
+ 현재 런타임 상태
```

AI 이미지 생성은 다음에만 제한적으로 사용한다.

```text
흑백 문양 마스크
룬
문장
장식 패턴
반점 분포
미세 표면 후보
```

### 원칙 4. 외형 설계와 제작 이력을 분리한다

```text
DesignGraph:
최종 형상과 부품 구조

ProcessGraph:
가열·단조·연마·조립·손상 과정

MaterialGraph:
물질과 표면 상태의 시각화 규칙
```

형상 최적화는 먼저 `DesignGraph`를 대상으로 수행한다.
완성된 형상을 얻은 뒤 `ProcessGraph`를 생성하거나 검증한다.

### 원칙 5. 모든 결과는 재현 가능해야 한다

```text
생성기 버전
+ 입력 Spec
+ seed
+ Operation 로그
=
동일한 메시와 동일한 텍스처
```

## 2. 첫 MVP의 현실적인 범위

첫 MVP는 모든 무기나 생물을 지원하지 않는다.

지원 대상:

```text
대칭 또는 준대칭 직선형 검
파라메트릭 칼날
2D 윤곽 Extrude 방식 가드
원통 또는 곡선 Sweep 방식 손잡이
회전체 방식 폼멜
탄소강·청동·가죽 머티리얼
```

지원하지 않는 대상:

```text
복잡한 기계식 무기
자유형 조각상 수준의 가드
천과 머리카락
임의 토폴로지 메시
사진 한 장에서 정확한 뒷면 복원
완전 자동 PBR 역추정
```

### 2.1 입력

```ts
export interface CreateSwordProjectInput {
  name: string;

  referenceImages: {
    id: string;
    url: string;
    view:
      | "front"
      | "side"
      | "back"
      | "three_quarter"
      | "unknown";
  }[];

  description?: string;

  constraints: {
    maximumTriangles: number;
    textureSize: 512 | 1024 | 2048;
    targetPlatform: "web_mobile" | "web_desktop";
  };
}
```

### 2.2 출력

```ts
export interface SwordBuildOutput {
  glbPath: string;

  textures: {
    baseColor: string;
    normal: string;
    orm: string;
    emissive?: string;
  };

  projectSpecPath: string;
  operationLogPath: string;
  qualityReportPath: string;

  generatorVersion: string;
  seed: number;
}
```

`ORM` 텍스처는 다음처럼 채널을 패킹한다.

```text
R = Ambient Occlusion
G = Roughness
B = Metallic
```

## 3. 전체 아키텍처

초기 MVP에서는 분산 서비스 구조를 사용하지 않는다.

```text
┌─────────────────────────────────────────────┐
│              Web Editor                     │
│                                             │
│ React UI                                    │
│ Three.js Viewer                             │
│ Reference Overlay                           │
│ Parameter Editor                            │
│ UV Preview                                  │
│ Material Preview                            │
│ Pipeline Timeline                           │
└─────────────────────┬───────────────────────┘
                      │
                      │ HTTP / WebSocket
                      ▼
┌─────────────────────────────────────────────┐
│          Node.js Pipeline Server             │
│                                             │
│ Project Store                               │
│ Pipeline Orchestrator                       │
│ Geometry Generator                          │
│ Material Compiler                           │
│ Texture Baker                               │
│ Evaluator                                   │
│ GLB Builder                                 │
└─────────────────────┬───────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌───────────────────┐   ┌────────────────────┐
│ Optional AI Worker │   │ Build Tool Worker  │
│                    │   │                    │
│ Part segmentation  │   │ KTX2 compression   │
│ Template selection │   │ Mesh optimization  │
│ Ornament mask      │   │ GLB validation     │
│ Visual critique    │   │ LOD generation     │
└───────────────────┘   └────────────────────┘
```

### 3.1 권장 기술 스택

웹 클라이언트

```text
TypeScript
React
Vite
Three.js
Zustand
WebSocket
Web Worker
```

파이프라인 서버

```text
Node.js
TypeScript
Fastify
Zod
Worker Threads
파일 기반 프로젝트 저장소
```

선택적 AI 워커

```text
Python
FastAPI
OpenCV
ONNX Runtime 또는 PyTorch
```

출력 도구

```text
glTF Transform 계열 도구
meshoptimizer
Basis Universal 또는 KTX-Software
```

초기에는 PostgreSQL·Redis·BullMQ를 사용하지 않는다.

```text
projects/{projectId}/project.json
projects/{projectId}/states/
projects/{projectId}/renders/
projects/{projectId}/textures/
projects/{projectId}/build/
```

형태의 파일 저장으로 충분하다.

## 4. 저장소 구조

```text
asset-evolution/
├─ apps/
│  ├─ web-editor/
│  │  ├─ src/
│  │  │  ├─ viewer/
│  │  │  │  ├─ SwordViewer.ts
│  │  │  │  ├─ ReferenceOverlay.ts
│  │  │  │  ├─ UVPreview.ts
│  │  │  │  └─ MaterialPreview.ts
│  │  │  ├─ panels/
│  │  │  ├─ state/
│  │  │  ├─ api/
│  │  │  └─ main.tsx
│  │  └─ package.json
│  │
│  └─ pipeline-server/
│     ├─ src/
│     │  ├─ api/
│     │  ├─ projects/
│     │  ├─ pipeline/
│     │  ├─ geometry/
│     │  ├─ materials/
│     │  ├─ baking/
│     │  ├─ evaluation/
│     │  ├─ build/
│     │  └─ server.ts
│     └─ package.json
│
├─ packages/
│  ├─ domain/
│  ├─ sword-generator/
│  ├─ geometry-core/
│  ├─ material-core/
│  ├─ texture-baker/
│  ├─ evaluation-core/
│  └─ protocol/
│
├─ workers/
│  └─ ai-worker/
│     ├─ app/
│     │  ├─ segmentation/
│     │  ├─ target_spec/
│     │  ├─ ornament/
│     │  └─ critique/
│     └─ pyproject.toml
│
├─ tools/
│  ├─ compress-textures.ts
│  ├─ optimize-glb.ts
│  └─ validate-build.ts
│
└─ tests/
   ├─ geometry/
   ├─ uv/
   ├─ materials/
   ├─ baking/
   ├─ pipeline/
   └─ golden/
```

## 5. 핵심 도메인 모델

### 5.1 프로젝트

```ts
export interface AssetProject {
  id: string;
  name: string;
  category: "sword";

  status:
    | "created"
    | "reference_ready"
    | "designing"
    | "texturing"
    | "evaluating"
    | "building"
    | "completed"
    | "failed";

  seed: number;
  generatorVersion: string;

  referenceSpec: ReferenceSpec;
  targetSpec?: SwordTargetSpec;
  design?: SwordDesign;
  process?: SwordProcess;
  materialGraph?: SwordMaterialGraph;

  currentRevision: number;

  createdAt: string;
  updatedAt: string;
}
```

### 5.2 참조 이미지 정보

```ts
export interface ReferenceSpec {
  images: ReferenceImage[];

  manuallyConfirmed: {
    objectMask: boolean;
    bladeEndpoints: boolean;
    partBoundaries: boolean;
    camera: boolean;
  };
}

export interface ReferenceImage {
  id: string;
  path: string;

  view:
    | "front"
    | "side"
    | "back"
    | "three_quarter"
    | "unknown";

  width: number;
  height: number;

  objectMaskPath?: string;
  partMaskPath?: string;

  landmarks?: Landmark2D[];
  camera?: CameraEstimate;
}
```

### 5.3 목표 명세

```ts
export interface SwordTargetSpec {
  parts: {
    blade: TargetPartSpec;
    guard: TargetPartSpec;
    grip: TargetPartSpec;
    pommel: TargetPartSpec;
  };

  silhouetteTargets: SilhouetteTarget[];
  landmarks: LandmarkConstraint[];
  materialTargets: MaterialTargetSpec[];

  hiddenStructureHypotheses: HiddenStructureHypothesis[];
}
```

### 5.4 형상 설계 그래프

```ts
export interface SwordDesign {
  blade: BladeDesign;
  guard: GuardDesign;
  grip: GripDesign;
  pommel: PommelDesign;

  assembly: SwordAssembly;
}
```

```ts
export interface BladeDesign {
  length: number;

  centerCurve: Curve3Spec;
  widthCurve: Curve1Spec;
  thicknessCurve: Curve1Spec;

  crossSection:
    | "flat"
    | "diamond"
    | "lenticular"
    | "hexagonal";

  ridgeHeight: number;

  fuller?: {
    enabled: boolean;
    start: number;
    end: number;
    width: number;
    depth: number;
  };

  tip: {
    type: "needle" | "spear" | "rounded";
    start: number;
    endScale: number;
  };

  segments: {
    longitudinal: number;
    crossSection: number;
  };
}
```

```ts
export interface GuardDesign {
  outline: Vec2[];
  depth: number;
  bevel: number;
  symmetry: "bilateral";
}

export interface GripDesign {
  length: number;
  startRadius: number;
  endRadius: number;
  curvature: Curve3Spec;

  wrap: {
    enabled: boolean;
    turns: number;
    width: number;
    thickness: number;
  };
}

export interface PommelDesign {
  profile: Vec2[];
  radialSegments: number;
}
```

## 6. 형상 데이터 구조

메시에는 최종 위치만 저장하지 않는다.
생성 과정에서 얻은 표면 의미값도 저장한다.

```ts
export interface GeneratedMesh {
  positions: Float32Array;
  normals: Float32Array;
  tangents: Float32Array;
  indices: Uint32Array;

  uvLocal: Float32Array;
  uvAtlas: Float32Array;
  uvMetric: Float32Array;

  attributes: {
    partId: Float32Array;

    longitudinal: Float32Array;
    perimeter: Float32Array;

    edgeWeight: Float32Array;
    ridgeWeight: Float32Array;
    fullerWeight: Float32Array;
    contactWeight: Float32Array;

    curvature: Float32Array;
    cavity: Float32Array;
  };

  bounds: Bounds3;
}
```

세 종류의 표면 좌표를 구분한다.

### 6.1 Local UV

부품 내부의 논리 좌표다.

```text
칼날:
U = 뿌리에서 칼끝까지 0~1
V = 단면 둘레 0~1

손잡이:
U = 둘레 0~1
V = 손잡이 길이 0~1
```

### 6.2 Atlas UV

최종 베이크 텍스처 안에서의 위치다.

```text
칼날 영역
가드 영역
손잡이 영역
폼멜 영역
```

### 6.3 Metric UV

실제 길이에 기반한 타일링 좌표다.

```text
1 UV 단위 = 표면 10cm
```

검이 길어져도 긁힘과 연마 패턴의 실제 크기가 유지된다.

## 7. 칼날 메시와 UV 동시 생성

칼날은 길이 방향 단면 링을 연결해 생성한다.

```text
Ring 0
→ Ring 1
→ Ring 2
→ ...
→ Ring N
```

각 링은 칼날의 특정 길이 위치 `t`에 해당한다.
각 링 내부의 정점은 단면 둘레 위치 `s`에 해당한다.

```text
t = 0: 칼날 뿌리
t = 1: 칼끝

s = 0~1: 단면 둘레
```

### 7.1 단면 프로파일

```ts
export interface ProfilePoint {
  x: number;
  y: number;

  edgeWeight: number;
  ridgeWeight: number;
  fullerWeight: number;
}
```

```ts
export function buildCrossSectionProfile(
  type: BladeDesign["crossSection"],
  width: number,
  thickness: number,
  ridgeHeight: number,
  segmentCount: number
): ProfilePoint[] {
  switch (type) {
    case "diamond":
      return sampleDiamondProfile(
        width,
        thickness,
        ridgeHeight,
        segmentCount
      );

    case "lenticular":
      return sampleLenticularProfile(
        width,
        thickness,
        segmentCount
      );

    case "hexagonal":
      return sampleHexagonalProfile(
        width,
        thickness,
        ridgeHeight,
        segmentCount
      );

    case "flat":
      return sampleFlatProfile(
        width,
        thickness,
        segmentCount
      );
  }
}
```

### 7.2 칼날 생성 코드

```ts
export function buildBladeMesh(
  design: BladeDesign
): GeneratedMesh {
  const builder = new MeshBuilder();

  const ringCount = design.segments.longitudinal;
  const profileSegments = design.segments.crossSection;

  const centerCurve = createCurve3(design.centerCurve);
  const arcLengthTable = buildArcLengthTable(
    centerCurve,
    ringCount
  );

  for (let ringIndex = 0; ringIndex <= ringCount; ringIndex++) {
    const t = ringIndex / ringCount;

    const center = centerCurve.evaluate(t);
    const frame = centerCurve.frame(t);

    const width = evaluateCurve1(design.widthCurve, t);
    const thickness = evaluateCurve1(
      design.thicknessCurve,
      t
    );

    const tipScale = evaluateTipScale(design.tip, t);

    const profile = buildCrossSectionProfile(
      design.crossSection,
      width * tipScale,
      thickness * tipScale,
      design.ridgeHeight,
      profileSegments
    );

    const physicalLength = arcLengthTable[ringIndex];

    /*
     * profileSegments + 1개를 생성한다.
     * 마지막 정점은 첫 정점과 같은 위치지만 UV가 다르다.
     * 이 중복 정점이 UV seam을 명시적으로 만든다.
     */
    for (
      let profileIndex = 0;
      profileIndex <= profileSegments;
      profileIndex++
    ) {
      const wrappedIndex = profileIndex % profileSegments;
      const p = profile[wrappedIndex];

      const s = profileIndex / profileSegments;

      const position = add3(
        center,
        add3(
          scale3(frame.normal, p.x),
          scale3(frame.binormal, p.y)
        )
      );

      const metricPerimeter =
        calculateProfileDistance(profile, wrappedIndex);

      builder.addVertex({
        position,

        uvLocal: [t, s],

        uvMetric: [
          physicalLength / 0.1,
          metricPerimeter / 0.1
        ],

        attributes: {
          partId: PartId.Blade,
          longitudinal: t,
          perimeter: s,

          edgeWeight: p.edgeWeight,
          ridgeWeight: p.ridgeWeight,
          fullerWeight: p.fullerWeight,
          contactWeight: evaluateBladeContactWeight(t)
        }
      });
    }
  }

  const ringVertexCount = profileSegments + 1;

  for (let ring = 0; ring < ringCount; ring++) {
    for (let side = 0; side < profileSegments; side++) {
      const a = ring * ringVertexCount + side;
      const b = a + 1;
      const c = a + ringVertexCount;
      const d = c + 1;

      builder.addTriangle(a, c, b);
      builder.addTriangle(b, c, d);
    }
  }

  closeBladeRoot(builder, design);
  closeBladeTip(builder, design);

  builder.recalculateNormals();
  builder.recalculateTangents();
  builder.calculateCurvature();

  return builder.build();
}
```

이 구조에서 UV seam은 자동 추측되지 않는다.

```text
단면의 특정 위치가 항상 seam이다.
```

칼날의 seam은 플레이 시 가장 덜 보이는 칼날 뒤쪽이나 특정 능선에 고정할 수 있다.

## 8. 손잡이 메시와 UV 생성

손잡이는 중심 곡선을 따라 원형 또는 타원형 단면을 Sweep한다.

```ts
export function buildGripMesh(
  design: GripDesign
): GeneratedMesh {
  const builder = new MeshBuilder();

  const lengthSegments = 32;
  const radialSegments = 16;

  const curve = createCurve3(design.curvature);
  const arcLengths = buildArcLengthTable(
    curve,
    lengthSegments
  );

  for (let i = 0; i <= lengthSegments; i++) {
    const v = i / lengthSegments;

    const center = curve.evaluate(v);
    const frame = curve.frame(v);

    const radius = lerp(
      design.startRadius,
      design.endRadius,
      v
    );

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const angle = u * Math.PI * 2;

      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      const position = add3(
        center,
        add3(
          scale3(frame.normal, x),
          scale3(frame.binormal, y)
        )
      );

      builder.addVertex({
        position,

        uvLocal: [u, v],

        uvMetric: [
          angle * radius / 0.05,
          arcLengths[i] / 0.05
        ],

        attributes: {
          partId: PartId.Grip,
          longitudinal: v,
          perimeter: u,

          edgeWeight: 0,
          ridgeWeight: 0,
          fullerWeight: 0,
          contactWeight: evaluateGripContact(v)
        }
      });
    }
  }

  connectSweepRings(
    builder,
    lengthSegments,
    radialSegments
  );

  builder.recalculateNormals();
  builder.recalculateTangents();
  builder.calculateCurvature();

  return builder.build();
}
```

가죽 감기는 메시로 직접 만들 수도 있지만 첫 MVP에서는 머티리얼로 표현한다.

```text
가죽 감기 마스크
=
fract(V × turns + U)
```

## 9. 가드 메시와 UV 생성

가드는 2D 윤곽을 깊이 방향으로 Extrude한다.

```ts
export interface ExtrudedMeshInput {
  outline: Vec2[];
  depth: number;
  bevel: number;
}
```

UV 규칙:

```text
앞면:
정규화된 2D 윤곽 좌표

뒷면:
동일한 2D 윤곽 좌표

측면:
U = 윤곽선을 따라 이동한 거리
V = 앞면에서 뒷면까지의 깊이
```

```ts
export function buildExtrudedGuard(
  design: GuardDesign
): GeneratedMesh {
  const outline = normalizeOutline(design.outline);
  const triangles = triangulatePolygon(outline);

  const builder = new MeshBuilder();

  addGuardFrontFace(
    builder,
    outline,
    triangles,
    design.depth
  );

  addGuardBackFace(
    builder,
    outline,
    triangles,
    design.depth
  );

  addGuardSideFaces(
    builder,
    outline,
    design.depth
  );

  if (design.bevel > 0) {
    applyParametricGuardBevel(
      builder,
      design.bevel
    );
  }

  builder.recalculateNormals();
  builder.recalculateTangents();
  builder.calculateCurvature();

  return builder.build();
}
```

복잡한 Boolean 장식은 첫 MVP에서 허용하지 않는다.
장식은 다음 중 하나로 처리한다.

```text
별도 장식 메시
Height·Normal 문양
Decal
가드 윤곽 자체에 포함
```

## 10. 폼멜 생성

폼멜은 축을 중심으로 2D 프로파일을 회전해 생성한다.

```ts
export function buildPommelMesh(
  design: PommelDesign
): GeneratedMesh {
  return buildLatheMesh({
    profile: design.profile,
    radialSegments: design.radialSegments,

    uvRule: {
      u: "rotation_angle",
      v: "profile_distance"
    },

    partId: PartId.Pommel
  });
}
```

## 11. 부품 조립

초기에는 Boolean Union을 사용하지 않는다.
각 부품은 별도 primitive로 유지하고 동일한 GLB 안에 넣는다.

```text
SwordRoot
├─ Blade
├─ Guard
├─ Grip
└─ Pommel
```

```ts
export interface SwordAssembly {
  bladeTransform: Transform;
  guardTransform: Transform;
  gripTransform: Transform;
  pommelTransform: Transform;
}
```

의미 있는 소켓을 사용한다.

```ts
export interface SwordSockets {
  blade: {
    guardSocket: Transform;
    gripSocket: Transform;
  };

  guard: {
    bladeSocket: Transform;
    gripSocket: Transform;
  };

  grip: {
    guardSocket: Transform;
    pommelSocket: Transform;
  };
}
```

```ts
export function assembleSword(
  parts: SwordParts,
  assembly: SwordAssembly
): AssembledSword {
  alignSockets(
    parts.guard,
    "bladeSocket",
    parts.blade,
    "guardSocket"
  );

  alignSockets(
    parts.grip,
    "guardSocket",
    parts.guard,
    "gripSocket"
  );

  alignSockets(
    parts.pommel,
    "gripSocket",
    parts.grip,
    "pommelSocket"
  );

  return {
    root: createSwordRoot(parts),
    parts
  };
}
```

## 12. UV Atlas 생성

각 부품은 먼저 0~1 범위의 `uvLocal`을 가진다.
MVP에서는 동적 패킹 알고리즘보다 고정된 Atlas 레이아웃을 사용한다.

```ts
export interface AtlasRegion {
  offset: Vec2;
  scale: Vec2;
  paddingPixels: number;
}
```

```ts
export const SWORD_ATLAS_LAYOUT: Record<
  PartId,
  AtlasRegion
> = {
  [PartId.Blade]: {
    offset: [0.0, 0.5],
    scale: [1.0, 0.5],
    paddingPixels: 8
  },

  [PartId.Guard]: {
    offset: [0.0, 0.0],
    scale: [0.35, 0.5],
    paddingPixels: 8
  },

  [PartId.Grip]: {
    offset: [0.35, 0.0],
    scale: [0.4, 0.5],
    paddingPixels: 8
  },

  [PartId.Pommel]: {
    offset: [0.75, 0.0],
    scale: [0.25, 0.5],
    paddingPixels: 8
  }
};
```

```ts
export function applyAtlasUV(
  mesh: GeneratedMesh,
  partId: PartId,
  textureSize: number
): void {
  const region = SWORD_ATLAS_LAYOUT[partId];

  const paddingU =
    region.paddingPixels / textureSize;

  const paddingV =
    region.paddingPixels / textureSize;

  const innerOffset: Vec2 = [
    region.offset[0] + paddingU,
    region.offset[1] + paddingV
  ];

  const innerScale: Vec2 = [
    region.scale[0] - paddingU * 2,
    region.scale[1] - paddingV * 2
  ];

  for (let i = 0; i < mesh.uvLocal.length; i += 2) {
    const localU = mesh.uvLocal[i];
    const localV = mesh.uvLocal[i + 1];

    mesh.uvAtlas[i] =
      innerOffset[0] + localU * innerScale[0];

    mesh.uvAtlas[i + 1] =
      innerOffset[1] + localV * innerScale[1];
  }
}
```

후속 버전에서는 예상 화면 면적과 부품 중요도에 따라 Atlas 비율을 조정한다.

## 13. UV 유효성 검사

```ts
export interface UVValidationReport {
  overlaps: number;
  outOfBoundsVertices: number;
  degenerateTriangles: number;
  minimumPaddingPixels: number;
  texelDensityDeviation: number;
}
```

```ts
export function validateUVs(
  mesh: GeneratedMesh,
  textureSize: number
): UVValidationReport {
  return {
    overlaps: detectUVTriangleOverlaps(mesh),
    outOfBoundsVertices: countOutOfBoundsUVs(mesh),
    degenerateTriangles:
      countDegenerateUVTriangles(mesh),

    minimumPaddingPixels:
      measureMinimumIslandPadding(
        mesh,
        textureSize
      ),

    texelDensityDeviation:
      calculateTexelDensityDeviation(mesh)
  };
}
```

빌드 차단 조건:

```ts
export function assertValidUV(
  report: UVValidationReport
): void {
  if (report.overlaps > 0) {
    throw new Error("UV overlap detected.");
  }

  if (report.outOfBoundsVertices > 0) {
    throw new Error("UV coordinates out of bounds.");
  }

  if (report.degenerateTriangles > 0) {
    throw new Error("Degenerate UV triangles detected.");
  }

  if (report.minimumPaddingPixels < 4) {
    throw new Error("Insufficient UV padding.");
  }
}
```

## 14. MaterialGraph

최종 PBR 이미지를 직접 저장하기 전에 논리적인 머티리얼 그래프를 저장한다.

```ts
export interface SwordMaterialGraph {
  materials: {
    blade: MaterialInstanceSpec;
    guard: MaterialInstanceSpec;
    grip: MaterialInstanceSpec;
    pommel: MaterialInstanceSpec;
  };

  decorations: SurfaceDecoration[];
  surfaceOperations: MaterialOperation[];
}
```

```ts
export interface MaterialInstanceSpec {
  primitiveId:
    | "carbon_steel"
    | "bronze"
    | "leather";

  colorTint: Vec3;
  roughnessOffset: number;
  normalStrength: number;

  state: SurfaceState;
  seed: number;
}
```

```ts
export interface SurfaceState {
  polish: number;
  oxidation: number;
  dirt: number;
  moisture: number;
  scratchAmount: number;
  impactAmount: number;
}
```

## 15. 기본 머티리얼 라이브러리

기본 물질은 자산마다 AI로 새로 만들지 않는다.

```ts
export interface MaterialPrimitive {
  id: string;

  baseColor: Vec3;
  metallic: number;
  roughness: number;

  microNormal: NoiseSpec;
  colorVariation: NoiseSpec;

  rules: MaterialRuleSet;
}
```

```ts
export const CARBON_STEEL: MaterialPrimitive = {
  id: "carbon_steel",

  baseColor: [0.18, 0.19, 0.2],
  metallic: 1.0,
  roughness: 0.36,

  microNormal: {
    type: "directional_noise",
    scale: 160,
    strength: 0.08,
    seedOffset: 19
  },

  colorVariation: {
    type: "fbm",
    scale: 12,
    strength: 0.025,
    seedOffset: 31
  },

  rules: {
    edgePolishResponse: 0.25,
    cavityOxidationResponse: 0.55,
    moistureRoughnessResponse: -0.2,
    scratchNormalResponse: 0.4
  }
};
```

```ts
export const BRONZE: MaterialPrimitive = {
  id: "bronze",

  baseColor: [0.42, 0.22, 0.08],
  metallic: 1.0,
  roughness: 0.42,

  microNormal: {
    type: "fbm",
    scale: 90,
    strength: 0.06,
    seedOffset: 67
  },

  colorVariation: {
    type: "fbm",
    scale: 8,
    strength: 0.04,
    seedOffset: 71
  },

  rules: {
    edgePolishResponse: 0.32,
    cavityOxidationResponse: 0.7,
    moistureRoughnessResponse: -0.18,
    scratchNormalResponse: 0.35
  }
};
```

## 16. 표면 의미 마스크

머티리얼을 합성할 때 AI가 "어디가 날인지" 다시 추측하지 않는다.
검 생성기가 이미 값을 제공한다.

```text
edgeWeight:
날에 가까울수록 1

ridgeWeight:
중앙 능선에 가까울수록 1

fullerWeight:
홈 내부일수록 1

contactWeight:
손이나 부품이 자주 닿는 곳일수록 1
```

추가적으로 형상에서 계산한다.

```text
curvature:
볼록하거나 오목한 정도

cavity:
가려지고 움푹한 정도

ambientOcclusion:
주변 형상에 의해 가려지는 정도
```

### 16.1 곡률 근사

```ts
export function calculateVertexCurvature(
  mesh: GeneratedMesh
): Float32Array {
  const result = new Float32Array(
    mesh.positions.length / 3
  );

  const adjacency = buildVertexAdjacency(mesh);

  for (let vertexId = 0; vertexId < result.length; vertexId++) {
    const normal = getNormal(mesh, vertexId);
    const neighbors = adjacency[vertexId];

    let totalDifference = 0;

    for (const neighborId of neighbors) {
      const neighborNormal =
        getNormal(mesh, neighborId);

      totalDifference +=
        1 - dot3(normal, neighborNormal);
    }

    result[vertexId] =
      neighbors.length === 0
        ? 0
        : clamp01(
            totalDifference / neighbors.length
          );
  }

  return result;
}
```

실제 검 MVP에서는 일반 곡률보다 생성기가 제공한 의미값을 우선한다.

```text
날 마스크:
의미 기반

능선 마스크:
의미 기반

홈 마스크:
의미 기반

일반 마모:
곡률 기반
```

## 17. MaterialOperation

표면 변화도 제한된 연산으로 저장한다.

```ts
export type MaterialOperation =
  | AssignMaterialOperation
  | PolishOperation
  | ScratchOperation
  | OxidizeOperation
  | DirtOperation
  | EngraveOperation;
```

```ts
export interface PolishOperation {
  type: "polish";

  targetPartId: PartId;

  selector:
    | { type: "edge" }
    | { type: "ridge" }
    | { type: "local_uv"; bounds: Rect };

  strength: number;
}
```

```ts
export interface ScratchOperation {
  type: "scratch";

  targetPartId: PartId;

  count: number;
  lengthRange: [number, number];
  widthRange: [number, number];

  direction:
    | "longitudinal"
    | "perpendicular"
    | "random";

  seed: number;
}
```

```ts
export interface EngraveOperation {
  type: "engrave";

  targetPartId: PartId;

  maskPath: string;

  transform: {
    offset: Vec2;
    scale: Vec2;
    rotation: number;
  };

  depth: number;
}
```

## 18. 절차적 PBR 합성

최종 텍스처는 UV 공간에서 렌더링해 만든다.
CPU로 모든 삼각형을 직접 래스터라이즈하지 않는다.
Three.js와 WebGL2를 사용하여 다음과 같은 베이크 전용 장면을 만든다.

```text
정점의 화면 위치
=
Atlas UV를 -1~1 clip space로 변환한 값
```

따라서 메시가 3D 공간이 아니라 UV 공간에 펼쳐져 렌더링된다.

### 18.1 베이크 정점 셰이더

```glsl
precision highp float;

attribute vec3 position;
attribute vec2 uv;
attribute vec2 uvMetric;

attribute float partId;
attribute float edgeWeight;
attribute float ridgeWeight;
attribute float fullerWeight;
attribute float contactWeight;
attribute float curvature;
attribute float cavity;

varying vec2 vAtlasUV;
varying vec2 vMetricUV;

varying float vPartId;
varying float vEdgeWeight;
varying float vRidgeWeight;
varying float vFullerWeight;
varying float vContactWeight;
varying float vCurvature;
varying float vCavity;

void main() {
  vAtlasUV = uv;
  vMetricUV = uvMetric;

  vPartId = partId;
  vEdgeWeight = edgeWeight;
  vRidgeWeight = ridgeWeight;
  vFullerWeight = fullerWeight;
  vContactWeight = contactWeight;
  vCurvature = curvature;
  vCavity = cavity;

  vec2 clip = uv * 2.0 - 1.0;

  gl_Position = vec4(
    clip.x,
    clip.y,
    0.0,
    1.0
  );
}
```

### 18.2 결정적 노이즈

```glsl
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);

  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(a, b, u.x),
    mix(c, d, u.x),
    u.y
  );
}
```

### 18.3 BaseColor 합성 셰이더

```glsl
precision highp float;

uniform vec3 uSteelColor;
uniform vec3 uOxidationColor;
uniform vec3 uDirtColor;

uniform float uOxidationAmount;
uniform float uDirtAmount;
uniform float uSeed;

varying vec2 vMetricUV;
varying float vEdgeWeight;
varying float vFullerWeight;
varying float vCavity;

void main() {
  float variation =
    valueNoise(vMetricUV * 0.35 + uSeed) - 0.5;

  vec3 color =
    uSteelColor +
    variation * 0.025;

  float oxidationMask =
    clamp(
      vCavity * 0.6 +
      vFullerWeight * 0.45,
      0.0,
      1.0
    ) * uOxidationAmount;

  float dirtMask =
    clamp(
      vCavity * 0.7,
      0.0,
      1.0
    ) * uDirtAmount;

  color = mix(
    color,
    uOxidationColor,
    oxidationMask
  );

  color = mix(
    color,
    uDirtColor,
    dirtMask
  );

  gl_FragColor = vec4(color, 1.0);
}
```

### 18.4 Roughness 합성

```glsl
precision highp float;

uniform float uBaseRoughness;
uniform float uPolishAmount;
uniform float uOxidationAmount;
uniform float uMoisture;

varying float vEdgeWeight;
varying float vRidgeWeight;
varying float vFullerWeight;
varying float vCavity;

void main() {
  float polishMask =
    max(vEdgeWeight, vRidgeWeight);

  float oxidationMask =
    max(vCavity, vFullerWeight) *
    uOxidationAmount;

  float roughness =
    uBaseRoughness
    - polishMask * uPolishAmount * 0.25
    + oxidationMask * 0.3
    - uMoisture * 0.18;

  gl_FragColor = vec4(
    clamp(roughness, 0.04, 1.0),
    0.0,
    0.0,
    1.0
  );
}
```

### 18.5 Metallic 합성

```glsl
precision highp float;

uniform float uBaseMetallic;
uniform float uOxidationAmount;

varying float vCavity;
varying float vFullerWeight;

void main() {
  float heavyOxidation =
    clamp(
      max(vCavity, vFullerWeight) *
      uOxidationAmount,
      0.0,
      1.0
    );

  float metallic =
    uBaseMetallic -
    heavyOxidation * 0.25;

  gl_FragColor = vec4(
    metallic,
    0.0,
    0.0,
    1.0
  );
}
```

## 19. 베이크 코드

첫 MVP에서는 채널별로 순차 렌더링한다.

```ts
export type BakeChannel =
  | "baseColor"
  | "normal"
  | "roughness"
  | "metallic"
  | "ao";
```

```ts
export interface BakeRequest {
  mesh: GeneratedMesh;
  materialGraph: SwordMaterialGraph;

  width: number;
  height: number;

  channels: BakeChannel[];
}
```

```ts
export class TextureBaker {
  constructor(
    private readonly renderer: THREE.WebGLRenderer
  ) {}

  async bake(
    request: BakeRequest
  ): Promise<Record<BakeChannel, ImageData>> {
    const result =
      {} as Record<BakeChannel, ImageData>;

    const geometry =
      createThreeGeometry(request.mesh);

    for (const channel of request.channels) {
      const material =
        createBakeMaterial(
          channel,
          request.materialGraph
        );

      const bakeMesh =
        new THREE.Mesh(geometry, material);

      const scene = new THREE.Scene();
      scene.add(bakeMesh);

      const target =
        new THREE.WebGLRenderTarget(
          request.width,
          request.height,
          {
            depthBuffer: false,
            stencilBuffer: false,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType
          }
        );

      this.renderer.setRenderTarget(target);
      this.renderer.clear();
      this.renderer.render(
        scene,
        createBakeCamera()
      );

      const pixels = new Uint8Array(
        request.width *
        request.height *
        4
      );

      this.renderer.readRenderTargetPixels(
        target,
        0,
        0,
        request.width,
        request.height,
        pixels
      );

      result[channel] =
        flipAndCreateImageData(
          pixels,
          request.width,
          request.height
        );

      target.dispose();
      material.dispose();
    }

    this.renderer.setRenderTarget(null);

    return result;
  }
}
```

UV Atlas에서 비어 있는 영역은 투명하게 남는다.
베이크 후 padding을 확장해 mipmap에서 seam이 번지는 것을 방지한다.

```ts
export function dilateTexturePadding(
  source: ImageData,
  iterations: number
): ImageData {
  let current = source;

  for (let i = 0; i < iterations; i++) {
    current = dilateOnePixel(current);
  }

  return current;
}
```

## 20. Normal 텍스처 생성

Normal은 다음 요소를 합성한다.

```text
기본 미세 표면
길이 방향 연마 흔적
긁힘
조각 문양
```

높이 필드를 먼저 만들고 Normal로 변환한다.

```ts
export function heightToNormal(
  height: Float32Array,
  width: number,
  heightPixels: number,
  strength: number
): Uint8Array {
  const output = new Uint8Array(
    width * heightPixels * 4
  );

  for (let y = 0; y < heightPixels; y++) {
    for (let x = 0; x < width; x++) {
      const left = sampleHeight(
        height,
        width,
        heightPixels,
        x - 1,
        y
      );

      const right = sampleHeight(
        height,
        width,
        heightPixels,
        x + 1,
        y
      );

      const down = sampleHeight(
        height,
        width,
        heightPixels,
        x,
        y - 1
      );

      const up = sampleHeight(
        height,
        width,
        heightPixels,
        x,
        y + 1
      );

      const dx = (right - left) * strength;
      const dy = (up - down) * strength;

      const normal = normalize3([
        -dx,
        -dy,
        1
      ]);

      const index = (y * width + x) * 4;

      output[index] =
        Math.round((normal[0] * 0.5 + 0.5) * 255);

      output[index + 1] =
        Math.round((normal[1] * 0.5 + 0.5) * 255);

      output[index + 2] =
        Math.round((normal[2] * 0.5 + 0.5) * 255);

      output[index + 3] = 255;
    }
  }

  return output;
}
```

## 21. 긁힘 생성

긁힘은 AI 이미지가 아니라 seed 기반 벡터 스트로크로 생성한다.

```ts
export interface ScratchSpec {
  count: number;

  lengthRange: [number, number];
  widthRange: [number, number];
  depthRange: [number, number];

  direction:
    | "longitudinal"
    | "perpendicular"
    | "random";

  seed: number;
}
```

```ts
export function generateScratches(
  canvas: OffscreenCanvas,
  spec: ScratchSpec
): void {
  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error("2D context is unavailable.");
  }

  const random = createSeededRandom(spec.seed);

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.strokeStyle = "white";

  for (let i = 0; i < spec.count; i++) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;

    const length = lerp(
      spec.lengthRange[0],
      spec.lengthRange[1],
      random()
    );

    const width = lerp(
      spec.widthRange[0],
      spec.widthRange[1],
      random()
    );

    const angle =
      resolveScratchAngle(
        spec.direction,
        random
      );

    context.lineWidth = width;
    context.globalAlpha =
      lerp(0.25, 0.8, random());

    context.beginPath();
    context.moveTo(x, y);

    context.lineTo(
      x + Math.cos(angle) * length,
      y + Math.sin(angle) * length
    );

    context.stroke();
  }
}
```

## 22. AI 문양 생성

AI는 완성 텍스처를 생성하지 않는다.

입력:

```ts
export interface OrnamentGenerationRequest {
  prompt: string;

  style:
    | "engraving"
    | "rune"
    | "heraldry"
    | "organic";

  width: 512;
  height: 512;

  outputMode: "grayscale_mask";
}
```

출력:

```ts
export interface OrnamentGenerationResult {
  maskPath: string;

  validation: {
    grayscaleOnly: boolean;
    borderIsEmpty: boolean;
    connectedComponentCount: number;
    fillRatio: number;
  };
}
```

AI 출력은 반드시 검증한다.

```ts
export function validateOrnamentMask(
  image: ImageData
): OrnamentValidationResult {
  return {
    grayscaleOnly:
      calculateColorDeviation(image) < 0.02,

    borderIsEmpty:
      calculateBorderFill(image) < 0.01,

    connectedComponentCount:
      countConnectedComponents(image),

    fillRatio:
      calculateMaskFillRatio(image)
  };
}
```

검증 실패 시 다음을 수행한다.

```text
배경 제거
흑백 변환
threshold
작은 노이즈 제거
가장 큰 연결 요소 선택
윤곽 단순화
```

문양은 `EngraveOperation`으로 칼날의 `uvLocal` 공간에 배치한다.

```ts
export function sampleDecoration(
  decoration: SurfaceDecoration,
  localUV: Vec2
): number {
  const transformedUV =
    inverseTransformUV(
      localUV,
      decoration.transform
    );

  return sampleMask(
    decoration.mask,
    transformedUV
  );
}
```

## 23. 참조 이미지와 머티리얼 비교

참조 이미지에서 정확한 PBR 채널을 추출한다고 가정하지 않는다.
비교는 두 종류로 분리한다.

### 23.1 참조 조명 비교

```text
참조 이미지와 비슷한 카메라
참조 이미지와 비슷한 주광 방향
유사한 환경 밝기
```

평가 대상:

```text
전체 색상 분포
광택이 나타나는 영역
밝고 어두운 부품 관계
장식 위치
```

### 23.2 중립 조명 검사

```text
회색 스튜디오 환경
고정 HDR 또는 고정 조명
카메라 회전
```

평가 대상:

```text
그림자가 BaseColor에 그려져 있지 않은가
금속이 플라스틱처럼 보이지 않는가
Roughness가 지나치게 균일하지 않은가
Normal이 과도하지 않은가
여러 각도에서 문양이 유지되는가
```

```ts
export interface MaterialEvaluation {
  referenceColorDifference: number;
  referencePatternAlignment: number;

  neutralMaterialPlausibility: number;
  seamVisibility: number;
  directionalConsistency: number;
}
```

## 24. 전체 파이프라인 상태

```ts
export type PipelineStage =
  | "reference_prepare"
  | "target_spec"
  | "design_optimize"
  | "geometry_generate"
  | "uv_validate"
  | "material_assign"
  | "surface_compile"
  | "texture_bake"
  | "render_evaluate"
  | "asset_build"
  | "completed";
```

```ts
export interface PipelineState {
  projectId: string;
  stage: PipelineStage;

  revision: number;
  progress: number;

  currentDesign?: SwordDesign;
  currentMetrics?: EvaluationMetrics;

  error?: {
    code: string;
    message: string;
  };
}
```

## 25. 전체 실행 코드

```ts
export async function runSwordPipeline(
  context: PipelineContext,
  projectId: string
): Promise<SwordBuildOutput> {
  const project =
    await context.projectStore.load(projectId);

  await context.stage.set(
    projectId,
    "reference_prepare"
  );

  const references =
    await context.referenceProcessor.prepare(
      project.referenceSpec
    );

  await context.stage.set(
    projectId,
    "target_spec"
  );

  const targetSpec =
    await context.targetSpecBuilder.build(
      references
    );

  await context.projectStore.update(projectId, {
    targetSpec
  });

  await context.stage.set(
    projectId,
    "design_optimize"
  );

  const optimizedDesign =
    await optimizeSwordDesign(
      context,
      targetSpec,
      createInitialSwordDesign(targetSpec)
    );

  await context.stage.set(
    projectId,
    "geometry_generate"
  );

  const parts =
    generateSwordParts(optimizedDesign);

  for (const part of Object.values(parts)) {
    applyAtlasUV(
      part.mesh,
      part.partId,
      project.constraints.textureSize
    );
  }

  const sword =
    assembleSword(
      parts,
      optimizedDesign.assembly
    );

  await context.stage.set(
    projectId,
    "uv_validate"
  );

  for (const part of Object.values(parts)) {
    const report = validateUVs(
      part.mesh,
      project.constraints.textureSize
    );

    assertValidUV(report);
  }

  await context.stage.set(
    projectId,
    "material_assign"
  );

  const materialGraph =
    await context.materialPlanner.createGraph({
      project,
      targetSpec,
      design: optimizedDesign
    });

  await context.stage.set(
    projectId,
    "surface_compile"
  );

  const compiledSurface =
    compileSurfaceGraph({
      sword,
      materialGraph,
      seed: project.seed
    });

  await context.stage.set(
    projectId,
    "texture_bake"
  );

  const bakedTextures =
    await context.textureBaker.bake({
      mesh: mergeForBake(sword),
      materialGraph: compiledSurface,
      width: project.constraints.textureSize,
      height: project.constraints.textureSize,
      channels: [
        "baseColor",
        "normal",
        "roughness",
        "metallic",
        "ao"
      ]
    });

  const paddedTextures =
    applyPaddingToAll(
      bakedTextures,
      8
    );

  const packedTextures =
    packTextureChannels(paddedTextures);

  await context.stage.set(
    projectId,
    "render_evaluate"
  );

  const qualityReport =
    await evaluateBuiltSword({
      sword,
      textures: packedTextures,
      targetSpec,
      references
    });

  assertBuildQuality(qualityReport);

  await context.stage.set(
    projectId,
    "asset_build"
  );

  const output =
    await context.assetBuilder.build({
      project,
      sword,
      textures: packedTextures,
      design: optimizedDesign,
      materialGraph,
      qualityReport
    });

  await context.stage.set(
    projectId,
    "completed"
  );

  return output;
}
```

## 26. 형상 최적화 루프

초기에는 AI가 파라미터 값을 직접 결정하지 않는다.
연속 파라미터는 수치 최적화가 담당한다.

```ts
export interface SwordOptimizationVector {
  bladeLength: number;
  bladeWidthRoot: number;
  bladeWidthMiddle: number;
  bladeWidthTip: number;

  bladeThicknessRoot: number;
  bladeThicknessTip: number;

  taperStart: number;
  tipEndScale: number;

  guardWidth: number;
  gripLength: number;
}
```

```ts
export async function optimizeSwordDesign(
  context: PipelineContext,
  target: SwordTargetSpec,
  initial: SwordDesign
): Promise<SwordDesign> {
  let bestDesign = initial;

  let bestMetrics =
    await evaluateDesignPreview(
      context,
      target,
      bestDesign
    );

  for (let iteration = 0; iteration < 40; iteration++) {
    const candidates =
      generateDesignCandidates(
        bestDesign,
        iteration
      );

    for (const candidate of candidates) {
      const metrics =
        await evaluateDesignPreview(
          context,
          target,
          candidate
        );

      if (
        metrics.aggregateLoss <
        bestMetrics.aggregateLoss
      ) {
        bestDesign = candidate;
        bestMetrics = metrics;
      }
    }

    if (bestMetrics.silhouetteIoU >= 0.92) {
      break;
    }
  }

  return bestDesign;
}
```

AI는 다음 상황에서만 개입한다.

```text
단면 유형 선택
가드 템플릿 선택
칼끝 유형 선택
복수 가설 중 선택
최적화 정체 원인 진단
```

## 27. 렌더 평가

```ts
export interface EvaluationMetrics {
  silhouetteIoU: number;
  landmarkError: number;
  partProportionError: number;

  nonManifoldEdges: number;
  selfIntersections: number;

  uvOverlaps: number;
  seamVisibility: number;

  materialPlausibility: number;

  triangleCount: number;
  aggregateLoss: number;
}
```

Hard Constraint:

```ts
export function assertBuildQuality(
  report: EvaluationMetrics
): void {
  if (report.nonManifoldEdges > 0) {
    throw new Error("Non-manifold geometry.");
  }

  if (report.selfIntersections > 0) {
    throw new Error("Self-intersection detected.");
  }

  if (report.uvOverlaps > 0) {
    throw new Error("UV overlap detected.");
  }

  if (report.triangleCount > 15_000) {
    throw new Error("Triangle budget exceeded.");
  }

  if (report.seamVisibility > 0.08) {
    throw new Error("Visible texture seams.");
  }
}
```

## 28. GLB 빌드

Three.js 장면 구성:

```ts
export function createExportScene(
  sword: AssembledSword,
  textures: PackedTextures
): THREE.Scene {
  const scene = new THREE.Scene();

  const material =
    new THREE.MeshStandardMaterial({
      map: textures.baseColor,
      normalMap: textures.normal,

      aoMap: textures.orm,
      roughnessMap: textures.orm,
      metalnessMap: textures.orm,

      metalness: 1,
      roughness: 1
    });

  configureORMChannels(material);

  for (const part of sword.parts) {
    const geometry =
      createThreeGeometry(part.mesh);

    const mesh =
      new THREE.Mesh(
        geometry,
        material
      );

    mesh.name = part.name;

    scene.add(mesh);
  }

  return scene;
}
```

```ts
export async function exportGLB(
  scene: THREE.Scene
): Promise<ArrayBuffer> {
  const exporter =
    new GLTFExporter();

  return new Promise(
    (resolve, reject) => {
      exporter.parse(
        scene,
        result => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
            return;
          }

          reject(
            new Error(
              "Expected binary GLB output."
            )
          );
        },
        reject,
        {
          binary: true,
          onlyVisible: true,
          truncateDrawRange: true
        }
      );
    }
  );
}
```

GLB 생성 후 외부 빌드 도구에서 다음을 수행한다.

```text
메시 최적화
정점 캐시 최적화
LOD 생성
텍스처 KTX2 압축
불필요 데이터 제거
glTF 유효성 검사
```

## 29. API

프로젝트 생성

```http
POST /api/projects
Content-Type: application/json
```

```json
{
  "name": "Reference Sword",
  "category": "sword",
  "constraints": {
    "maximumTriangles": 15000,
    "textureSize": 1024,
    "targetPlatform": "web_desktop"
  }
}
```

참조 업로드

```http
POST /api/projects/{projectId}/references
Content-Type: multipart/form-data
```

목표 명세 생성

```http
POST /api/projects/{projectId}/target-spec
```

파이프라인 실행

```http
POST /api/projects/{projectId}/runs
```

```json
{
  "mode": "automatic",
  "seed": 183729
}
```

현재 상태

```http
GET /api/projects/{projectId}/state
```

디자인 파라미터 수정

```http
PATCH /api/projects/{projectId}/design
```

```json
{
  "blade": {
    "length": 1.08,
    "tip": {
      "start": 0.72,
      "endScale": 0.04
    }
  }
}
```

문양 생성

```http
POST /api/projects/{projectId}/ornaments
```

```json
{
  "prompt": "고대 별 문양의 대칭 룬",
  "style": "engraving",
  "targetPartId": "blade"
}
```

빌드

```http
POST /api/projects/{projectId}/build
```

## 30. WebSocket 이벤트

```ts
export type PipelineEvent =
  | {
      type: "stage_started";
      stage: PipelineStage;
    }
  | {
      type: "design_candidate";
      revision: number;
      metrics: EvaluationMetrics;
    }
  | {
      type: "design_accepted";
      revision: number;
    }
  | {
      type: "geometry_generated";
      triangleCount: number;
    }
  | {
      type: "uv_validated";
      report: UVValidationReport;
    }
  | {
      type: "texture_baked";
      channel: BakeChannel;
      previewUrl: string;
    }
  | {
      type: "evaluation_completed";
      metrics: EvaluationMetrics;
    }
  | {
      type: "build_completed";
      glbUrl: string;
    }
  | {
      type: "pipeline_failed";
      code: string;
      message: string;
    };
```

## 31. 테스트 전략

### 31.1 메시 결정성

```ts
it("creates identical blade geometry from identical input", () => {
  const a = buildBladeMesh(TEST_BLADE_DESIGN);
  const b = buildBladeMesh(TEST_BLADE_DESIGN);

  expect(hashMesh(a)).toBe(hashMesh(b));
});
```

### 31.2 UV 결정성

```ts
it("creates identical UVs from identical design", () => {
  const a = buildBladeMesh(TEST_BLADE_DESIGN);
  const b = buildBladeMesh(TEST_BLADE_DESIGN);

  expect(hashFloatArray(a.uvLocal))
    .toBe(hashFloatArray(b.uvLocal));
});
```

### 31.3 길이 변화 시 패턴 크기 유지

```ts
it("preserves metric texture scale when blade length changes", () => {
  const shortBlade =
    buildBladeMesh({
      ...TEST_BLADE_DESIGN,
      length: 0.8
    });

  const longBlade =
    buildBladeMesh({
      ...TEST_BLADE_DESIGN,
      length: 1.6
    });

  const shortScale =
    estimateMetricPatternScale(shortBlade);

  const longScale =
    estimateMetricPatternScale(longBlade);

  expect(shortScale)
    .toBeCloseTo(longScale, 3);
});
```

### 31.4 UV overlap

```ts
it("does not create overlapping UV triangles", () => {
  const mesh =
    buildBladeMesh(TEST_BLADE_DESIGN);

  applyAtlasUV(
    mesh,
    PartId.Blade,
    1024
  );

  const report =
    validateUVs(mesh, 1024);

  expect(report.overlaps).toBe(0);
});
```

### 31.5 재질 결정성

```ts
it("creates identical textures from the same seed", async () => {
  const a =
    await bakeTestMaterial(9123);

  const b =
    await bakeTestMaterial(9123);

  expect(hashImage(a.baseColor))
    .toBe(hashImage(b.baseColor));

  expect(hashImage(a.normal))
    .toBe(hashImage(b.normal));
});
```

### 31.6 Golden Asset

다음 검 유형을 고정 테스트한다.

```text
직선 양날검
찌르기용 세검
넓은 대검
단날 직선검
단순 판타지 검
```

각 빌드에서 검사한다.

```text
실루엣 점수
삼각형 수
UV overlap
seam 가시성
텍스처 해시
GLB validator 결과
빌드 시간
```

## 32. 구현 로드맵

### Phase 1. AI 없는 칼날 생성기

구현:

```text
BladeDesign
단면 프로파일
길이 방향 링 생성
Local UV
Metric UV
Three.js 렌더
GLB 출력
```

완료 조건:

```text
20종의 칼날 생성
UV overlap 0
비매니폴드 0
동일 입력의 동일 해시
```

### Phase 2. 가드·손잡이·폼멜

구현:

```text
가드 Extrude
손잡이 Sweep
폼멜 Lathe
소켓 조립
고정 Atlas
```

완료 조건:

```text
검 전체 조립
부품별 의미 UV 생성
Atlas 경계 정상
```

### Phase 3. 절차적 기본 머티리얼

구현:

```text
탄소강
청동
가죽

BaseColor
Normal
Roughness
Metallic
AO
```

완료 조건:

```text
AI 없이 일관된 검 머티리얼 출력
형상 크기가 변해도 패턴 크기 유지
```

### Phase 4. 표면 상태

구현:

```text
Polish
Scratch
Oxidation
Dirt
Engraving
```

완료 조건:

```text
같은 검에 상태값만 바꿔 다양한 표면 생성
동일 seed 결과 재현
```

### Phase 5. 참조 이미지 형상 최적화

구현:

```text
실루엣 추출
랜드마크
카메라 정렬
수치 최적화
```

완료 조건:

```text
검 20종 평균 실루엣 IoU 0.9 이상
```

### Phase 6. 제한적 AI 사용

구현:

```text
부품 분할 보조
템플릿 선택
단면 가설 선택
흑백 장식 마스크 생성
정체 원인 진단
```

AI가 생성하지 않는 것:

```text
정점 배열
UV Atlas
완성 BaseColor
완성 Normal
완성 Roughness
```

### Phase 7. 빌드 최적화

구현:

```text
LOD
KTX2
meshoptimizer
충돌 메시
GLB 검증
```

### Phase 8. 다른 도메인 확장

공통으로 재사용:

```text
프로젝트 관리
TargetSpec
파이프라인 상태
렌더링
평가
텍스처 베이크
GLB 빌드
```

도메인별로 새로 개발:

```text
생성 문법
의미 좌표
표면 의미값
유효성 검사
기능 평가
```

## 33. 생물 확장 원칙

생물에서는 개체마다 메시를 새로 만들고 자동 언랩하지 않는다.
종별 템플릿을 사용한다.

```text
늑대 템플릿
├─ 기준 메시
├─ 기준 UV
├─ 기준 스켈레톤
├─ 기준 Skin Weight
└─ 표면 의미 영역
```

개체별 변화:

```text
골격 비율
근육량
지방량
귀 길이
주둥이 비율
털색
반점
흉터
```

토폴로지를 유지하므로 UV도 유지된다.

```text
표준 템플릿
→ cage deformation
→ 골격 비례 변화
→ 근육·지방 표면 보정
→ 동일 UV 유지
```

팔다리 수가 바뀌는 돌연변이는 별도의 템플릿 계열로 분류한다.

## 34. 시스템이 해결하는 것

```text
같은 계열 무기의 대량 변형
메시와 UV의 구조적 일관성
형상 크기가 달라져도 유지되는 재질 밀도
제작·손상 상태와 외형 연결
동일 결과 재현
국소 수정과 되돌리기
LOD·텍스처·GLB 자동 출력
공유 머티리얼을 통한 메모리 절감
```

## 35. 시스템이 해결하지 않는 것

```text
어떤 임의 메시든 사람 수준으로 자동 언랩
사진 한 장에서 정확한 뒷면 복원
조명을 완전히 제거한 PBR 역추정
자유형 조각 자산의 완전 자동 텍스처링
AI만으로 상용 아티스트 수준의 고유 캐릭터 완성
```

이 영역은 추가 참조 이미지, 별도 템플릿, 수작업 검수 또는 특화 모델이 필요하다.

## 36. 최종 파이프라인

```text
[1] 참조 이미지 입력
        ↓
[2] 객체 마스크와 부품 영역 확인
        ↓
[3] 검 생성 템플릿 선택
        ↓
[4] SwordTargetSpec 생성
        ↓
[5] SwordDesign 초기화
        ↓
[6] 파라메트릭 부품 생성
        ↓
[7] 메시와 Local·Metric UV 동시 생성
        ↓
[8] 고정 Atlas에 UV 배치
        ↓
[9] UV overlap·padding·밀도 검사
        ↓
[10] 기본 물질 선택
        ↓
[11] 형상 의미 마스크 생성
        ↓
[12] 제작·손상 MaterialOperation 적용
        ↓
[13] 제한적인 AI 장식 마스크 적용
        ↓
[14] UV 공간에서 PBR 채널 렌더
        ↓
[15] Padding 확장과 채널 패킹
        ↓
[16] 참조 조명 렌더 비교
        ↓
[17] 중립 조명 물리 검사
        ↓
[18] 형상·재질 파라미터 수정
        ↓
[19] LOD·충돌·KTX2·GLB 빌드
        ↓
[20] Spec·seed·Operation 로그와 함께 저장
```

## 37. 최종 정의

본 시스템은 다음과 같은 도구가 아니다.

```text
이미지 한 장
→ 범용 AI
→ 완성된 메시와 텍스처
```

본 시스템은 다음과 같은 구조다.

```text
도메인별 생성기가
메시와 의미 UV를 동시에 만들고,

결정적인 Material Compiler가
물질·형상·제작·손상 상태를
PBR 텍스처로 변환하며,

AI는 구조 선택과 제한된 장식 생성에만 사용되는
게임 자산 생산 파이프라인
```

첫 번째 기술 검증의 성공 기준은 다음이다.

```text
참조 검 이미지 한 장을 입력한다.

검 생성기가
칼날·가드·손잡이·폼멜을 생성한다.

각 부품의 UV가
자동 언랩 없이 생성 규칙에서 결정된다.

탄소강·청동·가죽 머티리얼이
동일한 규칙으로 안정적으로 적용된다.

검의 길이와 폭을 바꿔도
연마와 긁힘의 실제 크기가 유지된다.

같은 seed에서는
동일한 메시와 동일한 텍스처가 출력된다.

최종 결과를
웹에서 사용할 수 있는 GLB와 KTX2로 출력한다.
```

이 수직 단면이 먼저 완성되어야 이후에 창·도끼·식물·암석·생물과 같은 별도의 도메인 생성기를 추가할 수 있다.
