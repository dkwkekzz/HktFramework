# EVOLUTION-BACKLOG

> 아직 구현하지 않았지만 장기적으로 필요할 가능성이 있는 의미를 기록한다.
>
> **Backlog 에 존재한다는 이유로 현재 World State 에 placeholder 나 dummy field 를
> 만들지 않는다.** 이 목록은 "언젠가 올 것" 을 기억하기 위한 것이지,
> 지금 자리를 비워 두기 위한 것이 아니다.

## Deferred Capability

| 항목 | 최초 기록 | 왜 미뤘는가 | 현재 설계가 막고 있는가 |
|---|---|---|---|
| Multiple Actor contention | 환경 구성 | 아직 Actor 1인 Runtime 으로 충분 | 미확인 |
| Resource ownership | 환경 구성 | 소유 분쟁이 발생하는 Cycle 이 없음 | 미확인 |
| Resource regeneration | 환경 구성 | 고갈 이후를 다루는 Cycle 이 없음 | 미확인 |
| Persistence | 환경 구성 | 세션 간 지속을 요구하는 Cycle 이 없음 | 미확인 |
| Network authority | 환경 구성 | 단일 프로세스로 충분 | 미확인 |
| Regional simulation | 환경 구성 | 단일 지역 범위 | 미확인 |
| Economy | 환경 구성 | 거래 Cycle 이전 | 미확인 |
| Guild | 환경 구성 | 사회 구조 Cycle 이전 | 미확인 |
| Social relationship | 환경 구성 | 사회 구조 Cycle 이전 | 미확인 |
| Ecology | 환경 구성 | 자연 법칙 Cycle 이전 | 미확인 |

`현재 설계가 막고 있는가` 열은 Stage 6 (Evolution Compatibility) 에서만 갱신한다.
`yes` 가 되면 그 Cycle 은 완료되지 않은 것이다.

## Design Gap 에서 승격된 항목

Stage 진행 중 발견된 DESIGN GAP 중, 현재 Cycle 에서 해결하지 않기로 인간이 결정한 것을
여기로 옮긴다.

| Gap ID | 누락 Semantic | 발견 Stage | 결정 |
|---|---|---|---|
| — | — | — | — |
