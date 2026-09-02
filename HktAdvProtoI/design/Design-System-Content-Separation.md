# Design — 기반 시스템 / 컨텐츠 분리

status: IMPLEMENTED — 경계는 `npm test` 의 boundary:check 가 상시 강제한다

## 목적

다른 세계를 제시하면, **기반은 한 줄도 바꾸지 않고** 컨텐츠만 확장하거나 완전히
교체할 수 있다. 분리 기준은 하나다.

```text
기반(Engine)    어느 세계에서나 참인 것 — 시계·관찰자 인과·요청 경로·투영 시점·봉투·그리기 장치
컨텐츠(Content) 이 세계에서 파생되는 것 — Rule·능력치·종류·표현 결정·모션
```

교체 단위는 `content/` 디렉터리 **통째**다. 이 기준선에는 컨텐츠가 하나뿐이므로 팩
이름 계층(`content/<packId>/`)을 두지 않는다 — 이름이 하나뿐인 계층은 경로만 길게
할 뿐 아무것도 가르지 않는다. 다른 세계를 만든다 = `content/` 를 갈아 끼우고 조립
포인터(`content/active*.ts`)가 가리키는 것을 그대로 둔다.

강제 수단은 선언이 아니라 검사다 — `npm run boundary:check` 가 engine → content
방향의 import 를 상시 막는다 (아래 "경계의 기계적 강제").

## 구조

```text
engine/                      기반. content/ 를 import 하지 않는다
  world-kernel/              시계·참여/이탈/표식 인과·요청 큐·request-reply·Tick 프레임·커널
  physics/                   기본 세계의 규칙 솔버 — vec·seek(추적 이동)·push(밀어내기)·
                             momentum(관성)·sweep(호 스윕 접촉·충격). 커널 단계가 아니라
                             컨텐츠의 시스템이 조합해 부르는 순수 함수 도구상자다
  protocol-core/             Snapshot 봉투 · ActionRequest 코어 · transport · 엔진 semantic-id
  view-kernel/               renderer·hud·input·net·camera·motion 재생·scene(Render Plan)·
                             명령 표면 기계장치·겹침 표면(surface — 열림/초점/Esc/닫는 자리)·
                             초점 이동 산수(input/focus)·기다리는 요청 표(net/pending)·
                             collision/facing/link/session presentation

content/                     컨텐츠 = 이 세계. 교체 단위다
  world/                     Rule · Semantic(이 세계의 State) · 시스템 순서 배열 · 투영 · 카탈로그 · 초기 배치
  protocol/                  봉투를 확장한 이 세계의 타입 (AttributesView·StrikeEvent·요청 파라미터·semantic-id)
  view/                      결정 Layer — resolve · presentation 표 · 문구(code-text) · 키 바인딩 · 스프라이트 표
  motions/                   모션 시트 + 정적 분석 생성물(view/motion-atlas.generated.ts)

조립 (컨텐츠를 부르는 자리):
  content/active.ts          world 조립 (server 가 읽는다)
  content/active-view.ts     view 조립 (app 이 읽는다 — world 와 분리: 클라이언트는 world 를 import 하지 않는다)
  content/active-catalog.ts  공정 도구 조립 (Node 도구용 — Vite glob 체인을 피한다)

기획·Cycle 산출물은 컨텐츠 안이 아니라 저장소 위에 있다:
  design/ · design/play/     설계·기획 원본과 Play Design
  cycles/C###-이름/          Cycle Artifact (00-cycle … 05-verification)
  tools/content-root.ts      파일시스템 도구가 컨텐츠 자리를 읽는 유일한 경로
```

## 반전 메커니즘 5종 (결합 → 등록)

| # | 메커니즘 | 자리 |
|---|---|---|
| ① | Interaction Registry — 컨텐츠가 핸들러를 등록, 엔진은 unknown-observer/interaction 불변식만 | `engine/world-kernel/dispatch.ts` ← `content/world/actions/interactions.ts` |
| ② | 시스템 순서 배열 — 결정론은 컨텐츠의 **한 배열**이 지킨다, 엔진은 인과 순서(참여→요청→진행→시간→투영)만 | `engine/world-kernel/tick.ts` ← `content/world/index.ts` |
| ③ | State 제네릭 — 엔진은 CoreWorldState(time·observers)만 요구, 컨텐츠가 확장 | `engine/world-kernel/state.ts` |
| ④ | Protocol 컨텐츠 소유 — 봉투는 코어, 의미 타입은 컨텐츠가 interface 확장. 좁힘은 결정 Layer 진입점 한 곳 | `engine/protocol-core/` ← `content/protocol/` |
| ⑤ | View 결정 Layer 주입 — 표·문구·바인딩·스프라이트는 컨텐츠, capability 는 엔진 (registerSprites·CodeTextFn·KeyBinding·baseline 인자) | `engine/view-kernel/` ← `content/view/` |

