# CLAUDE.md

HktAdvProtoI — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다.
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

## 지금 어디에 서 있는가

이 프로젝트는 HktAdvProtoH 를 복사해 **다시 세운 기준선**이다.

```text
기반 (engine/·app/·server/·tools/)   HktAdvProtoH 의 최신 상태 그대로
컨텐츠 (content/)                     기능만 남기고 Cycle 이력은 지웠다
```

**Cycle 은 이 프로젝트에서 처음부터 센다.** 이전 트랙의 Cycle 번호는 코드·주석 어디에도
남기지 않았다 — 첫 Cycle 은 `C001` 이다. 지금 있는 기능은 이전 트랙이 만든 것이지만
이 프로젝트의 Cycle 이 만든 것은 아직 하나도 없다. 기능은 그대로 두고 다음 Cycle 들이
그것을 재사용한다.

컨텐츠에 지금 있는 것 — 채광 · 캐릭터 행동과 모션 · 세계/클라이언트 분리 ·
다중 관찰자 · 이어짐 계량 · 몸 충돌 · 기본 전투 정책 · 시점과 그림 방향 ·
개발 명령 표면과 세계의 대답.

컨텐츠에 **없는** 것 — 전투 공식 · 막기 · 피해 종류 · 관통 · 살펴봄 · 치명 · 지목 · 태도 ·
선딜 · 소지품 · 자리 · 장비 · 스킬 형태 · 지형 법칙 · 성장. 전부 `design/` 에 기획으로만 있다.

기반에는 그 뒤에 자란 능력(겹침 표면 · 칸 띠 · 터치 입력 · 이펙트 레이어 · 지면 구역 ·
세계 영속)이 **그대로 남아 있다.** 컨텐츠가 아직 쓰지 않을 뿐이다 — 쓰기 시작하는 것이
다음 작업들의 일이다.

## 작업 공정 (Workflow)

공정 원본은 [design/Design-CycleExecutionWorkflow.md](design/Design-CycleExecutionWorkflow.md),
기획 위층(사람의 아이디어 → Play Design → 00-cycle)은
[design/Design-DesignAuthoringWorkflow.md](design/Design-DesignAuthoringWorkflow.md),
스킬 분할 근거는 [design/Plan-Skill-CycleExecutionWorkflow.md](design/Plan-Skill-CycleExecutionWorkflow.md).

```text
advprotoi-design  기획      방향/기획서 주입 → Play Design(content/roadmap/play/*.md) 구체화
                           → Human 승인 1회 → 00-cycle.md 생성
advprotoi-plan    의미 확정  00-cycle → CYCLE SPEC → WORLD SEMANTIC + RULE (01·02)
advprotoi-build   실현·검증  구현 ∥ GameView ∥ 검증 병렬 → 실측 검증 (03·04·05)
                           완료 시 play 문서의 Cycle 체크박스 갱신
```

"다음에 무엇을 만들까"는 승인된 Play Design 의 Cycle Breakdown 이 답한다 —
별도의 Master Graph 탐색 공정(advprotoi-master)은 두지 않는다.
"다음에 무엇을 **주입**할까"는 [content/roadmap/README.md](content/roadmap/README.md)
가 답한다 — 로드맵은 코드의 기반/컨텐츠 분리와 같은 두 층이다. **기반 층**(게임 방향 →
세계의 문법 → 세계 → 몸 → 물건 → 대결 → 능력 → 성장)은 축을 위에서 아래로 하나씩
주입하고, **컨텐츠 층**은 그 축 위에 미지(지역·생물·자원·구조) 하나씩을 행으로 놓는다.
한 Play 는 행 하나만 증명한다. 로드맵과 그 결과물(`L0-Game.md` · 층별 확정 문서 · 미지
문서 · `play/`)은 전부 `content/roadmap/` 에 있다.

Cycle Artifact 는 `cycles/<CycleId>/` (CycleId: `C###-이름`) — 파일만이 단계 간
인터페이스다. 이전 공정의 산출물(`guides/` · `master/` · `BACKLOG.md` · `LANES.md`)과
그 도구(master-graph · lanes · cycle-lint · feedback-gate)는 이 기준선에서 걷어냈다.

## 기반 / 컨텐츠 경로 규약

기반(Engine)과 컨텐츠(Content)는 물리적으로 분리되어 있다
([design/Design-System-Content-Separation.md](design/Design-System-Content-Separation.md)).

```text
engine/            기반 — world-kernel · physics(기본 세계 규칙 솔버) · view-kernel ·
                   protocol-core. 게임 명사 없이 성립하는 재사용 기구만 갖는다. Cycle 의
                   기구 추출(advprotoi-build 의 분해 → Agent E, 별도 커밋)로 자라며,
                   기존 계약의 변경은 ENGINE GAP 으로 Human 승인을 거친다.
                   **Cycle 을 알지 못한다** — 공용 모듈이므로 Cycle 번호를 적지 않는다.
                   컨텐츠의 시스템은 physics 솔버를 조합해 만든다 — 직접 재구현하지 않는다
content/           컨텐츠 = 이 세계 — world/ view/ protocol/ motions/
content/roadmap/   이 세계의 주입 순서와 그 결과물 (문서만 — L0-Game.md · 기반 층/컨텐츠 층 확정 문서 · play/)
content/active*.ts 조립이 컨텐츠를 부르는 유일한 자리 (경계 규칙 3)
app/ · server/     조립 — 클라이언트 루트와 세계 호스트. 컨텐츠의 속을 알지 못한다
scripts/           실행 스크립트 — run*.{bat,sh} · scan-motions.{bat,sh}
design/            설계·기획 원본 (공정·기반 + 이 세계의 컨텐츠 기획 재료) — Human 소유
```

