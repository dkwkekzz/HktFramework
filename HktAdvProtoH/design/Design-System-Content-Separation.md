# Design — 기반 시스템 / 컨텐츠 분리

status: IMPLEMENTED — 경계는 `npm test` 의 boundary:check 가 상시 강제한다

## 목적

다른 Master Graph Root 를 제시하면, **기반은 한 줄도 바꾸지 않고** 컨텐츠만 확장하거나
완전히 교체할 수 있다. 분리 기준은 하나다.

```text
기반(Engine)    Root 가 바뀌어도 참인 것 — 시계·관찰자 인과·요청 경로·투영 시점·봉투·그리기 장치
컨텐츠(팩)      Root 에서 파생되는 것 — Rule·능력치·종류·표현 결정·모션·Master Graph·Cycle
```

증명: `content/blank/` — 종류 1·move 만의 최소 팩이 engine 무수정으로 뜨고 움직인다.
스모크 테스트(`content/blank/world/tests/`)가 이를 상시 검증하고, 조립 포인터를
blank 로 바꾼 상태의 typecheck·빌드도 통과한다.

## 구조

```text
engine/                      기반. content/ 를 import 하지 않는다
  world-kernel/              시계·참여/이탈/표식 인과·요청 큐·request-reply·Tick 프레임·커널
  physics/                   기본 세계의 규칙 솔버 — vec·seek(추적 이동)·push(밀어내기)·
                             momentum(관성)·sweep(호 스윕 접촉·충격). 커널 단계가 아니라
                             팩의 시스템이 조합해 부르는 순수 함수 도구상자다 (P6)
  protocol-core/             Snapshot 봉투 · ActionRequest 코어 · transport · 엔진 semantic-id
  view-kernel/               renderer·hud·input·net·camera·motion 재생·scene(Render Plan)·
                             명령 표면 기계장치·collision/facing/link/session presentation

content/<packId>/            컨텐츠 팩 = 교체 단위
  world/                     Rule · Semantic(팩 State) · 시스템 순서 배열 · 투영 · 카탈로그 · 초기 배치
  protocol/                  봉투를 확장한 팩 타입 (AttributesView·StrikeEvent·요청 파라미터·semantic-id)
  view/                      결정 Layer — resolve · presentation 표 · 문구(code-text) · 키 바인딩 · 스프라이트 표
  motions/                   모션 시트 + 정적 분석 생성물(view/motion-atlas.generated.ts)
  master/ cycles/            Master Intent Graph 와 Cycle History — Root 가 팩의 정체성이다

조립 (어느 팩을 띄우는가):
  content/active.ts          world 조립 (server 가 읽는다)
  content/active-view.ts     view 조립 (app 이 읽는다 — world 와 분리: 클라이언트는 world 를 import 하지 않는다)
  content/active-catalog.ts  공정 도구 조립 (Node 도구용 — Vite glob 체인을 피한다)
  hkt.pack.json              공정·파일시스템 도구(catalog·motion-atlas)와 문서 공정의 활성 팩 선언
```

## 반전 메커니즘 5종 (결합 → 등록)

| # | 메커니즘 | 자리 |
|---|---|---|
| ① | Interaction Registry — 팩이 핸들러를 등록, 엔진은 unknown-observer/interaction 불변식만 | `engine/world-kernel/dispatch.ts` ← `<pack>/world/actions/interactions.ts` |
| ② | 시스템 순서 배열 — 결정론은 팩의 **한 배열**이 지킨다, 엔진은 인과 순서(참여→요청→진행→시간→투영)만 | `engine/world-kernel/tick.ts` ← `<pack>/world/index.ts` |
| ③ | State 제네릭 — 엔진은 CoreWorldState(time·observers)만 요구, 팩이 확장 | `engine/world-kernel/state.ts` |
| ④ | Protocol 팩 소유 — 봉투는 코어, 의미 타입은 팩이 interface 확장. 좁힘은 팩 결정 Layer 진입점 한 곳 | `engine/protocol-core/` ← `<pack>/protocol/` |
| ⑤ | View 결정 Layer 주입 — 표·문구·바인딩·스프라이트는 팩, capability 는 엔진 (registerSprites·CodeTextFn·KeyBinding·baseline 인자) | `engine/view-kernel/` ← `<pack>/view/` |

관찰자의 몸(spawnObserverBody)·투영(projectObserver)·tickInterval 도 팩이
`WorldContent` 계약(`engine/world-kernel/content.ts`)으로 등록한다.

