# CLAUDE.md

HktAdvProtoI — 목적 트리 기반 오픈월드 어드벤처 프로토타입 (TypeScript · vite, UE 빌드와 무관).
세계의 규칙과 상태를 정의하고 그 위에서 굴러가는 게임을 만든다 — 채집물·퀘스트 NPC·몬스터 배치가 아니라.

이 문서는 **규약**만 둔다. 지금의 상태는 [plan/STATE.md](plan/STATE.md) 가, 할 일은 [plan/TODO.md](plan/TODO.md) 가, 코드에 있는 것은 [codemap/](codemap/README.md) 가 소유한다.

## 게임의 목적 (Human 원문 — 모든 기획·묶음·Cycle 의 상위 판단 기준)

> 플레이어는 요정들을 모으고 성장시키며 미지의 세계를 탐험해나간다 — 무대에 서서 직접 조작되는 것은 언제나 한 명이다.
> 미지의 세계는 플레이어에게 다양한 위험과 그것을 극복할 재료를 제공함으로써 플레이어에게 경험을 제공한다.
> **"미지의 세계에서의 성장과 조합의 재미"가 핵심이다.** 이 경험을 느끼도록 세계가 재료를 충분히 제공해야 한다.
> 성장 = 플레이어가 구성할 수 있는 유효한 조합과 세계에 개입할 수 있는 가능성의 확장 (Fairy × Class × Item × Knowledge).

세부는 [content/roadmap/L0-Game.md](content/roadmap/L0-Game.md) (둘째 원문의 전문은 [content/roadmap/L7-Fairy-Growth-Combination.md](content/roadmap/L7-Fairy-Growth-Combination.md)). 아직 증명되지 않은 것 넷 — 한 지역을 여러 번
방문해도 재미있는가 · 수많은 플레이어가 같은 세계에 존재해야만 하는 이유가 있는가 · 요정을 성장시키는 선택에
애착과 고민이 생기는가 · 세계가 발견된 뒤에도 계속 살아 움직이는가. 새 기획과 묶음은 이 넷 중 무엇에 닿는지 말해야 한다.

## 작업 공정

```text
기획서(content/roadmap/L<N> · M<N> · design/) → 묶음 + 첫 spec (AI 제안) → Human "C### 진행" → Cycle → … → AI 예심 → Human 실주행 판정
advprotoi-cycle  하나뿐인 스킬 — "<기획서> 로 묶음 잘라"(묶음 + 첫 spec) · "C### 진행"(spec 동결 → E ∥ W ∥ V ∥ T → npm test → 마감)
```

- 공정 원본: [Design-CycleExecutionWorkflow.md](design/Design-CycleExecutionWorkflow.md) (Cycle) ·
  [Design-DesignAuthoringWorkflow.md](design/Design-DesignAuthoringWorkflow.md) (주입 → 묶음 → 판정) ·
  [Plan-Skill-CycleExecutionWorkflow.md](design/Plan-Skill-CycleExecutionWorkflow.md) (스킬 분할 · 회수 규칙 · 병렬)
- **기획서와 Cycle 사이에 문서 층이 없다.** 묶음(기획서에서 자른 플레이 하나 — Goal · Intent · Breath · Cycle 목록 · 미지 · 질문)은
  첫 Cycle 의 `spec.md` 머리 블록이다. 의미의 출처는 기획서 하나이고 spec 은 그것을 인용한다. Play 문서는 없다.
- **작업 관리는 `plan/` 하나다** — 관점 셋(design · 묶음 · cycle)으로 나뉜다.
  ```text
  plan/STATE.md    지금 어디까지 — §0 트랙과 순서(어느 트랙에서 무엇을 어떤 순서로) · 관점별 요약 표 (진입점 — 새 세션은 이것부터)
  plan/TODO.md     앞으로 할 일 — 트랙(Human · cycle · engine)마다 순서대로 한 줄씩
  plan/DESIGN.md   기획 관점 상세 — 층 · 행 · 원본 기획 → Cycle 덮임과 남은 것 · 다음 묶음 후보
  plan/CYCLES.md   Cycle 관점 상세 — 레인 표 · 병렬 규칙 · 묶음 대장(판정 질문 · 결정 대기 · 다음 Cycle 로) · 공학 부채
  codemap/         코드에 있는 것 — ENGINE.md(기반 API 명세) · CONTENT.md(컨텐츠 코드 구조) · README.md(실행 · 손잡이)
  ```
- 다음에 **만들** 것은 승인된 첫 spec 의 묶음 블록(Cycle 목록)과 `plan/CYCLES.md` 레인 표가, 다음에 **자를** 것은
  `plan/DESIGN.md` §5 가 답한다. 주입의 규약은 [content/roadmap/README.md](content/roadmap/README.md).
- `cycles/<CycleId>/` 에는 `spec.md` · `shots.json` + `shots/` 만 둔다. 코드 뒤에 남는 것은 전부 `plan/` 에 쓴다 —
  관찰 항목 · 결정 · 같은 묶음의 다음 Cycle 로 → `CYCLES.md` 그 묶음 절, 공학 부채 → `CYCLES.md` §5, 뒤 층 · 뒤 묶음으로 → `DESIGN.md` §3 의 "남은 것".
  Cycle 별 TODO 없음. 구현 노트·검증 산문은 만들지 않는다 — 코드 주석의 `RULE-*` id · 시나리오 테스트 · 커밋 메시지가 원본이다.
- **한 사실 한 집** — 요약 문서(STATE · TODO)는 링크하고 복사하지 않는다. 층 · 행 · 덮임 · 후보는 `DESIGN.md`, 묶음의 상태 · 질문 · 결정 ·
  레인 · 부채는 `CYCLES.md`, 코드는 `codemap/`. 회수 규칙(누가 언제 읽고 지우는가)은 Plan-Skill §3.
