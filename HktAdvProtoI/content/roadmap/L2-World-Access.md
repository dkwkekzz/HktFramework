# L2 — 세계의 요구와 성질: 열쇠와 자물쇠 계약 (기반 층 2 · 세계 절반 ② 부속 넷째 · 초안)

상태: **초안** (제안 · Human 승인 대기). [L2-World-Region.md](L2-World-Region.md) 의 넷째 확장 계약으로 제안한다 —
새로운 설계 층도, 별도 Gameplay 시스템도 만들지 않는다. [L2-World-Material.md](L2-World-Material.md) ·
[L2-World-Time.md](L2-World-Time.md) · [L2-World-Life.md](L2-World-Life.md) 와 같은 자리다.

2층의 여섯 기획은 세계를 **쓰는 문법**을 다 세웠다 — 공간 · 땅 · 규칙 · 재료 · 시간 · 생명. 그런데 L0 의 문장
"위험을 극복할 재료를 제공한다 · 세계가 재료를 **충분히** 제공해야 한다" ([L0-Game.md](L0-Game.md) §1) 는 아직
검사할 수 없다. 세계가 **무엇을 묻는가**(협곡의 문: "체열이 감지된다")와 세계가 **무엇을 내놓는가**(열을 저장하는 결정)가
서로 다른 말로 적혀 있고, 둘을 잇는 것은 지금 사람의 손 하나뿐이기 때문이다 (RoomOfAnotherKind 확정 4).
이 문서는 그 구멍을 메운다: *세계의 요구와 세계의 성질을 같은 어휘로 적는다. 자물쇠는 성질을 묻고 열쇠는 성질을 가진다.
그러면 "모든 자물쇠에 열쇠가 어딘가 있는가" 를 기계가 센다.*

§1 이 동기(Human 원문은 아직 없다 — 2층 분석에서 나온 제안이다)이고 §2 이후는 기존 문서(Concept · Region · Material ·
Time · Life · Play 여덟)에서 유도한 것이다. **세계 사실을 더하지 않았다** — 어휘의 항목 하나하나에 근거 문서를 적었고,
근거가 없는 것은 §9 의 빈칸으로만 남긴다. Human 이 언제든 뒤집는다.

```text
이 문서가 소유한다      세계가 묻는 것(자물쇠)의 종류와 자리 · 세계가 내놓는 것(열쇠)에 붙는 성질 어휘 ·
                      둘을 같은 말로 적는 규칙 · 충분성(모든 자물쇠에 열쇠가 있는가)의 검사 ·
                      2층에서 자물쇠가 관찰되는 방식(묻되 답의 자리는 말하지 않는다)
이 문서가 바꾼다        Material §6.1 observableProperties — 문장은 그대로 두고 **어휘 태그**를 곁에 더한다.
                      Region §6 Soft/Hard Requirement 와 Time 2.4 ② Connector activation — 셋을 한 형(자물쇠)으로 읽는다.
                      Tool-Scale §1 고정 공식 · T2 · T4 의 "계약 목록" 에 열쇠·자물쇠 표가 든다 (§4.4)
이 문서가 소유하지 않는다  열쇠가 실제로 문을 여는 판정(몸이 추위를 버티는가 — 3층) · 열쇠를 지니는 방식(소지 · 장비 — 4층) ·
                      성질을 조합해 새 성질을 만드는 규칙(Recipe · Mechanism — 4층) · 클래스와 지식이 열쇠가 되는 방식(3 · 7층) ·
                      성질의 수치(얼마나 따뜻한가 — 4층 이후)
```

## 0. 이어 쓰는 규약 — 다른 agent 가 이 문서를 잇는 법

이 문서는 여럿이 이어 쓴다. 규약은 넷이다.

```text
① 이름공간   확정 항목은 K1~ (Key·Lock). Concept 의 W · Region 의 R · Material 의 S · Time 의 T · Life 의 F 와 같은 자리.
             검사 번호는 ㉞ 부터 잇는다 (Life 가 ㉝ 까지 썼다). Required Capability 는 W46 · V · E 의 다음 번호부터 —
             Life(W38~W45) 뒤다. Play 가 정한다
② 어휘 추가   §2.4 의 어휘 표에 행을 더할 때는 **근거 열이 비면 안 된다** — 기존 문서(Concept · Region · Material · Time ·
             Life · M5 · play/*)의 절 번호 하나. 근거 없는 성질은 어휘가 아니라 §9 의 빈칸이다 (지어내지 않는다 — Region §5.5 ①)
③ 표의 자리   자물쇠는 §8.1 표에, 열쇠는 §8.2 표에 한 줄씩 더한다. 새 Region 이 오면 그 Region 의 Play(또는 등급 A 의 Spec)가
             두 표에 자기 줄을 더한다 — 이 문서를 고치는 것이 아니라 그 Region 의 RegionSpec.access 와 Seed 의 properties 에
             적고, 여기는 "지금 세계" 의 요약만 남긴다 (§8 머리)
④ 상태 갱신   "초안 → 확정" 은 Human 승인 1회로만 바뀐다. 승인 시 고칠 자리는 §10 에 다 적어 두었다.
             본문에 경위 · 날짜를 쌓지 않는다 (CLAUDE.md 원칙 10)
```

빈칸은 `[ ]` 로 표시했다 — §9 에 모아 두었고 본문 곳곳에서 그 번호를 가리킨다.

---

## 1. 동기 — 무엇이 비어 있는가

[L0-Game.md](L0-Game.md) §4 의 셋째 질문 *"요정이 무엇으로 자라는가 — 성장이 대응 범위의 확장으로 드러나는가"* 에
2층은 "정하지 않는다" 로 답해 왔다 (Material S10 · Time §7 · Life §5). 맞는 답이다 — 성장은 3 · 4 · 7층의 것이다.
그러나 성장이 **대응 범위의 확장**이라면, 그 범위를 긋는 것은 세계다:

