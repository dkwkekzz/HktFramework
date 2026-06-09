# TESTBED — 단일 라이브 모니터·검증 환경 설계

> step 마다 손수 만들던 `step-NNNN.html`(시각 관찰 셸, 0004~0010 7개)**과** 손으로 그린 `SYSTEM.html`(정적 전체도)을
> **한 개의 라이브 모니터**로 합친다. 현재 만들어진 서버 인스턴스를 *실제로 띄워* 시각적으로 관찰·제어하고,
> 서버 간 통신·각 동작이 제대로 되는지 라이브로 확인한다. 검증 권위는 여전히 headless `verify.js`.
> 방법론·규칙은 [CLAUDE.md](CLAUDE.md) · 현재 위치(SSOT)는 [STATE.md](STATE.md) · 큰 그림은 [SPINE.md](SPINE.md).
>
> **이 문서의 위상**: 설계 결정 문서(거의 불변 참조). 실제 러너·모니터는 본 설계 채택 후 별 작업으로 구현한다.

---

## 1. 문제 — 그림이 둘로 갈라져 있고, 둘 다 손작업이며, 실제 작동과 괴리된다

- `step-NNNN.html`(0004~0010, 7장) — step 별 관찰 셸. **인프로세스 `run()` 만 그린다**(실 멀티프로세스가 아니라 단일 프로세스 시늉). 검증(4기둥)은 안 하고, 어느 step 인지 알아야 열 수 있으며, step 마다 손으로 만든다.
- `SYSTEM.html` — 손으로 그린 *정적* SVG 전체도(토폴로지·서버 상태색·6계층표). **실제 도는 인스턴스가 아니라 사람이 그린 그림** — step 마다 손으로 색을 고친다. 진짜 작동과 어긋날 수 있다(그림은 거짓말할 수 있다).
- 진짜 검증 권위는 흩어진 `step-NNNN/verify.js`(`node verify.js all`). "현재 상태 한 줄 검증·관찰"의 단일 진입점이 없다.

결과: **정적 그림 8장(7+1)을 손으로 그리는데, 정작 "실 인스턴스가 서로 통신하며 제대로 도는가"를 라이브로 보여주지 못한다.**

---

## 2. 원하는 모습 — 하나의 라이브 모니터

현재 만들어진 서버 인스턴스를 **실제로 생성**하고, 그것을 **monitor 형태로 시각 관찰·제어**하며, **서버 간 통신·각 동작이 제대로 되는지 라이브로** 확인한다. 그러면 그 화면은 *작동하는 시스템 전체도*일 수밖에 없다 — **그러므로 `SYSTEM.html` 은 별도로 둘 이유가 없다(흡수·폐기).** step-NNNN.html 도 마찬가지(라이브가 인프로세스 정지 그림을 대체).

> 즉 단일 뷰 하나가 **세 역할을 합친다**: ① step 별 관찰 셸(step-NNNN.html) ② 전체 구조도(SYSTEM.html) ③ 실 인스턴스 라이브 모니터·제어(신규).

핵심 가르기(불변): **검증(pass/fail)은 headless `verify.js` 가 권위**, **모니터는 같은 net-core 를 띄워 그것을 *눈으로* 보고 *손으로* 흔드는 층**이다. 둘은 *같은 코어*를 공유하므로 "보는 것 = 검증되는 것"(괴리 0).

---

## 3. 핵심 판단 두 가지

### 3-1. CI(GitHub Actions)는 필요 없다

`verify.js` 는 이미 headless·이 원격 환경에서 `node` 한 줄로 돈다(제1 운영 제약 충족). step 은 어차피 닫을 때 verify 를 통과시켜야 닫힌다(루프 §4) — 게이트가 절차에 내장. Actions 는 같은 게이트를 한 번 더 거는 중복 의식이라 넣지 않는다. (후일 `node HktInfra/run.js` 한 줄 workflow 로 사소하게 붙일 수 있음 — 핵심 아님.)

### 3-2. 모니터는 "그냥 여는 html" 이 아니라 served 백엔드다 — 그리고 그래도 괜찮다

"인스턴스를 *생성*하고 *제어*하며 서버 간 IPC 통신을 라이브로 본다"는 건 **정적 html 로 물리적으로 불가능**하다. 실 멀티프로세스(`runMulti` = child_process)는 Node 만 띄울 수 있고(브라우저는 인프로세스 시늉만 — 기존 step-NNNN.html 의 한계), 제어 명령을 받아 프로세스를 흔들려면 **백엔드가 클러스터를 소유**해야 한다. 그래서 모니터는 **Node 백엔드 + 브라우저 얇은 클라(WS)** 형태의 *served 앱*이다.

