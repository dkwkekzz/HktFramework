---
name: htj-step
description: HTJ step 한 바퀴(논의→구현→검증→기록)를 토큰·시간 효율적으로 실행한다. 정해진 규칙으로 스스로 굴러가는 세계를 step 단위로 점진 구축한다. 사용자가 "HTJ step 진행/다음 step"을 요청하면 사용.
---

# HTJ step 루프 — 실행 절차

규칙의 권위는 `HTJ/CLAUDE.md`(목표·작업 방식·큰 목표↔중간 목표)와 `HTJ/STATE.md`(지금 어디까지 + **나아갈 방향**). 이 스킬은 그 절차를 **토큰·시간 효율적으로** 실행하는 방법만 정한다. 작업 디렉토리: `HTJ/`.

> **⛔ 방향을 따른다 — 임의로 정하지 않는다.** 무슨 step 을 할지는 **`STATE.md §3 「나아갈 방향」`이 권위**다(큰 목표·중간 목표는 `CLAUDE.md` 「큰 목표 ↔ 중간 목표」 + STATE §3 이 가리키는 design 문서). step 은 그 방향을 따라 고른다. 방향이 애매하면 *새 트랙을 지어내지 말고* 사용자와 논의한다. 중간 목표 *도달*은 사용자가 직접 모는 **인터랙티브 viewer** 로 확인한다(per-step 갤러리와 별개·아래 §2).

## ⛔ 절대 원칙 — 물리영역(engine)에 타입 전용 처리 금지

> 이 프로젝트의 핵심은 **author 하지 않는다**는 것이다 — 아이템·캐릭터·지형을 타입으로 박아 넣는 게 아니라, 더 낮은 층위의 규칙이 굴러간 *결과로 창발*하게 한다. 이 "author 안 함"은 **코드에서도** 지켜진다. **모든 step 이 이 원칙을 어기지 않는지 §1 에서 먼저 자문하고, 닫기 전 다시 확인한다.**

- `engine/`(세계·물리)는 **한 원소(자유 구체) + 알려진 역학 + DNA 메타**만 안다 — `"지형"·"바다"·"퇴적"` 같은 **특정 타입을 아는 함수·분기를 두지 않는다**(sphere-world §1 "예외 없는 한 원소·지면 타입 없음").
- 모양·자연스러움(매끄러움 포함)은 **DNA(`shapeHash` → 세계 `shapeDict`)가 담고, *제너릭* 렌더(`viewer`)가 발현**한다 — engine 에 손수 author 한 형태/필터를 박지 않는다.
- **자문**: 새 step 마다 "engine 에 타입 이름이 박힌 처리(특정 타입을 아는 함수·분기·필터)를 넣고 있지 않은가?" — 그런 거동은 *제너릭* engine 법칙 + viewer 발현으로 갈라낸다.
- **위반 선례(되돌림)**: `engine/htj-terrain.js` 의 지형 전용 `terrainSurface`(0065/0066) 와 그 `smooth` 노브(0067) — 물리영역에 타입 전용 처리를 박아 **되돌림**. 정답은 T2(0067 배선 + 0068 제너릭 표면)·T3(0069 거리 LOD) 처럼 *타입 무관 유틸 + 제너릭 렌더*.
- 권위 문서: `HTJ/CLAUDE.md` 「절대 원칙」 · `design/merge-dna.md §6` · `sphere-world.md §5` · `environment.md §4`.

## 0. 읽기 — 허용 목록만

**필독**: `HTJ/CLAUDE.md` · `HTJ/STATE.md` (전체). STATE 가 현재의 SSOT 다.
**조건부**: 직전 step 의 `steps/step_NNNN/step_NNNN.md` 1개(직전 법칙 형식 참고용)만 기본으로 읽는다. 그 외 옛 step 문서는 *습관적으로* 통째로 훑지 말 것 — 다만 이번 step 이 특정 과거 법칙을 직접 건드리거나 그 발견에 의존한다면 **해당 step 문서를 짚어 읽는다**(필요하면 전체라도). STATE 가 SSOT 이지만, 거기에 없는 세부가 필요하면 출처 step 으로 내려가는 게 맞다.
**설계 문서**: 이번 step 이 `HTJ/design/` 의 설계(예: `design/scalability.md` 의 S1~S7 도입 사다리)를 구현하는 것이라면 **해당 설계 문서를 읽고**, 닫을 때 그 step 문서에서 설계 문서를 역참조한다(설계는 트랙 밖이 아니라 *이 트랙 후속 step 의 청사진*).
**큰 코드 파일은 부분 읽기만**: `engine/` 의 법칙 파일이 커지면 Grep 으로 직전 법칙·진입점만 찾아 offset/limit 로 읽는다.