```text
Region §12   Threat → 현재 요정에게 부족한 가능성을 드러냄 → Resource/Knowledge → 대응 수단 → Overcome → New Access
Concept §7   새로운 자원 획득 → Skill/Item/Class 변화 → 새로운 지역 탐험 가능
Concept §1   그것으로 이전에는 불가능했던 장소에 갈 수 있게 된다
```

세 문장의 앞 절반("무엇이 부족한가 · 무엇이 그것을 채우는가")은 세계 사실이다. 지금 세계에서 그것은 어떻게 적혀 있는가.

| 자리 | 지금 적힌 것 | 문제 |
|---|---|---|
| 빙결 심층의 문 | "체열이 감지된다" — 사유 코드 (Region §4.2 · RoomOfAnotherKind §5.3) | 무엇이 있으면 되는지가 코드에 없다. 사람은 Region §12 의 예시("열 저장 결정 → 체온 유지")를 읽어 안다 |
| 열을 저장하는 결정 | 이름과 예시 한 줄 (Region §5.1 · §12). 원천 없음 (RoomOfAnotherKind 확정 4) | 성질이 적힌 자리가 없다. "이것이 그 문의 답" 이라는 사실은 사람의 머리에만 있다 |
| 미로의 심장 문 | `CONNECTOR_ACTIVATIONS` — 미로의 패턴이 P2 일 때 (C009) | 형은 있다. 그러나 "패턴" 만 묻는 형이라 성질 · 때 · 지식을 같은 자리에 못 적는다 |
| 긴 밤에만 열리는 문 | `RegionSpec.phases.LONG_NIGHT.connectorActivation` (Time §3) | 같은 "문이 묻는 것" 인데 다른 자리 · 다른 형이다 |
| 미로 입구 | `entry.requirement.knowledge: ANCIENT_GATE_PATTERN` (Region §16 양식) | 양식에만 있고 데이터에 없다. 3층의 것이라 비워 둔 것은 맞으나 **자리**조차 없다 |
| 재료의 성질 | `observableProperties` 다섯 항 — 문장 (Material §6.1 · RoomBearsMaterial D2 · RoomOfAnotherKind 확정 3) | 문장은 사람이 읽는다. 기계는 "열을 먹는다" 와 "열을 저장한다" 가 같은 축의 반대라는 것을 모른다 |

그래서 지금은 **검사할 수 없다** — "이 세계에 갈 수 없는 곳은 없는가" (모든 자물쇠에 열쇠가 어딘가 있는가) ·
"열쇠 하나가 모든 문을 여는가" (조합의 폭이 있는가) · "열쇠가 자물쇠와 같은 방에만 있는가" (세계가 한 방에서 닫히는가).
Region §17 의 검증 기준 "재료와 지식이 실제 대응 수단이 되는가 · 보상이 다음 가능성을 여는가" 가 사람의 눈에만 있다.

이것이 3층 주입 **전에** 서야 하는 이유는 하나다 — 3층(몸 · 추위 · 체열)과 4층(소지 · 장비 · Mechanism)이 이 어휘를
**소비**한다. 먼저 세우지 않으면 두 층이 각자 어휘를 만들고, 세계는 자기가 충분한지 영영 스스로 모른다.

---

## 2. 제안 — 열쇠와 자물쇠

### 2.1 한 문장 정의

> 세계의 어떤 자리는 **묻는다**(자물쇠). 세계의 어떤 것은 **가진다**(열쇠). 묻는 것과 가지는 것은 하나의 **성질 어휘**로
> 적힌다. 2층은 어휘 · 자물쇠의 자리 · 열쇠의 성질 · 그 둘이 세계 전체에서 맞물리는가의 검사까지를 세우고,
> 열쇠를 **지니고 · 써서 · 실제로 여는** 것은 뒤 층이 같은 어휘로 받는다.

자물쇠는 Quest 가 아니다 — 세계가 지시하지 않는다 (W8). 자물쇠는 **세계의 사실**이고, 물으면 답한다
(RoomAnswersWhenAsked): "이 문은 체열을 묻는다." 어디에 답이 있는지는 말하지 않는다 — 그것은 흔적을 따라 찾는 것이다 (S4).

### 2.2 자물쇠 — 세계가 묻는 것

Region §6 이 요구를 둘로 갈랐다. 이 문서는 그 둘에 **묻는 것의 종류** 넷을 곱한다.

```text
자물쇠의 강도 (Region §6 그대로)
  soft   진입은 되나 버티거나 나아가기 어렵다 — area 에 붙는다. 기본형이다 (§6.1)
  hard   Connector 가 활성이 아니다 — 발견 · 세계 상태 전이에만 쓴다. 레벨 제한 · UI 잠금의 대체가 아니다 (§6.2)

자물쇠가 묻는 것 (asks)
  property   성질 — "체열을 숨기는 것이 있는가" · "열을 저장한 것을 지녔는가". 열쇠는 재료(2층) · 물건(4층) · 몸(3층)
  time       때 — "긴 밤인가". 열쇠는 세계 시계다 (Time 2.4 ②). 지금 phases.connectorActivation 이 이것이다
  state      세계 상태 — "미로의 패턴이 P2 인가". 열쇠는 Region State 다 (Region §6.2 · C009). 지금 CONNECTOR_ACTIVATIONS 가 이것이다
  knowledge  앎 — "문양의 순서를 아는가". 열쇠는 주체의 지식이다 → **3층**. 2층은 자리만 적고 판정하지 않는다 (Concept §3.1 hazard/knowledge 와 같은 처리)
```

넷은 새 문법이 아니다. `time` 과 `state` 는 이미 코드에 있는 두 활성 조건을 한 형으로 읽은 것이고, `knowledge` 는 Region §16
양식이 이미 둔 자리이며, 이 문서가 **새로 더하는 것은 `property` 하나**다. 하나의 자물쇠가 여럿을 함께 물을 수 있다 —
빙결 심층의 문은 `time: LONG_NIGHT` 와 `property: 체열을 숨긴다` 를 함께 묻는다 (RoomOfAnotherKind §5.3).