- 병렬 Cycle 규칙(브랜치 `cycle/C###` = 세션 하나 · plan/ 은 main 에서만 · engine 먼저 합침)은
  Plan-Skill §4 항목 4 가 소유한다.

## 기반 / 컨텐츠 경로 규약

기반(engine)과 컨텐츠(content)는 물리적으로 분리된다 ([Design-System-Content-Separation.md](design/Design-System-Content-Separation.md)).

```text
engine/            기반 — world-kernel · physics · view-kernel · protocol-core · world-authoring.
                   게임 명사 없이 성립하는 재사용 기구만. Cycle 번호를 적지 않는다.
                   기존 계약 변경은 ENGINE GAP 으로 Human 승인
content/           컨텐츠 = 이 세계 — world/ view/ protocol/ motions/ regions/ roadmap/
content/regions/   Region 데이터 — world 와 view 가 함께 읽는다. engine 만 import
content/active*.ts 조립이 컨텐츠를 부르는 유일한 자리
app/ · server/     조립 — 클라이언트 루트와 세계 호스트. 컨텐츠의 속을 알지 못한다
design/            설계·기획 원본 — Human 소유
```

경계는 `npm run boundary:check` 가 강제한다 (engine→content · content→조립 · regions→world/view import 금지).
컨텐츠의 시스템은 physics 솔버를 조합해 만든다 — 직접 재구현하지 않는다.

### 기반이 컨텐츠에게 요구하는 것

기반은 사람이 읽을 말을 짓지 않고 게임의 명사를 알지 못한다. 컨텐츠가 다음을 준다.

```text
world/index.ts        WorldContent 계약 — tick · 초기 배치 · interaction · 시스템 순서 · 관찰자 · 투영
view/resolve.ts       GameView Snapshot → SceneState (결정 Layer 의 유일한 진입점)
view/code-text.ts     의미 코드 → 문구 (코드 목록의 단일 출처: engine/view-kernel/presentation/text-codes.ts)
view/bindings.ts      장면을 읽어 요청을 고르는 키 규칙
view/sprites.ts       그림표
view/motion-source.ts motions/ 폴더와 아틀라스
protocol/             봉투(engine/protocol-core)를 확장한 이 세계의 계약
```

CharacterKind 의 정적 데이터는 `world/semantic/character-catalog.ts` · `view/kind-presentation.ts` · `motions/<kind>/` 셋에만 둔다
(`npm run catalog:check`).

## 실행과 검증

```text
scripts/run.* / npm run dev     세계 + 클라이언트 한 프로세스 (run-split.* 은 분리)
npm test                        경계 검사 + vitest
npm run build                   tsc --noEmit + vite build
npm run motions:scan            모션 시트 → view/motion-atlas.generated.ts
npm run cycle:shot <cycles/C###/shots.json>   마감 촬영 → cycles/C###/shots/*.png
```

## 핵심 원칙

```text
 1. World 는 Authoritative Server, View 는 독립 Client 다.
 2. World → View 계약은 GameView Specification 이다 — 세계는 의미만 투영하고,
    "어떻게 그릴지"(sprite·크기·문구·키)는 View 의 결정 Layer 가 정한다.
 3. View 는 GameView Specification 만으로 동작해야 한다.
 4. State 변경은 World Rule 의 Transition 에서만 일어난다.
 5. 기반은 컨텐츠를 부르지 않는다 — 컨텐츠가 계약으로 자신을 등록한다.
 6. 시뮬레이션 상수는 헤더 상수로 고정한다.
 7. 새 규칙·표현에는 REUSED / ADDED / CHANGED / AFFECTED 를 명시한다.
 8. 영향을 받는 기존 Rule 과 플레이 Scenario 도 함께 검증한다.
 9. 완료 조건은 코드가 아니라 실제로 플레이되는가다.
10. 살아 있는 문서(plan/ · codemap/ · README)에는 현재 상태만 — 진행 상태는 CLAUDE.md 가 아니라 plan/ 에.
11. 코드 주석은 한국어로 쓴다.
```

## 막혔을 때

확정된 의미를 임의로 바꾸거나 없는 의미를 지어내지 않는다. 부족한 것을 명시하고 책임지는 자리로 반환한다.

```text
GAP
Required   무엇을 표현해야 하는가
Missing    무엇이 없는가
Reason     왜 현재 입력으로 불가능한가
Return To  View 부족 → protocol/ · Spec 부족 → world/semantic/ · Semantic 부족 → design/ · Human
```

## 기준 문서

| 문서 | 내용 |
|---|---|
| [plan/STATE.md](plan/STATE.md) | **진입점** — 트랙과 순서 · design/묶음/cycle 관점 요약 (살아 있는 문서) |
| [plan/TODO.md](plan/TODO.md) | 앞으로 할 일 — 트랙마다 순서대로 |
| [plan/DESIGN.md](plan/DESIGN.md) · [CYCLES.md](plan/CYCLES.md) | 관점별 상세 — 기획서 덮임과 다음 묶음 후보 · 묶음 대장(판정 질문 · 결정) · 레인과 부채 |
| [codemap/README.md](codemap/README.md) | 코드에 있는 것 — engine API 명세 · content 코드 구조 · 실행과 손잡이 |
| [design/README.md](design/README.md) | 설계 문서 목록과 갈래 |
| [content/roadmap/README.md](content/roadmap/README.md) | 주입의 규약 — 층의 정의 · 주입 방식 · 열 질문 · 결과물(L0~ · M<N>) |
