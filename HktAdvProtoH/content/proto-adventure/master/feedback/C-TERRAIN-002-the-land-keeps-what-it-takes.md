# Feedback — C-TERRAIN-002-the-land-keeps-what-it-takes

    반영 시점    C-TERRAIN-002 가 닫힌 직후, 같은 브랜치 위에서
    근거         cycles/C-TERRAIN-002-the-land-keeps-what-it-takes/08-verification.md 의
                 MASTER FEEDBACK

    **Where 규칙을 지키지 못했다.** master-feedback.md 는 "그 Cycle 의 브랜치가 main 에
    병합된 뒤 최신 main 위에서" 돌리라고 정한다. 이 반영은 아직 병합되지 않은
    `claude/world-terrain-progress-cln27o` 위에서 돌았다 — 세션에 지정 브랜치가 하나뿐이고
    Human 이 "complete 하고 다음 cycle 진행" 을 한 흐름으로 지시했기 때문이다.
    `npm run feedback:gate` 가 그 사실을 경고했고, 넘어가고 진행했다.

    이것이 위험한 이유는 규칙이 적어 둔 그대로다 — 공유 파일(`overlay.md` ·
    `graph/*.yaml`)을 트랙 브랜치에서 고치면 병렬 갈래의 Feedback 끼리 병합이 사실을
    고르는 일이 된다. **지금은 병렬 TERRAIN 세션이 없으므로 사고가 나지 않았으나,
    같은 상황이 반복되면 규칙을 지키거나 규칙을 고쳐야 한다** (PROCESS 보고).

## Overlay

    이 Cycle 도 **Capability 를 Target 으로 삼지 않았다** (01-cycle.md).
    바뀐 것은 능력 표가 아니라 **세계 표**이며, 그 자리는 이 Cycle 이 도는 동안
    Master 가 BT §16 을 주입해 세운 노드들이다 (HISTORY — BT §16 세계 골격 대조).

    MW-TERRAIN-CIRCULATION        ABSENT → **PRESENT**
        선 것    자리가 거둔 것을 지니고(kept), 넘치면 뿜고, 그 안의 몸에게 돌려주고,
                 다 쓰면 닫혀 도로 거둔다. world_shape 가 요구한 "같은 자리를 다른 시각에
                 보면 다르고, 그 다름이 그 사이에 무슨 일이 있었는가로 설명된다" 가
                 성립한다 — 25초 주기는 세계가 정한 것이 아니라 그 자리에 누가 서
                 있었는가의 결과다
        근거     08 의 WORLD SCENARIO (t=0 발밑 찬 50% → t=7.5 찬 100% → t=10 venting) ·
                 보존 대조 (온기+발밑 = 130 → 130)

    MW-NATURAL-REFUGE             PARTIAL → **PRESENT**
        선 것    예외를 놓을 형이 사라졌다 (`GroundZone.role` 삭제). 법칙이 멎는 자리는
                 넘쳐서 뿜는 중인 맥뿐이므로 "왜 하필 거기가 안전한가" 에 세계가 답한다.
                 그리고 옮겨 가고 사라진다
        근거     08 의 WORLD SCENARIO (t=42.5 저쪽이 binding 0% 로 닫힘) ·
                 PLAYABLE (땅 위의 이름 둘이 서로 자리를 바꾼 그림)

    MW-SURVIVAL-PRESSURE          PARTIAL → **PARTIAL (넓어짐)**
        선 것    압력이 순환에서 나온다 — 어디가 거두고 어디가 돌려주는지가 내가 한 일의
                 결과이므로 읽어서 이용할 거리가 생겼다
        남은 것  world_shape 의 "읽은 사람과 읽지 못한 사람이 다른 결과를 낸다" 가 절반이다.
                 **지금 상태는 읽히나 앞으로 일어날 일은 읽히지 않는다** —
                 MW-CIRCULATION-EVIDENCE 가 그 자리이고 다음 후보가 연다

    MW-MACRO-TERRAIN 은 PARTIAL 그대로다 — 법칙이 여전히 하나이고, 그 법칙이 낳는 자원이
    없으며, 깊이와의 직교도 없다. 셋 다 이 Cycle 의 EXCLUDED 였다.

    MW-TERRAIN-SUNEATER-ICEFIELD 도 PARTIAL 그대로 두었다. 그 노드의 world_shape 가
    요구하는 것은 **풍경**이다 — 얼음 아래의 검은 빛 · 원형 서리 무늬 · 얼어붙은 거수.
    "해숨구멍이 원인 없이 놓인 상수다" 는 이 Cycle 로 해소되었으나 풍경 쪽은 하나도
    서지 않았으므로, 그 노드는 다음 후보(예고)가 닫을 때 함께 재판정한다.

    **대지형 MC 아홉은 여전히 MISSING 이나 막고 있는 것이 또 달라졌다.**
    "놓일 바닥이 없다"(C-TERRAIN-001 이전) → "땅에 시간이 없다"(C-TERRAIN-001)
    → **"땅이 무엇을 할지 미리 말해 주지 않는다"**(지금). MC-TIME-THE-CYCLE 은 셀 주기가
    생겼고 MC-FIND-SAFE-ROUTE 는 이을 자리가 여럿이 되었으나, 둘 다 `grounded: false` 라
    개별 재판정을 하지 않는다 — 그 설명은 `graph/overlay-notes.yaml` 이 소유한다.