**2층에서 자물쇠가 하는 일은 셋뿐이다.**

```text
① 묻는다      지목하면(RoomAnswersWhenAsked) 판이 "이 자리는 무엇을 묻는가" 를 말한다 — 사유 코드 하나.
              답이 어디 있는지 · 어떻게 얻는지는 말하지 않는다 (§12.4 재료 아이콘 없음의 원칙과 같다)
② 걸러 낸다    time · state 는 지금처럼 2층이 판정한다 (활성/비활성). property · knowledge 는 **판정하지 않는다** —
              몸도 소지도 지식도 아직 없다. 표시까지다 (RoomOfAnotherKind W35 "몸의 변화 없음" 과 같은 선)
③ 세어진다     검사 ㉞~㊳ 이 세계 전체의 자물쇠와 열쇠를 대조한다 (§4.2)
```

### 2.3 열쇠 — 세계가 가진 것

2층의 열쇠는 **재료의 성질**이다. Material §6.1 `observableProperties` 는 다섯 항의 **문장**이고, 그 문장은 그대로 둔다 —
사람이 읽고 View 가 옮기는 것이다. 이 문서가 더하는 것은 그 곁의 **어휘 태그**다.

```text
observableProperties.behavior        "닿은 것을 식힌다 · 숨이 언다"          → properties: [heat:absorbs]
observableProperties.conditionResponse "열이 닿으면 자란다"                  → properties: [heat:grows-on]
observableProperties.appearance      "푸르게 빛난다"                        → properties: [light:emits]
```

문장이 원본이고 태그는 색인이다. **태그가 문장에 없는 것을 말하면 안 된다** (규약 ②). 하나의 Seed 가 태그를 여럿 가진다 —
빙정석은 `heat:absorbs · heat:grows-on · light:emits` 셋이다 (RoomOfAnotherKind 확정 3).

열쇠는 재료만이 아니다. 뒤 층이 같은 어휘로 더 가져온다 — 이 문서는 자리만 약속한다.

| 열쇠의 종류 | 성질이 어디에 적히는가 | 층 |
|---|---|---|
| 재료 (Material Seed) | `MaterialSeed.properties` | **2층 — 이 문서** |
| 때 · 세계 상태 | WorldClock · Region State — 이미 있다 | 2층 (Time · Rule) |
| 몸 (요정 · 생물의 감각과 기관) | 3층이 정한다. Region §12 "포식자의 감각 기관 → 냄새 탐지 규칙 역이용" 이 그 예다 | 3층 |
| 물건 (장비 · 가공물) | 4층이 정한다 — Item 의 네 층 가운데 MATERIAL 이 Seed 의 성질을 물려받고 MECHANISM 이 그것을 쓴다 (Design-Item-System-R1 §2) | 4층 |
| 지식 · 클래스 | 3층 · 7층 | 3 · 7층 |

**약속은 하나다 — 어느 층이 열쇠를 들고 오든, 자물쇠는 같은 어휘로 묻는다.** 그래서 4층이 "열을 저장하는 장비" 를 만들면
그 장비는 새 판정 규칙 없이 협곡의 문에 답이 된다.

### 2.4 성질 어휘 — 축과 관계

어휘는 **축(aspect)** 과 **관계(relation)** 의 쌍이다. `heat:absorbs` 처럼 적는다. 축은 세계가 재는 것이고 관계는 그것에
대해 재료가 하는 일이다. 축을 많이 두지 않는다 — 기존 문서에 글자로 있는 것만이다.

**축 (제안 — 전부 기존 문서에 있는 것)**

| 축 | 뜻 | 근거 |
|---|---|---|
| `heat` | 열 · 체온 · 추위 | Concept §6 빙결 협곡 · Region §4.2 체열 · §12 열 저장 결정 · M5 · RoomOfAnotherKind 확정 2·3 |
| `light` | 빛 · 색 · 어둠 | Time 2.2 밤은 흔적의 종류를 바꾼다 · RoomOfAnotherKind 확정 3 "푸르게 빛난다" · D2 "붉게 물들인다" |
| `vibration` | 진동 · 소리 · 정지 | Concept §11 맹목의 사냥꾼(진동에 반응 · 움직이지 않으면 못 찾는다) · §12 침묵의 계곡 · Time 2.6 |
| `space` | 공간 연결 · 전이 목적지 | Region §12 "공간 왜곡 결정 → Connector 목적지 고정" · §16 `FIX_TRANSITION_DESTINATION` · Concept §5 현상 |
| `flesh` | 살아 있는 것의 몸 — 결정화 · 붙음 · 안에 쌓임 | Concept §5 물질(접촉하면 결정화) · D2 "살아 있는 것의 몸을 따라 옮겨 다닌다" · Life F7 |

**관계 (제안)**

| 관계 | 뜻 | 자물쇠 쪽에서 읽으면 |
|---|---|---|
| `absorbs` | 그 축의 것을 **먹는다** (줄인다) | "이 자리는 열을 먹는다" — 열을 지닌 것이 깎인다 |
| `stores` | 그 축의 것을 **담아 둔다** | "열을 담은 것을 지녔는가" |
| `emits` | 그 축의 것을 **낸다** | "빛을 내는 것이 있는가" · "진동을 내지 않는가" |
| `senses` | 그 축의 것을 **감지한다** | "체열을 감지한다" (Region §4.2 그대로) |
| `hides` | 그 축의 것을 **숨긴다** | "체열을 숨기는가" — senses 자물쇠의 짝 |
| `grows-on` | 그 축의 것이 닿으면 **자란다** | 회복 조건 쪽(Material 회복 원인)에 닿는다 — 자물쇠는 잘 쓰지 않는다 |
| `fixes` | 그 축의 것을 **고정한다** | "전이 목적지를 고정하는가" (space) |

`[ ] 빈칸 1` 축과 관계의 **최종 목록은 Human 결정**이다. 위 표는 지금 세계와 확정 문서에서 나온 최소이고, 새 Region 이
새 축을 요구하면 그것은 컨텐츠 행이 아니라 이 표의 새 줄이다 — 근거 절과 함께 (규약 ②). 축이 다섯을 크게 넘으면 어휘가
아니라 카탈로그가 된 것이니 그때 다시 본다.