관찰자의 몸(spawnObserverBody)·투영(projectObserver)·tickInterval 도 컨텐츠가
`WorldContent` 계약(`engine/world-kernel/content.ts`)으로 등록한다.

### ⑤ 의 문구 — 기반은 사람이 읽을 말을 짓지 않는다

기반이 그리는 표면(명령 표면 · 겹침 표면 · 슬롯 띠 · 손가락 띠 · 이어짐)은 **무엇을
말해야 하는지를 코드로 부르고**, 그 코드가 무슨 말이 되는지는 컨텐츠의 문구 표가 정한다
(`CodeTextFn` — 형과 기본값은 `engine/view-kernel/presentation/code-text.ts`).
값이 끼는 자리는 `{}` 이며, **값은 기반이 데이터로 넘기고 문장은 컨텐츠가 소유한다** —
기반은 `{}` 가 문장의 어디에 있는지조차 알지 못한다.

```text
목록의 소유    코드를 부르는 자리가 자기 목록을 export 한다
              (SURFACE_TEXT_CODES · SLOT_BAR_TEXT_CODES · ENGINE_KEY_TEXT_CODES ·
               SESSION_TEXT_CODES · LINK_TEXT_CODES · COMMAND_TEXT_CODES)
합집합        engine/view-kernel/presentation/text-codes.ts 의 ENGINE_TEXT_CODES —
              모으기만 한다. 자리가 자기 목록에 한 줄을 더하면 합집합이 함께 자란다
검사          **이 기준선에는 없다** — 컨텐츠가 덮지 못한 코드를 잡아 주는 검사
              (content/view/tests/engine-text.spec.ts)는 아직 서지 않았다 (남은 부채)
덮지 않으면    코드가 그대로 화면에 뜬다 — 표현 누락이 게임을 멈추지 않는다.
              하지만 조용히 그렇게 되는 것과 검사가 말해 주는 것은 다르다
```

말이 아닌 것은 이 길을 타지 않는다 — 표식 글자(`✓` `✗` `…` `✕`)와 값 없음 표시(`—`),
단위(`ms` `/s`)는 기반이 그대로 쓴다. 개발자에게만 가는 말(`throw` · `console`)도 같다.

## 엔진 물리 (engine/physics) 와 승격 규칙

특정 세계관이 아닌 **기본 세계의 규칙**(밀어내기·관성·추적 이동·호 스윕 접촉)은 엔진이
순수 솔버로 제공하고, 컨텐츠는 그것을 조합해 자기 시스템을 만든다. 소유 경계:

```text
엔진 솔버가 소유    수식과 결정론 성질 — 제2/3법칙, 중심 일치 시 고정 방향, 스냅 도착
컨텐츠가 소유      상수(강성·마찰·충격량·호 각 — 그 세계의 결정론 값),
                   대상 선택(누가 밀리는가), 접촉의 의미(닿으면 무슨 일이 일어나는가)
```

솔버는 커널 파이프라인의 단계가 아니다 — 물리를 쓰지 않는 세계도 성립해야 하므로
컨텐츠의 시스템이 골라 부르는 라이브러리다. 예: 이 세계의 RULE-SWING-STRIKE-001 은
`arcSweepCollider`(엔진)로 접촉 목록을 얻고 피격·피해·기력 수지(컨텐츠 의미)를 적용한다.

컨텐츠 코드를 엔진으로 올리는 **승격 규칙**:

1. **rule of two** — 두 번째 세계가 같은 기계장치를 실제로 요구할 때 올린다.
   하나의 게임에서 일반화하면 그 게임의 가정이 엔진에 박제된다.
2. **라이브러리 형태** — 커널 필수 단계가 아니라 컨텐츠가 조합하는 순수 함수로 올린다.
3. **게임 무지 문장 검증** — 그 변경을 게임 명사 없이 서술할 수 있어야 한다.
   ("호를 그리며 닿은 몸 목록을 돌려준다" ✓ / "칼끝에 맞으면 피해를 준다" ✗)
4. 승격은 Cycle 이 아니라 기반 트랙 커밋으로 하며, 컨텐츠의 공개 API 와 결정론
   (동일 부동소수점 연산 순서)을 보존해 기존 테스트가 그대로 증거가 되게 한다.