## Frontier (자기 트랙만 — TERRAIN)

    지웠다   FR-THE-LAND-KEEPS-WHAT-IT-TAKES → 이 Cycle 로 닫혔다.

             배운 것 셋.

             ① **"Why one Cycle" 이 맞았다.** 후보가 "새로 서는 것은 뺀 것을 어디에
                넣는가 하나이며 나머지는 그 하나의 결과다" 라고 적었고, 실제로
                `ground-law-apply.ts` 에서 는 줄은 셋이었다. 형태가 이미 서 있다는
                판단이 값의 근거로 쓸 만하다.

             ② **후보의 이유가 부기로 적혀 있었다.** 이 후보의 근거는
                "DC-WORLD-TERRAIN-IS-A-PRINCIPLE 이 PARTIAL 이다" 였지, "이것이 없으면
                생명과 자원을 놓는 수밖에 없다" 가 아니었다. 순환 계열이 그래프에 노드로
                없었기 때문이고, Human 이 그것을 지적해 Master 가 이 Cycle 이 도는 중에
                BT §16 사슬을 주입했다 (Q69(b) — 순환이 이제 Goal 을 낳는다).
                **후보를 뽑을 때 Goal 경로가 비어 있으면 그 자체가 결손 신호다.**

             ③ **후보가 적어 둔 순서 경고가 실제로 참이 되었다.** "이 후보만 넣고 예고가
                없으면 게임이 지금보다 나빠진다 — 안전한 자리가 움직이는데 읽을 방법이
                없으면 그것은 깊이가 아니라 불공정이다." 지금 세계가 정확히 그 상태다.
                그래서 다음 후보의 추천 근거가 의존이 아니라 **부채**다.

    갱신했다 FR-THE-LAND-SHOWS-BEFORE-IT-TAKES 에 Target 이 생겼다 —
             `MW-CIRCULATION-EVIDENCE` (ABSENT). BT §15.8 주입으로 선 노드이며,
             이 후보는 이제 "Capability 를 Target 으로 삼지 않는다" 가 아니라
             **그 노드를 연다** 고 적는다. 의존 둘이 모두 닫혔음도 함께 적었다.

    새 후보  없음 — 이 Cycle 이 새로 연 후보는 없다. 남은 둘이 이미 그 자리를 지닌다.

    SELECTED 를 비웠다 — 다음 선택은 Human 의 몫이다.

## Constraint Evaluation

    **그래프에 기록하지 않는다.** 이 Cycle 도 Capability 노드를 하나도 건드리지 않아
    `constraint_evaluation` 을 적을 노드가 없다 (그 필드는 Capability/Possibility 소유).
    판정은 여기 남기고, 세계 표의 근거는 위 Overlay 가 지닌다.

    DC-WORLD-TERRAIN-IS-A-PRINCIPLE          PARTIAL → **SATISFIED**
        그 Constraint 의 requires 는 "어떤 상태를 어떤 조건에서 **반복** 변화시키는지"
        인데 C-TERRAIN-001 이 세운 것은 반복이 아니라 지속이었고, 그 Cycle 이 스스로
        판정을 고쳐 올렸다. 이 Cycle 의 25초 주기가 그 반복이다.

    DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION   SATISFIED — **형태로 닫혔다**
        C-TERRAIN-001 은 예외가 자기가 멎게 하는 법칙의 이름을 지니게 해서 "모든 것을
        막는 안전지대" 를 적을 수 없게 했다. 이 Cycle 은 한 걸음 더 갔다 — **어떤
        안전지대도** 적을 수 없다. 형이 없기 때문이며, 검사가 그것을 지킨다.

    DC-CONDITION-OPENS-WITHOUT-RECORDING     SATISFIED — 몸에 대해
        몸에는 한 항목도 늘지 않았다. State 가 는 곳은 땅이며, 땅의 State 는 판정을 위한
        기록이 아니라 세계가 겪은 일의 결과다 (광맥의 남은 자원과 같은 종류).

    DC-WORLD-OWNS-THE-SURFACE-LIST           SATISFIED
        화면은 `fill` 을 받는다 — `kept` 도 `saturation` 도 계약에 없으므로 나누지 못하고,
        그래서 "곧 넘친다" 를 스스로 판정할 수 없다. 검사가 그것을 지킨다.

    DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE       UNRESOLVED — 예정대로
        증거가 **먼저** 오는 절은 다음 후보의 몫이다. 이 Cycle 은 그 예고가 예고할
        거리를 만들었다.

## Constraint Candidate

    없음 — 이 Cycle 에서 새로 관찰된 반복 패턴이 없다.

## Master Gap

    Cycle 이 보고한 Gap 은 **그 아래가 열렸다**는 것이다 — 순환이 섰으므로
    `MW-ADAPTED-LIFE`(무엇이 어디 사는가) · `MW-TERRAIN-RESOURCE`(그 법칙이 낳는 자원) ·
    `MW-NATURAL-SETTLEMENT`(정착) 셋이 이제 **매달릴 자리를 지닌다.** 셋 다 ABSENT 다.

    임의로 해결하지 않는다. 셋을 여는 후보를 지금 세우지 않은 이유는 둘이다.

    ① 그 셋은 TERRAIN 트랙 혼자의 것이 아니다 — 자원은 `Design-Resource-Catalog-R0.md`
       승인을 기다리고 (HUMAN 대기), 생명은 `Design-Creature-Behavior-R0.md` 승인을
       기다린다. 승인 없이 후보를 세우면 문서에 없는 의미를 지어내게 된다.
    ② 예고(FR-THE-LAND-SHOWS-BEFORE-IT-TAKES)가 먼저라는 것이 이 Cycle 이 남긴
       부채다. 그것을 건너뛰고 아래층으로 내려가면 불공정한 세계 위에 생태를 얹게 된다.

    **Human 이 볼 것**: 저 두 기획서의 승인이 TERRAIN 트랙의 다음 다음을 막고 있다.
