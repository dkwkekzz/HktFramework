---
name: advprotoi-master
description: HktAdvProtoI 의 Master Graph 탐색을 실행한다 — World/Actor → Goal → Possibility → Required Capability → Missing Capability → Frontier 사다리로 "다음에 무엇을 만들까" 후보를 제시한다. Cycle 공정의 필수 단계가 아니다 — Human 이 직접 Cycle 을 지정하면 쓰지 않는다. Frontier 선택은 Human 이 하고, 이후는 advprotoi-plan 이 이어받는다. 사용자가 "AdvProtoI 다음 뭐 할지 / Frontier 뽑아줘 / Master Graph 탐색 / master 진행" 을 요청하면 사용.
---

# HktAdvProtoI Master — 다음 Cycle 탐색 (선택적)

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-CycleExecutionWorkflow.md](../../../HktAdvProtoI/design/Design-CycleExecutionWorkflow.md) §15.

**대체 관계** ([design/Design-DesignAuthoringWorkflow.md](../../../HktAdvProtoI/design/Design-DesignAuthoringWorkflow.md) §10):
"다음에 무엇을 만들까"의 표준 답은 승인된 Play Design(`design/play/*.md`)의
Cycle Breakdown 이다 — 미완료 Cycle 이 있는 Play 가 존재하면 이 스킬을 쓰지 않고
`advprotoi-design`/`advprotoi-plan` 으로 안내한다. 이 스킬은 Play Design 이 하나도
없는 초기 탐색의 보조 도구로만 남는다.

이 스킬은 **설계 탐색 도구**다. Cycle 은 구현 공정이고 둘은 분리한다 (원본 §15).
코드·`design/`·`cycles/` 를 수정하지 않는다. 산출물은 대화 보고(Frontier 후보 목록)
뿐이다 — 필요해질 때까지 `master/` 디렉터리·그래프 파일을 만들지 않는다
(선행 구조 금지, 원본 §10 의 정신을 공정 자신에게도 적용).

## 절차

1. **현재 세계 파악** — `CLAUDE.md` 의 "컨텐츠에 지금 있는 것/없는 것" +
   기존 `cycles/*/02-world.md` 의 REUSED/ADDED 목록으로 현재 보유 Capability 를 읽는다.
2. **탐색 사다리** (원본 §15):

   ```text
   World / Actor → Goal → Possibility → Required Capability
   → Missing Capability → Frontier
   ```

   Goal·Possibility 의 근거는 반드시 `design/` 문서다 — 문서에 없는 기획 의미를
   탐색 중에 만들어내지 않는다. 없으면 "기획 부재"로 표시한다.
3. **Frontier 후보 제시** — 각 후보에: 근거 Design 문서·절 / 성립시킬 플레이 결과
   한 문장 / 필요한 Missing Capability / 예상 REUSED. 3개 내외.
4. **정지** — 선택은 Human 이 한다. 선택 결과는 `advprotoi-plan` 의 Cycle Goal 로만
   전달된다. **Master 는 Source 가 아니다** — 의미의 근거(01-spec 의 SOURCE)는
   반드시 Design 문서이고, Frontier 는 "왜 지금 이걸 하는가"로서 01-spec 의
   SELECTED_FROM 에만 적힌다. 이후 구현은 Master 탐색을 다시 해석하지 않는다.

## 금지

- Frontier 를 스스로 선택하고 Cycle 을 시작하지 않는다.
- 닫힌 Cycle 산출물을 되읽어 의미를 재해석하거나 Design 에 없는 Goal 을 지어내지 않는다.
