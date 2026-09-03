# CLAUDE.md

HktAdvProtoI — 목적 트리 기반 오픈월드 어드벤처 프로토타입 (TypeScript · vite, UE 빌드와 무관).
세계의 규칙과 상태를 정의하고 그 위에서 굴러가는 게임을 만든다 — 채집물·퀘스트 NPC·몬스터 배치가 아니라.

이 문서는 **규약**만 둔다. 지금의 상태(다음 할 일 · 레인 · 부채 · 코드에 있는 것)는 [STATE.md](STATE.md) 가 소유한다.

## 작업 공정

```text
advprotoi-design  기획   방향/기획서/미지 주입 → Play Design(content/roadmap/play/*.md) → Human 승인 1회 → STATE.md §1 레인 표
advprotoi-cycle   Cycle  "C### 진행" — spec.md 동결 → E ∥ W ∥ V ∥ T → npm test → 마감(촬영 · TODO.md · 커밋 · PR)
```

- 공정 원본: [Design-CycleExecutionWorkflow.md](design/Design-CycleExecutionWorkflow.md) ·
  [Design-DesignAuthoringWorkflow.md](design/Design-DesignAuthoringWorkflow.md) ·
  [Plan-Skill-CycleExecutionWorkflow.md](design/Plan-Skill-CycleExecutionWorkflow.md)
- 다음에 **만들** 것은 승인된 Play 의 Cycle Breakdown 이, 다음에 **주입할** 것은
  [content/roadmap/README.md](content/roadmap/README.md) 가 답한다.
- `cycles/<CycleId>/` 에는 `spec.md` · `TODO.md`(비면 삭제) · `shots.json` + `shots/` 만 둔다.
  구현 노트·검증 산문은 만들지 않는다 — 코드 주석의 `RULE-*` id · 시나리오 테스트 · 커밋 메시지가 원본이다.
- 병렬 Cycle 규칙(브랜치 `cycle/C###` = 세션 하나 · STATE 는 main 에서만 · engine 먼저 합침)은
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
10. 살아 있는 문서(STATE.md · README)에는 현재 상태만 — 진행 상태는 CLAUDE.md 가 아니라 STATE.md 에.
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
| [STATE.md](STATE.md) | 지금의 상태 (살아 있는 문서) |
| [design/README.md](design/README.md) | 설계 문서 목록과 갈래 |
| [content/roadmap/README.md](content/roadmap/README.md) | 주입 순서 · 층별 확정 문서(L0~) · play/ |
