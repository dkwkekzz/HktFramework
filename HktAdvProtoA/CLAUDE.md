# CLAUDE.md

HktAdvProtoA — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

이전에 경험하지 못했던 끝없는 성장과 상호작용을 통해 다채롭고 도파민을 뿜어내는 모험을 경험을 제공하는 세계를 구축한다.

## 지켜야 할 사항

작업 진행 상황은 항상 [STATE.md](STATE.md) 에 기록하고, 새 작업을 시작하기 전에 먼저 읽는다.

**기록 분리 규칙** — STATE.md 는 비대해지지 않게 유지한다.

- **STATE.md 에는 핵심만**: 현재 상태 요지(무엇이 있고 규모·핵심 파일)와 TODO. 완료 항목은 한 줄 요약 이하로.
- **완료 작업의 상세는 [Progress.md](Progress.md) 에 누적**: 권역·단계별 변경 내역, 실증 방법(`--force` 등), 설계 요약 등 길어지는 기록은 전부 이곳에. 최신 항목을 위에 쌓는다.
- **연결은 인덱스로**: STATE.md 에서 상세가 필요하면 Progress.md(또는 해당 설계 문서)로 링크만 건다. 같은 내용을 두 곳에 중복 기재하지 않는다.
- 새 작업을 마치면 이 규칙대로 STATE.md(핵심 갱신)와 Progress.md(상세 추가)를 함께 정리한다.

## 문서 인덱싱

| 문서 | 역할 |
|---|---|
| [STATE.md](STATE.md) | **현재 핵심 상태 + TODO** (핵심만 — 상세는 Progress.md) |
| [Progress.md](Progress.md) | **완료 작업 상세 기록** (권역별 변경 내역·실증 방법·설계 요약, 최신 위로 누적) |
| [Design-ObjectiveTree.md](Design-ObjectiveTree.md) | 목적 트리 구축 **방법론** — 원칙·절차·검증 |
| [Design-ObjectiveGraph.md](Design-ObjectiveGraph.md) | **상흔계 아벨리온** 목적 그래프 정본 (세계 시드·타입 표기·G0~G9·교차 그래프·대표 사건). 겹치면 우선 |
| [Design-WorldState.md](Design-WorldState.md) | 세계 상태(속성) 데이터화 **설계** — 다섯 층 모델(변수·스냅샷·법칙·행동·목적), 축 문법, 틱 의미론 |
| [Design-WorldLaws.md](Design-WorldLaws.md) | 세계 법칙 **설계** — 현상 세 서식지(관계·detail·사슬)의 전수 번역(패턴 7종·자율 법칙 42·사슬 5종 완역·NPC 정책·균형 법칙) + **노드→법칙 번역 절차·완료 체크리스트**(§9·§10, 새 세션은 이 절차로 작업) |
| [data/objective-graph.json](data/objective-graph.json) | 목적 그래프 **유일한 원본 데이터** (타입 노드 G/S/E/R/L/K/T/F/H/X/EV + 타입 관계). 편집은 여기 한 곳 |
| [data/validate-graph.mjs](data/validate-graph.mjs) | 위 JSON 검증기(데이터 없음, 참조 무결성 확인 — `node data/validate-graph.mjs`) |
| [data/world-state.json](data/world-state.json) | 세계 **상태의 유일한 원본** — vars/clocks/subjects/rules/actions/objectives 다섯 층. 그래프 id 를 앵커로 참조 |
| [data/state-engine.mjs](data/state-engine.mjs) | 상태 엔진(공유) — 결정론적 틱 루프 ①~⑦. validate/simulate 가 함께 사용 |
| [data/validate-state.mjs](data/validate-state.mjs) | world-state 검증기 — WorldState §12 검증 1~13 + WorldLaws §7 법칙검증 (`node data/validate-state.mjs`) |
| [data/simulate-state.mjs](data/simulate-state.mjs) | 무입력 틱 시뮬레이터 — 대표 사건 5종 사슬 재생 (`--force`·`--no-policy`·`--at`) |
| [objective-tree.html](objective-tree.html) | 목적 그래프 브라우저 관찰·편집기 (의존성 없는 단일 파일) |
