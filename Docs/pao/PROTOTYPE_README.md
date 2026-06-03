# 물질 레이어 프로토타입 — Step 1-3 작업 가이드

`material_layer_prototype.py` 한 파일. 표준 라이브러리만 쓴다(설치 불필요).
이 프로토타입의 목적은 **그래픽이 아니라 "법칙이 맞물려 캐스케이드가 떠오르는지 + 재밌는 임계점이 어디인지"를 코드로 증명**하는 것이다.

---

## 1. 바로 실행

```bash
python3 material_layer_prototype.py            # 산불이 번지는 과정 스냅샷 (t=0,4,10,20,40)
python3 material_layer_prototype.py --ignite 0.9   # 임계 높여서 "안 번짐" 확인
python3 material_layer_prototype.py --sweep    # ★ Step 3: 재밌는 구간 자동 탐색
```

`@`=불, `.`=잿더미, `#`=울창한 숲(질서 높음), `:`=성긴/회복 중인 땅.

---

## 2. 무엇을 보고 있나 (핵심)

코드 어디에도 "산불을 그려라"는 명령이 없다. **칸마다 숫자 3개 + 그 숫자를 읽는 법칙 4개**뿐인데 산불이 떠오른다. 이게 "조합이 무언가를 보여준다"의 실물이다.

### field = 한 칸이 든 숫자 3개
| 코드 | 축 | 이 예제에서의 의미 |
|---|---|---|
| `P` | **잠재(Potential)** | 연료량. 점화 가능 여부와 화력을 정하고, 탈수록 줄어든다 |
| `A` | **친화(Affinity)** | 인화성. 들어온 열에 곱해진다 — 같은 열이 와도 A 높은 칸만 붙는다 |
| `O` | **질서(Order)** | 숲의 성숙도. 불에 파괴되고, 비옥도로 회복되고, 충분하면 다시 연료를 모은다 |

### 법칙 = field를 읽고 상태를 바꾸는 함수 (= UE5 Processor)
| 함수 | 법칙형 | 하는 일 |
|---|---|---|
| `law_threshold` | **임계** | `heat × A > IGNITE`면 점화. 경사가 아니라 절벽 |
| `law_catalysis` | **촉매** | 타는 칸이 이웃 heat를 올림 → 연쇄 (= "미친 도파민"의 정체) |
| `law_conservation` | **보존** | 탈수록 P·O 감소. 공짜 없음. 소진되면 꺼지고 비옥도를 남김 |
| `law_regrow` | (되먹임) | 비옥도→질서→잠재로 루프를 닫음 (= "끝없음"의 엔진) |

> 결정적: 이 함수들은 자기가 "산불"을 돌리는지 **모른다.** P/A/O만 안다.
> → 똑같은 함수를 사회 레이어에 꽂으면 P=불만, A=선동성, O=제도가 되어 *혁명*이 같은 코드로 떠오른다. 이게 "축=인터페이스, 법칙=Processor"의 실전 의미다.

---

## 3. Step 3 = criticality 찾기 (`--sweep`가 해주는 일)

재밌는 세계는 **좁은 임계점 근처에서만** 나온다. 직접 돌려보면 두 절벽이 보인다:

**SWEEP 1 — 점화 임계(IGNITE):**
```
IGNITE 0.25 → cascade 2166  PLAYABLE
IGNITE 0.27 → cascade    1  FROZEN     ← 절벽! 0.02 차이로 세계가 죽는다
```
임계가 조금만 높아도 불이 한 칸도 못 번지고 꺼진다. 재밌는 점은 0.25~0.27 사이 좁은 구간.

**SWEEP 2 — 재생속도(끝없음 루프의 세기):**
```
REGROW 0.20 → cascade   2494  PLAYABLE
REGROW 0.50 → cascade  19401  MELTED     ← 재생이 연소보다 빠르면 영구 화염폭풍
```
루프를 닫아 "끝없음"을 만들되, 너무 세면 영원히 다 타버린다.

> **교훈:** 이 두 절벽 사이가 게임이 사는 곳이다. 그 점은 해석으로 못 찾는다 — `--sweep`처럼 **돌려보며 찾는다.** 이게 일정에 잡아둬야 할 "탐색 비용"의 정체다.

---

## 4. 손잡이 (sim.py 상단 `Config`)

| 파라미터 | 무엇 | 늘리면 |
|---|---|---|
| `IGNITE` | 점화 임계 | 불이 잘 안 번짐 (→ FROZEN) |
| `SPREAD` | 촉매 전파 계수 | 연쇄가 세짐 |
| `BURN_RATE` | 연료 소모 | 불이 빨리 꺼짐 |
| `ASH_FERT` | 잿더미 비옥도 | 회복이 빨라짐 (= 다음 레이어로 가는 잠재량) |
| `REGROW`/`O_TO_P` | 되먹임 세기 | 루프가 강해짐 (과하면 MELTED) |

Step 3는 본질적으로 **이 표를 만지는 작업**이다.

---

## 5. UE5 / Mass 로 옮기기 (Step → 실제 코드)

```cpp
// field = 격자 칸의 숫자 3개 → Fragment 하나
USTRUCT() struct FFieldCell : public FMassFragment {
    float Potential;   // P
    float Affinity;    // A
    float Order;       // O
};
// 옮겨온 열 / 비옥도는 상태 Fragment로 분리(혹은 같은 구조체에)
USTRUCT() struct FFieldState : public FMassFragment {
    float Heat;
    float Fertility;   // ★ 다음 레이어 Potential로 가는 다리
    uint8 bBurning : 1;
};

// 법칙 = Processor. Python 함수 4개가 그대로 Processor 4개.
//   UThresholdProcessor   : law_threshold
//   UCatalysisProcessor   : law_catalysis  (이웃 셀 Heat 갱신 = sampling)
//   UConservationProcessor : law_conservation
//   URegrowProcessor      : law_regrow
// 실행 순서를 ExecutionOrder로 고정 (Python의 LAWS 리스트 순서와 동일).
```

**MMO 스케일 주의:** 매 entity가 매 이웃을 쿼리하면 폭발한다.
→ Python처럼 field를 **거친 grid**에 두고, `law_catalysis`가 이웃 칸에 *쓰기*만 하게 한다(entity는 자기 칸을 sampling). 이 프로토타입의 `new_heat` 버퍼 방식이 그 패턴이다.

---

## 6. 다음 단계

- **Step 4 (수직 결합 1개):** 지금 `fert`(비옥도)는 같은 레이어 안에서 소비된다. 이걸 **생명 레이어의 Potential 입력**으로 빼면 끝 — "물질의 질서 → 생명의 잠재" 화살표 1개가 증명된다. 그 지점부터 통일 가설이 선다.
- **그 전에:** `--sweep`로 *이 레이어 하나*의 재밌는 구간을 먼저 확정할 것. 수직으로 뚫기 전에 한 레이어를 손맛 나게.
