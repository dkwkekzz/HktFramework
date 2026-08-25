# CYCLE C010 — Stats Decide the Damage

> 번호 재사용 — 구 `C010-guard-trades-body-for-resource` 는 2026-08-17 Human 결정으로
> 롤백되어 git history 에만 존재한다. 구분은 전체 ID(번호+이름)로 한다
> (`master/frontier.md` 번호 주의 참조).

[PASS] Cycle Definition
[PASS] Intent                    (새 Intent 5종 · CHANGED 4종 — 계산은 하나뿐이다)
[PASS] World Semantic            (Closure 통과 · GAP 없음 — 새 규칙 1 · CHANGED 3)
[PASS] GameView Specification    (새 표면 없음 — 세 자리에 실리는 내용만 늘어난다)
[PASS] Human Semantic Review     APPROVED (2026-08-17 — 밸런스 선택·Playable Result 해석 포함)
[PASS] World Implementation      새 규칙 파일 1 · world 테스트 180 통과 · 카탈로그 정합
[PASS] View Implementation       새 표면 0 · 세 자리에 줄 추가 · 테스트 403/404 (1 선존재 실패)
[PASS] Verification              7종 검사 · 회귀 403/404 · e2e 2방식 · Human Play 확인

STATUS  COMPLETE    2026-08-17

## MASTER TRACE
    Frontier            FR-STATS-DECIDE-THE-DAMAGE
    Source Goal         MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility  MP-OUTGROW-THE-OPPONENT
    Target Capability   MC-ATTACK-POWER          (overlay: MISSING)
                        MC-SKILL-SCALING         (overlay: MISSING)
                        MC-DEFENSE-MITIGATION    (overlay: MISSING)
    Active Constraints  DC-COMBAT-PLAYER-CAUSALITY
                        DC-COMBAT-ONE-FORMULA
                        DC-COMBAT-ONE-LAYER-AT-A-TIME
                        DC-COMBAT-SHARED-BUDGET
    Constraint Note     난수 없음 — 같은 공격자·같은 스킬·같은 대상이면 언제나 같은 피해다.
                        피해 공식은 하나로 통합된다 — 이 Cycle 이 이후 모든 공격/방어
                        시스템의 유일한 기반 공식을 세운다.
                        한 번에 한 층만 — 기본 공식 위의 어떤 층도 이번에 올리지 않는다.
                        기력(CP) 예산은 하나 그대로다 — 새 게이지를 만들지 않는다.
    원본 근거           content/proto-adventure/design/Design-Combat-OffenseDefense-R0.md **R1**
                        §1~§5 공식 · §9 기존 C007 관계 · §10 신규 INTENT 4종 ·
                        §11 밸런스 기준 · §13 하지 않을 것 · §16 성공 조건

    Playable Result 해석
        Frontier 의 Playable Result 는 그 차이를 "장비·성장으로" 만든다고 적었으나,
        R1 §13 이 장비·성장 시스템을 이 층에서 제외한다. 이번 Cycle 이 세우는 것은
        **Attack / Defense 가 바뀌면 피해가 실제로 달라진다**는 인과이며, 플레이어가
        그 차이를 직접 만드는 수단은 이미 있는 C009 디버그 명령(값 변경 요청)이다.
        장비 슬롯·경험치·레벨은 이 위에 붙을 다음 층이고, 이번 Cycle 은 그 자리를
        비워 둔 채 값 자체를 조작 가능하게 만든다. Master 의 의미(공격력이 높으면
        더 아프고, 방어력이 높으면 덜 아프며, 그 차이를 플레이어가 만든다)는 유지된다.
        이 해석이 상위 의미와 어긋난다고 판단되면 Stage 5 Human Review 에서 되돌린다.

## TYPE
    New Capability                     Combat Stats — Attack · Defense 라는 값이
                                       세계에 처음 생긴다. 지금 Actor 는 자기 공격이
                                       얼마나 센지, 맞는 것을 얼마나 견디는지를
                                       나타내는 값을 갖고 있지 않다

    Existing Capability Enhancement    Strike Damage (C007) — 지금은 스킬이 정한
                                       고정값 하나가 그대로 생명에서 빠진다
                                       (`SkillDefinition.damage`). 이것이 하나의
                                       피해 공식으로 대체된다. 행동도 자원도
                                       그대로이고, 값을 정하는 방식만 바뀐다

## TARGET CAPABILITY
    Basic Damage Formula
        공격 능력치 · 방어 능력치 · 스킬의 기본 피해량과 공격 계수 —
        그리고 이 넷을 하나로 묶어 최종 피해를 내는 단 하나의 계산

## GOAL
    같은 스킬을 휘둘러도 공격 능력치가 높은 존재가 더 아프게 때리고,
    같은 공격을 맞아도 방어 능력치가 높은 존재가 덜 아프게 맞는다.
    플레이어는 자기 몸이나 상대의 그 값을 바꿔 가며 때려 보고,
    피해 숫자가 왜 그만큼인지를 계산 내역으로 그 자리에서 확인한다.

