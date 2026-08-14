# CYCLE C007 — Basic Combat Policy

[PASS] Cycle Definition
[    ] Intent
[    ] World Semantic
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## TYPE
    New Capability    싸움의 자원(체력·기력)이라는 새 세계 규칙
                      기존 Attack / Swing Strike / Move 는 이 규칙의 영향을 받아 변경된다

## TARGET CAPABILITY
    Combat Vitals (체력 hp · 기력 cp — 소모와 충전으로 굴러가는 전투 자원)

## GOAL
    플레이어는 기본 스킬을 휘둘러 기력을 모으고, 모은 기력을 고급 스킬로 크게 쏟아부어
    상대의 체력을 깎으며 — 달리면 기력이 새어 나가고, 몸 상태에 따라 그 모이는 속도와
    쓰이는 값이 달라진다. 모든 존재의 이름과 체력은 그 몸 위에서, 자신의 기력과
    수지(收支)는 자기 정보창에서 눈으로 확인하며 싸운다.

## INCLUDED
    체력 hp              모든 Actor 가 가지는 전투 자원 — 타격으로 깎이고 0 이면 쓰러진다
    기력 cp              모든 Actor 가 가지는 전투 자원 — 충전과 소모가 동시에 일어난다
    스킬 수지            스킬마다 고유한 (충전량, 소모량) 쌍을 가진다
                             기본 스킬  충전만 (소모 0)
                             고급 스킬  충전 + 소모, 대개 소모가 더 크다  (붉은보석식 수지)
    기력 부족            소모할 기력이 모자라면 그 스킬은 시작되지 않는다 (사유가 남는다)
    타격 피해            휘두름 충돌 반경에 맞은 몸은 밀려나는 것에 더해 체력을 잃는다
    쓰러짐               체력이 0 이 되면 무력화되어 더 이상 행동하지 않는다
    달리기               이동을 빠른 이동으로 전환할 수 있고, 그동안 기력이 점진적으로 샌다
                         기력이 바닥나면 달릴 수 없고 보통 이동으로 돌아온다
    수지 배율            외부 요소가 기력 충전률·소비율에 배율을 건다 (원천은 곱해서 합성)
                         이번 Cycle 의 원천 2종 — 달리는 중 · 피격 직후
    존재 HUD             모든 Actor 의 이름과 체력을 그 몸 위에서 관찰할 수 있다
    자기 정보            플레이어는 자신의 체력·기력 수치와 현재 수지 배율까지 관찰할 수 있다

## EXCLUDED
    마나                 없다. 자원은 hp · cp 둘뿐이다
    체력·기력 자연 회복  쓰러진 몸은 그대로 남는다 — 회복·부활·리스폰은 다음 Cycle
    스킬 습득·교체·쿨다운 스킬은 고정 2종이며 배우거나 바꾸지 않는다
    원거리·발사체 스킬   스킬은 C006 의 휘두름 충돌 반경만 사용한다
    방어·회피·상태이상   맞으면 그대로 받는다
    치명타·명중률·난수   피해는 결정론이다
    장비로 인한 능력치   장비·아이템이 hp/cp/피해를 바꾸지 않는다
    NPC 의 고급 스킬     자율 Actor 는 기본 스킬만 쓴다
    전리품·경험치        쓰러진 몸에서 얻는 것은 없다
    타 Actor 의 기력 관찰 남의 cp 는 보이지 않는다 — 몸 위에 실리는 것은 이름과 체력뿐이다

## RELATED EXISTING CAPABILITY
    Attack / Swing Strike        (C002·C006) — 휘두름이 이제 피해를 실어 나르고, 스킬 수지를 낸다
    Action State / Definition    (C002) — 스킬은 새 ActionKind 로 같은 구조에 얹힌다
    Move                         (C001·C002) — 이동에 달리기 모드가 더해진다
    NPC Decide / Wander          (C002) — 자율 Actor 도 같은 자원 규칙 아래에서 싸운다
    Collision Body               (C006) — 피해 판정은 기존 충돌 반경 판정을 그대로 쓴다
    Observer Projection          (C004) — 존재 HUD·자기 정보가 Projection 에 실려 나간다
    HUD Presentation             (C002·C004) — 자기 정보는 기존 HUD 계약을 확장한다