기반은 **Cycle 을 알지 못한다.** engine/ 은 어느 세계에서나 참인 것만 담으므로
그 주석에 Cycle 번호를 적지 않는다 — 번호는 컨텐츠 쪽 사건이다.

## 경계의 기계적 강제

`npm run boundary:check` (`tools/boundary/check.ts`) — `npm test` 가 먼저 실행한다.

```text
규칙 1  engine/**  은 content/**·조립을 import 하지 않는다
규칙 2  content/** 은 조립(app/·server/)을 import 하지 않는다
규칙 3  content/** 를 import 하는 것은 조립(app/·server/·content/active*.ts)뿐이다
```

팩 이름 계층이 없어지면서 옛 규칙 2(팩 간 격리)는 지켜야 할 대상이 사라졌다 —
컨텐츠가 하나면 팩 사이의 선이 없다. 규칙은 셋으로 줄었다.

## 다른 세계로 작업하는 법

1. 지금 `content/` 를 옮겨 두고(또는 지우고) 같은 모양의 새 `content/` 를 만든다 —
   `world/index.ts`(WorldContent 계약) · `view/resolve.ts` · `view/code-text.ts` ·
   `view/bindings.ts` · `view/sprites.ts` · `view/motion-source.ts` · `protocol/` 이
   기반이 요구하는 최소 표면이다 (HktAdvProtoI/CLAUDE.md "기반이 컨텐츠에게 요구하는 것").
2. `design/` 에 그 세계의 기획을 쓴다 (Human).
3. advprotoi-design → advprotoi-plan → advprotoi-build 공정을 돈다.
4. 조립 포인터(`content/active*.ts`)의 재수출 대상이 새 `content/` 를 가리키면 뜬다 —
   engine/ · app/ · server/ 는 그대로다.

같은 세계를 확장하는 것이면 1·4 없이 `content/` 에 Cycle 을 계속 쌓는다.

> 이 기준선에는 최소 컨텐츠 예제(옛 `content/blank/`)가 없다. 교체 가능성은 지금
> 선언이 아니라 `boundary:check` 가 지키는 import 방향으로만 담보된다.

## 확정된 결정

| # | 질문 | 결정 |
|---|---|---|
| 1 | 컨텐츠의 자리 | `content/` 하나 — 팩 이름 계층을 두지 않는다 (교체는 디렉터리 통째) |
| 2 | Snapshot 컨텐츠 타입의 위치 | 컨텐츠 소유 — 봉투를 제네릭 가방으로 만들지 않는다 (타입 검증력 유지) |
| 3 | 도구가 컨텐츠 자리를 읽는 법 | `tools/content-root.ts` 하나 — 옛 `hkt.pack.json` 선언은 고를 것이 없어져 걷어냈다 |
| 4 | 컨텐츠 요청 파라미터(mode·attribute) | `params` 가방 대신 **컨텐츠 protocol 의 타입 확장** — 효과 동일, 타입 안전 우위 |

## 남은 부채

- `engine/view-kernel/scene/scene-state.ts` 의 SceneSelf 에 guard·moveMode 등 컨텐츠
  어휘가 남아 있다 (import 결합은 아니며 전부 optional — 쓰지 않는 세계도 성립한다).
  범용 겹침 표면(`SceneSurface` — 칸·줄·초점·요청 상태만, 게임 명사 0)이 그 옆에 섰지만
  **SceneSelf 와 SceneCommandSurface 를 그 위로 옮기지는 않았다.** 명령 표면은 타이핑과
  후보 좁힘이라는 자기 기계장치를 가지며, 그것을 범용 형에 밀어 넣으면 형이 명령의
  모양을 닮는다 (승격 규칙 1 — 하나의 게임에서 일반화하지 않는다).
  셋을 하나로 합칠지는 **다음 세계가 실제로 다른 패널을 요구할 때** 정한다.
- `engine/view-kernel/terrain/terrain.ts` 의 구릉·풀색은 엔진의 기본 지면이다 —
  세계별 지형 표현이 필요해지면 ⑤ 와 같은 주입 자리로 뺀다.
- 기반이 부르는 문구 코드(`ENGINE_TEXT_CODES`)를 컨텐츠가 전부 덮었는지 확인하는
  검사가 없다 (`content/view/tests/engine-text.spec.ts`). 지금은 덮지 못한 코드가
  화면에 코드 그대로 뜨는 것으로만 드러난다.
