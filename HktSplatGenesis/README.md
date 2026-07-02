# HktSplatGenesis — 속성이 형태가 되는 스플랫 생명

캡처가 없는 3D Gaussian Splatting. `.ply` 를 로드하는 대신, **소수의 유전자(응집력·휘발성·상승력…)로부터 형태가 창발**한다. 슬라임·정령·골렘 같은 판타지 존재를 "모델링"하지 않고 "배양"하는 실험장.

`HktGaussianSplatWeb`(캡처 재생 뷰어)과 상보 관계 — 렌더 수학(EWA 투영)은 공유하고, 데이터의 출처가 정반대다.

## 핵심 아이디어: 스플랫 = 세포

- 각 스플랫은 시뮬 상태(위치·속도·나이·에너지)만 가진다.
- 렌더 속성(공분산·색·불투명도·크기)은 매 프레임 시뮬 상태로부터 **유도**된다 — 직접 만드는 코드가 없다.
- 개체의 정체성은 메시/텍스처가 아니라 **유전자 벡터**: 같은 시스템에서 유전자만 바꾸면 불꽃이 물방울이 되고 숲의 정령이 된다.
- 속도 방향으로 스플랫이 늘어나는 이방성(anisotropy)이 붓터치 같은 질감을 만든다 — 3DGS 고유의 표현 채널.

## 실행

WebGPU 지원 브라우저(Chrome/Edge 113+) 필요. 로컬 정적 서버 권장:

```bash
cd HktSplatGenesis
python -m http.server 8080
# 브라우저에서 http://localhost:8080
```

우측 패널: 원소 프리셋(불/물/숲) → 유전자 슬라이더로 연속 변형 → 중간 생물 탐색.

## 아키텍처 (전부 GPU 상주, CPU 왕복 없음)

```
유전자(uniform) ─► sim 패스(compute): 자율 규칙 — 구심 + 난류 + 부력, 수명/재생성
                        │  storage: Splat{pos, vel, age, life, energy} × N
                        ▼
                  key 패스: 뷰 깊이 → 단조 uint 키
                        ▼
                  bitonic sort (동적 오프셋 유니폼, log²N 단계) — back-to-front
                        ▼
                  렌더: 시뮬 상태 → 3D 공분산 유도(속도 정렬 이방성)
                        → EWA 2D 투영 → 인스턴스드 쿼드, premultiplied over
```

| 파일 | 역할 |
|---|---|
| `js/math.js` | mat4 유틸 + 오빗 카메라 (WebGPU 클립 규약) |
| `js/wgsl.js` | WGSL 4종: sim / key / bitonic sort / render |
| `js/engine.js` | 버퍼·파이프라인·프레임 인코딩 |
| `js/app.js` | 유전자 UI + 프리셋 + 루프 |

## 로드맵 (레이어 = 데모)

- **L0 렌더 파이프라인** ✅ 풀 + GPU 정렬 + EWA 래스터
- **L1 자율 규칙** ✅ 이웃 없는 per-splat 규칙 — 정령(불/물/숲)
- **L2 이웃 규칙**: spatial hash + 응집/분리/점성 → **슬라임** (분열·합체)
- **L3 본드/클러스터**: shape matching + 파괴/재흡수 → **돌골렘**
- **L4 성장**: 스플랫 증식 + 방향성 성장 → **나무** (성장→연소→재생)
- **L5 원소 상호작용**: 개체 간 에너지 교환 (불 vs 나무, 슬라임의 포식)

이후 UE5 이식: 이 compute 파이프라인이 그대로 설계도가 된다 (`HktGaussianSplat` 플러그인의 래스터 + Niagara/compute 시뮬).