## 1. 논의 — step 의 의미를 먼저 확정

step 은 목적에 도달하기 위한 *의미*를 가져야 한다. 시작 시 사용자와 **무엇을 할지** 정한다:
- **방향 정합** — 이 step 이 `STATE.md §3 「나아갈 방향」`에 부합하는가. 부합 안 하면 멈추고 논의(임의 방향 금지).
- 이 step 이 세계를 어떻게 변형시키는가 (충분히 유의미한가)
- **무엇으로 검증 가능한가** — 검증 불가능한 step 은 step 이 아니다
- 무엇이 보존되고 무엇이 변하는가

결정되면 구현을 시작한다. 애매하면 멈추고 논의한다.

### step 의 두 종류 — 의례를 무게에 맞춘다

- **법칙 step (새 엔진 법칙)**: engine 에 새 거동을 더한다. 한 step = 가장 단순한 법칙 하나(여러 개 욱여넣지 않음). 아래 §3~5 의 *온전한* 의례를 따른다.
- **조립/통합 step (새 엔진 법칙 0)**: 이미 가진 법칙들을 viewer 한 장면에서 *함께 굴려* 창발을 보인다(선례 0035·0043·0044). engine 변경 0 → 회귀는 구조적으로 0. **가벼운 의례**: verify 는 *새로 생긴 상호작용·창발 + 합쳐서도 보존*만(부품 자체 보존은 부품 step verify 가 이미 보증) · 문서는 타이트(§4). **자잘한 조립 여러 개는 한 step 으로 묶어도 된다** — 조립은 "가장 단순한 단위 하나" 규칙의 예외(법칙이 아니라 무대라서). 어느 종류인지 §1 에서 먼저 밝힌다.

## 2. 구현 — 세계(engine)와 확인용(viewer) 분리

**세계 ↔ 확인용은 단방향 의존**: `engine/` = 세계(법칙) 그 자체 · `viewer*` = 그것을 확인하는 도구. `viewer` 는 `engine` 을 *읽기만* 하고, `engine` 은 `viewer`(렌더·캡처·캔버스)를 **절대 import/참조하지 않는다**. 렌더 방식을 바꿔도 세계는 불변이어야 한다.

- **법칙은 `engine/`** 한 곳. 새 법칙은 직전 법칙 형식을 따르고 **가법적**으로 추가(기존 동작 회귀 0 — 노브=0 → early-return 패턴 권장). engine 코드는 캔버스·DOM·렌더에 의존하지 않는다(Node 에서 그대로 돈다).
- **확인용 = 시나리오 1벌**(`viewer/scenes/step_NNNN.js`). **장면 통일**([design/scene-unify.md](../../../HTJ/design/scene-unify.md)·U1☑): 한 step 의 시뮬레이션 시나리오는 `viewer/scenes/step_NNNN.js` **한 곳에만** 산다(UMD·engine 만 *읽음*). 이 한 벌을 **헤드리스 캡처**(`node tools/htj-render-capture.js NNNN`)가 읽어 `capture.png` 를 뽑는다(§3b·AI 눈 검증) — **per-step `capture.js` 를 새로 짜지 않는다**. 시나리오 모듈 계약: `{ label, note, defaults, init(w), advance(w,p), frames:[step…], toFrame(w)->{pts}, makeWorld?()->w, captureOpts? }`. 보조함수가 필요하면 모듈 안에 *인라인*해 self-contained 로(외부 클로저 의존 금지). 선례: `viewer/scenes/step_0066.js`. 닫은 step 의 옛 `capture.js` 는 **소급 안 함**(불변).
- **사용자용 라이브 viewer 갤러리(`viewer.html` STEPS·`check-viewer.js`)는 폐기** — 유지보수가 안 됐다. 새 step 은 `viewer.html` 에 등록하지 않고 갤러리 가드도 돌리지 않는다(시나리오 모듈은 *캡처용*으로만 존재). **사용자용 viewer 는 중간 목표(STATE §3) *도달* 때만 큐레이트해 인터랙티브로 제공**한다 — per-step 이 아니라 목표 세계당 한 번.

## 3. 검증 — verify.js (수치) + 시뮬레이션 캡처 (눈)

검증은 두 축이다. 둘 다 통과해야 step 을 닫는다.