이는 기존 "시각 관찰 셸 규약 ⒝(빌드/서버 0, html 그냥 열기)"를 *의도적으로* 넘어선다. **불변은 깨지 않는다**:

- **headless·원격 검증 불변** = *검증*에 관한 규약. 검증은 여전히 `verify.js`(headless, 이 환경에서 한 줄). 모니터는 *관찰/제어* 층이지 pass/fail 권위가 아니다.
- 모니터 백엔드도 이 원격 환경(Node 컨테이너)에서 돈다 — 로컬 UE/GUI 의존 0. 원격 제1 제약 유지.
- 모니터와 verify 는 **같은 net-core 인스턴스**를 쓴다(아래 §5-4) — 둘째 구현을 만들지 않으므로 "보는 것 ≠ 검증되는 것" 괴리가 없다.
- 데이터 층 환경 무관(규약 ⒜)은 보존: 모니터가 그리는 상태·메시지는 전부 net-core 에서 나오며 headless 재현 가능.

---

## 4. 산출물 ① — `HktInfra/run.js` (단일 진입점)

흩어진 `step-NNNN/verify.js` 와 모니터 앞에 서는 얇은 오케스트레이터. **살아있다 = 손수정 없이 step 마다 자동으로 최신을 가리킨다.**

### 현재 step 자동 탐지

`step-*/` 디렉토리 중 **최대 번호**를 현재로 본다(파일시스템 사실 — 결정적). 닫힌 step 만 디렉토리가 존재하므로 STATE.md §1 NOW 와 어긋날 일이 없다(어긋나면 STATE 가 권위 — 경고 출력).

### 모드

| 명령 | 동작 | 성격 |
|---|---|---|
| `node run.js` (기본) | 현재 step `verify.js all` 실행·집계·종료코드 전파 | headless 검증(권위) |
| `node run.js spine` | step-0002..NNNN 각자 `verify.js reg`(+0001 `det`) 순차 — 전 사슬 비트동일 한 줄 요약 | headless 회귀(신규 가치) |
| `node run.js <NNNN> [mode]` | 특정 step·모드 지정 실행(디버깅) | headless |
| **`node run.js monitor [port]`** | **현재 step 토폴로지의 실 인스턴스를 띄우고 라이브 모니터·제어 UI 를 serve** (§5) | 시각 관찰·제어 |

`monitor` 외 모드는 §3-1 대로 headless 게이트. `monitor` 만 백엔드를 띄운다.

---

## 5. 산출물 ② — 라이브 모니터 (`step-NNNN.html` + `SYSTEM.html` 통합 대체)

`node run.js monitor` → 백엔드가 **현재 step 의 net-core 토폴로지로 실 인스턴스를 생성**하고, 브라우저 UI 에 라이브로 스트림한다.

### 5-1. 무엇을 띄우나 — 현재 만들어진 서버 인스턴스 (자동)

현재 step 의 `net-core.js` 가 만드는 토폴로지를 그대로 인스턴스화한다(step-0010 기준: login · gateway · registry · zone1/2 · 추종자 zone1f/2f · orchestrator · broker, 각 child_process). **무엇이 떠 있는가는 step 마다 자동으로 바뀐다** — 모니터가 토폴로지를 하드코딩하지 않고 net-core 에서 읽는다. 기본은 `runMulti`(실 멀티프로세스), 옵션으로 인프로세스 `run`(가벼운 디버깅).

### 5-2. 무엇을 보나 — 라이브 전체도 (SYSTEM.html 흡수)

SYSTEM.html 이 *손으로* 그리던 것을 *실 상태에서 자동으로* 그린다:

