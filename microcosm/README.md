# microcosm (python)

하나의 규칙에서 2D 세계를 **창발**시키는 프레임워크. 지형·바다·바위·나무·
움직이는 개체가 모두 같은 기질 위에 단위를 다르게 배치한 *레시피*일 뿐이다.

```
dx/dt = f(x) + Σ_j W_ij g(x_i, x_j) + I_i - γ x_i
        자체동역학   상호작용=장          흐름   소산
```

## 원리 ↔ 파일

| 층 | 파일 | 내용 |
|---|---|---|
| 기질 + 보편 규칙 step() | `microcosm/core.py` | 단위 상태 배열, 통합 적분기, 소멸/상호작용 |
| 장(규칙의 항) | `microcosm/fields.py` | Pair(열·반발·응집)·Env(부력·중력·냉각·항상성·점성)·Bond(스프링+융점파괴)·Terrain(지지력) |
| 레시피 + 레지스트리 | `microcosm/forms.py` | terrain·water·character·rock·tree·creature·fireball |
| 렌더(읽기 전용) | `microcosm/render.py` | matplotlib 헤드리스 렌더 |
| 실시간 앱 | `app.py` | pygame 입력·렌더 루프 |
| 헤드리스 데모 | `demo.py` | 장면을 굴려 PNG/GIF 생성 |

핵심: **엔진(core+fields)=무엇이 가능한가, 레시피(forms)=무엇을 만드나,
렌더(render/app)=읽어서 그리기.** 새 요소는 레시피만, 새 물리는 장만 추가한다.

## 설치 · 실행

```bash
pip install numpy matplotlib pillow pygame
python app.py     # 실시간 인터랙티브 (좌드래그=물, R 바위, T 나무, C 개체, F 불, N 리셋)
python demo.py    # 헤드리스: demo_world.png + microcosm_world.gif 생성
```

## 30초 사용법

```python
from microcosm import World, standard_fields
w = World(); standard_fields(w)
w.spawn_form('terrain')
w.spawn_form('water', cx=100, count=80, topY=112)
w.spawn_form('tree', baseX=60)
w.spawn_form('rock', cx=150)
w.spawn_form('creature', cx=120)
w.run(600)        # 시뮬레이션 (dt=0.02)
```

## 각 요소가 창발하는 원리

- **지형** `TerrainField` — 높이함수 h(x) 법선 지지력 + 마찰. 경사면에선 미끄러짐.
- **바다** `PairField`의 물-물 응집(표면장력) + 중력·반발(압력)·점성 → 흘러 고이는 유체.
- **바위** 강결합·고융점(melt=9) 2D 격자 → 단단한 강체. 무거워 골짜기로.
- **나무** 2열 트러스 줄기 + 넓은 고정 뿌리(쓰러짐 방지). 불에 결합 융해 → 붕괴.
- **개체** 캐릭터(결합+항상성) + 방랑 추진력(`CreatureCtrl`, 입력항 I) → 지형 위를 걸음.

## 새 요소 추가법

`forms.py`에 함수 하나 + `@register('name')`. 엔진은 손대지 않는다.

```python
from microcosm.forms import register
from microcosm.core import KIND

@register('boulder')
def boulder(w, cx=120, r=8):
    return REGISTRY['rock'](w, cx=cx, r=r)   # 기존 레시피 조합도 가능
```

새 *물리*가 필요하면 `fields.py`에 `Field` 하나를 추가해 `apply(world)`에서
`world.F`/`world.dT`에 기여하게 만들고 `standard_fields`에 끼우면 된다.

## Phase 0 — 층위 창발 검증 (`phase0.py`, `microcosm/layers.py`)

목표는 이 엔진을 **거대한 오픈월드를 *창발*시키는 시뮬레이션 두뇌**로 키우는 것이다.
그러려면 두 주장이 사실이어야 하며, 가장 싼 파이썬에서 먼저 입증한다.
이론 근거는 [`systems.pdf`](systems.pdf) 2~3장(분기·재규격화군).

```bash
python phase0.py      # 3종 실험 실행 → phase0_results.png + 콘솔 지표
```

