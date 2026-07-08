# HktSplatGenesis — 속성이 형태가 되는 스플랫 생명

캡처가 없는 3D Gaussian Splatting. `.ply` 를 로드하는 대신, **소수의 유전자(응집력·휘발성·상승력…)로부터 형태가 창발**한다. 슬라임·정령·골렘 같은 판타지 존재를 "모델링"하지 않고 "배양"하는 실험장.

`HktGaussianSplatWeb`(캡처 재생 뷰어)과 상보 관계 — 렌더 수학(EWA 투영)은 공유하고, 데이터의 출처가 정반대다.

## 핵심 아이디어: 스플랫 = 세포

- 각 스플랫은 시뮬 상태(위치·속도·나이·에너지)만 가진다.
- 렌더 속성(공분산·색·불투명도·크기)은 매 프레임 시뮬 상태로부터 **유도**된다 — 직접 만드는 코드가 없다.
- 개체의 정체성은 메시/텍스처가 아니라 **유전자 벡터**: 같은 시스템에서 유전자만 바꾸면 불꽃이 물방울이 되고 숲의 정령이 된다.
- 속도 방향으로 스플랫이 늘어나는 이방성(anisotropy)이 붓터치 같은 질감을 만든다 — 3DGS 고유의 표현 채널.

## 실행

WebGPU 지원 브라우저(Chrome/Edge 113+) 필요.

- **Windows**: `run.bat` 더블클릭 (Python 필요 — py 런처/python 자동 탐색)
- **macOS/Linux**: `./run.sh`

둘 다 로컬 정적 서버(`:8123`)를 띄우고 기본 브라우저를 연다. 수동 실행은:

```bash
cd HktSplatGenesis
python -m http.server 8123
# 브라우저에서 http://localhost:8123
```

### 에디터 (작업 확인 도구)

`http://localhost:8123/editor.html` — 일반 게임 에디터 형태의 별도 진입점 (데모 index.html 불변).
툴바(모드/팔레트/스플랫 수) · 아웃라이너(지형/스켈레톤/개체) · 뷰포트(마커 선택·드래그 이동, 배치 모드 클릭 배치) · 디테일(선택 대상의 파라미터 — 지형 시드/진폭, 개체 유전자 슬라이더, 스켈레톤 위치/FBX + 캐릭터 게놈: 체형 프리셋·부위 굵기/길이·부위 채색·부속·게놈 JSON 입출력) · 타임라인(재생/스크럽/클립/배속). 세 기둥:

1. **지형 생성** — 시드 fBm 절차 지형을 무대(PLY→Spark)와 시뮬 바닥(collider→heightfield)에 한 번에 굽는다.
2. **오브젝트 배치** — 프리셋 개체(최대 8)를 지형 클릭 지점에 배치, 마커 드래그로 이동, 유전자 라이브 튜닝.
3. **애니메이션** — 장면 공용 스켈레톤(built-in 클립/Mixamo FBX)을 지형 위에 세우고 타임라인으로 확인.

검증: `node test/editor-shot.js` (합성 사진 + 판정).

### 데모 (index.html)

우측 패널은 탭 3개: **유전자** 탭(원소 프리셋 → 슬라이더로 연속 변형 → 중간 생물 탐색, 장면 버튼(불×나무)은 다중 개체 공존 데모) · **뼈대** 탭(히키토의 모션 클립/속도·통통함·뼈대 표시, 그리고 **Mixamo FBX 드롭존** — Mixamo 에서 FBX 로 받은 캐릭터/클립을 놓으면 실제 클립 위에 살이 자란다) · **무대** 탭(S 트랙 — worldlabs Marble 등 외부 생성 3DGS 월드(.spz/.ply)를 드롭하면 Spark 레이어가 생명 아래에 깔린다. "무대는 로드, 생명은 배양" — [Docs/PLAN-SparkTerrain.md](Docs/PLAN-SparkTerrain.md), 수급: [assets/worlds/README.md](assets/worlds/README.md)).

### 캐릭터 게놈 (C 트랙) — 이미지 몇 장으로 캐릭터

캐릭터의 정체성은 메시가 아니라 **게놈(JSON, 수 KB)** — ①형태(부위별 반지름·길이 배율)
②채색(부위 그룹 램프) ③재질(유전자 차분) ④부속(꼬리·뿔 = 가상 뼈 스프링 체인, 클립 무수정)
4층의 데이터다. 표준 리그의 모든 클립이 어떤 게놈에서도 무수정 재생된다 — 스키닝이 없으므로
리타게팅도 없다.

```bash
# 컨셉 이미지 → 게놈 번역 (스타일 프로파일이 울타리 — 벗어나면 반려)
node tools/genome-extract/extract.js front.png side.png --out newt.genome.json
```

추출된 게놈은 에디터(스켈레톤 디테일 패널)에서 불러와 체형·부위 채색·부속 슬라이더로
후보정하고 다시 내보낸다. 상세: [tools/genome-extract/README.md](tools/genome-extract/README.md) ·
계획: [Docs/PLAN-CharacterGenesis.md](Docs/PLAN-CharacterGenesis.md).

## 아키텍처 (전부 GPU 상주, CPU 왕복 없음)