- **토폴로지** — 박스 = 실 인스턴스, 선 = 실제 오간 메시지(굵기 = 메시지 수). 정적 SVG → 라이브 그래프.
- **서버별 상태색** — 작동/스텁/사망/승격을 *진짜 런타임 상태*로 색칠(그림이 아니라 사실). 죽은 존 ✝·승격 추종자 ▲ 가 라이브로 뜬다.
- **6계층 위치 + 진행** — STATE §5 의 계층표를 현재 인스턴스에 매핑해 표시.
- **동작 검증 시각화** — 통신·각 동작이 "제대로 되는가"를 라이브로: per-tick 메시지 흐름, 권위 소유자=1(공백·중복 경보), desync(겹친 뷰 일치), AOI 가시 집합, 핸드오프/failover 이벤트 타임라인. 즉 verify 4기둥이 *수치*로 증명하는 것을 모니터가 *움직임*으로 보여준다(같은 net-core).

### 5-3. 무엇을 제어하나

기존 net-core 의 파라미터·intent·이벤트 seam 에 그대로 매핑(새 제어 표면 최소):

- **tick 구동** — play / pause / step(1 tick) / 속도. broker lockstep 을 UI 에서 한 박자씩.
- **인스턴스 흔들기** — 존 kill(`deathTick` 의 수동판) → failover 가 실제로 도는지 눈으로. (후일 진짜 `child.kill()`.)
- **부하·intent 주입** — 클라 이동/입장/퇴장 intent 를 손으로 주입해 AOI·핸드오프 관찰.
- **전송 노브** — `transport`(지연·손실·재정렬·redundancy)를 슬라이더로 → 열화 아래 복원·권위 보존 라이브 관찰.

### 5-4. 아키텍처 — 같은 net-core, 얇은 클라

```
브라우저(얇은 클라)  ──WS── │  Node 백엔드 (run.js monitor)
  · 토폴로지/상태/흐름 렌더    │    · 현재 step net-core 소유(run / runMulti = 실 인스턴스)
  · 제어 명령 전송            │    · broker tick 구동·이벤트 tap → WS push
  · (재사용) panel.js compute │    · 제어 명령 → net-core 파라미터/intent/이벤트 seam
```

- 백엔드는 **verify 가 쓰는 바로 그 net-core** 를 require 한다(둘째 구현 0 → 보는 것 = 검증되는 것).
- 브라우저는 상태를 *받아 그리기*만(렌더는 기존 `engine/panel-kit.js` + `step-NNNN/panel.js` 의 `compute()` 재사용 — 데이터 층 환경 무관 규약 ⒜ 보존).
- net-core 무수정이 원칙. 모니터가 필요로 하는 *관찰 탭*(메시지 로그·상태 스냅샷)은 net-core 가 이미 노출(`net.log`·`zones`·`clients`·`totals`)하므로 백엔드가 읽기만 한다.

### 5-5. 결정론 보존 — 관찰 세션 = 재현 가능한 시나리오

손으로 흔든 제어(kill·intent·노브 변경)는 **타임스탬프된 명령 시나리오로 기록**된다. 이 시나리오는 ⒜ 시드와 함께 *재생*되고 ⒝ 그대로 `verify` 에 투입돼 headless 재현된다. 즉 모니터에서 "어? 이 상황 이상한데" 를 발견하면 → 시나리오를 export → verify 회귀 케이스로 굳힌다. 인터랙티브 관찰과 결정론 검증이 한 고리로 닫힌다(`Math.random` 0 유지 — 명령도 로그의 일부).

---

## 6. `SYSTEM.html` · `step-NNNN.html` 폐기 — 역할 이전

| 파일 | 기존 역할 | 본 설계 후 |
|---|---|---|
| `step-NNNN.html` (0004~0010) | step 별 관찰 셸(인프로세스 정지 그림) | **폐기** — 라이브 모니터가 대체. 기존 7장은 그 step 의 동결 기록으로 잔존(더 안 만듦). |
| `SYSTEM.html` | 손으로 그린 정적 전체도(토폴로지·상태색·6계층) | **폐기(흡수)** — 모니터 §5-2 가 *실 상태에서 자동으로* 같은 그림을 라이브로 그린다. |
| (신규) 라이브 모니터 | — | step-NNNN.html + SYSTEM.html + 실 인스턴스 제어를 합친 단일 뷰 |

> "그림이 거짓말할 수 있다" 문제 해소: SYSTEM 은 손으로 그려 실제와 어긋날 수 있었지만, 모니터는 *실 인스턴스의 런타임 상태*를 그리므로 항상 사실이다.
>
> **무실행 글랜스 보존(선택)**: 실행 없이 구조를 한눈에 보고 싶을 때를 위해, 모니터가 `node run.js monitor --snapshot` 으로 *현재 라이브 상태를 정적 html 1장으로 export* 할 수 있다(SYSTEM.html 의 편의를 손갱신 없이 자동 생성으로 대체). 커밋 여부는 선택.

