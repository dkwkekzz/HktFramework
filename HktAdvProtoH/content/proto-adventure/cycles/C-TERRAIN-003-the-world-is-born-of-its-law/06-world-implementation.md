# C-TERRAIN-003 — World Implementation

입력: [03-world-semantic.md](03-world-semantic.md) · [05-review.md](05-review.md) APPROVED

## IMPLEMENTED

    RULE-WORLD-GENESIS-001        world/rules/world-genesis.ts#bornGroundZones
        세계가 만들어질 때 한 번 — 분포(씨앗의 표본열) → 맥이 뻗는다(첫 중심은 경계 안,
        다음은 이웃 자리 · QUIET 를 품는 후보는 버림 · 유한 시도 256) → 과거가 계산된다
        (kept 표본 · 가장 찬 맥이 saturation 으로 차서 venting). Intent ID 주석 포함.
        표본은 기존 결정론 함수(chanceAt — C015)를 재사용한다 — 씨앗만 다르다.

    WorldState.genesisSeed        world/semantic/world-state.ts
        태어남의 뿌리. 어떤 규칙도 바꾸지 않는다. chanceSeed 와 가른다 (05 답 3).
    DEFAULT_GENESIS_SEED = 1      world/semantic/world-state.ts
        03 BALANCE 2 를 만족하는 세계를 고른 값 — 그 조건은 world-genesis.spec.ts 의
        "기본 씨앗의 세계" 절이 지킨다 (어기는 값으로 바꾸면 검사가 막는다)
    GroundLawDefinition.veins·veinRadius·veinStride   world/semantic/terrain.ts
        4 · 5.0 · 5.0 — 밀도가 아니라 출처를 바꾸는 Cycle (03 BALANCE 1)
    QUIET_GROUND                  rules/world-genesis.ts#QuietSpot · index.ts 조립
        목록을 상수로 두 번 적지 않고 **실제 배치에서 계산한다** — SPAWN_POINTS ·
        npc 자리/순회 끝점/지키는 자리 · 광맥. 붙박이가 단일 출처다 (03 의 "세계 성질
        상수" 를 조립 계산으로 구현 — 뜻 동일 · 중복 제거, NOTES 1)

## REUSED

    RULE-GROUND-LAW-APPLY-001 · RULE-GROUND-VENT-001    한 줄도 바뀌지 않았다
        (INTENT-BIRTH-DOES-NOT-CHANGE-THE-TURNING-001 — terrain.spec 의 규칙 검사가
        자체 자리로 그대로 돈다)
    chanceAt (C015)               semantic/combat.ts — 표본의 결정론 함수
    GroundZone · GROUND_LAWS 기존 항 · 판정 함수 전부    semantic/terrain.ts

## CHANGED

    GROUND_ZONES 상수             **삭제** — 자리를 목록으로 적는 형이 사라졌다.
                                  유일한 원천은 RULE-WORLD-GENESIS-001 이다
    index.ts 초기 배치            groundZones = bornGroundZones(genesisSeed, WORLD_BOUNDS, quiet)
                                  · WorldSetup.genesisSeed 추가 (chanceSeed 와 같은 지위)
    STATE_VERSION                 'proto-adventure/3' → '4' (genesisSeed 추가 · 마이그레이션 없음)

## AFFECTED UPDATED

    world/tests/terrain.spec.ts   고정 배치(zone-vein-1~4 · 좌표 상수) 의존 검사 전부를
                                  **태어난 세계에서 읽는** 방식으로 재작성 — takingSpot(뿜는
                                  맥에서 가장 먼 거두는 맥 안의 점) 등 파생 헬퍼.
                                  규칙 검사(자체 자리)는 손대지 않았다
    world/tests/growth.spec.ts    role='law' 를 찾던 낡은 줄(C-TERRAIN-002 이전) →
                                  phase='binding' + 뿜는 맥 밖 조건으로 정정
    view/tests/fixtures/*.json    41개 — ground.genesisSeed: 1 추가 (계약 필드가 늘었다)
    view/tests/resolve.spec.ts    인라인 ground 조립 한 곳에 genesisSeed 추가

## PROJECTION

    ground.zones · ground.self    변경 없음 (04 — 태어난 배치가 기존 표면으로 실린다)
    ground.genesisSeed (ADDED)    projection/observer-view.ts · protocol/gameview-terrain.ts
        designer/디버그 관찰 — 플레이어 표면은 이 값을 그리지 않는다.
        **04 는 자리를 debug.genesisSeed 로 적었으나 debug 봉투는 engine 소유
        (protocol-core — 편집 금지)라 땅 도메인(GroundView)이 싣는다.** 뜻은 같다 —
        NOTES 2. debug.open 이 모든 관찰자에게 실리는 기존 선례와 같은 지위다

## TESTS

    world/tests/world-genesis.spec.ts (신규 · 11)
        같은 씨앗 = 같은 세계 (배치·지닌 것·단계까지) · 다른 씨앗 = 다른 땅 ·
        세계로 띄워도 같다 · 밝힌 씨앗이 관찰에 남는다 ·
        씨앗 20개 구조 불변식: 경계 안 · 조용한 자리 불가침 · 이어진 밭(이웃 거리) ·
        해숨구멍 하나(=saturation) · kept 범위 ·
        기본 씨앗의 세계가 03 BALANCE 2 를 만족한다 (걸어 닿는 거리 · 가로지르기
        검사의 재료)
    world/tests/terrain.spec.ts (재작성 구간)
        태어난 맥 넷 · 해숨구멍 · role 없는 항목 여섯 · QUIET 회귀 · 관찰(taking ·
        sheltered · warming · none) · 플레이(머물면 넘치고 옮겨 가고, 가로지르면 안
        열리고, 원점 플레이는 닿지 않는다) — 전부 파생 자리로

    npm test        89 파일 · **1660 통과** (병합 전 1551 → 회귀 없음 + 신규)
    catalog:check   정합 · boundary 0 (npm test 에 포함)

## NOTES

    1. QUIET_GROUND 의 자리 — 03 은 "세계 성질 (상수)" 로 적었고, 구현은 조립(index.ts)이
       실제 배치에서 계산한다. 붙박이 좌표를 상수로 한 벌 더 적으면 두 진실이 생기기
       때문이며, 의미(이들이 선 자리가 법칙이 조용한 자리다)는 그대로다.
       setup.actorPosition 은 넣지 않는다 — 검증용 오버라이드이고 보장의 대상은
       SPAWN_POINTS 다 (05 답 2).
    2. genesisSeed 의 관찰 자리 — 04 의 debug.genesisSeed 대신 ground.genesisSeed.
       debug 봉투(DebugAuthorityView)는 engine/protocol-core 소유라 컨텐츠 Cycle 이
       편집할 수 없다 (기반 편집 금지). 트랙 소유 도메인 파일(gameview-terrain.ts)에
       실었다 — 08 검증은 뜻(designer 관찰 · 같은 씨앗 같은 세계의 검증 표면)으로 본다.
    3. 사전 존재 형 오류 — `npx tsc` 전체 검사에는 main 에서 온 기존 오류가 있다
       (view/tests/terrain.spec.ts 27 캐스트 등 4건 — 이 Cycle 과 무관, 프로젝트 게이트는
       npm test). 이 Cycle 이 새로 만든 형 오류는 0 이다.
    4. 기본 씨앗 1 의 세계 — 맥 넷이 북서쪽에 태어난다 (옛 손배치와 같은 사분면 ·
       우연이다). 가장 가까운 맥 중심이 원점에서 9.9 — 옛 12.0 과 같은 자릿수다.
