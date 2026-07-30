# Phase 9 — 시뮬레이션 과정 재설계: 생성/플레이 분리 · 플레이 화면 · MMORPG 조작

> 요구 3건에서 출발한다 (2026-07-30).
> ① 세계 생성과 게임플레이가 분리되어야 한다 — 생성된 데이터를 **저장**했다가 플레이에서 **불러오는** 구조.
> ② 플레이어 관점으로 보면 검은 화면만 나온다.
> ③ 조작이 안 된다 — 일반 MMORPG 를 참고해 모바일·PC 모두에서 작동해야 한다.

## 9.0 기획 판단 — 무엇이 문제였는가

지금까지의 프로토타입은 **개발자의 검증 도구**로 완성됐다(§36 네 화면·§44 게이트 13/13).
그 화면 구성은 "세계가 옳게 도는가"를 묻는 자리였지 "이 세계를 플레이한다"의 자리가 아니었다.
세 요구는 전부 그 간극의 증상이다:

| 증상 | 구조적 원인 (file:line 은 재설계 전 기준) |
|---|---|
| 생성↔플레이 미분리 | 생성 결과가 `RuntimeServer.generated` **메모리에만** 머문다 — 새로고침이면 소멸. "생성된 세계로 시작"은 같은 세션에서만 성립 (`RuntimeServer.ts:57`, §39 저장 구조는 in-memory 구현에 머묾) |
| 플레이어 검은 화면 | `MapViewBuilder.buildMapView` 는 플레이어 모드에서 **조작 중인 주체가 없으면 빈 지도**를 반환한다(`MapViewBuilder.ts:416` — 원칙 자체는 옳다). 그런데 조작 시작이 "id 텍스트 입력 → attach 버튼"이라 플레이어 흐름에서 이 전제가 채워지지 않는다. "플레이어" 버튼을 먼저 누르면 배경색만 남는다 |
| 조작 불능 | 조작 수단이 §31 행동 후보의 **디버그 버튼 목록**뿐이다. 이동·대상 지정·화면 제어 같은 게임 문법이 없고, 시간도 +1시간/+1일 버튼으로만 흐른다 |

**원칙**: 기존 §44 증명(결정론·지식 필터·렌더러 격리·§35 기준선)은 한 항도 깨지 않는다.
플레이는 **이미 증명된 코어 위에 얹는 소비층**이다 — 세계 동역학(규칙·행동·판단)은 무변경.

## 9.1 세계 생성 ↔ 게임플레이 분리 — §3 아키텍처의 두 국면화

기획서 §3 의 일곱 모듈을 그대로 두 국면으로 가른다:
**모듈 1~6 은 제작(정적) 국면** — 데이터가 가공되는 과정이 단계별로 확실하게 처리되고 산출물이 저장된다.
**모듈 7 은 플레이 국면** — 그 데이터를 **가공 없이 그대로 불러와** 플레이한다.

```
[제작 — 정적 파이프라인: core/simulation/WorldPackager.buildWorldPackage]
 1. World Seed Editor   입력 원문 확인 (metadata.seedInput, G-11)      ─┐
 2. World Compiler      실행 데이터 확인 (규칙·행동·지역·종족·조직·개체) │ 각 단계가
 3. World Validator     §34 정적 검증 — 위반이 있으면 여기서 멈춘다      │ 처리 보고
 4. World Bootstrapper  배치 실행 → **부트스트랩 스냅샷** (§39)          │ (ok+수치)를
 5. Simulation Runtime  사전 실행 2일 (§35 축소판 — 세계가 실제로 도는가)│ 남긴다
 6. Event Interpreter   사전 실행이 남긴 사건의 문장 표본                ─┘
        ↓  패키지 = { format, label, definition, bootstrapSnapshot, stages[6] }
   WorldLibrary(localStorage) 보관  ──────────────┐
        ↓                                          ↓
[플레이 — §3 모듈 7]  세계 선택(카드가 stages ✓/✗ 표시) → initialize_world{package}
                       → 4단계 스냅샷을 fromSnapshot 으로 **그대로 복원** (재배치 없음)
```

### §3 일곱 모듈 ↔ 코드 — 분리의 단일 출처