## INCLUDED

    ── 새 능력치 ─────────────────────────────────────────────────────
    공격 능력치          모든 Actor 가 가진다 — 자기 공격을 얼마나 강하게 만드는가
    방어 능력치          모든 Actor 가 가진다 — 들어오는 피해를 얼마나 줄이는가
    존재 종류별 값       능력치는 존재 종류마다 정해진 값이다 (기존 템포 능력치와 같은 방식)

    ── 스킬의 분리 ───────────────────────────────────────────────────
    기본 피해량          스킬 자체의 강함 — 기존 스킬 고정 피해가 이 이름으로 이어진다
    공격 계수            그 스킬이 공격 능력치를 얼마나 피해로 바꾸는가
                         스킬마다 다르다 — 빠른 기술은 낮게, 강한 기술은 높게
    스킬/존재 분리       스킬의 강함과 존재의 강함이 따로 자란다

    ── 하나의 피해 공식 ──────────────────────────────────────────────
    공격 피해 계산       스킬의 기본 피해량 + 공격자의 공격 능력치 × 그 스킬의 공격 계수
    방어 감쇄            대상의 방어 능력치가 그 피해에 배율을 건다 —
                         값이 오를수록 덜 맞지만 무적이 되지 않고,
                         오를수록 추가 방어의 효율이 완만해진다 (체감식)
    최종 피해            위 둘을 거친 하나의 값이 생명에서 빠진다.
                         타격 판정·밀어냄·기력 수지는 기존 순서 그대로다
    결정론 유지          같은 공격자·같은 스킬·같은 대상이면 언제나 같은 피해다.
                         난수는 이번에도 없다

    ── 관찰 ──────────────────────────────────────────────────────────
    능력치 관찰          공격·방어 능력치도 다른 속성과 같이 관찰 계약에 실린다
                         (C007 R2 전 속성 관찰 — 새 관찰 경로를 만들지 않는다)
    계산 내역 관찰       타격 하나의 피해가 어떻게 나왔는지를 읽을 수 있다 —
                         기본 피해 · 공격 기여 · 방어 배율 · 최종 피해.
                         숫자만 뜨는 것이 아니라 이유가 보인다
    값 변경으로 확인     공격·방어 능력치를 C009 디버그 명령의 변경 가능 목록에 올린다.
                         플레이어가 값을 바꾸고 다시 때려 차이를 직접 만든다

## EXCLUDED
    막기 · 완전 막기     R1 §14 Defense Action / Active Defense 층 — 다음이다
    되받아치기 · 무너뜨림 위와 같음
    치명타 · 명중 · 회피  R1 §13. 치명타는 DC 충돌 미해결 (open-questions Q11)
    관통 · 물리/마법 구분 R1 §14 Damage Type / Penetration 층
    속성 · 상성 · 저항    R1 §14 Damage Type 층
    넨 · 집중 · 서약      R1 §14 Aura/Nen 층
    세계 난수원          이번에도 없다 — 확률로 갈리는 것이 하나도 없다
    장비 슬롯 · 아이템    능력치를 바꾸는 것은 이번엔 디버그 명령뿐이다.
                         장비가 능력치에 수정치를 거는 경로는 다음 층이다
    레벨 · 경험치 · 성장  능력치는 존재 종류별 고정값이며 플레이로 자라지 않는다
    새 스킬 · 스킬 교체   스킬은 지금의 2종 그대로다. 값의 구성만 나뉜다
    새 자원 · 새 게이지   생명·기력 둘뿐이다 (DC-COMBAT-SHARED-BUDGET)
    회복 · 부활 · 리스폰   C007 EXCLUDED 그대로 유지
    수치 재밸런싱 전반    기존 템포·기력 수지 값을 이 Cycle 이 다시 손대지 않는다.
                         피해에 관한 값만 이번 공식으로 다시 정의된다

## RELATED EXISTING CAPABILITY
    Strike Damage                (C007) — CHANGED. 고정값 대신 하나의 공식이 값을 정한다.
                                 이 Cycle 이 바꾸는 유일한 기존 Rule 이다
    Skill Definition             (C007) — 스킬의 `damage` 한 필드가
                                 기본 피해량 + 공격 계수로 나뉜다
    Combat Vitals (hp · cp)      (C007) — REUSED. 자원 구조는 그대로다.
                                 기력 수지는 이 Cycle 이 건드리지 않는다
    Downed                       (C007) — REUSED. 생명이 0 이면 쓰러진다, 그대로다
    Tempo Attributes             (C007) — REUSED. 새 능력치 2종은 같은 방식으로 얹힌다
                                 (존재 종류별 고정값 · 수정치가 붙을 자리 · 관찰 대상)
    Swing Strike / Collision     (C002·C006) — REUSED. 누가 맞았는지 정하는 판정은 그대로다.
                                 바뀌는 것은 맞은 뒤 얼마나 아픈가뿐이다
    Observer Projection          (C004) — 새 능력치와 계산 내역이 기존 관찰 계약에 실린다
    Attribute Set / Debug Command (C007 R2 · C009) — 변경 가능 목록에 두 능력치가 더해진다.
                                 새 표면을 만들지 않는다 — 목록에 항목이 늘어날 뿐이다
    Strike Result HUD            (C007) — 맞은 자리의 피해 표시가 계산 내역까지 담게 된다