어휘는 **컨텐츠 데이터**다 — `content/regions/` 의 카탈로그 파일이고, 규칙 코드는 어떤 축도 어떤 관계도 이름으로 알지 못한다
(R13 — Material 이 재료에 대해 말한 것 그대로). 규칙이 아는 것은 "묻는 자리" 와 "가진 것" 의 문자열 일치뿐이다.

### 2.5 맞물림 — 자물쇠와 열쇠가 서로를 찾는 법

```text
자물쇠 asks.property = X   열쇠 properties ∋ X'   X 와 X' 의 대응은 어휘 표가 정한다 (같은 축 · 짝이 되는 관계)
  senses  ↔ hides         체열을 감지한다 ↔ 체열을 숨긴다
  absorbs ↔ stores        열을 먹는 자리 ↔ 열을 담아 둔 것 (담은 열이 깎여 나가는 동안 버틴다 — 얼마나는 4층)
  emits   ↔ absorbs       빛을 내는 것 ↔ 빛을 먹는 자리 (어둠 속 통행 — 3층이 판정)
  fixes   ↔ (자물쇠가 space 를 묻는다)   공간 왜곡 결정이 미로의 전이를 고정한다
```

짝은 어휘 표의 한 열이다 — 코드가 아니라 데이터다. 검사는 "짝이 되는 열쇠가 세계 어딘가에 있는가" 만 본다.

### 2.6 충분성 — L0 의 "충분히" 를 검사 가능하게

Material §2.2 는 "충분한 재료" 를 일곱 조건으로 풀었다 — 깊이마다 다른 기회 · 편중 없음 · 여러 원천 · 조건부 기회 ·
영구 소거 없음 · 경계를 넘는 흐름 · **후속 설계가 해석할 수 있는 고유한 세계적 성질**. 마지막 하나가 이 문서다.
이 문서는 거기에 하나를 더한다 — **묻는 것마다 답이 있다.**

```text
K-충분성   세계의 모든 property 자물쇠에 대해, 짝이 되는 성질을 가진 Material Seed 가 하나 이상 있고,
          그 Seed 의 원천이 **그 자물쇠를 지나지 않고** 닿는 Region 에 하나 이상 있다.
          없으면 그 자물쇠는 "갈 수 없는 곳" 이다 — 세계가 잘못 짜인 것이다 (Time ㉖ "긴 밤에 갈 데가 없는 세계" 와 같은 성격)
```

이 검사는 **지금 실패한다** — 빙결 심층의 문이 `heat:stores`(체열을 숨긴다) 를 묻는데 열을 저장하는 결정에는 원천이 없다
(RoomOfAnotherKind 확정 4). Life 의 ㉛ 이 `MOLT_LITTER` 에서 먼저 실패를 보고했듯, 이 검사도 먼저 실패를 보고하고
열쇠를 놓는 Play 가 통과로 바꾼다 (§8.2 · 빈칸 2).

### 2.7 관찰 — 2층에서 자물쇠는 어떻게 보이는가

RoomAnswersWhenAsked 가 세운 것 그대로다 — 세계 위에 글자를 뿌리지 않고, 지목하면 판이 답한다.

```text
자물쇠를 지목    판에 "무엇을 묻는가" 가 선다 — 사유 코드 asks:<property> (예: "체열을 묻는다"). 강도(soft/hard)와 함께.
                답이 어디 있는지 · 무엇이 답인지는 말하지 않는다
열쇠를 지목      재료의 판이 그 재료의 **성질**을 말한다 — observableProperties 의 문장 (D2 · 확정 3).
                C011 부채 "판이 재료의 이름을 말하지 않는다" 를 여기서 한 걸음 더 닫는다: 이름과 성질까지
잇는 것         관찰자의 머리다. "이 문은 열을 묻는다" 와 "이 결정은 열을 담는다" 를 잇는 것이 Core Breath 의 **관찰 → 이해**다.
                세계가 대신 잇지 않는다 (W8 · Region §17 "규칙을 이해한 뒤 실제 선택이 달라지는가")
```

### 2.8 원칙

```text
K1  자물쇠는 세계 사실이다 — Quest · 레벨 제한 · UI 잠금이 아니다. 지시하지 않고 묻는다 (W8 · Region §6.2)
K2  자물쇠가 묻는 것은 넷이다 — property · time · state · knowledge. 새로 더한 것은 property 하나이고 나머지는 이미 있던 것을 한 형으로 읽었다
K3  열쇠는 성질을 가진 것이다. 2층의 열쇠는 재료의 성질(Seed.properties)이고, 몸 · 물건 · 지식은 뒤 층이 같은 어휘로 가져온다
K4  자물쇠와 열쇠는 하나의 어휘(축:관계)로 적힌다. 어휘는 컨텐츠 데이터이고 규칙 코드는 그 글자를 모른다 (R13)
K5  태그는 문장의 색인이다 — observableProperties 의 문장에 없는 성질을 태그가 말하지 않는다
K6  2층은 묻고 · 세고 · 표시한다. property · knowledge 자물쇠를 **판정하지 않는다** — 몸(3층) · 소지(4층) · 지식(3층)이 온 뒤의 일이다
K7  묻는 것마다 답이 있다 — 모든 property 자물쇠에 그것을 지나지 않고 닿는 열쇠의 원천이 하나 이상 있다 (검사 ㉟). 없으면 세계가 잘못 짜인 것이다
K8  열쇠는 답의 자리를 말하지 않는다 — 자물쇠는 무엇을 묻는지만, 열쇠는 무엇을 가졌는지만. 잇는 것은 관찰자다 (S4 · §12.4)
K9  하나의 열쇠가 모든 자물쇠를 열지 않고, 하나의 자물쇠에 열쇠가 하나만 있지 않다 — 편중은 보고한다 (㊱ ㊲). 좋고 나쁨은 Human 이 본다
K10 열쇠와 자물쇠의 깊이 관계는 정하지 않는다 — 얕은 곳의 열쇠가 깊은 문을 여는 것이 기본형이나 그 역도 세계가 금하지 않는다. 분포만 본다 (㊳)
```

