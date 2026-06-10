# DESIGN-3D — HWS 3D 프레젠테이션 레이어 설계

> step-0008 이후의 step 작업을 **3D로 조작·관찰**하기 위한 설계 문서.
> 기존 2D 엔진([hws-ui.js](hws-ui.js)·[PANEL.md](PANEL.md))은 **불변**. 시각 철학은 [../VISION.md](../VISION.md)의
> "필드→현상 사전"을 따른다 — 브라우저 3D 는 그 사전의 1차 구현이자 UE 시각화의 프로토타입이다.

---

## 확정 결정 (설계의 전제)

| # | 결정 | 근거 |
|---|---|---|
| D1 | **WebGL2, 자체 미니 렌더러** (의존성 0, 단일 파일) | file:// 더블클릭·아카이브 영속성·자기완결 에토스. 64×64 워크로드에서 범용 엔진 불필요 |
| D2 | **WebGPU 미채택** — 단 GPU 백엔드를 교체 가능하게 분리(경첩) | 킬러 기능(컴퓨트)이 쓰일 자리 없음: 시뮬은 결정론 CPU JS 불변(GPU 부동소수점은 비트 결정론 불가). 드로콜 ~2개라 오버헤드 장점도 무의미. file://·브라우저 커버리지·스펙 안정성 리스크만 삼 |
| D3 | **3D 는 보기 전용이 아니라 완전한 인터페이스** — 조작(클릭)·관찰(오버레이·통계·호버) 전부 3D 에서 가능 | 사용자 요구. 2D 캔버스 없이도 step 작업이 가능해야 한다 |
| D4 | **단계적 voxel 확장** — 1단계: 2D 격자 세계를 3D 인터페이스로. 2단계: 이후 step 이 시뮬 공간을 W×H×D 로 확장(D=1 → 기존과 비트 동일 = 회귀 0) | 사용자 결정. 렌더러는 처음부터 D 차원을 염두에 두고 설계 |
| D5 | **엔진 불변** — hws-ui.js/hws-ui.css 무수정, 닫힌 step-0001~0007 무수정 | PANEL.md 불변 규칙. 통합은 공식 확장점(panel 장식·drawHook)만 사용 |

---

## 아키텍처

```
engine/
  hws-ui.css        ← 불변
  hws-ui.js         ← 불변 (패널·컨트롤·통계표의 주인 — DOM 은 계속 2D 엔진이 만든다)
  hws-3d.js         ← 신규. window.HWS3D. 내부 2층:
                       ├─ 장면 동기화층: sim 스냅샷 → 정점/인스턴스/텍스처 버퍼 (GL 무관)
                       └─ GL 백엔드(경첩): 버퍼 → 화면. 표면적 ~6 함수
                          (uploadField(E,W,H,D) · drawField · uploadAgents · drawAgents ·
                           setCamera · pick(ray)) — WebGPU 전환 시 이 층만 교체
  DESIGN-3D.md      ← 이 문서
  PANEL.md          ← 3D 절 추가 예정
  validate/
    step-0007-3d.html  ← 신규. 닫힌 step-0007 을 3D 셸로 재현(엔진 검증, 닫힌 파일 불변)
```

### 셸 통합 (step-0008.html, ~14줄)

```html
<script src="step-0008/sim-core.js"></script>
<script src="engine/hws-ui.js"></script>
<script src="engine/hws-3d.js"></script>
<script src="step-0008/panel.js"></script>
<script>HWS3D.bind(HWS.mount(window.HWS8, HWS3D.attach(window.HWS_PANEL_0008)));</script>
```

- **`HWS3D.attach(panel)`** — 패널을 *장식*해서 반환. 엔진은 평범한 패널로만 인식:
  - `drawHook` 체이닝(기존 훅 보존): 매 draw 마다 `sim.E`→필드 버퍼, `agents`→인스턴스 버퍼 동기화. **drawHook = 데이터 동기화만.**
  - `controls` 에 `{kind:'check', id:'view3d', view:true}` 뷰 토글 행 주입(2D ↔ 3D 캔버스 표시 전환, 기본 3D).
- **`HWS3D.bind(handle)`** — `HWS.mount` 반환값 `{sim, reset, draw}` 를 받아 3D 측 api 셈(클릭 디스패치·redraw)을 완성.
- **자체 rAF 렌더 루프** — 카메라 궤도/줌은 시뮬 일시정지 중에도 부드러워야 하므로 3D 렌더는 자체 `requestAnimationFrame` 으로 돌고, 마지막 동기화된 스냅샷을 그린다(시뮬 tick 과 렌더 프레임 분리 — STATE G1 의 원칙을 프레젠테이션에서 선실천).
- **HUD 레이어** — WebGL 캔버스 위에 투명 2D 캔버스를 겹쳐 스파크라인·토스트·호버 툴팁을 그린다(텍스트는 2D API 가 압도적으로 쉬움). 통계표·컨트롤은 DOM 이라 2D/3D 모드 무관하게 동작.

### 조작 (D3) — 레이캐스트 → 기존 clickModes 재사용

- 3D 캔버스 클릭 → 카메라 역투영 레이 → 하이트필드 교차 → 셀 좌표 `(cx,cy)` → **기존 `panel.clickModes[mode](api,cx,cy)` 그대로 디스패치**. 패널은 2D/3D 를 구분하지 않는다(시그니처 불변).
- 드래그(카메라 회전)와 클릭(조작) 구분: 이동 <5px 이면 클릭.
- 호버: 같은 레이캐스트로 셀 `(x,y)`·`E` 값·근처 에이전트 `m` 을 HUD 툴팁으로 — 2D 에 없던 관찰 보강.
- voxel 확장 시 좌표 규약: `(cx,cy)` → `(cx,cy,cz)` 인자 *추가*(기존 2-인자 핸들러는 무수정 동작).