---

## 7. step 루프 절차 변경 (CLAUDE.md §step 루프 5·작성법)

| 단계 | 기존 | 변경 후 |
|---|---|---|
| 검증(§4) | `cd step-NNNN && node verify.js all` | `node HktInfra/run.js` + `node HktInfra/run.js spine` 둘 다 ALL OK 라야 닫는다. |
| 갱신(§5) | STATE.md + **SYSTEM.html 손갱신** + (선택) **step-NNNN.html 손작성** | STATE.md 갱신만 손작업. **SYSTEM.html 손갱신 제거**(모니터가 라이브 렌더)·**step-NNNN.html 손작성 제거**. |
| 산출물 규약(작성법) | `panel.js` + `step-NNNN.html`(선택, 권장) | `panel.js` 는 유지(헤드리스 ASCII + 모니터 렌더 재사용). **`step-NNNN.html` 항목 삭제.** |
| 관찰(필요 시) | step 별 html 열기 | `node run.js monitor` 한 줄 — 현재 step 실 인스턴스 라이브 |

채택 시 CLAUDE.md 해당 절(시각 관찰 셸 규약 ⒝·step 루프 5·작성법 산출물 목록·작업 구조 3축 표의 SYSTEM.html 행)을 위 표대로 고친다.

---

## 8. 불변 정합 체크

- **headless·원격 검증(협상 불가)** — *검증*은 여전히 `verify.js`(headless, 이 환경 한 줄). 모니터는 관찰/제어 층(권위 아님). 모니터 백엔드도 이 원격 컨테이너 Node. ✅
- **보는 것 = 검증되는 것** — 모니터와 verify 가 *같은 net-core* 사용. 둘째 구현 0(괴리 0). ✅
- **회귀 0 / frozen 동결** — run.js·모니터는 step dir 을 *읽기/실행만*. 동결 단위·복사 전진 보존. ✅
- **SSOT** — 현재 step 은 파일시스템 파생 탐지, 권위는 STATE.md. 새 진실 원천 0. ✅
- **수치 = verify 출력** — 모니터의 모든 수치·상태는 net-core/verify 에서 나옴. 자체 진실 0. ✅
- **결정론 / Math.random 0** — 제어 명령도 시드·로그의 일부로 기록·재생(§5-5). ✅
- **데이터 층 환경 무관(규약 ⒜)** — 렌더는 panel `compute()` 재사용, 데이터는 net-core. ✅
- **(의도적 예외) 시각 관찰 셸 규약 ⒝(빌드/서버 0)** — 모니터는 served 백엔드로 *대체*(실 인스턴스 제어가 정적 html 로 불가). §3-2 에서 정당화·불변 보존 명시. ⚠→ 규약 갱신 대상.

---

## 9. 점진 적용 순서 (구현 시)

1. **`HktInfra/run.js`** — `node run.js`(현재 검증) + `spine`(회귀 사슬) 두 모드 먼저. 기존 verify·step dir 무수정. → "현재 상태 한 줄 검증" 즉시 성립.
2. `node run.js spine` 으로 전 시리즈 회귀 사슬 1회 통과(기준선 확보).
3. **모니터 백엔드** — `run.js monitor`: 현재 step net-core 를 require → `run`/`runMulti` 실 인스턴스 + WS 로 상태/메시지 push(읽기 전용 라이브 뷰 먼저, 제어는 다음).
4. **모니터 UI** — 라이브 토폴로지·상태색·메시지 흐름·동작 검증 시각화(SYSTEM.html 흡수). panel-kit/panel `compute()` 재사용.
5. **제어 표면** — tick play/step·존 kill·intent 주입·transport 노브 + §5-5 시나리오 기록/재생/verify 투입.
6. CLAUDE.md 절차·규약 갱신(§7). `SYSTEM.html`·`step-0004~0010.html` 은 동결 기록으로 잔존(더 안 만듦), `--snapshot` 이 무실행 글랜스 대체.

> 1~2 만으로 headless 단일 검증이 선다. 3~4 가 "실 인스턴스 라이브 모니터(= SYSTEM 흡수)", 5 가 "제어·재현 고리". 사용자가 원한 *생성·관찰·제어·동작 확인* 은 3~5 에서 완성된다.
</content>
