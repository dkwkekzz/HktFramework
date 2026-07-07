# PLAN — 애니메이션 시스템 (A 트랙: 입력 → 상태 → 클립)

상태: **진행 중 (2026-07)** — A1(입력·상태·클립 3층) 완료. 단계 큐·현황은 [ROADMAP.md](ROADMAP.md) A 트랙에서 관리한다.
전제가 되는 L6(뼈대 살) 구조는 [DESIGN.md](DESIGN.md) 「L6 의 구조」, 게놈(몸의 데이터화)은 [PLAN-CharacterGenesis.md](PLAN-CharacterGenesis.md).

## 목표

하나의 표준 스켈레톤(built-in 53관절 / Mixamo 호환)을 **입력으로 움직인다**. 캐릭터의 몸(게놈)이
정체성=데이터였듯, 캐릭터의 **행동도 데이터**로 — 입력에 반응하는 상태 그래프가 클립을 고르고,
클립 위에 L6 살이 그대로 자란다(애니메이션 보존). 이번 범위는 요청대로 **단일 스켈레톤**.

세 성질:

| 성질 | 정의 |
|---|---|
| **입력 분리** | 입력 *소스*(키보드/에디터/AI/네트워크)가 캐릭터 로직과 분리 — 어떤 소스든 같은 인터페이스에 주입하면 같은 상태 머신이 돈다 |
| **상태=데이터** | 상태 그래프·전이 조건이 코드가 아니라 직렬화 가능한 데이터 — 새 행동 = 새 그래프 값, 새 코드 경로 0 |
| **클립 무수정** | 상태가 고른 클립은 built-in 절차 / FBX 어느 쪽이든 L6 살이 무수정 추종 — 리타게팅·재스키닝 없음(L6 의 본질적 우위) |

## 3층 아키텍처 (`js/anim.js` → `HktGenesisAnim`)

```
입력 소스 (키보드·에디터·AI·네트워크)
   │  주입: input.setMove(x,z) · input.trigger('jump') · input.trigger('action','wave')
   ▼
① CharacterInput        연속 축(move) + 1회성 트리거(에지, 1프레임 수명)
   ▼
② CharacterStateMachine 선언적 조건 DSL 로 도는 상태 그래프 (기본 휴머노이드 내장)
   │  전이: idle→walk(이동)→run(강이동) · idle→jump(트리거) · *→wave(트리거) · 원샷→복귀(clipDone)
   ▼
③ AnimationController   상태의 논리 클립 → 실제 포즈 소스 해석
   │  built-in: Skeleton.pose(clip, 로컬시각, …)   FBX: ExternalSkeleton.play(name, fade) + pose(dt,…)
   ▼
세그먼트(taper 캡슐) → wgsl SIM 의 fleshK 규칙(살이 자란다) — 기존 L6 경로 그대로
```

### ① 입력 주입 — `CharacterInput`

- **축(axis)**: 연속 값, 매 프레임 샘플(레벨). `move = {x, z}`, 파생 `moveMag()`.
- **트리거(trigger)**: 1회성 에지. 눌린 프레임에 버퍼되었다가 상태 스텝 후 소멸 — 아무도 안 먹은
  트리거(공중 점프 등)를 무한 버퍼하지 않는다(게임 관례). `trigger(name, value?)` 로 값(액션 종류) 전달.
- 소스는 이 객체에만 쓴다 — 상태 머신·컨트롤러는 소스를 모른다(디커플링). 키보드든 에디터 버튼이든
  AI 경로 추종이든 네트워크 리플레이든 같은 API 로 주입한다.

### ② 상태 시스템 — `CharacterStateMachine`

- 상태: `{ name, clip, loop, speed?, duration?, transitions:[{to, when}] }`.
- 전이 조건 `when` 은 **선언적(직렬화 가능)**:
  - `{ axis:'moveMag', op:'>', value:0.12 }` — 연속 축 비교
  - `{ trigger:'jump' }` · `{ trigger:'action', equals:'wave' }` — 트리거 존재/값
  - `{ clipDone:true }` — 원샷 클립 완료 · `{ after:0.4 }` — 진입 후 경과
  - 배열 = AND · `{ any:[…] }` = OR · `function(ctx)` = 커스텀 술어(최후 수단)
- 왜 데이터인가: 게놈이 몸을 데이터화했듯 전이를 데이터화하면 새 캐릭터 클래스·에디터 편집·네트워크
  동기화가 JSON 하나로 성립한다. 함수 술어는 직렬화·검증을 깨므로 이스케이프 해치로만.
- 기본 휴머노이드 그래프(`DEFAULT_GRAPH`): idle ↔ walk ↔ run + wave/jump 원샷. 데이터로 완전 교체 가능.

