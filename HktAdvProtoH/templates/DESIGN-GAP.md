# DESIGN GAP — GAP-<NNN>

> 어느 Stage 에서든 필요한 세계 의미가 정의되어 있지 않으면 **추측하지 않고** 이것을 쓴다 (RULE 5).
> Agent 는 설계 변경을 수행하지 않는다. **설계 변경 후보를 제출**할 뿐이다.

## 발견 위치

```text
Cycle:
    CYCLE-<NNN>

Stage:
    Stage <N> — <이름>

발견 시점:
    <무엇을 하려다 막혔는가>
```

## Affected Intent

```text
INTENT-<...>
```

## Missing Semantic

```text

```

## Why Required

이 의미 없이는 무엇을 판정하거나 표현할 수 없는가.

```text

```

## Proposal

제안하는 의미. **확정이 아니라 후보다.**

```text
Proposed State / Rule:

Entity 단위 형태:

기존 Baseline 과의 관계:
```

## 대안

고려했지만 택하지 않은 후보와 이유.

```text

```

## Blocking

```text
yes   이 Gap 없이는 현재 Stage 를 완료할 수 없다 → Stage 중단
no    현재 Stage 는 완료 가능하고, 이후 Cycle 로 미룰 수 있다
```

## 인간 판정

```text
결정:      수용 / 수정 후 수용 / 거부 / Backlog 로 이월

내용:

판정자 / 일시:
```

---

**처리 규칙**

- `Blocking: yes` → 인간이 해소해야 해당 Stage 를 재실행할 수 있다.
- 수용 시 → Stage 2 (World Model) 를 별도 invocation 으로 재실행해 의미를 반영한다.
- Backlog 이월 시 → `context/EVOLUTION-BACKLOG.md` 의 "Design Gap 에서 승격된 항목" 표에 추가한다.