---

## 3. 데이터 계약 (의미 계약 — 타입과 파일 배치는 구현이 정한다)

Time §3 · Life §3.2 와 같은 방식이다. 새 layer 는 없다 — 자물쇠의 자리는 이미 있는 `area` · `anchor`(Connector) 이고,
열쇠의 자리는 이미 있는 Seed 다.

```yaml
PropertyVocabulary:                     # content/regions/properties.ts (가칭) — 세계 전체 하나. 규칙 코드는 읽지 않는다
  aspects:
    - { id: heat, meaning: 열 · 체온, basis: "Concept §6 · Region §4.2" }
  relations:
    - { id: absorbs, meaning: 먹는다, pairsWith: [stores] }
    - { id: senses,  meaning: 감지한다, pairsWith: [hides] }
    # …§2.4 의 표 그대로

MaterialSeed += properties:             # Material §6.1 의 확장 — 문장(observableProperties)은 그대로, 태그를 곁에
  properties: [ "heat:absorbs", "heat:grows-on", "light:emits" ]

Lock:                                   # 자물쇠 하나 — RegionSpec.access.locks[] (Region §16 entry.requirement 의 일반형)
  id: LOCK_ID
  at: { kind: area | connector, ref: AREA_TAG | CONNECTOR_ID }    # 자리 — area 면 soft 가 기본, connector 면 hard 가 기본
  strength: soft | hard
  asks:                                 # 하나 이상. 전부 참이어야 열린다
    - { property: "heat:hides" }        # 2층: 표시만 · 판정 없음 (K6)
    - { time: { season: LONG_NIGHT } }  # 2층 판정 — Time W26 의 connectorActivation 이 여기로 온다
    - { state: { region: FANTASY_MAZE, patterns: [P2] } }   # 2층 판정 — CONNECTOR_ACTIVATIONS 가 여기로 온다
    - { knowledge: KNOWLEDGE_ID }       # 3층 — 자리만
  reason: ASKS_CODE                     # 지목했을 때 판이 말하는 사유 코드 (V — 문구는 View 의 표)

RegionSpec += access:
  locks: [Lock]

# 자물쇠는 State 가 아니다 — 컨텐츠 데이터다. 열렸는가(time · state 의 답)는 지금처럼 Region State · WorldClock 에서 매 tick 유도된다.
# property · knowledge 의 답은 2층에 없다 — 뒤 층이 Subject 의 State(소지 · 몸 · 지식)에서 유도한다 (Design-Concept §10 의 자리)
```

기존 둘을 옮기는 것은 **선택**이다 — `CONNECTOR_ACTIVATIONS` 와 `phases.connectorActivation` 을 `Lock` 으로 옮기면 형이 하나가
되지만, 옮기지 않아도 검사 ㉞~㊳ 은 셋을 함께 읽을 수 있다. 옮길지는 첫 Cycle 의 spec 이 정한다 (빈칸 3).

---

## 4. 도구에 주는 변화

### 4.1 layer — 새 layer 를 만들지 않는다

자물쇠는 `area`(soft) 와 Connector 의 `anchor`(hard) 에 매달린다. 열쇠는 Seed 에 매달린다. 자리를 만드는 것이 아니라
**의미를 매다는 것**이다 — Material §3.1 · Life §3.1 과 같은 방향.

### 4.2 도구가 새로 검사하는 것 — ㉞~㊳

Concept ①~④ · Region ⑤~⑨ · Material ⑩~㉒ · Time ㉓~㉖ · Life ㉗~㉝ 에 다섯이 이어진다. 성질은 둘로 갈린다.

```text
참조 무결성 (통과/실패)
  ㉞ 모든 Lock 의 asks 가 어휘에 있는 축:관계인가 · at.ref 가 실제 area/Connector 인가 · 모든 Seed.properties 가 어휘에 있는가
  ㉟ 모든 property 자물쇠에 대해 짝이 되는 성질의 Seed 가 있고, 그 Seed 의 원천(ResourceSource)이 civil 에서 **그 자물쇠를 지나지 않고**
     닿는 Region 에 하나 이상 있는가 — 갈 수 없는 곳 없음 (K7). 지금 빙결 심층의 문이 여기 걸린다 (§2.6)
분포 요약 (판정 없음)
  ㊱ 열쇠 하나가 여는 자물쇠의 수 — 한 성질이 세계의 문 전부를 열면 보이게 한다 (K9)
  ㊲ 자물쇠 하나를 여는 열쇠(Seed)의 수 · 그 원천의 Region 과 자물쇠의 Region 이 같은 비율 — "세계가 한 방에서 닫히는가" (RoomOfAnotherKind §5.3)
  ㊳ 자물쇠의 depth 와 열쇠 원천의 depth 의 관계 표 — 얕은 열쇠 → 깊은 문 / 그 역 (K10) · 어느 자물쇠도 묻지 않는 성질 · 어느 열쇠도 없는 성질(고아 어휘)
```

㉟ 의 "지나지 않고" 는 Region ⑧(civil 에서 모든 Region 에 닿는가) 의 그래프 탐색에 자물쇠를 벽으로 놓고 다시 도는 것이다 —
새 기구가 아니라 있는 것의 재사용이다 (`reachableRegions` 에 제외 집합 하나).

### 4.3 관찰 도구

`world:observe --report` 에 열쇠 × 자물쇠 표 하나 — 행이 자물쇠, 열이 성질, 칸이 그 성질을 가진 Seed 와 원천의 Region.
사람이 세계 전체의 "무엇이 무엇을 여는가" 를 한 장에서 본다 (Region §2.1 ③ "보고를 사람이 읽는 것" 의 한 답).

### 4.4 도구 절반 2단계에 주는 변화 — Region 작성기가 자물쇠를 안다

