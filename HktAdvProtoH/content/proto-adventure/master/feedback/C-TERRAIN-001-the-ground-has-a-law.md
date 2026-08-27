# Feedback — C-TERRAIN-001-the-ground-has-a-law

    반영 시점    main f5b3ed6 위에서
    근거         cycles/C-TERRAIN-001-the-ground-has-a-law/08-verification.md 의 MASTER FEEDBACK

## Overlay

    이 Cycle 은 **Capability 를 Target 으로 삼지 않았다** (01-cycle.md `Target Capability: 없음`).
    세우는 것이 능력이 아니라 그 능력들이 놓일 땅이었으므로, 바뀐 것은 능력 표가 아니라
    **세계 표**다.

    MW-MACRO-TERRAIN              ABSENT → PARTIAL
        선 것    무대가 자리로 나뉘고 자리가 법칙을 지닌다 (World.GroundZones ·
                 GroundLawDefinition). 걸리는 것은 기후 이름이 아니라 무엇을 어떤 조건에서
                 거두어 가는가다
        남은 것  world_shape 의 나머지 — 법칙이 하나뿐이고, 그 법칙이 낳는 자원이 없으며,
                 어디에 갈 수 있는가가 감당으로 정해지지 않고, 깊이와의 직교도 없다
        근거     08 의 WORLD SCENARIO · PLAYABLE

    MW-TERRAIN-SUNEATER-ICEFIELD  ABSENT → PARTIAL
        선 것    열을 거두는 법칙(heat-binding)과 그것이 멎는 해숨구멍(zone-sunbreath)
        남은 것  world_shape 가 요구하는 **풍경이 없다** — 열이 어디로 이동하는지의 증거
                 (검은 빛 · 서리 무늬 · 얼어붙은 거수)가 하나도 없고, 거둔 열이 어디에도
                 저장되지 않아 해숨구멍이 원인 없이 놓인 상수다
        근거     08 의 PLAYABLE (실제 화면 · `npm run terrain:shot`)

    나머지 일곱 MW-TERRAIN-* 는 ABSENT 그대로다 — 이 Cycle 은 법칙 하나로 축이 서는지만 봤다.

    **대지형 MC 아홉은 여전히 MISSING 이나 막고 있는 것이 달라졌다.** "놓일 바닥이 없다"
    에서 **"땅에 시간이 없다"** 로 옮겨갔다. 그 설명은 `graph/overlay-notes.yaml` 의
    대지형 절 서문과 "가장 큰 구멍" 넷째 항이 소유한다 — 노드의 `overlay_gap` 은 아직
    개별로 고치지 않는다. 아홉이 같은 하나에 걸려 있고 그 하나를 여는 후보가
    이미 트랙에 서 있으므로, 그것이 닫힐 때 아홉을 함께 재판정하는 편이 정확하다.

## Frontier (자기 트랙만 — TERRAIN)

    지웠다   FR-THE-GROUND-HAS-A-LAW → 이 Cycle 로 닫혔다.
             배운 것: **후보가 SATISFIED 로 적어 둔 Constraint 판정이 실제로 세워 보니
             절반이었다** (아래 Constraint Evaluation). 후보 단계의 판정은 예측이고,
             Cycle 이 그것을 실측으로 고쳐 올리는 것이 이 접합점의 값어치다.

    새 후보  FR-THE-LAND-KEEPS-WHAT-IT-TAKES — 땅이 거둔 것을 간직한다.
             거둔 것이 자리에 쌓이고, 쌓인 것이 넘치면 분출하며, **예외 자리가 그 분출로
             생겨난다**. BT §15 의 셋째 항(대지 순환)이 그 자리다.

    SELECTED 를 비웠다 — 다음 선택은 Human 의 몫이다.

## Constraint Evaluation

    **그래프에 기록하지 않는다.** 이 Cycle 이 Capability 노드를 하나도 건드리지 않아
    판정을 걸 자리가 없다 (`constraint_evaluation` 은 capability/possibility 의 필드다).
    없는 자리에 Edge 를 만드는 것이 무차별 Edge 다 — C026 이 같은 자리에서 내린 판단 그대로다.
    아래는 그 판정의 기록이며, 이 파일이 소유한다.

    DC-WORLD-TERRAIN-IS-A-PRINCIPLE   **SATISFIED → PARTIAL (Cycle 이 고쳐 올렸다)**
        후보 문서가 착수 전에 SATISFIED 로 적었으나 실제로 세워 보니 절반이다.
        그 Constraint 의 requires 는 "어떤 상태를 어떤 조건에서 **반복** 변화시키는지" 인데
        이 Cycle 이 세운 것은 반복이 아니라 **지속**이다. 조건과 결과 절(걸린 것이 기후
        이름이 아니라 takes · rate 다)은 SATISFIED.
    DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION   SATISFIED
        예외가 플래그가 아니라 그 법칙이 멎는 자리로 성립한다. 게다가 respite 가 자기가
        멎게 하는 법칙의 이름을 지녀 **"모든 것을 막는 안전지대" 를 형태로 적을 수 없다**
    DC-CONDITION-OPENS-WITHOUT-RECORDING     SATISFIED   판정용 State 가 하나도 없다
    DC-WORLD-OWNS-THE-SURFACE-LIST           SATISFIED
        규칙과 관찰이 같은 함수(`activeGroundLaws`)를 쓴다 — 판정이 두 곳에 살지 않는다
    DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE       UNRESOLVED (예정대로)
        겪는 것은 섰고 **증거가 먼저 오는 절**은 다음 후보의 몫이다

## Candidates

    접수 없음. Cycle 이 Constraint Candidate 를 보고하지 않았다.

## Master Gap

    Cycle 이 하나를 보고했고, **Human 이 이미 답했다.**

    Gap        BT §15 의 셋째 항(대지 순환)이 통째로 비어 있다. BT §5.7 이 빙원의 핵심
               경험을 "대지가 열을 어디에서 빼앗고 **어디에 저장하는지**를 읽는 것" 으로
               못 박았는데 이 Cycle 은 앞 절만 세웠다. 거둔 열이 사라지므로 해숨구멍은
               원인 없이 놓인 결과다
    Affected   DC-WORLD-TERRAIN-IS-A-PRINCIPLE (위 PARTIAL) ·
               MC-TIME-THE-CYCLE · MC-FIND-SAFE-ROUTE (셀 주기와 이을 자리가 없다) ·
               FR-THE-LAND-SHOWS-BEFORE-IT-TAKES (속도가 상수면 예고할 것이 없다)
    Trade-off  순환을 그 Cycle 에 넣으면 "땅이 법칙을 지닌다" 와 "땅이 스스로 돈다" 가
               섞여 둘 다 흐려진다. 미루는 대가는 닫힌 시점의 세계가 생존게임의 추위
               게이지와 형태로 구분되지 않는다는 것이다
    Decision   **다음 후보로 세운다** — `FR-THE-LAND-KEEPS-WHAT-IT-TAKES`.
               예고보다 앞선다: 순환 없이는 예고가 가짜이고, 예고 없이 순환만 넣으면
               안전한 자리가 움직이는데 읽을 방법이 없어 불공정이다

## 기반 (Master 밖)

    ENGINE 레인의 지면 구역 장치(`SceneGroundZone`)가 이 Cycle 과 함께 섰다.
    `design/Design-Terrain-Visualization.md` 가 IMPLEMENTED 로 바뀌었다.