| §3 모듈 | 실제 처리 코드 | 패키지 단계 기록(details)에 남는 것 |
|---|---|---|
| 1. World Seed Editor | `app/WorldSeedPage`(§36.1 입력) → `metadata.seedInput`(G-11) | 입력 원문 문장들 (제목·주제·경험·제외) |
| 2. World Compiler | `generation/CompilerPipeline`(§5 15단계) — 수동 세계는 우회 | §5 단계별 실행 기록, 또는 "컴파일 우회" 명시 + 산출 수 |
| 3. World Validator | `generation/WorldValidator.validateWorld`(§34 스키마+의미 19종) + `core/world/WorldValidation`(로드 계약) | 검사기 **개별 판정** ✓/✗ · evidence · 검사 대상 수 |
| 4. World Bootstrapper | `core/world/WorldBootstrap` → `RuntimeSnapshot`(§39) | 유형별 배치 수 · 주체 런타임 수 · 예약 이벤트 수 |
| 5. Simulation Runtime | `core/simulation`(SimulationLoop·WorldSystems) — 사전 실행 2일 | 일자별 change·새 사건 관측 |
| 6. Event Interpreter | `presentation/EventInterpreter` + `viewmodel/NarrationBuilder`(§33.3) | 상위 사건의 실제 산문 「제목」—요약 |
| 7. Web Viewer(플레이) | `app/play/PlayPage` + `rendering/PlaySceneRenderer` | (처리 없음 — 4단계 스냅샷을 해시 동일하게 복원) |

단계 기록은 **화면에서 펼쳐진다**: 스튜디오 보관 시 `#package-report` 가 모듈별로 접이식 표시, 플레이 세계 카드도 "§3 모듈 1~6 처리 기록 펼치기"를 갖는다. verify DoD 1b 가 기록의 실질(검사기 개별 판정 ≥21줄 · 해석기 산문 · 컴파일 출처 명시 · 생성 세계 15단계 동봉)을 상시 판정한다.

- **패키지 형태**: `hktadvc.world.2` 문서를 JSON.stringify 한 **불투명 문자열**.
  화면(app)은 이 문자열을 해석하지 않는다 — 분해 원칙 5(화면은 core/content/generation import 금지)가 그대로 성립한다.
  만드는 쪽(WorldPackager)과 읽는 쪽(RuntimeServer.initialize)만 내용을 안다. 단계 보고(`stages`)만 표시 속성으로 따로 실린다.
- **모듈별 기능이 명확하게 처리된다**: 각 단계는 `WorldPackageStageBadge { id: "1.seed"…"6.interpret", ok, evidence }` 를 남기고,
  실패한 단계 뒤는 돌지 않는다(파이프라인 규약). 실패 시 패키지는 나오지 않고 실패 단계·근거가 오류로 돌아온다.
- **프로토콜**:
  - `export_world { world: WorldKind, worldSeed }` → 서버가 §3 모듈 1~6 을 돌려 `world_package { worldId, label, json, stages }`.
    `generated` 는 마지막 컴파일 결과, `player`/`manual` 은 빌트인(데모·테스트용 — 같은 파이프라인을 통과한다).
  - `initialize_world { worldSeed, package?: string }` — 패키지가 있으면 파싱·**§34 재검증** 후 4단계 스냅샷에서 복원. 재배치·재부트스트랩 없음("그대로 불러온다"의 코드 형태). 실패는 error 응답(형식·검증 사유 명시).
- **WorldLibrary** (`app/WorldLibrary.ts`): localStorage(`hktadvc.worlds.v1`) 에 `{id,label,savedAt,json,stages}` 저장/목록/삭제.
- **스튜디오 쪽 접점**: 생성 화면(§36.1)에 "플레이 패키지로 보관" — 누르면 §3 1~6 이 돌고 단계 보고가 ✓/✗ 와 수치로 화면에 그대로 실린다.
- **플레이 쪽 접점**: 세계 선택 카드가 그 세계의 단계 보고를 표시한다 — 어떤 가공을 거친 데이터인지 플레이 진입 전에 직관적으로 보인다.
  빌트인 세계도 같은 경로다: 선택 시 export_world 로 지금 구워 같은 로드 경로로 합류한다(플레이에 패키지 아닌 세계는 없다).
- 진행 상태(플레이 중 스냅샷) 이어하기는 §39 복원 절차가 이미 코어에 있으므로(`RuntimeServer.restore`) 후속 범위로 남긴다.

