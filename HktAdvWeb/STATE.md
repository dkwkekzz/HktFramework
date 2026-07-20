# STATE — 현재 상태

> **이 문서만 보고 다음 세션을 시작할 수 있어야 한다.** 규칙·불변 원칙은 [CLAUDE.md](CLAUDE.md),
> 설계 본체는 [Design-ObjectiveHierarchy.md](Design-ObjectiveHierarchy.md),
> 실행 계획은 [Design-StepPlan.md](Design-StepPlan.md). 완료 이력은 git.

## 현재 — 한눈에

- **설계 + 실행 계획 + seed 데이터 존재, 코드 없음.**
  - [Design-ObjectiveHierarchy.md](Design-ObjectiveHierarchy.md) v0.3 — 목적 계층(목적=상태 차이 →
    속성 기반 재료 요구 → 기회).
  - [Design-Visualization.md](Design-Visualization.md) v0.1 — 시각화: 하이브리드 렌더·속성 채널·
    재료 시각 문법·AI 에셋 파이프라인. 타겟: 모바일+PC 웹.
  - [Design-StepPlan.md](Design-StepPlan.md) v0.1 — **6 Phase 19 step 실행 계획**: A 세계 기질 →
    B 그래프 코어(M2=최소 수직 절편) → C 발견 상태 → D 시각화 최소 → E 플래너·생성 → F 다중
    행위자. 각 step 은 GoalNode 문법(목표/작업 세부/검증/done_when)으로 기술되어 있다.
  - [data/objective-graph.yaml](data/objective-graph.yaml) — **seed 목적 그래프**: §4.4/§4.5
    스키마 실물. 뿌리 7 + 위협 가지 전개, 0.1.1.2(약점 발견=가설 루프)·0.1.1.3(피해 수단=속성
    제작) 말단까지 완전 전개, DAG 교차(권속의 심장), 무대 4(발견 2·미발견 2), 술어 DSL v0 명세
    포함. Slice-1(절편) 정의됨. 아직 기계 검증 전 — step B1 이 인수한다.
  - [data/property-lexicon.yaml](data/property-lexicon.yaml) — 속성 사전 seed (속성명의 정본).
- 타 트랙 참조 없음 — 이 폴더 안에서 완결.
- 검증 인프라(테스트·데모·스크린샷) 미구축 — step A1 에서 세운다.

## NEXT — 다음 할 일

**step A1 — 검증 인프라 + 프로젝트 골격** ([Design-StepPlan.md](Design-StepPlan.md) §3 A1):

- `package.json`(ESM, node:test) + `demo/server.js`(node:http 정적 서버) + `run.sh` — 클린
  클론에서 `bash run.sh` 한 번으로 설치→테스트→데모가 재현되는 골격.
- 인프라 자체를 검증하는 테스트 1건(서버 기동→200 확인) — 자리표 테스트 금지.
- done_when: 클린 클론에서 `bash run.sh` 가 오류 없이 테스트 통과 후 서버를 띄운다.
- 이후 순서는 StepPlan §2 의 Phase DAG 를 따른다: A2(속성 물질+사전 로더) → A3(원장) →
  A4(술어 DSL — seed 그래프의 done_when 이 전부 이 DSL 로 쓰여 있다) → A5(사건+법칙) →
  B1(seed 그래프 기계 인수).
