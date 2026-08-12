# View Definition 템플릿

`cycles/<cycle-id>/VIEW.md` 로 작성한다. Observable Semantic 을 GameView 공개 어휘에 binding 하는 명세.
**gameview/VOCABULARY.md 에 ✅ 로 공개된 어휘만 사용할 수 있다.**

```text
VIEW <CYCLE-ID>

── Visual Catalog Mapping ──────────────
World 의미 → Catalog key (asset 경로는 World State 에 넣지 않는다)

  Actor.Type=Default   → catalog: actor.default
  Deposit.Type=Stone   → catalog: resource.stone

── Entity Binding ──────────────────────
<이름>Visual {
    component = <✅ 어휘>            # 예: CharacterBillboard
    position  = <Observable 경로>    # 예: Actor.Position
    ...파라미터 = Observable binding
}

부착:
<이름> {
    component = <✅ 어휘>            # 예: ValueBar
    attach    = <EntityVisual>
    value     = <Observable 경로>
    max       = <Observable 경로>
}

── Transition Binding ──────────────────
ON <RULE-ID>                          # Observable Transition 통지 기준
sequence {                            # ✅ Animation 어휘만 사용
    ...
}

── Screen Space (관찰 도구) ────────────
Inspector 에 표시할 Observable: Current Goal / Possibility(+가용성·reason) /
Rule / Transition(Before·Input·Rule·After)

── 가용성 검사 ─────────────────────────
사용 어휘 전수 목록 + VOCABULARY.md 상태 (전부 ✅ 확인)
부족분 → 조합 우회 or GVP-NNN
```

금지: View 에서 World Rule 재판단 (거리 계산·조건 판정 등), World 내부 상태 직접 읽기, ⏳ 어휘 binding.