## 9.2 플레이 모드 (검은 화면의 구조적 해소)

앱을 **두 모드**로 가른다. URL 해시 라우팅: `#studio`(기존 4탭, 기본) / `#play`.

플레이 모드 진입 절차가 "관찰자 없는 플레이어 시점"을 **구조적으로 불가능**하게 만든다:

```
① 세계 선택   보관된 세계 목록 + 빌트인 "침묵림 변두리(개입)"
② 주체 선택   request_playable_agents → 카드(이름·종족·지역·상태) — 조직 제외(§17)
③ 플레이     attach_player + set_view(player, observerId) 완료 후에만 렌더 시작
```

- 새 프로토콜: `request_playable_agents` → `playable_agents { agents: {id,label,speciesLabel,regionLabel,badges}[] }`.
- `MapViewBuilder` 의 "관찰자 없으면 빈 지도" 원칙은 **유지**한다 — 스튜디오에서 여전히 옳다. 고치는 것은 원칙이 아니라 진입 절차다.
- **표시 속성 2개 추가** (렌더러 격리 §8.0 유지):
  - `SceneMapRegion.worldSize { width, height }` — 화면→지역 좌표 역변환(픽킹)의 재료
  - `SceneMap.focusMarkerId?` — 카메라 기준(플레이어 모드에서 조작 주체 id)
- **PlaySceneRenderer** (`rendering/PlaySceneRenderer.ts`, SceneViewModel 만 import — 린트가 강제):
  - 카메라: focus 마커 중심, 현재 지역이 뷰포트를 채우는 줌(휠/핀치로 0.5~3×)
  - 그리는 것: 지역 바닥(기후·위험 색), 연결 게이트(열림/닫힘 §13), 마커(도형·게이지·강조 링), 신호 파문, 사건 링, 이동 목표 표식, 우상단 미니맵(전 지역 + 현재 위치)
  - `pick(px,py)` → `{kind:"marker",id} | {kind:"gate",toRegionId} | {kind:"ground",regionId,fx,fy}` — 표시 좌표의 역변환까지만 한다(의미 해석 없음)
- 지식 필터는 그대로 코어의 몫: 플레이 화면에 오르는 것은 이미 걸러진 SceneViewModel 뿐이다(§7.2 누출 0 유지).

## 9.3 MMORPG 조작 (PC + 모바일)

일반 MMORPG 문법을 코어 원칙(§21 플레이어=주체, §26 이벤트 루프, 결정론)과 화해시킨다.

### 이동 — 코어의 공간 능력 (`core/agents/PlayerMovement.ts`)

이동은 행동(§21)이 아니라 **행동 체계의 내장 공간 효과**의 연속형이다(`ActionSystem.applyMovement` 와 같은 층).
- `PLAYER_MOVE_SPEED = 2` (거리/tick) — WALK_SPEED(0.5) 의 4배, "달리기". 결정론 상수이므로 헤더 고정(CVar 금지 원칙).
- `player_move { x, y }`: 현재 지역 안 목표점(서버가 clamp). 수락 시 진행 중 행동은 취소된다(§31 재판단과 같은 취소 경로) — MMORPG 의 "움직이면 시전 취소".
- 실행은 **1 tick 간격 체인 이벤트**(`player_move_step`)로: 매 tick 목표 방향으로 PLAYER_MOVE_SPEED 만큼 전진, 도달 시 체인 종료. §26 이벤트 기반 루프와 정합(조용한 tick 을 만들지 않는다 — 이동 중일 때만 이벤트가 있다). 위치 변경은 `store.moveEntity` — 감각·신호·사건은 기존 파이프라인이 그대로 처리한다.
- `player_travel { toRegionId }`: §13 연결 검증(`canCross` — 조건부 길은 조건대로) → `travelCost` tick 뒤 도착 이벤트. 도착 지점은 지역 입구(지역 개체 위치). 도착 시 `entity_entered` 규칙 발화(기존 이동과 동일 규약 §11.1).
- 상태(`moveTarget`·`travel`)는 `PlayerRuntimeState` 확장 — agentRuntimes 에 실리므로 스냅샷 왕복(§39)이 자동으로 성립.
- 입력 로그 관점: `player_move`/`player_travel` 은 다른 요청과 같은 입력이다 — 같은 시퀀스면 같은 세계(결정론 검증 항목으로 고정).

