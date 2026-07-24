# CLAUDE.md

HktAdvProtoA — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

이전에 경험하지 못했던 끝없는 성장과 상호작용을 통해 다채롭고 도파민을 뿜어내는 모험을 경험을 제공하는 세계를 구축한다.

## 지켜야 할 사항

작업 진행 상황은 항상 [STATE.md](STATE.md) 에 기록하고, 새 작업을 시작하기 전에 먼저 읽는다.

**작업 기준 (2026-07 확정)** — 이 트랙의 콘텐츠·표현 작업은 **[Design-Intuition.md](design/Design-Intuition.md) 를 1차 기준**으로 한다. 신규/개정 목적·콘텐츠는 §14 변환 8항 표를 먼저 채우고 시작하며(§21 작업 절차), 로드맵은 §20 D 시리즈(D0 세계 재장전 → D4 상황 제공)를 따른다. 다른 설계 문서와 어긋나면 Intuition 이 우선한다(상태 형식·엔진 불변은 WorldState 유지). [Design-Motive.md](design/Design-Motive.md) 는 상태층 배선·과학 근거 참조용이다(§6 사슬 기점·§8 저널 성격은 Intuition 기준으로 대체됨).

**기록 분리 규칙** — STATE.md 는 비대해지지 않게 유지한다.

- **STATE.md 에는 핵심만**: 현재 상태 요지(무엇이 있고 규모·핵심 파일)와 TODO. 완료 항목은 한 줄 요약 이하로.
- **완료 작업의 상세는 `progress/` 의 큰 단계별 파일에 누적**: 권역·단계별 변경 내역, 실증 방법(`--force` 등), 설계 요약 등 길어지는 기록은 전부 이곳에. 최신 항목을 위에 쌓는다. 단계 구분:
  - [progress/graph.md](progress/graph.md) — ① 구조 그래프 (목적 그래프 구축·보강)
  - [progress/world-state.md](progress/world-state.md) — ② 세계 상태 (형식: 엔진·검증·시뮬·상태 모델)
  - [progress/world-laws.md](progress/world-laws.md) — ③ 세계 법칙 (내용: 사건 사슬·패턴)
  - 새 큰 단계가 생기면 `progress/<단계>.md` 를 추가한다. 한 파일이 너무 커지면 다시 쪼갠다.
- **연결은 인덱스로**: STATE.md 에서 상세가 필요하면 해당 progress 파일(또는 설계 문서)로 링크만 건다. 같은 내용을 두 곳에 중복 기재하지 않는다.
- 새 작업을 마치면 이 규칙대로 STATE.md(핵심 갱신)와 해당 progress 파일(상세 추가)을 함께 정리한다.

## 문서 인덱싱

