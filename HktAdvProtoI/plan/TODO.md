# TODO — 앞으로 할 일

살아 있는 문서 — **현재 상태만** (CLAUDE.md 원칙 10). 끝난 줄은 지운다. 경위는 git history 가 소유한다.

```text
목적    "다음에 무엇을 하는가" 의 큐. 트랙(주체)마다 절 하나, 위가 먼저다. 한 줄이 일 하나 — 내용은 복사하지 않고 상세 문서를 링크한다.
        어디까지 왔는가는 STATE.md, 왜 그 순서인가는 STATE §0 의 그림.
기능    §1 Human · §2 cycle · §3 engine · 도구
쓰는 이  advprotoi-inject(주입 질문) · advprotoi-cycle(Cycle 목록 승인 · 합친 직후 · 판정 반영 때) · Human(답하고 지운다)
```

## 1. Human — 답할 것 (순서대로)

```text
1  결정  3층 원문 L3-Subject-Body(주체와 몸 — 주입됨)와 후보 2 · 5 의 관계 — ① 이 문서 하나가 3층의 행(Cycle A~D)인가, 몸(A · D)만의 행인가 ② 후보 2 를 먼저 자르는가 A 부터인가
         ③ 놓는 미지(M8 은 후보 2 대로인가) ④ Knowledge 의 주인(Actor 인가 관찰자인가) → 답이 오면 "L3-Subject-Body 로 spec 써"                                    DESIGN.md §3 L3-Subject-Body
2  지목  다음 기획서 — 후보 2 편성과 무대(3층 — L3-Subject-Expedition · 위 ①② 뒤) · 2' 주체와 몸(L3-Subject-Body) · 3 Rooms GAP 회수 · 3.5 둥지가 군락이 된다(Foundation 둘째 — 순서 배치는 Human) → AI 가 그 기획서의 Cycle 전부를 spec 으로 (C039~)   DESIGN.md §5
3  판정  빙결 협곡 실주행 — Frost-1 ~ Frost-6 (그 절의 "결정 대기" 값 · 규칙을 함께 본다)                                        DESIGN.md §3 M5-FrostCanyon
4  판정  생명 · 붉은 알집 실주행 — Life-1 ~ Life-6 (〃)                                                                      DESIGN.md §3 L2-World-Life
5  판정  요구와 가능성 실주행 — Access-1 ~ Access-5 (〃)                                                                     DESIGN.md §3 L2-World-Access
6  이름  HundredRooms 의 미지 백 줄 — 직접 주거나 초안기(world:draft --batch) 후보를 고른다. **도구는 다 섰다** —
         일곱 줄로 배치 → 판정 표면 → 승인까지 한 바퀴 돌려 보았고, 이름만 오면 그대로 백 줄이 돈다              DESIGN.md §5 후보 4
7  이름  컨텐츠 행 — 보석 여덟 · 보류 계열 일곱 · Region §5.1 나머지 … 하나씩                                                   DESIGN.md §3 "컨텐츠 행"
```

## 2. cycle — 돌릴 것

```text
1  Cycle      돌 수 있는 레인이 없다 — Foundation 이 닫혔다. 다음은 §2-2 spec 제안 · Human 지목을 기다린다                CYCLES.md §1
2  spec 제안   §1-2 지목 즉시 — 그 기획서의 Cycle 전부를 spec 으로(첫 spec 의 Trace 에 Cycle 목록 · UNRESOLVED 에 질문 전부) → Human 에게 올린다   Design-DesignAuthoringWorkflow §5~§7
3  예심       기획서의 마지막 Cycle 이 합쳐지면 — 컨텐츠 Cycle 은 관찰 항목을 질문 대여섯으로 · 기반 Cycle 은 기반 검토 항목을 기반 질문 서넛으로(경험 질문 없음)
              → DESIGN.md §3 그 기획서 절에 · STATE §2 · TODO §1 에 판정/검토 줄                                                    Design-CycleExecutionWorkflow §21
4  GAP 회수   §1-3 · 4 · 5 에서 "아니오" 가 오면 — 그 기획서에 Cycle 을 더하거나, 여럿에 걸치면 관찰 가능성 Cycle 하나로 자른다 (advprotoi-spec)
5  옮김       2층 나머지 일곱 문서의 뒤 층 절을 그 층의 대기 문서로 (Material 쓰임 · Access 4층 몫 → L4 · Concept W6 · W7 → L5 …) — 3층 원문이 왔으므로 다음 inject 세션이 한다 (이번 주입은 L3 원문 보존만)   DESIGN.md §1 4 · 5행 · §3
합친 직후  CYCLES 레인 · DESIGN §3 그 기획서 절(덮인 것 · 관찰 항목 · 다음 Cycle 로) · STATE · codemap(API · 구조가 바뀐 것만)
```

## 3. engine · 도구

```text
1  (없다) — T1~T6 이 다 실측되었다. 도구 레인은 **미지 백 줄의 이름**(§1)을 기다린다                CYCLES.md §3
2  공학 부채 — 그 자리를 만지는 Cycle 이 갚는다                                            CYCLES.md §4
```
