# CC-THE-LIST-IS-THE-JUDGE-TOO

접수: Feedback — C-COMBAT-003-the-world-decides-what-is-possible 의 MASTER FEEDBACK 이
보고한 관찰이다. Cycle Agent 는 관찰만 보고했고, 승격 판단은 Human 이 한다.

## CANDIDATE STATEMENT

    세계가 목록으로 세운 것은 **세계 자신의 판정도** 그 목록에 물어야 한다.
    목록을 세워 두고 판정 코드가 이름을 따로 적으면, 새 항목이 조용히 반쪽만 살아난다.

## 무엇을 말하는가 (예시)

한 줄로: `DC-WORLD-OWNS-THE-SURFACE-LIST` 는 지금 **World → View 경계**의 규율로만
적혀 있는데, 이번에 어긴 것은 화면이 아니라 **세계 자신**이었다.

```ts
// ❌ C-COMBAT-003 이 실제로 저질렀다가 고친 것 (06 NOTES ①)
function isSkillKind(id: string) {
  return id === 'hatsu-strike' || id === 'aura-burst' || id === 'hatsu-burst';
}
```

사정 목록(`ABILITY_CIRCUMSTANCES`)은 세계가 소유하는데, 칼끝을 만들지 말지의 판정이
목록에 묻지 않고 세 이름을 적어 두었다. 그래서 새 기술을 목록에 더하면 **시작은 되는데
칼끝이 안 생기는** 반쪽 동작이 났다 — 컴파일도 검사도 잡지 못했다. 목록에 묻는 것으로
고쳤고, 그 뒤로는 항목 추가만으로 온전히 산다.

같은 노림의 자리를 이 세계는 이미 여럿 지닌다 — `HOSTILITY_REASONS`(C018) ·
`ALLOCATION_CATALOG`(C-COMBAT-001) · `GROUND_LAWS`(C-TERRAIN-001) ·
`ABILITY_CIRCUMSTANCES`(C-COMBAT-003). 전부 "목록을 늘려도 규칙이 열리지 않는다" 가
목적인데, 그 규율이 View 쪽 문장으로만 적혀 있어 세계 쪽 위반을 막지 못했다.

## OBSERVED REPEATING PATTERN

    C018            HOSTILITY_REASONS — 목록 소유의 선례 (위반 없음)
    C-COMBAT-003    isSkillKind — 세계 쪽 위반 첫 실측 · 고침 (관찰 둘째로 접수)

## 승격 조건 검사

    반복되는가            관찰 둘째 — 위반 실측은 한 번이다
    형태를 제한하는가      예 — 목록을 세운 도메인의 판정 코드가 항목 이름을 적지 못하게 한다
    시스템 목록을 낳는가    아니오
    이미 있는 DC 와 겹치는가 겹친다 — DC-WORLD-OWNS-THE-SURFACE-LIST 의 scope 는 GLOBAL 이나
                          rationale 이 View 쪽만 말한다. **새 DC 로 세울지, 기존 DC 의
                          rationale/requires 를 세계 쪽까지 넓힐지**가 Human 의 결정이다

HUMAN DECISION: PENDING