**(a) 수치 — `steps/step_NNNN/verify.js`** — *적정 검증*(완전 망라 아님)
- **새 법칙 유효성이 알맹이** (`node HTJ/steps/step_NNNN/verify.js`): verify 본문은 **① 이 step 이 도입한 *새 거동(법칙)* 의 핵심 단언**을 직접 쓴다(1~2개). 반복되는 **② 보존 ③ 항등(노브=0→회귀 0) ④ 결정론** 은 **공용 가드** `tools/htj-verify-lib.js`(`conserved`·`identity`·`deterministic`·`fnv1a`)를 *한 줄로 호출*해 채운다(보일러플레이트 손으로 다시 짜지 말 것). 보통 4~6 검사면 충분 — *고정 6종을 채우려 늘리지 말 것*. 조립 step 은 *새로 생긴 상호작용·창발 + 합쳐서 보존*만(부품 보존은 부품 verify 가 보증·중복 검증 금지). (장면 통일 U2☑·[design/scene-unify.md](../../../HTJ/design/scene-unify.md) §2-4 — verify 는 시나리오 재구성·눈 검증을 들지 않는다·캡처는 §3b 범용 러너가 따로.)
- verify 는 **자체로 온전·순수**해야 한다 — 외부 가변 상태에 의존하지 않고, 이후 어떤 step 을 진행해도 깨지지 않는다(영구 회귀 가드).
- 닫기 전 **이전 step 들의 verify 를 전부 재실행**해 회귀 0 을 확인한다(*이건 알맹이 — 절대 생략 안 함*). 깨지면 멈추고 사용자와 논의한다.
- 문서의 모든 수치는 verify 출력을 그대로 옮긴다.

**(b) 눈 — 시뮬레이션 캡처 (범용 러너·per-step capture.js 폐지)**
- 이 step 의 세계를 **화면으로 캡처**한다. 산출물: `steps/step_NNNN/capture.png`(보통 시간 경과 4 프레임). **§2 의 시나리오 모듈에서 바로 뽑는다**: `node HTJ/tools/htj-render-capture.js NNNN` — 범용 러너가 `viewer/scenes/step_NNNN.js`(viewer 라이브와 *같은 한 벌*)를 읽어 `init→advance` 를 `frames` 마크까지 굴리고 각 마크에서 `toFrame(w)` 을 모아 `tools/htj-capture.js` 로 PNG 를 쓴다. **per-step `capture.js` 를 새로 짜지 않는다** — 장면은 시나리오 모듈에, PNG 보일러플레이트는 `htj-capture.js` 에 이미 있다(`writeFramesPNG`). (chromium+playwright 가 있으면 viewer 캔버스 *픽셀 동일* 스크린샷도 가능하나 통상 부재 → 범용 러너가 *세계 동일* PNG. design/scene-unify.md §3.)
- 캡처가 *수치 검증의 가설과 일치하는지* 눈으로 확인한다 — verify 가 주장하는 바가 화면에 실제로 보여야 한다. 어긋나면 멈추고 논의한다.
- 캡처한 내용을 사용자에게 보여준다.

## 4. 기록 — steps/step_NNNN/ + STATE.md

**한 step = 한 폴더.** 그 step 의 모든 산출물(`step_NNNN.md`·`verify.js`·`capture.png`)은 `steps/step_NNNN/` 안에 모은다.

- **긴 산문은 한 곳만 — 이중 작성 금지.** "쉽게 풀어 쓴 설명"은 시나리오 모듈의 **`note`** 에 둔다(라이브 갤러리는 폐기됐지만 `note` 가 산문의 집 — step 을 보고할 때 캡처와 함께 이 `note` 를 사용자에게 전한다). `step_NNNN.md` 는 그걸 또 풀로 쓰지 말고 **타이트 템플릿**으로:
  - **논의**(3 bullets: 세계를 어떻게 변형 · 무엇으로 검증 · 무엇 보존/변함)
  - **구현**(법칙 식·진입점 — 코드블록 한둘)
  - **검증**(verify 출력 *그대로 붙여넣기* + 캡처 이미지 참조 1줄)
  - **다음**(한 줄: 무슨 의미를 남겼고 다음 작업으로 어떻게 연결)
  - 길게 풀 가치가 있는 *발견·정직한 한계*만 추가(나머지 산문은 viewer note 가 집).
- `STATE.md` 갱신 — **바뀐 절만 Edit(전체 Write 금지)·각 절은 짧게 유지·닫은 step 산문을 STATE 에 쌓지 말 것**(긴 설명·수치·한계는 `step_NNNN.md`·viewer note 가 집). 절 구성과 갱신 규칙:
  - **§1 NOW**: 지금 위치 한두 줄로 *교체*(append 아님).
  - **§2 트랙별 상태(4 기획서: SW·TW·M·U)**: 해당 로드맵 테이블의 **상태 칸만** 갱신 — 단락/문단 추가 금지.
  - **§3 나아갈 방향**: *현 단계 → 다음 중간 목표* 만(짧게). **방금 닫은 step 의 writeup 을 여기 적지 않는다** — 그건 §6·step 문서 몫. 방향이 바뀌면 여기서 교체.
  - **§4 좌표 / §5 격차**: §4 는 거의 불변. §5 는 *새로 생기거나 해소된 열린 결정*만 반영 — per-step 한계 나열 금지.
  - **§6 시리즈 인덱스**: **진짜 한 줄** append — `(트랙) 법칙/장면명 — 핵심 한 문장`. step 번호 순서 유지·수치/한계는 step 문서가 집.