## 엔진 물리 (engine/physics) 와 승격 규칙

특정 세계관이 아닌 **기본 세계의 규칙**(밀어내기·관성·추적 이동·호 스윕 접촉)은 엔진이
순수 솔버로 제공하고, 팩은 그것을 조합해 자기 시스템을 만든다. 소유 경계:

```text
엔진 솔버가 소유    수식과 결정론 성질 — 제2/3법칙, 중심 일치 시 고정 방향, 스냅 도착
팩이 소유          상수(강성·마찰·충격량·호 각 — 그 세계의 결정론 값),
                   대상 선택(누가 밀리는가), 접촉의 의미(닿으면 무슨 일이 일어나는가)
```

솔버는 커널 파이프라인의 단계가 아니다 — 물리 없는 팩(blank 급)도 성립해야 하므로
팩의 시스템이 골라 부르는 라이브러리다. 예: proto-adventure 의 RULE-SWING-STRIKE-001 은
`arcSweepCollider`(엔진)로 접촉 목록을 얻고 피격·피해·기력 수지(팩 의미)를 적용한다.

팩 코드를 엔진으로 올리는 **승격 규칙**:

1. **rule of two** — 두 번째 팩이 같은 기계장치를 실제로 요구할 때 올린다.
   하나의 게임에서 일반화하면 그 게임의 가정이 엔진에 박제된다.
2. **라이브러리 형태** — 커널 필수 단계가 아니라 팩이 조합하는 순수 함수로 올린다.
3. **게임 무지 문장 검증** — 그 변경을 게임 명사 없이 서술할 수 있어야 한다.
   ("호를 그리며 닿은 몸 목록을 돌려준다" ✓ / "칼끝에 맞으면 피해를 준다" ✗)
4. 승격은 Cycle 이 아니라 기반 트랙 커밋으로 하며, 팩의 공개 API 와 결정론
   (동일 부동소수점 연산 순서)을 보존해 기존 테스트가 그대로 증거가 되게 한다.

## 경계의 기계적 강제

`npm run boundary:check` (`tools/boundary/check.ts`) — `npm test` 가 먼저 실행한다.

```text
규칙 1  engine/**  은 content/**·조립을 import 하지 않는다
규칙 2  content/A/** 은 content/B/** 를 import 하지 않는다 (팩 간 격리)
규칙 3  content/** 은 조립(app/·server/)을 import 하지 않는다
규칙 4  content/** 를 import 하는 것은 조립(app/·server/·content/active*.ts)뿐이다
```

## 새 Root 로 작업하는 법

1. `content/<newPack>/` 을 만든다 — 최소 뼈대는 `content/blank/` 를 복사 (README 참조).
2. `master/root.md` 에 새 Root Goal / World Premise 를 쓴다 (Human).
3. advprotoh-master → advprotoh-cycle 공정을 그 팩 안에서 돈다.
4. 띄울 때는 조립 포인터 3개와 `hkt.pack.json` 을 그 팩으로 바꾼다 — engine 은 그대로다.

기존 팩 확장이면 1·4 없이 기존 팩에 Cycle 을 계속 쌓는다.

## 확정된 결정

| # | 질문 | 결정 |
|---|---|---|
| 1 | 현재 게임의 팩 이름 | `proto-adventure` |
| 2 | Snapshot 컨텐츠 타입의 위치 | 팩 소유 — 봉투를 제네릭 가방으로 만들지 않는다 (타입 검증력 유지) |
| 3 | guides/스킬 경로 규약 | 활성 팩 루트 기준 (CLAUDE.md 경로 규약 절) — guides 본문은 팩 상대 경로로 유효 |
| 4 | 컨텐츠 요청 파라미터(mode·attribute) | `params` 가방 대신 **팩 protocol 의 타입 확장** — 효과 동일, 타입 안전 우위 |

## 남은 부채

- `engine/view-kernel/scene/scene-state.ts` 의 SceneSelf 에 guard·moveMode 등 컨텐츠
  어휘가 남아 있다 (import 결합은 아니며 전부 optional — blank 팩은 쓰지 않는다).
  범용 패널 모델로 일반화할지는 다음 팩이 실제로 다른 패널을 요구할 때 정한다.
- `engine/view-kernel/terrain/terrain.ts` 의 구릉·풀색은 엔진의 기본 지면이다 —
  팩별 지형 표현이 필요해지면 ⑤ 와 같은 주입 자리로 뺀다.