```
개체(Entity) 테이블(storage, 개체=풀의 균등 슬라이스, eid = i / sliceSize)
                        ▼
                  grid clear/build: 64³ dense grid, 셀당 16슬롯 — *전 개체 공유* (L5 통로)
                        ▼
                  sim 패스(compute): L1 자율 규칙 — 구심 + 난류 + 부력 + 중력, 수명/재생성
                        │            L2 이웃 규칙 — 응집/분리(휴지 간격) + 점성, 바닥, 포인터 인력
                        │            L4 나무 — rest 골격 부착 + birth 성장 시계, heat/fuel 연소 전파
                        │            L5 발열(heatEmit) — 다른 개체의 연소 규칙에 열원으로 잡힘
                        │            L6 뼈대 살(fleshK) — CPU FK 뼈대(taper 캡슐 ≤64) 위
                        │              개인 성장 자리(시드 → 축 t·방위 θ·깊이 u)로 스플랫이 끌려가 "자란다"
                        │  storage: Splat{pos, vel, age, life, energy, heat, fuel} × N
                        ▼
                  cluster 패스(compute, L3): 워크그룹 1개 = 돌덩이(스플랫 256개) 1개
                        │  공유 메모리 리덕션 → 무게중심·회전(shape matching) → 강체 복원
                        │  클러스터 간 본드 스프링 — 변형률 > 인성이면 파단, 복귀 시 재흡수
                        ▼
                  key 패스: 뷰 깊이 → 단조 uint 키
                        ▼
                  bitonic sort (동적 오프셋 유니폼, log²N 단계) — back-to-front
                        ▼
                  렌더: 시뮬 상태 → 3D 공분산 유도(속도 정렬 이방성) + 본드 변형률 → 균열 발광
                        → EWA 2D 투영 → 인스턴스드 쿼드, premultiplied over
                        → L6 뼈대 오버레이 (라인 + 관절 점, 토글) — 입력의 시각화
```

슬라임의 분열·합체도, 골렘의 파괴·재생도, 나무의 연소도 별도 기능이 아니라 규칙의 결과다 —
Alt+드래그로 슬라임을 가르면 두 덩어리가 되고, 골렘 팔을 당기면 본드가 파단되어 돌덩이째
떨어지고, 나무에 대면 불씨가 되어 이웃으로 번진다. HP/분열/파괴/연소 코드는 존재하지 않는다.
잎과 줄기의 색 분화조차 창발이다 — 가는 가지끝일수록 바람에 크게 흔들려 속도 기반 팔레트가
자연히 잎색이 된다.

| 파일 | 역할 |
|---|---|
| `js/life/math.js` | mat4 유틸 + 오빗 카메라 (WebGPU 클립 규약) |
| `js/life/skeleton.js` | L6 뼈대: Skeleton IR(joints+FK) + 절차 클립(walk/idle/wave) + 살 문법(radiusForName) + 부속 가상 뼈 체인 + FBX 외부 리그 |
| `js/life/genome.js` | C 트랙 캐릭터 게놈: 형태 배율·부위 램프·재질 차분·부속 체인 + 스타일 프로파일 |
| `tools/genome-extract/` | 이미지 → 게놈 추출기 (LLM vision + 프로파일 검증기) |
| `vendor/` | three r147 UMD + FBXLoader + fflate — FBX 파싱/FK 전용 (렌더·시뮬은 자체 WebGPU) |
| `js/life/wgsl.js` | WGSL 7종: grid clear/build / sim / cluster / key / bitonic sort / render |
| `js/life/engine.js` | 버퍼·파이프라인·프레임 인코딩 |
| `js/app.js` | 유전자 UI + 프리셋 + 루프 |

## 로드맵 (레이어 = 데모)

- **L0 렌더 파이프라인** ✅ 풀 + GPU 정렬 + EWA 래스터
- **L1 자율 규칙** ✅ 이웃 없는 per-splat 규칙 — 정령(불/숲)
- **L2 이웃 규칙** ✅ dense grid + 응집/분리/점성 → **슬라임·물** (분열·합체, 필멸/불멸 구분)
- **L3 본드/클러스터** ✅ shape matching + 본드 파단/재흡수 → **돌골렘** (팔 뜯기, 균열 발광)
- **L4 성장** ✅ 절차 가지 골격 + birth 성장 시계 + heat/fuel 연소 전파 → **나무** (성장→점화→연소→재→재생)
- **L5 원소 상호작용** ✅ 다중 개체 공존(Entity 테이블) + 발열(heatEmit) 유전자 → **불×나무 장면** (모닥불이 나무를 점화)
- **L6 뼈대 살** ✅ hikito-flesh 이식: Skeleton IR(FK, 관절 53) + 이름 기반 살 문법 + fleshK 성장 자리 스프링 + 뼈대 오버레이 + **Mixamo FBX 드롭** → **히키토** (구름이 뼈대 위로 응축해 살이 되고, built-in 클립(걷기/숨쉬기/인사)과 실제 Mixamo 클립을 지연 추종하며 출렁이고, Alt+드래그로 뜯으면 다시 자란다)

이후 UE5 이식: 이 compute 파이프라인이 그대로 설계도가 된다 (`HktGaussianSplat` 플러그인의 래스터 + Niagara/compute 시뮬).

구현 현황과 다음 단계 큐(살 이음새, Evaluator, detail 층, 메시화…)는 [Docs/ROADMAP.md](Docs/ROADMAP.md), 설계 근거·결정·코드 지도는 [Docs/DESIGN.md](Docs/DESIGN.md) 참조. (문서 지도: [CLAUDE.md](CLAUDE.md))
