# progress/world-state.md — 세계 상태 (형식) 완료 기록

> 큰 단계 **② 세계 상태** = 상태를 데이터로 표현하는 **형식**(모델·엔진·검증·시뮬). 법칙의 *내용*은 [world-laws.md](world-laws.md). 최신 항목을 위에 쌓는다.
> 현재 규모: `data/world-state.json` **vars 73 · rules 60 · actions 15 · objectives 7 · clocks 2** (상태의 유일 원본).

## 엔진 — `data/state-engine.mjs` (공유)

- 결정론 틱 루프 ①시계 → ②파생 재계산 → ③전제 일괄평가(틱 시작 스냅샷) → ④효과 일괄적용 → ⑤파생 재계산 → ⑥목적 판정 → ⑦NPC/입력 행동.
- 읽기/쓰기 분리(평가 순서 무관), `set` 충돌 거부(런타임 우선순위로 얼버무리지 않음), `add` 합산·level 클램프.
- `every: N` — 주기 재발화(once 배타). P2 압력·P3 생태·P4 전파 법칙용 (사건 2 에서 도입).
- `duration` — 행동 효과 지연 + 발화 주체 점유(진행 중 다른 행동 안 함).
- 파생축 자동 재계산(formula 평가). `once` 발화 기록은 `<id>.발화됨` 내장 상태.

## 검증 — `data/validate-state.mjs`

- WorldState §12 검증 1~13 (owner/target 존재·선언 var 참조·basis·S 노드 var·말단 G complete·on_complete 효과·행동 2개+·파생 쓰기 금지·set 충돌·관계 커버리지·EV 매핑·정책 정합·무입력 자율변화).
- WorldLaws §7 법칙검증 — once/every 배타, **회복 짝**(§6: 음수 add ↔ 양수 add/복원 set, `monotonic:true` 면제), EV 노드별 사슬 매핑. `node data/validate-state.mjs` (경고 0).

## detail 커버리지 검증 (§7 법칙검증 7·8) — `detail-coverage.json` 원장 + 검증기

- **문제**: 현상은 관계(133)만이 아니라 노드 detail 서술에도 산다(WorldLaws §0 서식지 ②). 무엇이 미번역인지 기계로 셀 수단이 없었다 — "다 번역하라"가 열린 채였다.
- **유니버스**: 그래프 전 노드 detail 전 항목 = **335개**(설계 252는 163노드 기준, 184노드로 커짐). 검증기가 자동 집계.
- **분류 원장** `data/detail-coverage.json` — 항목(`<노드>.<키>`)마다 §9-7 분류: 번역(초기값·법칙·행동·목적·파생축·사슬)·서사(비현상)·보류. EV `흐름` 은 검증11 매핑으로 자동 커버. 원장 무결성(존재 않는 항목·오분류)도 검증.
- **검증7**(detail 커버리지): 항목별 분류 집계 + 미분류를 `coverage-backlog.json`(생성물, gitignore) 로 출력 — 후속 §9 절차의 작업 목록.
- **검증8**(노드 커버리지): 노드별 롤업(완료/부분/미착수).
- **기본은 보고**(경고 0 유지). `--strict-coverage` 로 미분류를 오류화 → A/B 확장 권역의 완료 게이트로 쓴다.
- **베이스라인**: 사건 5종 권역 시드로 **91/335 분류(27.2%)** — 번역 47·서사 35·보류 9. 노드 완료 37·미착수 138. 미분류 244(백로그): G 106·E 44·R 37·L 17·T 13·K 9·F 9·S 5·H 3·X 1.

## 시뮬레이터 — `data/simulate-state.mjs`

- 무입력 틱 시뮬. 옵션 `--ticks N`·`--quiet`·`--no-policy`·`--force VAR=VAL`·`--at t:ACT@주체`.
- 사건별 방아쇠(`--force`)로 자율 재생 실증. 판정 출력에 사건 1~5 단계·핵심 상태 표기.

## 상태 모델 (world-state.json 최초 구축)

- 다섯 층: vars / clocks / subjects / rules / actions / objectives. 그래프 노드 id 가 유일 앵커.
- 축 문법 3종: 단축 `노드.축` / 쌍축 `노드.축.노드`(계약·감염·보유·습득·관계) / 파생축(함수, 쓰기 금지). 값 4종 flag/level/count/ref. 모든 var `basis` 필수.
- 설계 결함 차단 사례: `S_토양침식.활성`(사건 2)·`R_심연유리.수요`(사건 3)를 **파생축**으로 두어 set 충돌·회복 교착을 원천 차단.

## 설계 문서 요약 — [Design-WorldState.md](../Design-WorldState.md) (형식)

- **다섯 층 모델**: vars(노드 귀속·basis) · initial(스냅샷) · rules(자율) · actions(주체 선택, 전제·비용·duration) · objectives(discover/complete/fail).
- **변형 전수 카탈로그 18종**(§4) — 모든 변형이 환원돼야 하는 표현. 런타임 노드 생성 금지(새 존재 = 숨김 노드 상태 전환).
- **틱 의미론**(§5.3) · **완료 판정 = 상태 술어**(어떤 행동이든 목표 상태면 완료) · **NPC 구동**(§8 subjects + policy).