Life §3.5 가 한 것과 같다. 작성기의 고정 공식에 한 항이 든다 — 그러지 않으면 **도구가 짓는 방 백 개에 열쇠 없는 문이 선다.**

```text
§1 고정 공식     재료 계약 표 다섯 · 철 덧씌움 넷 · 생명 계약 · **접근 계약(자물쇠 · 열쇠 성질)** · 검사 ①~㊳
§2 등급 A 조건   공통 계약에 접근이 든다 — 방이 무엇을 묻는지(없으면 없다고) · 그 방의 재료가 어떤 성질인지를 적어야 한다
T2 아홉째 답     Concept §17 의 일곱 + Life 의 여덟째(무엇이 태어나는가) + **아홉째 — 무엇을 묻고 무엇을 가졌는가**
                (이 방의 문은 어떤 성질을 묻는가 · 이 방의 재료는 어떤 성질을 가지는가 · 그 답은 어느 방에 있는가)
T4 계약 목록     brief 의 "요구" 가 어휘에 없는 축을 부르면 **C 등급**(새 축) — 자물쇠가 묻는 성질이 어휘에 없다는 것은
                새 성질이 아니라 새 축이 필요하다는 뜻이다. 어휘에 있으나 열쇠가 세계에 없으면 **B 가 아니라 GAP** —
                Missing: 그 성질의 Seed · Return To: 열쇠를 놓을 행(컨텐츠 층)
T6 편중 요약     ⑲ ⑳ ㉒ ㉕ ㉖ ㉚ ㉝ 에 ㊱ ㊲ ㊳ 이 더해진다
```

### 4.5 도구 밖으로 가는 것

| 원문 | 무엇인가 | 어디 |
|---|---|---|
| property 자물쇠의 실제 판정 (열을 담은 것을 지녔는가 · 몸이 얼마나 버티는가) | Subject State 에서 유도 — Natural Law 의 조건 (Design-Concept §7 혹한 예시) | 3층 · 4층 |
| knowledge 자물쇠의 판정 | 주체가 무엇을 아는가 | 3층 (Design-Subject-Decision §8 가능성 그래프) |
| 성질의 수치 (얼마나 · 몇 초) | 계산 | 4층 이후 (S10) |
| 성질의 조합 (열을 담은 것 + 빛을 내는 것 → ?) | Mechanism · Recipe | 4층 (Design-Item-System-R1 §2 · §9) |
| `growthOutcome.capability` (전이 목적지 고정 같은 **행동**) | 열쇠가 여는 행동 — Action Law 의 조건 | 4층 이후 (Region §12) |
| 안전 조건 (`settlement/condition`) | 자물쇠의 거울 — 조건이 있어 **안전한** 자리. 이 문서는 건드리지 않는다 (RoomBecomesLand §5.3 이 소유) | Land |

---

## 5. 이 층의 것이 아닌 것

| 무엇 | 어디 |
|---|---|
| 열쇠를 지니는 것 (소지 · 장비 · 몸에 두르는 것) | 4층 · 3층 |
| 열쇠가 실제로 문을 여는 순간 (통행 판정 · 체온이 깎이는 속도) | 3층 (몸) · 4층 (물건) |
| 새 성질을 만드는 것 (조합 · 가공) | 4층 |
| 클래스 · 지식이 열쇠가 되는 방식 · 세 성장 축의 확률 조합 | 3 · 7층 (L0 §2 · Design-Concept §10) |
| 요정이 무엇을 부족하다고 **느끼는가** (목적 그래프) | 3층 (Design-Subject-Decision §6~§8) |
| 자물쇠를 만든 원인이 몸에 하는 일 (위험 자체) | 이 문서는 요구만 본다. 위험이 어떻게 생기고 세지는가는 별도 제안(위험의 계약)의 것 |

---

## 6. 미증명 넷과의 대응

```text
① 재방문해도 재미있는가        닿지 않는다 — Time · Life 의 몫. 다만 "그때는 못 열었던 문" 이 열쇠를 얻은 뒤 다른 문이 된다 (간접)
② 여럿이어야 하는 이유         닿지 않는다 — 다만 열쇠의 원천이 자물쇠와 다른 Region 에 있다는 것(㊲)이 뒤 층의 분업 · 거래의 **세계 쪽 전제**다
                             (Concept §14 "다른 플레이어가 그 기관으로 장비 제작 · 다른 플레이어가 그 장비로 새 지역 도달")
③ 성장 선택의 애착과 고민       **여기가 이 문서의 중심이다.** RoomOfAnotherKind 가 "갈래가 다르다" 까지 놓았고, 이 문서는 그 갈래를
                             "무엇을 들고 가야 하는가" 로 적는다. 고민 자체는 3 · 7층이 만들지만, 고민할 **것**(어느 문이 무엇을 묻고
                             어느 열쇠가 어디 있는가)이 세계 사실로 서야 한다. 조합의 재미의 2층 몫 — 조합될 성질의 공간
④ 발견 뒤에도 살아 움직이는가   닿지 않는다 — Time · Life 의 몫
```

## 7. L0 판단 기준 통과

```text
어떤 위험을 주는가            이 문서는 위험을 새로 두지 않는다 — 자물쇠는 위험이 **묻는 형태**다. 협곡의 추위(위험)가 "열을 묻는다"(자물쇠)로 적힌다.
                            원인은 그 위험의 원인 그대로다 (빙정석이 열을 먹는다 — RoomOfAnotherKind 확정 2)
극복할 재료를 어디에 두는가    열쇠의 원천에 — 그리고 K7 이 "어딘가에 반드시" 를 세계의 검사로 만든다. 자물쇠와 같은 원인에서 나는가(W4)는
                            검사 ① 이 보고, 자물쇠를 지나지 않고 닿는가는 ㉟ 이 본다
요정이 무엇으로 자라는가       이 층은 정하지 않는다 (S10). 넘기는 것은 **성장이 무엇을 늘리는가의 단위** — 답할 수 있는 자물쇠의 집합.
                            "이전에는 갈 수 없던 곳" 이 처음으로 세계 사실(자물쇠)로 적힌다 (Concept §1 · Region §12 New Access)
Core Breath 의 어느 전이인가   위험 → 관찰 → **이해 → 시도 → 극복 → 성장 → 새로운 미지** — 뒷 절반. "이 문은 무엇을 묻는가" 를 관찰하고,
                            "저 결정이 그 답이다" 를 이해하고, 들고 와 시도하는 구간. 2층은 관찰 · 이해까지를 세계 사실로 세운다
```