| 실험 | 묻는 것 | 결과 |
|---|---|---|
| **ExpA** (R1·수직 창발) | L0 단위 클러스터가 *그 자체로* L1 상위 단위가 되는가? 라운드트립이 보존되는가? | 물입자 126 → 호수 7개(**18× 압축**), 질량·운동량·질량중심 보존 오차 ~1e-14 |
| **ExpB** (분기·식 3) | 제어변수(응집강도 K)를 임계점 너머로 올리면 질서변수 φ 가 0→1 로 솟는가? | φ: K=0 의 0.07 → K≥5 의 1.0, **임계 K≈0.5~1** 의 깨끗한 분기 |
| **ExpC** (R2·거칠게 보기) | 거시(coarse) 모델이 미세(fine) 질량중심 궤적을 재현하는가? | 소산 결합을 ×N 재규격화하면 오차 **≈0**(머신 정밀도), 순진 묶음은 발산(오차 7.7) |

핵심 메커니즘(`layers.py`):

- `promote(world, cluster)` — 거칠게 보기. L0 묶음을 L1 메타-단위(`kind=AGG`) 1개로.
  내부 상호작용 `Σ W·g` 는 작용-반작용으로 상쇄되어 사라지고(무관한 세부 → 0),
  보존량(질량·운동량·질량중심)만 남는다. 메타-단위도 그냥 `World` 의 한 단위라
  같은 `step()` 동역학(중력·소산·지지)을 받는다 — *"층이 바뀌면 명사만 바뀐다"*.
- `refine(world, meta)` — 미세화. 메타-단위를 L0 단위들로 복원(보존 일관).
- `order_parameter(world, kind, link)` — 질서변수 φ = 최대 클러스터 질량분율.

**MMO 로의 함의**: 멀리 있는 영역은 φ(거시 상태)만 싸게 굴리고(promote),
플레이어가 다가오면 미세화(refine)한다 — RG 가 곧 LOD/관심영역 관리의 정당성이다.
단, **소산 같은 결합상수는 거칠게 보기에서 재규격화(ExpC)되어야** 거시가 일치한다.

## 아트 렌더 Phase — 기질에서 아트를 뽑아낸다 (`artrender.py`)

방향 전환: microcosm 을 "게임플레이 시뮬"이 아니라 **아트 리소스를 *생성*하는 엔진**으로
본다. 나무·캐릭터(스켈레톤)·바다·지형의 시각적 형태와 움직임을 하나의 규칙에서 뽑아내
손으로 그리는 아트 비용을 없앤다. 병목은 물리가 아니라 **렌더링(스키닝)** 이다.

```bash
python art_character.py     # 스켈레톤 캐릭터 → art_character.png
```

통합 프리미티브(하나의 렌더러로 모든 자산):

- **스킨 = 암시적 표면(SDF).** 입자/뼈를 거리장으로 바꿔 매끈한 표면을 뽑고, 방향광
  셰이딩 + 외곽선. `_smin`(smooth-min)으로 관절을 부드럽게 융합. → *캐릭터 스킨 =
  나무 캐노피 = 바다 표면* 이 같은 코드.
- **림 = 캡슐.** 뼈·가지·줄기를 선분+반경 캡슐로(`{'kind':'capsule', 'r':, 'mat':}`).
- **재질 팔레트**(피부/옷/머리카락/바크/잎/암석/물) — 같은 기질, 다른 셰이딩.

검증(가장 어려운 자산 먼저): `skeleton` 폼(관절=입자, 뼈=본드+스킨 캡슐) →
**알아볼 수 있는 사람 실루엣**(회색 곤죽 아님). 머리·목·옷 몸통·피부 아래팔·바지 다리.
다음: 보행(물리 창발) → 프레임/스프라이트시트 베이크, 그리고 바다·나무·지형에 동일 렌더 적용.

## 한계 (의도적 단순화)

- 쌍 상호작용 O(n²)(numpy 벡터화) — 수백~천 단위까지 실시간. 대규모는 공간격자 필요.
- 명시적 오일러, dt=0.02 — 매우 강한 결합은 더 작은 dt 필요.
- 단위 삭제 시 배열 압축 없음(소멸은 alive 플래그).
