# microcosm

하나의 규칙에서 게임 세계를 **창발**시키는 프레임워크 골격.

캐릭터·파이어볼·벼락·사슬갑옷은 서로 다른 물리가 아니다. 모두 같은 기질
위에 단위(unit)를 다르게 배치한 **레시피**일 뿐이고, 거시 행동은 그 배치에서
저절로 떠오른다. 우리가 앞서 정리한 시스템 문법을 코드로 옮긴 것이다.

```
dx_i/dt = f(x_i) + Σ_j W_ij g(x_i, x_j) + I_i - γ x_i
          (자체동역학)  (상호작용=장)      (흐름)  (소산)
```

| 6칸 규칙 | 코드 |
|---|---|
| 단위 | `World` 의 상태 배열 (`P,V,T,Q,M,...`) |
| 경계 | `kind` 태그 + `fixed` |
| 상호작용 | `Field` (열·결합·반발·전기…) = `W_ij g` |
| 흐름 | `spawn(...)` 의 초기 에너지·속도, 외부 입력 |
| 피드백 | `HomeostasisField` (음성), 양성은 결합·열 폭주 |
| 창발 | `Form` 레시피 → 거시 행동이 떠오름 |

## 설치 · 실행

```bash
pip install numpy matplotlib pillow
python demo.py        # demo_stages.png 와 microcosm_demo.gif 생성
```

## 30초 사용법

```python
from microcosm import World, standard_fields

w = World(size=(120, 120), dt=0.05, gravity=9.0)
standard_fields(w)                       # 기본 장 세트 장착

w.spawn_form("character", center=(26, 58))
w.spawn_form("fireball", origin=(40, 60), speed=24)
w.spawn_form("lightning", top=(86, 114))
w.spawn_form("chainmail", topleft=(66, 104))

w.run(120)                               # 시뮬레이션
```

## 구조

```
microcosm/
  core.py     World - 단위 상태, 쌍거리 캐시, 통합 적분기(보편 규칙)
  fields.py   Field 들 - 규칙의 각 항(열·결합·반발·항상성·소산·중력)
  forms.py    Form 레시피 + REGISTRY - 캐릭터/파이어볼/벼락/사슬갑옷
  render.py   matplotlib 시각화
```

핵심 분리: **엔진(core+fields) 은 "무엇이 가능한가"를, 레시피(forms) 는
"무엇을 만들 것인가"를** 담당한다. 새 요소를 추가할 때 엔진은 건드리지 않는다.

## 각 요소가 창발하는 원리

- **캐릭터** = 결합(`ElasticBondField`) + 항상성(`HomeostasisField`). 단위들이
  서로 묶여 하나의 응집체로 움직이고, 교란이 와도 평형으로 복귀한다 → '몸'.
- **파이어볼** = 고온 비결합 패킷 + `ThermalField`. 열이 퍼지고(확산), 뜨거우면
  떠오르고(부력), 복사로 식는다(소산) → 불의 거동.
- **벼락** = 확률적 하향 분기 보행 → **프랙탈** 채널. 척도 무관한 가지치기가
  자기유사 구조를 만든다. 발광은 열장의 냉각으로 사그라든다.
- **사슬갑옷** = 격자형 결합 **네트워크**. 위 모서리를 고정하면 중력에 늘어져
  유연한 보호 그물이 링크들의 망에서 떠오른다.

각각 우리 문서의 네 기둥(항상성·열역학·프랙탈·네트워크)에 정확히 대응한다.

## 새 요소 추가법 (확장의 핵심)

엔진을 손대지 않고 `forms.py` 에 레시피 하나만 더한다. 예) 얼음 파편:

```python
from microcosm.forms import Form, register, KIND
import numpy as np

# 1) 새 종류 태그
KIND["ICE"] = 5

# 2) 레시피 작성: 같은 spawn/add_bond API 로 단위를 배치
@register
class IceShard(Form):
    name = "ice"

    def build(self, w, origin=(60, 80), count=18, seed=None):
        rng = np.random.default_rng(seed)
        o = np.array(origin, float)
        idx = []
        for _ in range(count):
            p = o + rng.standard_normal(2) * 2.0
            # 음의 온도 대신 0, 강한 결합 = 단단한 결정
            idx.append(w.spawn(p, T=0.0, mass=0.6, kind=KIND["ICE"]))
        # 가까운 단위끼리 단단히 결합 → 결정 구조 창발
        for a in range(len(idx)):
            for b in range(a + 1, len(idx)):
                if np.linalg.norm(w.P[idx[a]] - w.P[idx[b]]) < 4:
                    w.add_bond(idx[a], idx[b], k=60)
        self.units = idx
        return self
```

