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

우측 패널: 원소 프리셋 → 유전자 슬라이더로 연속 변형 → 중간 생물 탐색. 장면 버튼(불×나무)은 다중 개체 공존 데모.

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
| `js/math.js` | mat4 유틸 + 오빗 카메라 (WebGPU 클립 규약) |
| `js/skeleton.js` | L6 뼈대: Skeleton IR(joints+FK) + 절차 클립(walk/idle/wave) + 살 문법(radiusForName) |
| `js/wgsl.js` | WGSL 7종: grid clear/build / sim / cluster / key / bitonic sort / render |
| `js/engine.js` | 버퍼·파이프라인·프레임 인코딩 |
| `js/app.js` | 유전자 UI + 프리셋 + 루프 |

## 로드맵 (레이어 = 데모)

- **L0 렌더 파이프라인** ✅ 풀 + GPU 정렬 + EWA 래스터
- **L1 자율 규칙** ✅ 이웃 없는 per-splat 규칙 — 정령(불/숲)
- **L2 이웃 규칙** ✅ dense grid + 응집/분리/점성 → **슬라임·물** (분열·합체, 필멸/불멸 구분)
- **L3 본드/클러스터** ✅ shape matching + 본드 파단/재흡수 → **돌골렘** (팔 뜯기, 균열 발광)
- **L4 성장** ✅ 절차 가지 골격 + birth 성장 시계 + heat/fuel 연소 전파 → **나무** (성장→점화→연소→재→재생)
- **L5 원소 상호작용** ✅ 다중 개체 공존(Entity 테이블) + 발열(heatEmit) 유전자 → **불×나무 장면** (모닥불이 나무를 점화)
- **L6 뼈대 살** ✅ hikito-flesh 이식: Skeleton IR(FK, 관절 53) + 이름 기반 살 문법 + fleshK 성장 자리 스프링 + 뼈대 오버레이 → **히키토** (구름이 뼈대 위로 응축해 살이 되고, 클립(걷기/숨쉬기/인사)을 지연 추종하며 출렁이고, Alt+드래그로 뜯으면 다시 자란다)

이후 UE5 이식: 이 compute 파이프라인이 그대로 설계도가 된다 (`HktGaussianSplat` 플러그인의 래스터 + Niagara/compute 시뮬).
