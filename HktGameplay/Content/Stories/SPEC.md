# HktStory Spec — 시나리오 검증 스키마

본 문서는 `*.spec.json` 사이드카 파일의 스키마를 정의한다. spec 은
**작성자 의도 ↔ 실제 동작** 을 영구적으로 검증하는 자동화 테스트의 입력이다.
검증은 `FHktStorySpecRunner` (HktAutomationTests 모듈) 가 수행한다.

진실원: `HktGameplayDeveloper/Source/HktAutomationTests/Private/Tests/HktStorySpecParser.cpp`

## 1. 파일 배치 / 명명

```
HktGameplay/Content/Stories/
└── <Category>/
    ├── <Story>.json          ← Story 본문
    └── <Story>.spec.json     ← 본 시나리오 (선택, 미존재 시 검증 없이 등록)
```

자동화 테스트 이름:
```
HktCore.Story.Spec.<StoryTag 정규화>.<ScenarioName 정규화>
```
정규화 규칙: 영숫자/언더스코어 외 문자(`.`, `-`, 공백 등) → `_`.

## 2. 최상위 필드

| 키 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `storyTag` | string | 필수 | 검증 대상 Program tag. **V2 prefix 없이** 작성 (`Story.Event.Move.Stop`). 런너가 `Story.V2.*` → 베이스 tag 순으로 lookup. |
| `description` | string | 선택 | 시나리오 묶음 설명 |
| `scenarios` | array | 필수 | 시나리오 목록 (1개 이상) |

## 3. scenario

| 키 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `name` | string | 필수 | 자동화 테스트 이름 일부 |
| `given` | object | 필수 | 초기 WorldState 구성 |
| `events` | array | 선택 | 시간 진행 + 외부 이벤트 주입 (비어있으면 `ExecuteProgram` 단발 실행 — Timer 자동 진행) |
| `expect` | object | 필수 | 종료 시점 매처 |
| `maxFrames` | int | 선택, 기본 500 | 실행 상한 |

## 4. given — 초기 WorldState

`self`, `target`, `entities[]` 키로 엔티티별 명세. `target` 미명시 시 `InvalidEntityId`.
이벤트 페이로드는 별도 `event` 블록 (아래 4.1).

### entity 명세

| 키 | 타입 | 설명 |
|---|---|---|
| `archetype` | string | `FHktArchetypeRegistry::FindByName` (옵션). 미명시 시 None. **`IfHasTrait`/`CheckTrait` op 가 의존하므로 Hittable 등 trait 검증이 필요한 엔티티는 반드시 archetype 지정** (예: `"NPC"`, `"Character"`, `"Item"`). 미등록 이름 → 즉시 fail. |
| `properties` | `{ "<PropertyName>": int }` | `HktProperty::FindByName` 으로 PropertyId 해석. **이름 표기만 허용** (uint16 직접 금지). |
| `tags` | `[string]` | `FGameplayTag::RequestGameplayTag` (`bErrorIfNotFound=false`). |
| `position` | `[x,y,z]` | shorthand — `PosX/PosY/PosZ` 자동 set. `properties` 와 병행 가능. |

### 4.1 given.event — 이벤트 페이로드

`LoadStore Param0` 류 op 는 entity 컬럼이 아닌 `FHktVMContext` 의 로컬 (`EventParam0..3`, `EventTargetPos*`) 에서 읽는다. 실 게임에선 이벤트 디스패치 시 채워지지만, spec 은 이벤트 우회 직접 실행이라 명시 필요.

```json
"given": {
  "self":  { "properties": {...} },
  "event": { "param0": 30, "targetPosX": 1000, "targetPosY": 0, "targetPosZ": 0 }
}
```

| 키 | 매핑 |
|---|---|
| `param0` ~ `param3` | `Context.EventParam0..3` (= `LoadStore Param0..3`) |
| `targetPosX` / `targetPosY` / `targetPosZ` | `Context.EventTargetPos*` (= `LoadStore TargetPosX/Y/Z`) |

모두 optional. 블록 자체가 없으면 모두 0 (= `Context.Reset()` 직후 상태).

## 5. events[]

| 폼 | 매핑 |
|---|---|
| `{"advance": N}` | `AdvanceTimerFrames(N)` — Timer 명시 진행 (대부분 자동이므로 거의 불필요) |
| `{"inject":"Collision","entity":"<ref>"}` | `InjectCollisionEvent(<ref>)` |
| `{"inject":"MoveEnd"}` | `InjectMoveEndEvent()` |
| `{"inject":"Grounded"}` | `InjectGroundedEvent()` |
| `{"inject":"AnimEnd"}` | `InjectAnimEndEvent()` (= `AdvanceTimerFrames(SimFPS)`) |

각 event 처리 후 `ResumeUntilDone(maxFrames)` 호출. 마지막 event 가 없으면 `ExecuteProgram` 한 번만 호출 (Timer 자동 진행).

### entity ref 표기 (events / expect 공통)

- `"self"`, `"target"` — 고정 슬롯
- `"entities[N]"` — `given.entities` 배열의 0-based 인덱스

## 6. expect — 종료 매처

| 키 | 타입 | 시멘틱 |
|---|---|---|
| `status` | string | `"Completed"` (기본) / `"Failed"` / `"Waiting"` — VM 종료 상태 |
| `<entityRef>` | object | 엔티티별 매처 (아래) |

### 엔티티별 매처

| 키 | 시멘틱 |
|---|---|
| `properties: { name: int }` | **정확 일치** (모든 키가 일치해야 PASS) |
| `tags: [string]` | **부분 일치** — 명시된 모든 태그가 컨테이너에 있으면 PASS |
| `tagsExact: [string]` | **정확 일치** — 정렬 후 set 비교 |
| `tagsAbsent: [string]` | 명시된 태그가 **모두 없어야** PASS |

태그 표기에는 spec 파일의 `tags` alias 맵이 따로 없다 — 항상 fully-qualified GameplayTag 문자열을 사용한다 (`Anim.Montage.HitReaction` 등).

## 7. 실패 출력 형식

```
[FAIL] HktCore.Story.Spec.Story_Event_Move_Stop.moving_to_stopped
  Movement/MoveStop.spec.json:scenarios[0]
  expect self.properties.MoveForce: 0
  actual: 500
```

## 8. 작성 가이드라인

- 각 시나리오는 독립적이어야 한다 — given → events → expect 사이클 단일.
- given 의 properties 는 Story 본문에서 *읽는* 모든 입력을 명시. 미명시 값은 0.
- 분기 경로마다 1 시나리오. 분기 4개면 시나리오 4개.
- Wait op 가 있는 Story 는 events 또는 충분한 maxFrames 로 Wait 해소를 보장.
- `tagsAbsent` 는 "Story 종료 시 정리되어야 할 임시 태그" (애니 태그 등) 검증에 사용.

## 9. 예시

```json
{
  "storyTag": "Story.Event.Move.Stop",
  "scenarios": [{
    "name": "moving_to_stopped",
    "given": { "self": { "properties": {"MoveForce": 500, "IsMoving": 1} } },
    "expect": {
      "status": "Completed",
      "self": { "properties": {"MoveForce": 0, "IsMoving": 0} }
    }
  }]
}
```

이벤트 페이로드 + Wait 분리 실행 예시는 `Story_MoveTo.spec.json` 참조.