### 관찰 (D3) — 표준 오버레이 3D 등가물

| 2D 오버레이 | 3D 등가물 |
|---|---|
| 열지도 | 하이트필드: 높이 = log(1+E) 스케일(자동 명암 노브 공유), 색 = 기존 `colorOf` 램프 재사용(2D 와 색 일관) |
| 저장체 R 사각(step-0008 drawHook) | E+R 합산 높이의 호박색 암석 융기 — `sim.R` 이 있으면 자동(RG32F 텍스처 g 채널). 퇴적이 지형을 키운다(VISION "반영구 지형" 행) |
| source/sink 원 | emissive 기둥/링 · 어두운 함몰 마커 (떠도는 자원의 이동이 입체로 읽힘) |
| 고임 ○ | 봉우리 하이라이트 링 |
| 생명 ● | 표면 위 발광 인스턴스 점(크기 ∝ √m — 2D 와 동일 규칙) |
| 무게중심 ✛ | 수직 빔 (step-0007 추적이 직관적으로 보임) |
| 스파크라인·토스트 | HUD 2D 레이어 |
| 통계표 | DOM 그대로 (모드 무관) |

토러스 경계: v0 는 평면 + 가장자리 normal wrap. (진짜 토러스 곡면은 가독성을 해쳐 비채택. 3×3 타일 미러는 백로그.)

---

## 2단계 — 시뮬 공간의 3D 확장 (이후 step 의 한 조각)

시뮬 공간 자체를 voxel 로 확장하는 것은 **sim-core 의 step** 이다(엔진 작업 아님). 불변 규칙·척추 체크를 그대로 통과해야 한다:

- **회귀 0 경로**: `E` 를 `W×H×D` 로 일반화하되 **`D=1` 이면 기존 2D 코어와 비트 단위 동일** — 확산 stencil·응집·이동이 D=1 에서 z 항이 정확히 0 이 되도록 설계. verify `reg` 가 D=1 vs step-0007 비트 비교로 증명.
- **척추 정합**: 터(Ground)는 "그릇"(SPINE 6요소 매핑) — 차원 확장은 터의 진화이지 새 요소가 아니다. 단일 척추(E 하나)·국소 문턱·닫힌 장부는 차원과 무관하게 유지.
- **렌더 전환**: 하이트필드 → 볼륨. WebGL2 `sampler3D` 레이마칭 또는 인스턴스드 voxel(임계 이상 셀만) — 백엔드 경첩의 `uploadField(E,W,H,D)` 가 처음부터 D 를 받으므로 동기화층은 무수정.
- **픽킹 전환**: 레이 vs 하이트필드 → 레이 vs 볼륨(임계 이상 첫 셀) 또는 깊이 슬라이스 커서. 상세는 그 step 에서.
- **우선순위**: STATE.md 의 "다음"(step-0008: 연속 churn)이 우선이며, 공간 3D 확장은 백로그에 올려 STATE 가 지정할 때 착수한다(한 step = 한 조각).

---

## 검증

- **구조적 보증**: 3D 는 스냅샷의 함수일 뿐 시뮬에 쓰지 않는다(서버 권위 원칙의 브라우저판). `attach` 는 `controls`(view 전용 행)·`drawHook` 만 만지므로 `defaultParams` 매핑 불변 → 회귀·장부·결정론 자동 보존.
- **기계 증명**: `verify-engine.js` 에 "attach 전후 `HWS.defaultParams(panel)` 동일" 검사 1줄 추가.
- **재현 검증**: `validate/step-0007-3d.html` 로 닫힌 step-0007 을 3D 재현 — 통계표 수치가 2D 셸과 동일함을 확인(닫힌 step 파일 불변).
- 문서 수치 = verify 출력 원칙은 3D 와 무관하게 불변.

---

## 로드맵

| 단계 | 산출물 | 닫는 조건 |
|---|---|---|
| **3D-0: 엔진** | `hws-3d.js`(하이트필드+에이전트+오버레이+카메라+레이캐스트 조작+HUD+토글) · `validate/step-0007-3d.html` · PANEL.md 3D 절 · verify-engine 검사 추가 | step-0007 이 3D 에서 조작·관찰 전부 가능, 2D 토글 시 기존과 동일, verify-engine 통과 |
| **3D-1: step-0008 적용** | step-0008 셸 1줄 + bind 1줄 | step-0008 4기둥과 독립(3D 는 검증 비대상임이 곧 검증) |
| **3D-2: voxel 확장** | 이후 step 의 sim-core 한 조각(W×H×D, D=1 회귀 0) + 백엔드 볼륨 렌더 | 그 step 의 4기둥 + 척추 체크 4항 |
| **세계 해석 2분할** ✅ | `hws-3d.js` 에 `progW`(활성도 분류 셰이더) + 2분할 뷰포트 + '세계 해석(2분할)' 토글(view 전용). 좌=에너지 변위(원본)/우=세계(물·돌·나무[유전]·빛). A 를 텍스처 alpha 로 실음. 설계 [../RENDER.md](../RENDER.md) | 전 3D 셸(0009~)에서 자동 표시·토글, verify-engine/smoke 통과(셸 수정 0) |
| 백로그 | ∇E 파생 바람(흐름 입자, VISION (A)안) · 3×3 토러스 타일 · pools 결정화 연출 · FSM 상태 채널(이산 재질) | step 진행에 맞춰 사전의 행을 하나씩 |

문서 갱신(3D-0 닫을 때): PANEL.md(3D 셸/attach·bind 스펙) · STATE.md "빌드 인프라" 한 줄 · VISION.md(브라우저 3D = UE 전 단계 명기, 사전에 브라우저 구현 상태 열 추가).