### 실시간 흐름 — 클라이언트 루프

- `PlayLoop`: 500ms 간격으로 `advance_time(1 tick × 배속)`. 배속 ×1/×2/×4, 일시정지. 응답 미도착 시 스킵(백프레셔).
- §44-5("세계는 플레이어를 기다리지 않는다")는 유지 — 시간을 미는 주체가 버튼에서 루프로 바뀔 뿐, 코어는 여전히 `advance_time` 만 안다.

### 입력 문법 (일반 MMORPG 관례)

| 입력 | PC | 모바일 | 결과 |
|---|---|---|---|
| 이동 | WASD/방향키 (스티어) · 빈 땅 클릭 (click-to-move) | 가상 조이스틱 (좌하단) · 빈 땅 탭 | `player_move` |
| 대상 지정 | 마커 클릭 | 마커 탭 | 대상 카드 + 컨텍스트 행동 |
| 행동 | 하단 행동 버튼 (대상 필터된 §31 후보) | 동일 (터치 크기) | `execute_player_action` |
| 지역 이동 | 게이트 클릭 | 게이트 탭 | `player_travel` |
| 카메라 | 휠 줌 | 핀치 줌 | 렌더러 로컬(왕복 없음) |

스티어는 "현재 위치 + 방향×8 거리" 목표점을 250ms 마다 `player_move` 로 보낸다 — 프로토콜은 click-to-move 하나로 수렴한다.

### HUD (`#screen-play`)

- 상단 좌: 내 이름·체력바(마커 게이지 재사용) / 상단 우: 시계·배속·일시정지·나가기
- 대상 카드(선택 시): 이름 + **아는 사실 배지만**(지식 필터 통과분) + 그 대상에 가능한 행동 버튼
- 하단 우: 컨텍스트 행동 바(§31 후보 중 대상 일치 상위 6 + 더보기) — 근접 부족은 approach 후보가 이미 처리(§30)
- 접이식 패널: 저널·아는 사건(§29 필터 유지)·성장 선택(§32 모달)

## 9.4 완료 조건 (DoD) — `npm run verify` 항목

1. **§3 정적 파이프라인 + 그대로 로드**: buildWorldPackage(player) 가 모듈 1~6 보고를 전부 ✓ 로 남기고, initialize_world(package) 가 4단계 스냅샷과 **동일한 상태**(tick·개체 수·상태 해시)로 세계를 올린다(재가공 0). 변조 패키지(형식 위반)는 사유를 말하며 거부된다.
2. **이동 결정론**: 같은 `player_move` 시퀀스를 두 번 실행하면 최종 위치가 완전히 같다. 목표는 지역 경계로 clamp 된다.
3. **달리기 규약**: n tick 진행 시 이동 거리 ≤ PLAYER_MOVE_SPEED×n 이고 도달 후 체인이 멈춘다. `player_move` 수락이 진행 중 행동을 취소한다.
4. **지역 이동 규약**: 연결 있는 지역은 travelCost tick 뒤 도착하며 `entity_entered` 가 발화한다. 조건 미달 주체에게 조건부 길(잔재 능선)은 거부되고 큰길은 열린다.
5. **플레이 렌더러 격리**: `PlaySceneRenderer` 도 기존 `checkRendererImports` 검사를 통과한다(§8.0 — SceneViewModel 밖 import 0).

smoke 추가 여정: `#play` 진입 → 빌트인 세계 시작 → 주체 카드 선택 → **캔버스 픽셀이 검지 않음**(요구 ② 의 눈 검증) → 키보드 이동으로 좌표 변화 → 마커 탭으로 행동 버튼 표출.

## 9.5 범위 밖 (이번에 하지 않는 것)

- 진행 상태(스냅샷) 이어하기 UI — 코어 복원 경로(§39)는 있으므로 후속.
- NPC 달리기·연속 이동 — NPC 는 기존 행동 이동(순간 배치)을 유지한다. §35 기준선을 움직이지 않기 위함.
- 스프라이트·애니메이션·사운드 — 시각 완성도는 기존 결정(STATE.md)대로 범위 밖.
- 서버 동시 접속 — §43 이 제외한 것.