| 문서 | 역할 |
|---|---|
| [STATE.md](STATE.md) | **현재 핵심 상태 + TODO** (핵심만 — 상세는 progress/) |
| [progress/](progress/) | **완료 작업 상세**, 큰 단계별: `graph.md`(구조 그래프)·`world-state.md`(세계 상태·형식)·`world-laws.md`(세계 법칙·내용)·`mmo.md`(MMO 프로토)·`motive.md`(동기층)·`intuition.md`(직관·욕망 신호 변환층). 최신 위로 누적 |
| [Design-ObjectiveTree.md](design/Design-ObjectiveTree.md) | 목적 트리 구축 **방법론** — 원칙·절차·검증 + **트리 복수화 원칙(§18)**: 정본=주체 트리들의 교차·주체 G0 스텁·요소=타 주체 ≥2 연결·법칙·역사 동급 생성기 (검증 16~**18** — 18=그래프↔세계상태 층 교차) + **주체 추가 공정(§19)**: 그래프→세계상태→동기층→표현→실증 다섯 층 한 트랙, 검증 18 초록까지가 한 커밋 |
| [Design-ObjectiveGraph.md](design/Design-ObjectiveGraph.md) | **상흔계 아벨리온** 목적 그래프 정본 (세계 시드·타입 표기·G0~G9·교차 그래프·대표 사건). 겹치면 우선 |
| [Design-WorldState.md](design/Design-WorldState.md) | 세계 상태(속성) 데이터화 **설계** — 다섯 층 모델(변수·스냅샷·법칙·행동·목적), 축 문법, 틱 의미론 |
| [Design-MMO.md](design/Design-MMO.md) | **MMORPG 웹 프로토타입 설계 (세계 표현 우선)** — 표현=상태의 순수 함수(불변 6·7), 2단 공간 모델(대륙 지도+지역 씬), 표현 번역 사전(world-visual)·world-map, 법칙 가시화(연대기·발화 연출·인스펙터), 행동 발화 UX, 검증 V1~V6, 로드맵 4단계(멀티는 4단계 예약) |
| [Design-Intuition.md](design/Design-Intuition.md) | **직관·욕망 신호 변환층 설계 — 콘텐츠·표현 작업의 1차 기준** — 목적 트리를 플레이어에게 설명하지 않고 욕망 신호로 번역한다: 플레이 루프(욕망 대상→작은 방해→수단→간단한 행동→즉시 보상→예상 밖 확장→새 욕망, §5)·노드 변환 규칙 8항(§14)·방향성 있는 예측 불가능성(재료 성질 계열, §7)·재료=가능성(≥3용도, §8)·실패=사건(§11)·설명 후행(§12)·퀘스트보다 상황(§13)·원칙 10종(§16). 기존 설계 충돌 6건 층 분리 해소(§19)·로드맵 D0~D4(§20)·**작업 절차(§21 — 새 세션은 이 절차로 작업)**. 타 문서와 어긋나면 우선 |
| [Design-Motive.md](design/Design-Motive.md) | **동기층 설계 (상태층 배선·과학 근거 참조용 — 콘텐츠 기준은 Intuition 이 우선, §6 사슬 기점·§8 저널 성격 대체됨)** — 아키텍처(§1: 하향 설계·상향 플레이 두 화살표, 만남의 세 층위, 보상 이중성=충족+잉여)와 과학적 근거(§2: 항상성 추동·유인 현저성·SDT 세 조건, 매슬로 위계 폐기) 위에 결핍(허기·온기·상처, 미는 힘)과 욕망(탐욕·인정·앎·힘·유산, 당기는 힘 — 병렬·상호증폭)이 정보·기회를 거쳐 세계 서사로 상승하는 동기 사슬. 문제 진단 5(§0)·동기 불변 8~14·인지 축·필요/기회 저널·묻기 행동·motive 사전·검증 M1~M9·로드맵 M1~M6 |
| [Design-WorldLaws.md](design/Design-WorldLaws.md) | 세계 법칙 **설계** — 현상 세 서식지(관계·detail·사슬)의 전수 번역(패턴 7종·자율 법칙 42·사슬 5종 완역·NPC 정책·균형 법칙) + **노드→법칙 번역 절차·완료 체크리스트**(§9·§10, 새 세션은 이 절차로 작업) |
| [data/objective-graph.json](data/objective-graph.json) | 목적 그래프 **유일한 원본 데이터** (타입 노드 G/S/E/R/L/K/T/F/H/X/EV + 타입 관계). 편집은 여기 한 곳 |
| [data/validate-graph.mjs](data/validate-graph.mjs) | 위 JSON 검증기(데이터 없음, 참조 무결성 확인 — `node data/validate-graph.mjs`) |
| [data/world-state.json](data/world-state.json) | 세계 **상태의 유일한 원본** — vars/clocks/subjects/rules/actions/objectives 다섯 층. 그래프 id 를 앵커로 참조 |
| [data/state-engine.mjs](data/state-engine.mjs) | 상태 엔진(공유·**순수**) — 결정론적 틱 루프 ①~⑦. validate/simulate/objective-tree.html 이 함께 사용(브라우저 import 가능) |
| [data/load-world.mjs](data/load-world.mjs) | 파일 로더(fs) — `loadWorld`·`HERE`. 엔진을 순수하게 유지하려 fs 접근을 분리 |
| [data/validate-state.mjs](data/validate-state.mjs) | world-state 검증기 — WorldState §12 검증 1~13 + WorldLaws §7 법칙검증(회복 짝·EV 매핑·detail 커버리지 7·노드 커버리지 8). `node data/validate-state.mjs` · `--strict-coverage` |
| [data/material-families.json](data/material-families.json) | **D2 재료=가능성 카탈로그** (Intuition §7·§8) — 23 R 재료를 성질 계열 7종(불꽃·한기·생체·별빛·기억·치유·양식)으로 분류 + 재료마다 3용도(즉시·조합·사건). role=핵심(3용도 요구)\|서사. 실재 행동·법칙에 via 로 교차 배선 |
| [data/validate-material.mjs](data/validate-material.mjs) | **재료 다용도 감사** (Intuition §7·§8) — 성질 계열 커버리지 100%·핵심 3용도·via 배선 교차검증·조합 행동 존재. `node data/validate-material.mjs` |
| [data/detail-coverage.json](data/detail-coverage.json) | detail 항목 분류 원장(§9-7) — 그래프 전 노드 detail 을 {초기값·법칙·행동·목적·파생축·사슬·서사·보류} 로 분류. 검증기가 대조·미분류를 `coverage-backlog.json`(생성물) 로 출력 |
| [data/simulate-state.mjs](data/simulate-state.mjs) | 무입력 틱 시뮬레이터 — 대표 사건 5종 사슬 재생 (`--force`·`--no-policy`·`--at`) |
| [data/simulate-latejoin.mjs](data/simulate-latejoin.mjs) | **D0 늦은 진입자 프로브** (Intuition §20 D0 검증) — 세계를 T0 틱 굴린 뒤 갓 도착한 플레이어의 눈(결핍·인지 리셋)으로 W틱 관찰: 압력 법칙 작동·필요(위협 기원 포함)·기회 각 ≥1. "살아있는 채로 유지되는 세계" 감사 (`--at`·`--window`·`--verbose`) |
| [data/world-map.json](data/world-map.json) | 대륙 지도 — L 노드 공간 배치 + feature(RIVER). **표현 데이터** — 판정에 쓰지 않음 |
| [data/world-visual.json](data/world-visual.json) | 표현 번역 사전 — 변수→채널(전수), 연대기 번역문, 발화 fx. **표현 데이터** |
| [data/validate-visual.mjs](data/validate-visual.mjs) | 표현 정합 검증기 — Design-MMO §7 V1~V4·V6 (`node data/validate-visual.mjs`) |
| [game/world.html](game/world.html) | **게임 클라이언트** (단일 파일) — 대륙 지도·지역 씬·아바타·행동 발화 UI·연대기·인스펙터. 로컬(브라우저 내 엔진)/원격(`?online`) 겸용 |
| [game/server.mjs](game/server.mjs) | **월드 서버** (의존성 0) — 결정론 틱 상주, SSE 스냅샷 diff 구독·행동 요청 API·poses 릴레이 (`node HktAdvProtoA/game/server.mjs`) |
| [game/play.bat](game/play.bat) | 윈도우 원클릭 실행 배치파일 — 서버 기동 + 브라우저 오픈 |
| [objective-tree.html](objective-tree.html) | 목적 그래프 브라우저 관찰·편집기 (의존성 없는 단일 파일) |
