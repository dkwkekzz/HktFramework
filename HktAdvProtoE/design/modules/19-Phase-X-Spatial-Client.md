# 19. Phase X — 3D 공간과 웹 클라이언트

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「17. Phase X — 3D 공간과 웹 클라이언트」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 17. Phase X — 3D 공간과 웹 클라이언트

## X0. 의미적 지역 그래프

| 항목 | 내용 |
| -- | -- |
| 목적 | 3D 지형 생성 전에 지역 간 의미와 연결 조건을 결정한다 |
| 포함 | Region Node, Boundary, Route, Hidden Path, Choke Point |
| 대표 검증 | 밀수 조직 요구가 있을 때 공식 도로와 분리된 은폐 경로가 생성됨 |
| 선행 | W2, S0 |

## X1. 3D 공간 컴파일

| 항목 | 내용 |
| -- | -- |
| 목적 | 의미적 지역 그래프를 실제 이동 가능한 3D 지형으로 변환한다 |
| 포함 | 3D Embedding, Terrain Mesh, Road, River, Landmark, Navigation |
| 대표 검증 | 인간·거대 마물·비행 생물이 각각 요구된 경로를 실제로 통과할 수 있음 |
| 선행 | X0 |

논리 데이터와 표현 데이터를 분리한다.

```text
논리 공간
  이동 가능성
  관할권
  위험도
  생태
  의념장
  상호작용 지점
표현 공간
  메시
  머티리얼
  식생
  조명
  이펙트
```

## X2. 웹 3D 클라이언트

| 항목 | 내용 |
| -- | -- |
| 목적 | 논리 세계를 브라우저에서 이동하고 관찰할 수 있게 한다 |
| 포함 | Renderer, Camera, Controls, Entity Visual, Animation |
| 대표 검증 | 브라우저에서 지역에 접속하여 이동·충돌·NPC 관찰이 가능 |
| 선행 | X1, S0 |

## X3. 현상·정보·콘텐츠 UI

| 항목 | 내용 |
| -- | -- |
| 목적 | 퀘스트 목록 대신 현상·주장·약속·개입 가능성을 보여준다 |
| 포함 | Phenomenon FX, Claim UI, Evidence UI, Commitment UI, Debug Overlay |
| 대표 검증 | 사실·소문·추측이 출처와 확신도를 달리해 표시됨 |
| 선행 | U1, U2, I2, I3, X2 |

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 패키지 경로

| ID | 패키지 |
|---|---|
| X0 | `packages/spatial-client/X0-region-topology` |
| X1 | `packages/spatial-client/X1-spatial-compiler` |
| X2 | `packages/spatial-client/X2-web-client` |
| X3 | `packages/spatial-client/X3-world-ui` |

원문 「25. 프로젝트 디렉터리 구조」의 `/apps/client` 가 X2·X3 을 실행하는 앱이다.

### 관련 수직 통합

| 슬라이스 | 포함 모듈 (원문 기준) |
|---|---|
| [VS8](30-Vertical-Slices.md#vs8-주체-요구로부터-세계-생성) | X0 |
| [VS9](30-Vertical-Slices.md#vs9-3d-플레이-가능한-지역) | X1~X3 |

### 함께 읽을 세계 설계 원본

- 공간 요구의 예(거대 마물·밀수 조직·비행 종·국가·신) — [Design-MMO.md](../Design-MMO.md) 18.1
- 공간 생성 9계층 — 같은 문서 18.3
- 웹 프로토타입 지형 표현(복셀 미사용, 높이 필드 기반) — 같은 문서 18.4
- 렌더링·물리·빌드 기술 선택(Three.js `WebGPURenderer`, Rapier, Colyseus, Vite) — 같은 문서 27장
- 콘텐츠 투영식 `C_p = Project(...)` 과 UI 표시 항목, 퀘스트식 표현 대신 상황 표현 — 같은 문서 25장