```python
w.spawn_form("ice", origin=(60, 80))   # 끝. 바로 사용 가능
```

새 *물리*가 필요하면(예: 자기장) `Field` 를 하나 추가해 `apply(world)` 에서
`world.F`/`world.dT` 에 기여하게 만들고 `world.add_field(...)` 로 꽂으면 된다.

## 골격의 한계 (의도적으로 단순화한 부분)

- 단위 **삭제 없음**(결합 인덱스 안정성 우선). 소멸은 알파/온도로 표현.
- 쌍 상호작용이 **O(n²)** — 수백 단위까지 적합. 대규모는 공간 격자/이웃탐색 필요.
- 적분은 **명시적 오일러** — 매우 강한 결합은 작은 `dt` 필요.

이 셋은 게임 엔진으로 키울 때 가장 먼저 손볼 지점이고, 구조는 그대로 둔 채
교체 가능하도록 분리해 두었다.

## 실시간 인터랙티브 웹 빌드 (web/)

`web/microcosm.html` 을 브라우저로 열면 같은 기질의 JS 포팅이 실시간으로 돈다.
마우스로 조준해 파이어볼·벼락·사슬갑옷을 소환하고 **요소 간 상호작용**을 본다.

- 파이어볼이 사슬갑옷에 닿으면 결합이 **융해**되어 갑옷이 뚫린다.
- 벼락이 캐릭터/갑옷을 때리면 **HP 피해**, 0이면 단위가 소멸한다.
- 불은 식으면 소산되어 사라진다(엔트로피).

엔진은 `web/engine.js` 한 파일(DOM 비의존)이라 Node로 검증된다:

```bash
node -e "const MC=require('./web/engine.js'); /* ... */"
```

파이썬 쪽 대응: `interactions.py` 의 `BondBreakField` 가 결합 융해·과신장
파괴를 담당한다. `combat_fields(world)` 로 기본 장 + 상호작용을 한 번에 장착.

```python
from microcosm import World, combat_fields
w = World(); combat_fields(w)        # 기본 장 + 결합 파괴
```

## 3D 빌드 (web/microcosm3d.html)

같은 식, 위치만 3-벡터로. `engine3d.js` 는 R^3 상태(px,py,pz …)와 3D 거리만
바꾸고 장·결합·상호작용 로직은 2D와 동일하다 — 규칙이 차원에 무관하다는 증거.

- 렌더: Three.js(r128, cdnjs) — InstancedMesh 구체 + LineSegments 결합/벼락.
- 카메라: 자체 궤도(좌드래그=회전, 휠=줌), 레이-평면 조준(바닥 고리).
- 폼: 캐릭터=피보나치 구 껍질, 갑옷=수직 시트, 벼락=3D 프랙탈, 파이어볼=3D 패킷.
- 상호작용은 2D와 동일(융해 관통·HP 피해·소산). Node 검증: `node web/engine3d.js` 로드 + 시나리오.

## 월드 빌드 (web/microcosm_world.html) — 지형·바다·바위·나무·개체

2D 캔버스(외부 라이브러리 없음)에서 같은 원리로 작은 생태 세계를 굴린다.
추가된 일반 부품은 단 셋:

- `TerrainField` : 높이함수 h(x) 법선 지지력 + 마찰 (지형).
- `CohesionField` : 물-물 응집(표면장력) → 중력·반발·점성과 합쳐져 창발적 유체 (바다).
- per-bond 융점 + `world.agents` 훅 : 재질별 융점(바위는 안 녹고 나무는 탐)과 자율 추진.

요소는 전부 레시피(`Forms.rock/tree/creature/...`):
바위=강결합·고융점 덩어리, 나무=뿌리 고정 분기 골격(불에 융해→붕괴),
개체=캐릭터+방랑 추진력. Node 검증: 물 정착, 바위 안착, 개체 이동, 나무 연소 붕괴.
