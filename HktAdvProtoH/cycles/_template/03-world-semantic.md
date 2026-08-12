# <ID> — World Semantic

Guide: [guides/world-semantic.md](../../guides/world-semantic.md) · Input: `02-intent.md`

## SEMANTIC DELTA

    REUSED
        <기존 그대로 사용하는 Semantic>
    ADDED
        <이번 Cycle 에서 새로 추가되는 Semantic>
    CHANGED
        <변경되는 기존 Semantic / Rule + 무엇이 바뀌는가>
    AFFECTED
        <이 변경으로 영향을 받는 기존 Rule / 기능>

## WORLD STATE

    <Entity>
        <Field>    <Authority>

## WORLD RULE

    RULE-<...>-001
        Implements     INTENT-<...>-001
        Input          <...>
        Preconditions  <...>
        Transition     <...>
        Result         Success | Failure(<reason>)

## OBSERVABLE SEMANTIC

    <Rule 판단에 영향을 준 State>
    <Availability + Failure Reason>
    <Before → Input → Rule → After 로 관찰 가능한 전이>

## SEMANTIC CLOSURE

    "<Intent 문장 조각>"   →  <State 또는 Rule>