---

## 8. 지금 세계에 적용 — 역기술

Human 승인 전에 이 계약이 **현실을 담는지** 본다 (T2 가 방 아홉을 역기술하는 것과 같은 검증). 지금 세계와 승인된 Play 여덟에
있는 것만 옮겼다 — 새로 놓은 자물쇠도 열쇠도 없다.

### 8.1 자물쇠 — 지금 세계와 승인된 Play 에 이미 있는 것

| 자리 | 강도 | 묻는 것 | 지금 어디에 적혀 있나 | 이 계약에서 |
|---|---|---|---|---|
| 미로의 심장 문 `MAZE_HEART_GATE` | hard | state: 미로 패턴 P2 | `CONNECTOR_ACTIVATIONS` (C009) | Lock 하나 — 형만 바뀐다 (빈칸 3) |
| 긴 밤에만 열리는 문 (숲) | hard | time: LONG_NIGHT | `phases.LONG_NIGHT.connectorActivation` (RoomNeverSame W26) | Lock 하나 — 같다 |
| 빙결 심층의 문 (`FROST_DEPTH` 경계) | hard + soft | time: LONG_NIGHT **그리고** property: `heat:hides` (체열이 감지된다 — Region §4.2) | RoomOfAnotherKind §5.3 · W33 — 사유 코드만 | **첫 property 자물쇠.** ㉟ 이 여기서 실패를 보고한다 |
| 눈보라 area · 절벽 · 결정면 (협곡) | — | 묻지 않는다 — 위험이다 | RoomOfAnotherKind §5.1 | 자물쇠가 아니다. 모든 위험이 자물쇠는 아니다 (§5 마지막 줄) `[ ] 빈칸 4` 결정면(접촉 결정화)이 `flesh` 를 묻는 soft 자물쇠인지는 Human |
| 미로 입구 `MAZE_GATE` | hard | knowledge: `ANCIENT_GATE_PATTERN` | Region §16 양식 예시 — 데이터에 없다 (C004 는 문을 그냥 열었다) | 자리만 (K6) — 3층이 온 뒤 |
| 얼음 협곡 고개 (C002 "아직 갈 수 없는 곳") | — | 묻지 않는다 — 경계(`region-not-built`) | RegionGraphRooms 확정 5 | 자물쇠가 아니다. 경계는 "아직 짓지 않은 곳" 이지 "열쇠가 필요한 곳" 이 아니다 |
| 백왕령 북쪽 조건 area (산맥) | — | 묻지 않는다 — 안전 조건 | RoomBecomesLand §5.3 · RoomOfAnotherKind §5.4 | 자물쇠의 거울 (§4.5) — 이 문서 밖 |
| 추락 (`HEART_LAKE`) · 물길 | — | 묻지 않는다 — 일방향 전이 | RegionGraphRooms §5.6 | 자물쇠가 아니다 |

지금 세계의 자물쇠는 **셋**이고 property 를 묻는 것은 하나뿐이다. 그 하나에 열쇠가 없다 — 이것이 §1 의 구멍을 가장 짧게 보여 준다.

### 8.2 열쇠 — 지금 세계와 승인된 Play 의 Seed 에 성질 태그를 붙이면

| Seed | 문장 (원본 · 그대로) | 태그 (제안) | 원천 | 근거 |
|---|---|---|---|---|
| `BIO_ORE` 생체 광석 | 살아 있는 것의 몸을 따라 옮겨 다니며 쌓인다 · 쌓인 자리를 붉게 물들인다 · 물에 갈리면 붉은빛을 잃는다 | `flesh:stores` · `light:emits`(붉음) | 숲 셋 (C011) | RoomBearsMaterial D2 |
| `ORE_EATER_MOLT` 광식충 허물 | 붉은 결이 있되 옅다 · 마르면 부서진다 · 밑동 그늘에 모인다 | `light:emits`(옅음) | 숲 (C011) | D2 |
| `GIANT_TREE_FUNGUS` 거목균 | 사체에서만 자란다 · 사체를 삭여 흙을 붉게 되돌린다 · 그늘에서만 산다 | `flesh:absorbs` · `light:absorbs`(그늘) | 숲 (C014) | D2 |
| `FROST_CRYSTAL` 빙정석 | 열을 먹는다(닿은 것을 식힌다 · 숨이 언다) · 푸르게 빛난다 · 열이 닿으면 자란다 | `heat:absorbs` · `light:emits` · `heat:grows-on` | 협곡 넷 (C020) | RoomOfAnotherKind 확정 3 |
| `HEAT_CRYSTAL` 열을 저장하는 결정 | 빙결 Region 에서 체온 유지 (예시 한 줄) | `heat:stores` → 짝 `heat:hides`(체열을 숨긴다) 의 열쇠 | **없음** | Region §12 · RoomOfAnotherKind 확정 4 `[ ] 빈칸 2` |
| `SPATIAL_CRYSTAL` 공간 왜곡 결정 | 특정 Connector 의 목적지 고정 | `space:fixes` | **없음** (미로의 reward — Region §16) | Region §12 · §16 `[ ] 빈칸 5` |
| `WHALE_SCALE` 고래 비늘 | (성질 미정) | — | 세계 사건 (C018) | RoomNeverSame 확정 9 `[ ] 빈칸 6` |

