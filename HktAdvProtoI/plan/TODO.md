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
1  지목  다음 기획서 — 후보 2 편성과 무대(3층 — 먼저 "3층 주입 — <방향 한 줄>" 로 L3-Handoff §2 를 기획서로) · 3 Rooms GAP 회수 · 3.5 둥지가 군락이 된다(Foundation 둘째 — 순서 배치는 Human) → AI 가 그 기획서의 Cycle 전부를 spec 으로 (C039~)   DESIGN.md §5
2  판정  빙결 협곡 실주행 — Frost-1 ~ Frost-6 (그 절의 "결정 대기" 값 · 규칙을 함께 본다)                                        DESIGN.md §3 M5-FrostCanyon
3  판정  생명 · 붉은 알집 실주행 — Life-1 ~ Life-6 (〃)                                                                      DESIGN.md §3 L2-World-Life
4  판정  요구와 가능성 실주행 — Access-1 ~ Access-5 (〃)                                                                     DESIGN.md §3 L2-World-Access
5  이름  HundredRooms 의 미지 백 줄 — 직접 주거나 초안기(world:draft --batch) 후보를 고른다                                       DESIGN.md §5 후보 4
6  주입  3층 나머지 절반 — 몸의 값 전반 · 생물의 앎과 선택 (후보 2 판정 뒤 · L3-Handoff §3 과 합친다 · 그때 2층 나머지 일곱 문서의 뒤 층 절도 Handoff 로)   DESIGN.md §1 · §5 후보 5
7  이름  컨텐츠 행 — 보석 여덟 · 보류 계열 일곱 · Region §5.1 나머지 … 하나씩                                                   DESIGN.md §3 "컨텐츠 행"
8  결정  도구 — 갈래 hazard/terrain 의 땅이 분지인가 협곡 벽인가 · 방 아홉의 kinds 를 채우는가 (Cycle 이 아니라 작성기의 것)            DESIGN.md §3 Tool-Scale "결정 대기 — 도구"
```

## 2. cycle — 돌릴 것

```text
1  Cycle      돌 수 있는 레인이 없다 — Foundation 이 닫혔다. 다음은 §2-2 spec 제안 · Human 지목을 기다린다                CYCLES.md §1
2  spec 제안   §1-1 지목 즉시 — 그 기획서의 Cycle 전부를 spec 으로(첫 spec 의 Trace 에 Cycle 목록 · UNRESOLVED 에 질문 전부) → Human 에게 올린다   Design-DesignAuthoringWorkflow §5~§7
3  예심       기획서의 마지막 Cycle 이 합쳐지면 — 컨텐츠 Cycle 은 관찰 항목을 질문 대여섯으로 · 기반 Cycle 은 기반 검토 항목을 기반 질문 서넛으로(경험 질문 없음)
              → DESIGN.md §3 그 기획서 절에 · STATE §2 · TODO §1 에 판정/검토 줄                                                    Design-CycleExecutionWorkflow §21
4  GAP 회수   §1-2 · 3 · 4 에서 "아니오" 가 오면 — 그 기획서에 Cycle 을 더하거나, 여럿에 걸치면 관찰 가능성 Cycle 하나로 자른다 (advprotoi-spec)
합친 직후  CYCLES 레인 · DESIGN §3 그 기획서 절(덮인 것 · 관찰 항목 · 다음 Cycle 로) · STATE · codemap(API · 구조가 바뀐 것만)
```

## 3. engine · 도구

```text
1  기획서 없는 다음 Cycle — T2 확장(요구와 답을 구조로 · access.silence)                     CYCLES.md §3
2  공학 부채 — 그 자리를 만지는 Cycle 이 갚는다                                            CYCLES.md §4
```