- 닫은 `steps/step_NNNN/` 폴더(문서·verify·capture)는 이후 **불변** — **단, 버그 수정은 예외**(아래). (불변이라 *과거* capture.js 를 새 헬퍼로 소급 리팩터링하지 않는다.)

### 버그 수정 예외 — 닫은 step 도 *버그 한정* 수정 가능

"닫은 step 불변"은 **가법 확장**(새 법칙=새 step)에만 적용된다. **버그(수치 발산·보존 위배·잘못된 기대값 등)는 새 step 으로 우회하지 않고 *기존(닫은) step* 의 코드·verify·문서를 직접 수정한다.** 이후 같은 상황도 동일. 절차: ① 해당 step 문서에 「버그 수정」 노트(무엇이 왜 틀렸나) ② verify 를 올바른 기대값으로 교정 + 가능하면 영구 회귀 가드 추가 ③ **닫기 전 전 step verify 재실행 → 회귀 0** ④ `STATE.md` 격차/인덱스 갱신. 권위 문서: `HTJ/CLAUDE.md` 「버그 수정 정책」. (선례: step_0012 "에너지 소멸"=advect CFL 폭주 → CFL 서브스텝 가드 + step_0008 verify 교정.)

## 5. 닫기 체크리스트

1. 이 step verify PASS + 이전 step verify 전부 재실행 PASS (회귀 0) — 한 묶음 명령으로(아래)
2. **캡처 확보**(`node tools/htj-render-capture.js NNNN` — `viewer/scenes/step_NNNN.js` 시나리오 1벌에서 PNG) + 화면이 verify 가설과 일치(AI 눈 검증). *viewer.html 갤러리 등록·check-viewer 는 폐기 — 안 한다*(§2).
3. `step_NNNN.md` = 타이트 템플릿(논의 3 bullets · 구현 · verify 출력 붙여넣기 · 캡처 참조 · 다음 1줄) — 긴 설명 중복 금지(§4)
4. `STATE.md` §1~6 Edit (바뀐 절만 — §3 방향에 닫은 step writeup 금지·§6 은 한 줄)
5. git: (로컬) `main` 에 commit·push / (원격) 지정 브랜치 규칙

> **닫기 검증 한 묶음**(복붙): `node steps/step_NNNN/verify.js && for d in steps/step_*/; do node "$d/verify.js" >/dev/null 2>&1 || echo "REGRESSION $d"; done && echo OK`

## 금지 사항 (비용 함정)

- 검증 없는 step 을 닫지 않는다. (단 *적정* 검증 — 고정 6종을 채우려 늘리지 말 것. §3a)
- 전 step verify 재실행(회귀 0)은 절대 생략 안 한다 — 이건 알맹이.
- 옛 step 문서를 *습관적으로* 통째로 훑지 않는다 — STATE 가 SSOT. (단, 이번 step 이 특정 과거 법칙·발견에 직접 의존하면 그 step 문서는 짚어 읽는다.)
- verify 를 다른 step 에 의존시키지 않는다 — 순수·독립.
- **법칙 step** 에 법칙을 여러 개 욱여넣지 않는다 — 가장 단순한 단위 하나. (단 **조립 step** 은 부품 여럿을 한 무대로 묶어도 된다 — §1.)
- 긴 설명을 step 문서 *와* viewer note 양쪽에 풀로 쓰지 않는다 — note 가 집(§4).
- per-step `capture.js` 를 새로 짜지 않는다 — 장면은 `viewer/scenes/step_NNNN.js` 시나리오 1벌, PNG 는 범용 러너 `tools/htj-render-capture.js`(내부 `tools/htj-capture.js`)가 뽑는다(§2·§3b). verify 의 보존·결정론·항등도 손으로 다시 안 짠다 — `tools/htj-verify-lib.js` 공용 가드(§3a).
- `engine/`(세계) 안에 확인용(렌더·캡처·DOM) 코드를 넣지 않는다 — 세계는 viewer 없이도 돌아야 한다.
- **`engine/` 에 타입 전용 처리를 넣지 않는다** — 위 **⛔ 절대 원칙** 참조(`"지형"·"바다"·"퇴적"` 같은 특정 타입을 아는 함수·분기 금지·모양은 DNA+제너릭 렌더가 발현). 새 step 마다 자문. (위반 선례: `terrainSurface`·`smooth` 0065~0067·되돌림.)
