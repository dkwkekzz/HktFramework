# PLAN — Spark 지형 무대 (worldlabs Marble 월드 위의 스플랫 생명)

상태: 계획 확정 (2026-07, 사용자 결정). 단계 큐는 [ROADMAP.md](ROADMAP.md) S 트랙, 결정 기록은 [DESIGN.md](DESIGN.md).

## 결정

절차 노이즈만으로는 [Spark 2.0 블로그](https://www.worldlabs.ai/blog/spark-2.0)급 지형 충실도가 나오지 않는다.
따라서 세계를 **2층**으로 나눈다:

- **무대(stage)** — worldlabs **Marble** 로 생성한 3DGS 지형 월드를 **Spark 렌더러(WebGL2 + three ESM)** 로 로드·스트리밍. 정적, 로드된다.
- **생명(life)** — 기존 WebGPU 파이프라인의 스플랫 생명(슬라임/골렘/나무/히키토). 동적, 배양된다. 절대 원칙 1~3 그대로 유지.

"캡처 없음" 원칙은 **생명에만** 적용된다. 무대를 WebGPU 로 재구현하지 않는 이유: Spark 의
LoD 스플랫 트리·`.RAD` 스트리밍·포맷 파서(.ply/.spz/.sog)·기기별 스플랫 예산을 재작성하는
비용이 2-캔버스 합성 비용을 압도한다. Spark 은 오픈소스이고 대용량 정적 월드 재생이 본업이다.

## 아키텍처 — 2-캔버스 합성

```
[아래 캔버스] WebGL2 · three r180+ ESM · SparkRenderer     ← 무대: Marble .spz/.ply/.rad (LoD 스트리밍)
[위 캔버스]   WebGPU (기존 engine.js)                        ← 생명: alpha 투명 클리어, premultiplied 합성
─────────────────────────────────────────────────────────────
공유 1: 카메라 — HktOrbitCamera 가 원본, 매 프레임 three 카메라로 미러
공유 2: heightfield — Marble collider mesh(GLB) 에서 베이크 → 시뮬 바닥 + 오클루전 depth
```

- 데이터 흐름은 단방향: 무대는 생명을 모르고, 생명은 무대를 **heightfield 라는 상태**로만 안다.
  (시뮬이 읽는 것은 Spark 스플랫이 아니라 collider 에서 구운 텍스처 — GPU 상주 원칙 유지.)
- Marble 익스포트 활용: 고해상 `.ply` / 저해상 500k `.spz`(뷰) + **Collider Mesh `.glb`**(물리·오클루전).

### 좌표 정합 (함정)

- `math.js` 는 WebGPU 클립 규약(z∈[0,1]), three/Spark 은 GL 규약(z∈[-1,1]) — 투영은 각자 만들고
  **뷰(눈 위치·타깃·fov)만** 공유한다. 행렬을 직접 넘기지 말 것.
- Marble 월드의 스케일·원점은 생명 월드(격자 ~9.6u, 바닥 y=0)와 다르다 — 무대에 offset/scale/yaw
  노브를 두고 정합값을 월드별 JSON(sidecar)에 저장.

## 단계 (ROADMAP S 트랙과 1:1)

### S1 — 무대 로더 + 카메라 동기 (Spark 최소 통합)

- `vendor/spark/` 에 Spark ESM + three r180+ ESM 사본(무대 전용, 기존 r147 UMD 와 격리).
  `js/stage.js` 를 `<script type="module">` 로 로드 — classic 전역과 공존, 전역 `HktGenesisStage` 노출.
- `assets/worlds/` (gitignore) + README: Marble 에서 월드 받는 법, 파일 배치. 파일 없으면 Spark 공개
  샘플 URL 폴백으로 데모.
- WebGPU 캔버스 합성 준비: `context.configure({ alphaMode: 'premultiplied' })` + 클리어 a=0
  (현재 불투명 클리어, engine.js:576). 배경색은 무대가 담당.
- 카메라 미러 + 정합 노브(offset/scale/yaw) UI 탭.
- **완료 기준**: 무대 월드 위에 기존 생명(불×나무 장면)이 카메라 일치로 오버레이되는 스크린샷
  (오클루전 없이 항상 앞에 그려지는 상태 — S3 전 한계로 명시).

### S2 — 충돌: collider GLB → heightfield → 시뮬 바닥

- GLB 파서(positions+indices 만 읽는 최소 구현, vendor 예외 불필요) → 삼각형 수프 → 수직
  레이캐스트로 N×N heightfield 베이크(로드 시 1회, 워커) → WebGPU `r32float` 텍스처 업로드.
- `wgsl.js` SIM: 바닥 `y < P.floorY` 평면(wgsl.js:310)을 `y < terrainH(pos.xz)` 로 교체
  (textureLoad + 수동 bilinear, floorY 는 heightfield 없을 때 폴백).
- 법선은 heightfield 기울기에서 유도 — 반사·마찰이 경사를 따르게.
- **완료 기준**: 슬라임이 경사면을 흘러내리고, 나무가 능선 위에 자라고, 불×나무 장면이 골짜기에서
  벌어지는 스크린샷. 평지 폴백(월드 미로드) 회귀 없음.

### S3 — 오클루전 합성 (생명이 언덕 뒤로 가려진다)

- collider mesh 를 WebGPU **depth-only prepass** 로 렌더 → depth 텍스처.
- 생명 렌더 FS 에서 depth 비교 후 soft fade(경계 팝 방지). 스플랫이라 정확 해가 없음 —
  무대 스플랫은 대부분 불투명이므로 collider 근사가 시각적으로 충분하다는 것이 가설, 사진으로 검증.
- 톤 정합: 같은 distance fog 파라미터를 무대(three fog)와 생명(렌더 셰이더) 양쪽에 적용.
- **완료 기준**: 생명이 언덕 뒤로 이동하면 가려지는 전후 스크린샷. 프레임 예산 내(perf HUD).

### S4 — LoD 스트리밍 + 성능 예산

- Spark CLI 로 `.ply` → `.rad` 베이크(LoD 트리) 후 스트리밍. **함정**: `python -m http.server` 는
  HTTP Range 요청 미지원 — `.rad` 스트리밍이 안 됨. run.sh/run.bat 서버를 Range 지원 서버로 교체
  (예: `npx serve` 또는 파이썬 RangeHTTPServer). test/ 하니스 서버도 동일.
- 기기별 Spark 스플랫 예산 설정, 두 GPU 컨텍스트(WebGL2+WebGPU) 프레임 타임 계측 HUD.
- **완료 기준**: 고해상 Marble 월드가 점진 로드되며 목표 fps(데스크톱 60) 유지 수치 기록.

### S5 — 상호작용 심화 (선택)

- 무대 스플랫은 정적이라 직접 변형 불가 → 흔적은 **생명 쪽에서 스폰**: 연소 재/그을음 데칼
  스플랫(우리 풀 슬라이스)을 heightfield 표면에 부착.
- 시뮬 버블: `GRID_ORIGIN` 카메라 추종으로 넓은 무대 탐험 (L4 rest 부착점 월드 좌표 주의).

## 리스크 / 열린 문제

| 항목 | 내용 | 대응 |
|---|---|---|
| 두 three 사본 | r147 UMD(FBX)와 r180+ ESM(Spark) 공존 | 모듈 스코프 격리, 혼용 금지 (CLAUDE.md 컨벤션 개정) |
| 브라우저 요구 | WebGPU+WebGL2 동시 — iOS 는 생명 레이어 불가 | 기존 요구사항과 동일(WebGPU 필수), 변화 없음 |
| 오클루전 정밀도 | collider 는 저충실 근사 — 절벽 가장자리 어긋남 가능 | soft fade + 사진 검증, 부족 시 S3 에서 high-quality mesh 로 교체 |
| Marble 라이선스 | 생성 월드의 사용 조건 확인 필요 | 에셋은 repo 밖(gitignore), 사용 전 약관 확인 |
| 대용량 에셋 | 월드 수백 MB | repo 미포함, assets/worlds/README 로 수급 절차만 버전 관리 |
| 검증 하니스 | 합성 결과는 스왑체인 readback 으론 못 찍음 | test/ 에 페이지 스크린샷 방식 추가 (app-smoke 계열) |

## 검증

각 단계 완료 기준은 `test/` 하니스 스크린샷으로 재현한다 (사진 없는 "동작함" 주장 금지 — CLAUDE.md).
S1 부터 합성 캡처용 `stage-shot.js`(페이지 스크린샷) 를 추가하고, 무대 미로드 폴백(기존 데모 회귀
없음)을 모든 단계에서 함께 확인한다.