경계는 `npm run boundary:check` 가 강제한다 (engine→content import 금지 ·
content→조립 import 금지 · 컨텐츠를 부르는 것은 조립뿐).
다른 세계를 만든다 = `content/` 를 갈아 끼운다 — 기반은 그대로 둔다.

### 기반이 컨텐츠에게 요구하는 것

기반은 **사람이 읽을 말을 짓지 않고, 게임의 명사를 알지 못한다** (설계 반전 ⑤).
그래서 컨텐츠가 다음을 준다.

```text
world/index.ts            WorldContent 계약 — tick 주기 · 초기 배치 · interaction 목록 ·
                          시스템 진행 순서 · 관찰자 몸 · 투영
view/resolve.ts           GameView Snapshot → SceneState (결정 Layer 의 유일한 진입점).
                          봉투 형을 컨텐츠 형으로 좁히는 자리도 여기 하나다
view/code-text.ts         의미 코드 → 문구. 기반이 부르는 코드 전부를 덮어야 한다 —
                          목록의 단일 출처는 engine/view-kernel/presentation/text-codes.ts
view/bindings.ts          장면을 읽어 요청을 고르는 특수 키 규칙
view/sprites.ts           그림표 (SPRITE_SHEET · REGISTERED_SPRITE_IDS)
view/motion-source.ts     이 세계의 motions/ 폴더와 아틀라스
protocol/                 봉투(engine/protocol-core)를 확장한 이 세계의 계약
```

## Kind 정적 데이터

존재 종류(CharacterKind)의 정적 데이터는 3원소에만 둔다.

```text
1. world/semantic/character-catalog.ts   한 항목 (시뮬레이션)
2. view/kind-presentation.ts             한 항목 (표현)
3. motions/<kind>/                       폴더 (그림 — 없으면 placeholder 로 그려진다)
```

관찰·정합 검사: `npm run catalog` / `npm run catalog:check`.

## 실행과 검증

```text
scripts/run.bat · run.sh       세계 + 클라이언트를 한 프로세스에서 (원클릭)
scripts/run-split.*            세계와 클라이언트를 각각 다른 창으로
npm run dev                    같은 것 (vite — 세계가 이 프로세스 안에서 돈다)
npm test                       경계 검사 + vitest 전체
npm run build                  tsc --noEmit + vite build
npm run boundary:check         engine/content 경계
npm run motions:scan           모션 시트 재분석 → view/motion-atlas.generated.ts
npm run surface:lab            겹침 표면 capability 눈검증 페이지
```

## 핵심 원칙

```text
 1. World 는 Authoritative Server 이고 View 는 독립적인 Client 다.
 2. World → View 계약은 GameView Specification 이다 — 세계는 의미만 투영한다.
    "어떻게 그릴지"(sprite·크기·라벨 형식·문구·키)는 View 의 결정 Layer 가 정한다.
 3. View 는 GameView Specification 만으로 동작할 수 있어야 한다.
 4. 세계의 State 변경은 World Rule 의 Transition 에서만 일어난다.
 5. 기반은 컨텐츠를 부르지 않는다 — 컨텐츠가 계약으로 자신을 등록한다.
 6. 결정론에 영향을 주는 값(시뮬레이션 상수)은 헤더 상수로 고정한다.
 7. 새 규칙·표현을 더할 때 REUSED / ADDED / CHANGED / AFFECTED 를 명시한다.
 8. 영향을 받는 기존 Rule 과 플레이 Scenario 도 함께 검증한다.
 9. 최종 완료 조건은 코드 작성이 아니라 실제로 플레이되는가다.
10. 살아 있는 문서(README·상태 문서)에는 **현재 상태만** 둔다 —
    완료·승인·날짜 경위를 본문에 쌓지 않는다. 경위는 git history 가 소유한다.
11. 코드 주석은 한국어로 쓴다.
```

## 막혔을 때

이전 단계에서 확정된 의미를 임의로 바꾸거나 없는 의미를 만들어내지 않는다.
부족한 내용을 명시하고 그 의미를 책임지는 자리로 반환한다.

```text
GAP
Required   무엇을 표현해야 하는가
Missing    무엇이 없는가
Reason     왜 현재 입력으로 불가능한가
Return To  어느 자리가 이 의미를 책임지는가
```

```text
View 정보 부족       → GameView Specification (protocol/)
Spec 정보 부족       → World Semantic (world/semantic/)
Semantic 정보 부족   → 기획 원본 (design/) · Human
```

## 기준 문서 (Source of Truth)

`design/` 의 목록과 갈래는 [design/README.md](design/README.md) 가 소유한다.
지금 코드가 선 자리를 읽으려면 다음 둘이 먼저다.

| 문서 | 내용 |
|---|---|
| [Design-System-Content-Separation.md](design/Design-System-Content-Separation.md) | 기반/컨텐츠 분리 — 이 저장소 구조의 근거 |
| [Design-Concept.md](design/Design-Concept.md) | 세계의 문법 — 존재·상태·주체·법칙·시간 (로드맵 1층, 확정) |
| [Design-Subject-Decision.md](design/Design-Subject-Decision.md) | 주체의 의사결정 — 지식·숙련·경험·선호·목적·가능성 (3층 재료) |

기획을 들일 때는 [content/roadmap/README.md](content/roadmap/README.md)(주입 순서 · 열린 층) 와
[content/roadmap/L0-Game.md](content/roadmap/L0-Game.md)(게임 방향) 가 먼저다.