태그가 문장에서 나온 것인지 한 줄씩 대조할 수 있다 (K5). `heat:stores` 와 `heat:hides` 를 같은 열쇠로 볼지(열을 담은 것이 체열을
숨기는가)는 어휘 표의 짝 열이 정한다 — 지금은 Region §12 의 예시 문장("열 저장 결정 → 빙결 Region 에서 체온 유지")을 근거로 짝으로 두었다.

### 8.3 검사를 지금 돌리면

```text
㉞ 통과 (어휘 표가 서면)
㉟ 실패 1 — FROST_DEPTH 의 문: heat:hides 를 묻는데 heat:stores 를 가진 Seed(HEAT_CRYSTAL)에 원천이 없다
㊱ heat 축이 열쇠 넷 중 둘 — 편중 아님
㊲ 자물쇠 셋 · property 자물쇠 하나 · 그 열쇠의 Region = 미정
㊳ 고아 어휘: space:fixes(열쇠 없음 · 자물쇠도 없음) · vibration(열쇠도 자물쇠도 없음 — 3층 맹목의 사냥꾼이 올 자리)
```

실패 하나와 고아 둘 — 전부 **이미 문서에 있던 빈 자리**다. 이 계약은 그것을 새로 만든 것이 아니라 보이게 한 것이다.

---

## 9. 빈칸 — Human 결정과 위임 후보

Material §6 · Life §7 의 방식이다. Human 이 결정하거나 "컨셉에 맞게 알아서" 로 위임하면 첫 Play 가 내린다.

```text
[ ] 1  축과 관계의 최종 목록 (§2.4) — 다섯 축 · 일곱 관계가 최소다. 더하거나 빼거나 이름을 바꾼다
[ ] 2  열을 저장하는 결정(HEAT_CRYSTAL)의 원천 — 어느 Region · 어느 Carrier · 어느 Cause. RoomOfAnotherKind 확정 4 가 "그 재료를 놓는 행이
       정한다" 로 미뤘다. 후보는 숲 계통(살아 있는 것 안에 쌓이는 성질 — 확정 4 의 후보 그대로). ㉟ 을 통과로 바꾸는 유일한 결정
[ ] 3  CONNECTOR_ACTIVATIONS · phases.connectorActivation 을 Lock 형으로 옮길 것인가, 셋을 검사만 함께 읽을 것인가 (§3 끝)
[ ] 4  협곡의 결정면(접촉하면 결정화 — Concept §5 물질)이 flesh 를 묻는 soft 자물쇠인가, 위험일 뿐인가
[ ] 5  공간 왜곡 결정(SPATIAL_CRYSTAL)의 원천과 그것이 여는 자물쇠 — Region §16 은 미로의 reward 로 두었으나 Play 는 놓지 않았다.
       두지 않으면 고아 어휘로 남는다 (㊳) — 남겨도 된다
[ ] 6  고래 비늘의 성질 — RoomNeverSame 이 이름만 확정했다
[ ] 7  자물쇠를 지목했을 때 강도(soft/hard)를 말할 것인가 — "버티기 어렵다" 와 "열리지 않는다" 를 판이 갈라 말하는가
```

남는 UNRESOLVED (2층이 답하지 않는다)

```text
· knowledge 자물쇠의 판정 — 3층
· 열쇠를 지닌다는 것의 뜻 (소지 · 장비 · 몸) — 3 · 4층
· 요정 자신이 열쇠가 되는 경우 (원리의 결속 — Concept §8) — 7층
```

---

## 10. 다음

```text
승인 시 고칠 자리 (이 문서 밖 — 승인 전에는 건드리지 않는다)
  · README.md §2 2층 행 — "②-부속 넷째 세계의 요구와 성질(자물쇠 · 열쇠 · 어휘 · 충분성)" 과 결과물 L2-World-Access.md · Play 하나
  · play/README.md 덮임 지도 — 행 하나: K1~K10 → 그 Play · 2층 밖: 판정(3 · 4층) · 조합(4층) · 클래스와 지식(3 · 7층)
  · L2-World-Tool-Scale.md §1 고정 공식 · §2 등급 A 조건 · T2 · T4 · T6 — §4.4 그대로
  · L2-World-Material.md §3.4 "observableProperties 의 값은 Human 이 준다" 곁에 "태그는 이 문서" 한 줄
  · STATE.md §1 레인 표 — 레인 하나 (Frost 뒤)
첫 계약 (Play 제안 — advprotoi-design 이 쓴다 · 승인 1회)
  이름   RoomAsksForAKey — 방이 열쇠를 묻는다
  방향   "관찰자가 빙결 심층의 문을 지목해 그것이 열을 묻는다는 것을 알고, 숲으로 돌아가 열을 담는 것을 흔적으로 찾아 캐고,
         들고 온 것이 그 문의 답이라는 것을 판이 말하는 것을 본다 — 문은 아직 열리지 않는다 (몸이 없다)"
  놓는 미지  열을 저장하는 결정의 원천 하나 (빈칸 2 — 컨텐츠 행 M7 후보 · 종류: 자원)
  자리   Frost(C021) 뒤 · Life 와 병행 가능 (Life 는 Frost 만 기다린다). Cycle 번호는 승인 때
  Cycle 후보 셋
    ① 어휘와 자물쇠 — PropertyVocabulary · Lock 데이터 · 지목하면 "무엇을 묻는가" · 검사 ㉞~㊳ (㉟ 은 먼저 실패를 보고한다)
    ② 열쇠 — Seed.properties · HEAT_CRYSTAL 의 원천(빈칸 2) · 재료의 판이 성질을 말한다 · ㉟ 통과
    ③ 세계 한 장 — 열쇠 × 자물쇠 표(§4.3) · T4 계약 목록 등록 · 등급 판정에 "열쇠 없는 문 = GAP"
선행   RoomBearsMaterial(원천 · 흔적 · 성질 문장) · RoomOfAnotherKind(첫 property 자물쇠) · RoomAnswersWhenAsked(지목과 판)
뒤에 오는 것  3층 주입 — 이 어휘로 몸(추위 · 체열)을 적는다. 4층 — 이 어휘로 물건의 MATERIAL 을 적는다
```
