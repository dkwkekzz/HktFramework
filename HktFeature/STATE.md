# STATE — 현재 상태

> 작업하거나 논의한 **feature 의 명제만** 나열하고, **현재 작업 상태**를 관리한다.
> 규칙·방식은 [CLAUDE.md](CLAUDE.md) · 각 feature 상세는 `features/`.
> 마커: 🟢 검증됨(상시 재현) · 🟡 진행 중 · ⬜ 논의만/백로그.

## NOW — 현재

- **완료**: 최소 원장 코어 + feature-0001(보존)·0002(정수)·0003(닫힌 열역학 루프: 태양·소실·순환).
- **검증 상태**: `npm test` **19/19** · 서버+봇 8기 라이브 세계 총 **1,000,000,000** 불변 · 소실(SINK) 맥동(28→117→0) · 태양 정상상태 · 체크섬 OK.
- **열린 feature**: 없음 (다음 feature 논의 대기). 규칙은 이 코어 위에 이체 문법으로 얹는다.

## FEATURES — 명제 목록

| # | 명제 | 상태 | 문서 |
|---|---|---|---|
| 0001 | 전 세계의 에너지는 보존된다 | 🟢 검증됨 | [feature-0001](features/feature-0001-energy-conservation.md) |
| 0002 | 에너지는 전부 정수다 (부동소수 에너지 없음) | 🟢 검증됨 | [feature-0002](features/feature-0002-integer-energy.md) |
| 0003 | SOURCE=태양(순환의 원점)·방출은 SINK 거쳐 복귀 — 닫힌 열역학 루프로 영속 | 🟢 검증됨 | [feature-0003](features/feature-0003-closed-thermo-loop.md) |

## BACKLOG — 논의 후보 (명제만)

- ⬜ 아직 없음. 새 feature 는 직관적 기능 하나 → 측정 가능한 최종 목적 → step 분할 순으로 연다.
