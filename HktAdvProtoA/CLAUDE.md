# CLAUDE.md

HktAdvProtoA — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

이전에 경험하지 못했던 끝없는 성장과 상호작용을 통해 다채롭고 도파민을 뿜어내는 모험을 경험을 제공하는 세계를 구축한다.

## 지켜야 할 사항

작업 진행 상황은 항상 [STATE.md](STATE.md) 에 기록하고, 새 작업을 시작하기 전에 먼저 읽는다.

## 문서 인덱싱

| 문서 | 역할 |
|---|---|
| [STATE.md](STATE.md) | 구현 현황, TODO |
| [Design-ObjectiveTree.md](Design-ObjectiveTree.md) | 목적 트리 구축 **방법론** — 원칙·절차·검증 |
| [Design-ObjectiveGraph.md](Design-ObjectiveGraph.md) | **상흔계 아벨리온** 목적 그래프 정본 (세계 시드·타입 표기·G0~G9·교차 그래프·대표 사건). 겹치면 우선 |
| [Design-WorldState.md](Design-WorldState.md) | 세계 상태 데이터화 **설계** — 목적 그래프를 근거로 상태 변수·판정 술어·전이 규칙의 3층 모델 정의 |
| [data/objective-graph.json](data/objective-graph.json) | 목적 그래프 **유일한 원본 데이터** (타입 노드 G/S/E/R/L/K/T/F/H/X/EV + 타입 관계). 편집은 여기 한 곳 |
| [data/validate-graph.mjs](data/validate-graph.mjs) | 위 JSON 검증기(데이터 없음, 참조 무결성 확인 — `node data/validate-graph.mjs`) |
| [data/world-state.json](data/world-state.json) | 세계 **상태의 유일한 원본** — vars/clocks/subjects/rules/actions/objectives 다섯 층. 그래프 id 를 앵커로 참조 |
| [data/state-engine.mjs](data/state-engine.mjs) | 상태 엔진(공유) — 결정론적 틱 루프 ①~⑦. validate/simulate 가 함께 사용 |
| [data/validate-state.mjs](data/validate-state.mjs) | world-state 검증기 — §12 검증 1~13 (`node data/validate-state.mjs`) |
| [data/simulate-state.mjs](data/simulate-state.mjs) | 무입력 틱 시뮬레이터 — '강의 귀환' 사슬 재생 (`node data/simulate-state.mjs`) |
| [objective-tree.html](objective-tree.html) | 목적 그래프 브라우저 관찰·편집기 (의존성 없는 단일 파일) |