### ③ 상태 → 클립 바인딩 (FBX 설정) — `AnimationController`

- built-in `Skeleton` 을 항상 쥐고, FBX(`ExternalSkeleton`)를 선택적으로 붙인다.
- **FBX 로 설정**: `ExternalSkeleton` 이 `animations[]` 전체를 보관(`clipNames`)하고 `play(name, fade)`
  로 크로스페이드한다(전엔 `animations[0]` 하나만). `useFbx(ext, override?)` 가 상태를 클립 이름에
  **자동 배선** — 상태 이름 우선(run→'Run'), 없으면 논리 클립명 폴백(run 은 clip 'walk'→'Walking'),
  Mixamo `mixamorig|`·`Armature|`·`.001` 접두어·꼬리는 `normClip` 으로 흡수(rig-agnostic).
- Idle/Walk/Run/Jump 클립이 담긴 FBX 하나를 드롭하면 상태 그래프 전체가 그 리그의 클립으로 배선된다.

## 불변·함정 (친화 인덱스와의 정합)

세그먼트 **순서 = 뼈 친화(rest.w) 인덱스** 규약([DESIGN.md](DESIGN.md))이 애니메이션 전환의 한계를 정한다.

1. **크로스페이드는 같은 소스·같은 리그 안에서만.** 같은 FBX 리그의 클립끼리는 뼈 순서가 불변이라
   mixer 크로스페이드가 안전. built-in 끼리는 위상 리셋(즉시)이며 살 스프링이 지연 흡수.
2. **소스 전환(built-in↔FBX)은 하드 컷 + 재시드.** 세그먼트 수/순서가 달라지므로 부드럽게 섞을 수
   없다 — `controller.update` 가 `sourceChanged` 를 올려 호출측(app.js)이 `bindBones` 재시드하게 한다.
3. **클립에 부속 트랙을 넣지 않는다.** 꼬리·망토(C4 가상 뼈)는 물리(지연 추종)로만 — 클립 무수정 유지.
4. **built-in `jump` 는 절차 원샷.** FBX 없이도 트리거 구동을 실증(도약 포물선 + bell 무릎 당김).

## 통합 (index.html 데모)

- `뼈대` 탭에 **`입력 구동(상태 머신)` 토글** — 켜면 상태 머신이 클립을 몰고, 끄면 기존 드롭다운(수동 클립).
- 키보드 주입: **WASD 이동 · Space 점프 · Q 인사** + 상태 HUD(현재 상태 표시).
- FBX 드롭 시 `controller.useFbx` 로 상태를 FBX 클립에 자동 배선.

## 검증

`node test/anim-shot.js` — ① 상태 전이(무입력→idle · 이동→walk → 강이동→run · 정지→idle · wave/jump
트리거→원샷 후 clipDone 복귀, CPU 결정론) ② FBX 자동 배선(Mixamo 접두어 매핑) ③ 컨트롤러 구동
세그먼트 위 살 배양 사진. 회귀: `genome-shot`(세그먼트 bit-exact) · `app-smoke` 무영향.

## 남은 단계 (확정 시 ROADMAP A 트랙으로)

- **A2 — 블렌드 트리·파라메트릭**: 이동 강도로 idle/walk/run 을 연속 블렌드(같은 리그 전제),
  방향 스트레이프 블렌드. 완료 기준: moveMag 스윕에서 발 접지 유지·불연속 없는 사진.
- **A3 — 루트 모션 / 이동 결합**: 보폭-이동 속도 정합(발 미끄러짐 제거) — MMORPG 관례대로 이동 속도를
  다리 길이(게놈)에 비례. 지형(T 트랙) 이동과 결합. 완료 기준: 걷는 속도 = 실제 이동 속도 사진.
- **A4 — 다개체 상태 머신 (C7 합류)**: 개체별 컨트롤러(개체별 뼈대 E2 위) — 서로 다른 캐릭터가 각자
  입력·상태로 움직인다. 완료 기준: 두 캐릭터가 서로 다른 상태를 동시에 재생.
- **A5 — 에디터 배선 (E 트랙 합류)**: 타임라인 대신/과 함께 상태 그래프 편집 UI + 상태별 클립 매핑
  패널(FBX 클립 → 상태 드롭다운). 완료 기준: 에디터에서 그래프·매핑을 편집해 저장/재생.

## 이 문서가 아닌 곳

- 단계 진행 현황 → [ROADMAP.md](ROADMAP.md) A 트랙
- 구현하며 내린 결정·함정 → [DESIGN.md](DESIGN.md) 「설계 결정」 A1 행
- 몸의 데이터화(게놈) → [PLAN-CharacterGenesis.md](PLAN-CharacterGenesis.md)
