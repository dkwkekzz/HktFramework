# Master Inject Guide (기반 기획 주입)

## Role

Human 이 작성·개정한 **기반 기획 문서**(`design/Design-*.md` — 전투 규칙 등)의 의미를
Master Layer 로 옮긴다.

**창작이 아니라 번역이다.** 기본 4단계(WHY → OPTIONS → NEED → NEXT)가 Graph 를
원본으로 새 의미를 *탐색*하는 공정이라면, 주입은 Human 이 이미 설계한 문서를
원본으로 의미를 *대조해 옮기는* 공정이다. 둘을 섞으면 문서에 없는 의미를
Agent 가 지어내게 된다.

트리거 — **Human 이 문서를 지목해 반영을 지시할 때만.** Agent 가 스스로 시작하지 않는다.

```text
탐색 (기본 4단계)   Graph 가 원본. 누가 왜 원하는지에서 새 의미를 찾는다
주입 (이 Guide)     Human 문서가 원본. 문서에 있는 의미만 Master 어휘로 옮긴다
```

## Input

- 대상 기반 기획 문서 (Human 지정 — 신규 또는 개정)
- `master/constraints/` · `master/graph/` · `master/overlay.md` — 기존 상태 (중복·충돌 대조용)
- `master/root.md`

## Do

1. **Constraint 추출** — 문서가 **명시한** 설계 원칙만 DC 신규/개정 후보로 만든다.
   작성 규칙은 `master-constraint.md` 를 그대로 따른다. Human 승인 전에는 `DRAFT` 다.
   원본보다 세게 쓰지 않는다 — 문서의 "정도 조절(prefers)"을 "금지(prohibits)"로 바꾸지 않는다.
2. **Graph 주입** — 문서의 Goal / Possibility / Capability 의미를 노드로 옮긴다.
   - 각 노드에 문서의 § 를 근거로 남긴다 (주석 provenance) — 어디서 왔는지 답할 수 있어야 한다.
   - 문서가 **예고만 한** 확장 층(사다리)도 노드로 먼저 세운다 — 노드가 없으면
     그 층은 Overlay 에도 Frontier 에도 나타나지 못한다.
   - WHY / OPTIONS / NEED Guide 의 MUST / MUST NOT 은 동일하게 적용된다.
     단, "폭으로 탐색"은 하지 않는다 — 문서에 있는 의미만 옮긴다.
3. **Overlay 정합** — 주입·변경된 Capability 를 현재 세계와 겹쳐 판정한다
   (`master-overlay.md` 의 절차와 판정 기준).
4. **기존 노드와의 충돌** — 문서 개정이 기존 노드·DC 의미와 어긋나면 임의로 고치지 않고
   Conflict · Affected Nodes · Trade-off 로 `open-questions.md` 에 노출한다.
   (예: R1 개정이 기존 DC 5종의 근거를 바꿔 Q10 이 열렸다.)
5. **공백은 자리로 남긴다** — 문서가 공급하지 않는 의미(World Cause 등)는 지어내지 않고
   `open-questions.md` 에 남긴다. (예: 전투 문서는 세계의 사정을 공급하지 않아 Q2 가 열렸다.)

## Output

- `master/constraints/DC-*.yaml` (DRAFT — Human 승인 대기)
- `master/graph/*.yaml` (문서 § provenance 포함)
- `master/overlay.md` (갱신)
- `master/open-questions.md` (충돌·공백)

형식은 `master/SCHEMA.md` 가 단일 출처다.

## Must

- 모든 신규/변경 노드·DC 가 문서의 어느 § 에서 왔는지 답할 수 있다.
- 새 Node 를 만들기 전에 기존 Registry 를 검색한다 — 같은 의미를 새 이름으로 만들지 않는다.
- 문서 개정 주입이면 무엇이 REUSED / ADDED / CHANGED 인지 기록에서 읽힌다.

## Must Not

- 문서에 없는 Goal / Possibility / Capability 를 만들지 않는다 — 그것은 탐색(4단계)의 몫이다.
- 이 공정을 4단계 대신 상시로 쓰지 않는다 — 주입이 끝나면 성장과 선택은 기본 4단계로 복귀한다.
- 원본보다 세게 쓰지 않는다.
- Constraint 를 자동 승인·승격하지 않는다.
- 수치·공식·판정 상수를 옮기지 않는다 — 문서에 남겨 두고 해당 Cycle 의
  `03-world-semantic.md` 가 소유한다 (정책 §7.2).
- 기존 노드와의 충돌을 임의로 해결하지 않는다.

## Done When

- 문서의 모든 명시 원칙이 DC(승인 대기 포함)로 존재하거나, 옮기지 않은 사유가 있다.
- 문서의 플레이 의미가 노드로 존재하거나, 옮기지 않은 사유가 있다.
- 예고된 확장 층이 노드로 세워져 있다.
- 주입·변경된 Capability 에 Overlay 판정과 근거가 있다.
- 충돌과 공백이 Human 결정 대기로 노출되어 있다.
- 다음 4단계 실행(특히 NEXT)이 이 상태만 보고 이어질 수 있다.
