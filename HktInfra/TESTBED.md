# TESTBED — 단일 검증·시각화 환경 설계

> step 마다 손수 만들던 `step-NNNN.html`(시각 관찰 셸, 0004~0010 7개)**과** 손으로 그린 `SYSTEM.html`(정적 전체도)을
> **하나로 합친다**: ① 에이전트가 *스스로 실행·검증*하는 headless 진입점(`run.js`) + ② 사람이 보는 *자기완결 시각화*(플라이트 레코더 `report.html`).
> 검증 권위는 headless 텍스트, 시각화는 같은 실행의 *녹화*. 둘 다 이 원격 환경에서 한 줄로 돈다.
> 방법론·규칙은 [CLAUDE.md](CLAUDE.md) · 현재 위치(SSOT)는 [STATE.md](STATE.md) · 큰 그림은 [SPINE.md](SPINE.md).
>
> **이 문서의 위상**: 설계 결정 문서(거의 불변 참조). 실제 러너·레코더는 본 설계 채택 후 별 작업으로 구현한다.

---

## 1. 문제 — 그림이 둘로 갈라져 있고, 둘 다 손작업이며, 실제 작동과 괴리된다

- `step-NNNN.html`(0004~0010, 7장) — step 별 관찰 셸. **인프로세스 `run()` 만 그린다**(실 멀티프로세스가 아니라 단일 프로세스 시늉). 검증(4기둥)은 안 하고, 어느 step 인지 알아야 열 수 있으며, step 마다 손으로 만든다.
- `SYSTEM.html` — 손으로 그린 *정적* SVG 전체도(토폴로지·서버 상태색·6계층표). **실제 도는 인스턴스가 아니라 사람이 그린 그림** — step 마다 손으로 색을 고친다. 진짜 작동과 어긋날 수 있다(그림은 거짓말할 수 있다).
- 진짜 검증 권위는 흩어진 `step-NNNN/verify.js`(`node verify.js all`). "현재 상태 한 줄 검증·관찰"의 단일 진입점이 없다.

결과: **정적 그림 8장(7+1)을 손으로 그리는데, 정작 "실 인스턴스가 서로 통신하며 제대로 도는가"를 라이브로 보여주지 못한다.**

---

## 2. 원하는 모습 — 단일 뷰가 세 역할을 합친다

현재 만들어진 서버 인스턴스를 **실제로 생성**하고, 그것을 **시각적으로 관찰·제어**하며, **서버 간 통신·각 동작이 제대로 되는지** 확인한다. 그러면 그 화면은 *작동하는 시스템 전체도*일 수밖에 없다 — **그러므로 `SYSTEM.html` 은 별도로 둘 이유가 없다(흡수·폐기).** step-NNNN.html 도 마찬가지.

> 단일 뷰 하나가 세 역할을 합친다: ① step 별 관찰 셸(step-NNNN.html) ② 전체 구조도(SYSTEM.html) ③ 실 인스턴스 시각화(신규).

---

## 3. 핵심 판단 셋

### 3-1. CI(GitHub Actions)는 필요 없다

`verify.js` 는 이미 headless·이 원격 환경에서 `node` 한 줄로 돈다(제1 운영 제약 충족). step 은 어차피 닫을 때 verify 를 통과시켜야 닫힌다(루프 §4) — 게이트가 절차에 내장. Actions 는 같은 게이트를 한 번 더 거는 중복 의식이라 넣지 않는다. (후일 `node run.js` 한 줄 workflow 로 사소하게 붙일 수 있음 — 핵심 아님.)

### 3-2. 에이전트 자율 검증 ≠ 사람 시각화 — 둘을 분리한다 (이 설계의 척추)

같은 headless 실행을 **두 소비자**가 나눠 쓴다. 출력만 갈린다.

```
에이전트(원격, 자율)              사람(시각화)
  node run.js  ─────────┐          report.html
  → stdout 수치 읽기     │          → 타임라인 스크럽
  → "ALL OK / FAIL"     │
  → exit 0/1 로 판정     │          (에이전트는 이걸 "볼" 필요 없다)
  → 자율로 다음 결정     ┘
```

| 소비자 | 보는 것 | 자율성 |
|---|---|---|
| **에이전트** | stdout 수치 + exit code | **완전 자율** — 코드 작성 → `node run.js` 검증 → ALL OK 면 step 닫기 → `spine` 회귀까지 사람 0 |
| **사람** | `report.html` 타임라인 | 에이전트가 *생성·전달*(파일 전송), 사람은 열기만 |

> **실증(2026-06, step-0010)**: 에이전트가 이 원격 컨테이너에서 `node step-0010/verify.js all` 을 사람 개입 0 으로 실행 → 실 인스턴스 **9개 프로세스**(login·gateway·registry·zone1/2·추종자·orch·broker) 기동·IPC 1162건·멀티=인프로세스 비트 동일·승격 1·**desync 0**·누설 0·`결과: ALL OK`·exit 0. **에이전트 자율 실행·검증은 이미 성립**한다 — 본 설계는 그 위에 사람용 시각화를 *얹을 뿐* 자율성을 줄이지 않는다.

핵심 귀결: **검증 권위는 headless 텍스트**(에이전트가 읽는 수치·exit code). 시각화(report.html)는 *사람용 창*이지 pass/fail 권위가 아니다. 에이전트는 같은 trace 데이터(JSON)를 *프로그램적으로 단언*하면 되고 — 그게 곧 verify 다.

### 3-3. 라이브 제어는 보류 — "녹화(레코더)" 가 셋을 동시에 만족한다

"인스턴스를 *라이브로* 흔든다(실시간 노브)"는 백엔드(실 프로세스 소유)+포트 포워딩/터널을 요구해 **"간단·원격" 과 상충**한다(정적 html 로는 물리적으로 불가). 그래서 *라이브 제어* 와 *시각화* 를 분리한다: **실 멀티프로세스 실행을 headless 로 *녹화*해, 타임라인 플레이어가 든 자기완결 html 1장으로 떨군다.** 제어는 라이브 노브가 아니라 *시나리오 파일*(§5-3)로 — 재현 가능하고, 그대로 verify 에 투입된다.

| 요구 | 레코더가 만족하는 법 |
|---|---|
| **간단 실행** | `node run.js report` 한 줄 → 파일 1장. 서버·포트·터널·빌드 0 |
| **원격 테스트** | 데이터 생성은 이 컨테이너에서 headless(verify 와 동일). 산출물은 *파일* — 다운로드/커밋/첨부로 어디서나 열림 |
| **충분한 시각화** | 실 멀티프로세스의 *스크럽 가능한* 그래픽 타임라인 — 기존 step-NNNN.html(인프로세스 정지 그림)보다 엄격히 상위 |

> 라이브 WS 대시보드(실시간 poking)는 *진짜 실시간 제어가 꼭 필요할 때만* 꺼내는 보류 카드. 기본은 레코더.

---

## 4. 산출물 ① — `HktInfra/run.js` (단일 진입점, 에이전트 자율 검증의 본체)

흩어진 `step-NNNN/verify.js` 앞에 서는 얇은 오케스트레이터. **살아있다 = 손수정 없이 step 마다 자동으로 최신을 가리킨다.**

### 현재 step 자동 탐지

`step-*/` 디렉토리 중 **최대 번호**를 현재로 본다(파일시스템 사실 — 결정적). 닫힌 step 만 디렉토리가 존재하므로 STATE.md §1 NOW 와 어긋날 일이 없다(어긋나면 STATE 가 권위 — 경고 출력).

### 모드

| 명령 | 동작 | 소비자 |
|---|---|---|
| `node run.js` (기본) | 현재 step `verify.js all` 실행·집계·**exit code 전파** | 에이전트(검증 권위) |
| `node run.js spine` | step-0002..NNNN 각자 `verify.js reg`(+0001 `det`) 순차 — 전 사슬 비트동일 한 줄 요약 | 에이전트(회귀) |
| `node run.js <NNNN> [mode]` | 특정 step·모드 지정 실행(디버깅) | 에이전트 |
| **`node run.js report [scenario]`** | 현재 step `runMulti`(실 멀티프로세스) 를 headless 녹화 → 자기완결 `report.html` 생성 (§5) | 사람(시각화) |

`report` 외 모드는 stdout 텍스트 + exit code — 에이전트가 읽고 판정. `report` 만 html 산출물을 만든다(그래도 생성은 headless).

---

## 5. 산출물 ② — 플라이트 레코더 (`report.html`, step-NNNN.html + SYSTEM.html 통합 대체)

```
node run.js report [scenario]
   │  ① 현재 step net-core 를 headless 로 돈다 — 풍부한 per-tick 상태는 inproc run()+onTick 탭에서,
   │     "진짜 멀티프로세스로 돌았다"는 runMulti 증명(pid·IPC 건수·logDigest 일치)을 함께 박는다 (→§10-1)
   │  ② tick 마다 trace 수집: 메시지(from>to)·엔티티·권위 소유자·seen 집합·이벤트(death/promote/handoff)
   │     — net.log·zones·clients·totals 는 이미 노출. per-tick 경계만 run 루프에 onTick 콜백 1회 추가(no-op 기본 → reg 0 불변, 닫힌 step 무수정)
   └─ ③ trace 를 JSON 으로 html 템플릿에 *인라인 임베드* → HktInfra/report.html (외부 의존·fetch 0 — 그냥 열기)
```

### 5-1. 무엇을 띄우나 — 현재 만들어진 서버 인스턴스 (자동)

현재 step `net-core.js` 의 토폴로지를 그대로 인스턴스화(step-0010 기준 9 프로세스). **무엇이 떠 있는가는 step 마다 자동으로 바뀐다** — 레코더가 토폴로지를 하드코딩하지 않고 net-core 에서 읽는다.

### 5-2. 무엇을 보나 — 라이브 전체도 (SYSTEM.html 흡수)

SYSTEM.html 이 *손으로* 그리던 것을 *실 녹화에서 자동으로* 그린다. **타임라인 스크러버**(play/pause/step·tick 앞뒤로 — 라이브보다 검증에 유리, 되감기 가능) 위에:

- **토폴로지** — 박스=실 인스턴스(trace 에서 자동), 선=그 tick 실제 오간 메시지(굵기=양). 정적 SVG → 스크럽 그래프
- **서버별 상태색** — 작동/스텁/사망✝/승격▲ 를 *런타임 사실*로(그림이 아니라 trace)
- **6계층 위치 + 진행** — STATE §5 계층표를 현재 인스턴스에 매핑
- **동작 검증 시각화** — per-tick 메시지 흐름·권위 소유자=1(공백/중복 경보)·desync(겹친 뷰 일치)·AOI 가시집합·핸드오프/failover 이벤트 마커. verify 4기둥이 *수치*로 증명하는 것을 *움직임*으로

렌더는 기존 `engine/panel-kit.js` + `step-NNNN/panel.js` 의 `compute()` 재사용(데이터 층 환경 무관 규약 ⒜ 보존).

### 5-3. 제어 — 라이브 노브 대신 시나리오 파일

kill·intent 주입·전송 노브를 **작은 시나리오 파일**로:

```js
// scenario.json — 시드 + 타임드 명령
{ seed: 42, ticks: 80, transport: { loss: 0.2 },
  cmds: [ { tick: 40, kill: "zone1" },
          { tick: 10, inject: { client: 3, move: [5, 2] } } ] }
```

`node run.js report scenario.json` → 재녹화. 라이브보다 **재현 가능**·원격 친화적이며, 결정적 이점: **같은 시나리오를 그대로 `verify` 에 투입** → 레코더와 검증 게이트가 *같은 입력* 공유. 레코더에서 "이거 이상한데" 발견 → 시나리오 export → verify 회귀 케이스로 굳힘(인터랙티브 관찰↔headless 검증 한 고리). 명령도 시드 로그의 일부라 `Math.random` 0·결정론 보존.

### 5-4. 에이전트도 trace 를 직접 단언한다

report.html 은 *사람*용 창이지만, 같은 trace(JSON)에 대해 에이전트는 *프로그램적으로* 단언할 수 있다(권위=1 매 tick·desync 0·핸드오프 N tick 내 완료…). 즉 trace 는 사람에겐 그림, 에이전트에겐 verify 입력 — 한 데이터, 두 소비.

---

## 6. `SYSTEM.html` · `step-NNNN.html` 폐기 — 역할 이전

**기존 html 8장(step-0004~0010.html 7장 + SYSTEM.html)은 전부 삭제했다**(git 이력엔 남음). 동결 기록으로도 남기지 않는다 — 레코더가 같은 것을 *실 녹화에서 더 정확히* 재생하므로 손그림을 보존할 이유가 없다.

| 파일 | 기존 역할 | 본 설계 후 |
|---|---|---|
| `step-NNNN.html` (0004~0010) | step 별 관찰 셸(인프로세스 정지 그림) | **삭제** — 레코더가 대체. 더 안 만든다. |
| `SYSTEM.html` | 손으로 그린 정적 전체도 | **삭제(흡수)** — 레코더 §5-2 가 *실 녹화에서 자동으로* 같은 그림을 그린다(손갱신 0). |
| (신규) `report.html` | — | step-NNNN.html + SYSTEM.html 을 합친 자기완결 시각화 1장(`run.js report` 생성, gitignore 권장) |

> "그림이 거짓말할 수 있다" 해소: SYSTEM 은 손그림이라 실제와 어긋날 수 있었지만, 레코더는 *실 실행의 trace* 라 항상 사실이다.
> 닫힌 step `.md` 가 자기 html 을 링크하던 줄은 죽은 링크가 되지만, 닫은 step 문서는 불변이라 손대지 않는다(역사 기록).

---

## 7. step 루프 절차 변경 (CLAUDE.md §step 루프 5·작성법)

| 단계 | 기존 | 변경 후 |
|---|---|---|
| 검증(§4) | `cd step-NNNN && node verify.js all` | `node run.js` + `node run.js spine` 둘 다 ALL OK 라야 닫는다(에이전트 자율) |
| 갱신(§5) | STATE.md + **SYSTEM.html 손갱신** + (선택)**step-NNNN.html 손작성** | STATE.md 갱신만 손작업. **SYSTEM.html·step-NNNN.html 손작업 둘 다 제거** |
| 산출물 규약 | `panel.js` + `step-NNNN.html`(선택) | `panel.js` 유지(헤드리스 ASCII + 레코더 렌더 재사용). **`step-NNNN.html` 항목 삭제** |
| 시각 확인(필요 시) | step 별 html 열기 | `node run.js report` → `report.html` 한 장(에이전트가 생성·전달 가능) |

채택 시 CLAUDE.md 해당 절(시각 관찰 셸 규약·step 루프 5·작성법 산출물 목록·작업 구조 3축 표의 SYSTEM.html 행)을 위 표대로 고친다.

---

## 8. 불변 정합 체크

- **headless·원격 검증(협상 불가)** — *검증*은 `run.js`/`verify.js`(headless 텍스트, exit code). 에이전트 자율(§3-2 실증). report 생성도 headless. ✅
- **보는 것 = 검증되는 것** — 레코더와 verify 가 *같은 net-core* 실행. 둘째 구현 0(괴리 0). ✅
- **빌드/서버 0, 그냥 열기(규약 ⒝)** — 레코더는 *headless 생성된 자기완결 html*(인라인 데이터·fetch 0). 라이브 WS 백엔드 불요 → 규약 *유지*(앞선 served-backend 안을 폐기한 이유). ✅
- **회귀 0 / frozen 동결** — run.js·레코더는 step dir 을 읽기/실행만. 동결 단위·복사 전진 보존. ✅
- **SSOT** — 현재 step 은 파일시스템 파생 탐지, 권위는 STATE.md. 새 진실 원천 0. ✅
- **수치 = verify 출력** — 레코더의 모든 수치·상태는 trace(net-core)에서. 자체 진실 0. ✅
- **결정론 / Math.random 0** — 시나리오 명령도 시드 로그의 일부로 기록·재생(§5-3). ✅
- **데이터 층 환경 무관(규약 ⒜)** — 렌더는 panel `compute()` 재사용, 데이터는 net-core. ✅

---

## 9. 점진 적용 순서 (구현 시)

1. **`HktInfra/run.js`** — `node run.js`(현재 검증) + `spine`(회귀 사슬). 기존 verify·step dir 무수정. → 에이전트 자율 "현재 상태 한 줄 검증" 즉시 성립.
2. `node run.js spine` 으로 전 시리즈 회귀 사슬 1회 통과(기준선 확보).
3. **레코더 코어** — `run.js report`: 현재 step net-core 를 require → `runMulti` 녹화(trace 수집) → JSON 임베드 html 생성. *읽기 전용 타임라인 뷰 먼저*.
4. **레코더 UI** — 스크럽 가능한 토폴로지·상태색·메시지 흐름·동작 검증 패널(SYSTEM.html 흡수). panel-kit/panel `compute()` 재사용.
5. **시나리오 제어** — `scenario.json`(시드+타임드 kill/inject/노브) → 재녹화 + 그대로 verify 투입(§5-3).
6. CLAUDE.md 절차·규약 갱신(§7) — *완료*(기존 html 8장 삭제 + step 마다 html 금지·testbed 집중 명시). `report.html` 은 생성물이라 gitignore.

> 1~2 = 에이전트 자율 headless 검증(이미 토대 존재, §3-2 실증). 3~4 = 사람용 시각화(SYSTEM 흡수). 5 = 제어·재현 고리. 라이브 WS 는 보류 카드.

---

## 10. 구현 세부 — 이번 점검에서 보강한 설계 결정

설계 본체(§1~9)는 *무엇을·왜*를 정한다. 구현에 들어가면 막히는 *어떻게* 여섯 가지를 여기서 못 박는다.

### 10-1. 타임라인 데이터 출처 — inproc 상태 + 멀티프로세스 증명을 *분리* (§5 정정)

멀티프로세스(`runMulti`)는 상태가 자식 프로세스 안에 있어 부모가 per-tick 전체 상태를 못 본다(verify 도 최종 상태 + 메시지 로그만 비교). 그러므로:

- **풍부한 per-tick 상태**(엔티티 위치·권위 소유자·seen·desync)는 **inproc `run()`** 에서 딴다 — 단일 프로세스라 매 tick 전체 상태가 즉시 관찰 가능.
- 이를 위해 `run`/`runMulti` 가 옵션 콜백 **`onTick(t, state)`** 를 받게 한다. **미제공 시 no-op → reg 0 불변**(동작 무변경). 이 훅은 net-core *복사 전진 템플릿*에 1회 들어가 현재/이후 step 이 자동 보유한다(닫힌 step 은 동결 — 소급 안 함, 과거는 최종 상태/로그만).
- **"진짜 멀티프로세스로 돌았다"** 는 `runMulti` 증명(9 pid·IPC 건수·logDigest 일치)을 별 패널로 박는다. verify 가 이미 `runMulti ≡ inproc` 비트 동일을 보장하므로, **inproc 타임라인은 멀티프로세스 동작의 충실한 표현**이다.
- **메시지 흐름** 레이어는 `runMulti` 의 broker.net.log(실 멀티프로세스 메시지)로 그려도 된다(둘은 bit-equal 이라 일관). tick 경계는 onTick 기준.

### 10-2. trace 스키마 + 크기 예산

- 스키마(초안): `{ meta:{step,seed,scenario,pids,ipc}, layers:{addr→layer}, ticks:[ {t, msgs:[{from,to,kind}], ents:[{id,x,y,owner}], desync, events:[…]} ] }`.
- 크기: 80 tick × 수백 메시지 → 수백 KB~수 MB. 임베드 가능하나 ⒜ payload 는 `kind`/요약만(전문 아님) ⒝ 기본 tick 상한(예: 120) ⒞ 넘으면 메시지 샘플링.
- **report 는 결정적**(같은 시드·시나리오 → 데이터 byte-동일) — 공유·diff 가능. (UI 셸은 고정 템플릿이라 통째로도 결정적.)

### 10-3. 브라우저 인터랙티브 재실행 — "제어" 의 절반을 백엔드 없이 복원

net-core 는 dual-mode(브라우저 전역)다. 이를 살려 report.html 이 net-core 를 *임베드*하면:

- **싼 노브(반경·전송 손실·redundancy 등 순수 파라미터)는 브라우저에서 inproc `run()` 을 즉석 재실행** — 슬라이더가 *진짜 다시 돌린다*(옛 step html 슬라이더가 하던 것, 백엔드 0).
- **구조적 변경(kill·인스턴스 수·멀티프로세스)만** 시나리오 재녹화(§5-3)가 필요.
- 즉 제어 = ⒜ 브라우저 즉석(싼 파라미터) + ⒝ 시나리오 재녹화(구조)로 2분. 사용자가 원한 "제어" 가 라이브 WS 없이 상당 부분 복원된다.

### 10-4. 시나리오 저장 위치 + verify 브리지 (§5-3 의 "그대로 verify 투입" 실체화)

- 시나리오는 **`HktInfra/scenarios/*.json`(커밋)**. "이상 발견 → export → 회귀 케이스" 가 성립하려면 검증 게이트가 시나리오를 먹어야 한다.
- 초안은 *시드 인자만 받는 verify 에 `scenario` 모드를 추가*하자였으나 — **verify.js 는 동결 step 안이라 수정 불가**(회귀 0·복사 전진 불변). 그래서 *라이브 단일 진입점* `run.js` 에 **`scenario <file>` 모드**를 두고, `report` 와 **같은 `loadScenario` 번역기**(seed·ticks·transport·cmds → `run/runMulti` 파라미터)를 공유한다 — "중복 0" 목표 그대로 충족. 이는 §5-4("에이전트도 trace 를 직접 단언, 한 데이터·두 소비")의 직접 실현이다: `run.js scenario` 가 trace 4기둥(권위=1·desync 0·kill→승격·멀티프로세스 비트 동일)을 *프로그램적으로* 단언·exit 0/1.
- `cmds` 의 기존 seam 매핑: `kill@t` → `deathTick/killZone/failover`(✅). `inject`(클라 intent 주입) → `opts.inject`(✅ — 0012 동결엔 없어 대기였다가, onTick(§10-1) 선례처럼 **step-0016 net-core 복사 전진에서 심음**. run.js 가 `NET.SUPPORTS.inject` 로 기능 탐지해 자동 소비 — 미지원 과거 step 은 경고 후 무시).

### 10-5. 6계층 렌더용 addr→layer 맵

- 토폴로지를 6계층으로 묶어 그리려면 인스턴스 주소→계층 매핑이 필요. **작은 선언 맵**(login/registry→엣지·코디, gateway→엣지, zone*→월드, orch/broker→코디)을 testbed 가 보유. 거의 불변 — 새 박스 추가 때만 갱신(SPINE §6 6계층과 정합).

### 10-6. 잡다 (작은 결정)

- **runMulti 없는 과거 step**: report 는 runMulti 가 있으면 멀티 증명 포함, 없으면 inproc 만(0001~0009 대상 시). 현재 탐지는 최신(runMulti 보유)이라 평소 무관.
- **spine 비용**: 시리즈가 길어지면 reg N개 순차가 느려짐 → 필요 시 자식 동시 spawn 으로 병렬화. 지금은 순차로 충분.
- **run.js 자기 검증**: run.js 는 얇아 별도 verify 불요 — 단 탐지 로직(현재 step·exit 집계)은 한 번 수동 확인.
- **닫힌 step report 불가 항목**: per-tick 타임라인은 onTick 보유 step 부터. 그 이전은 최종 상태 + 메시지 로그 기반 축약 뷰로 폴백.

---

## 11. 점검 결론 — 설계 완비 여부

§1~9(무엇을·왜)는 완비. §10 이 구현 6대 구멍(타임라인 출처·trace 스키마·브라우저 재실행·시나리오 브리지·계층 맵·잡다)을 메웠다. **남은 것은 설계가 아니라 구현**(§9 순서). 단 두 가지는 구현 1번 착수 전 *확정 필요*: ⒜ `onTick` 콜백을 net-core 템플릿에 넣는 형태(§10-1) ⒝ verify `scenario` 모드 + 공유 번역기(§10-4). 나머지는 구현하며 자연히 굳는다.

---

## 12. 구현 현황 (2026-06 — 본 설계 채택 후 별 작업으로 구현)

§9 순서대로 구현됐고, 라이브 WS(보류 카드)까지 섰다. **현재 `node run.js` 의 모드**: 기본(현재 step verify all)·`spine`(전 시리즈 회귀 사슬)·`<NNNN> [mode]`·`report [scen]`(녹화 레코더)·`scenario <file>`(검증 브리지)·`live [port]`(SSE 라이브 모니터). 손그림 html 8장은 폐기 완료.

| 항목 | 설계 | 상태 |
|---|---|---|
| `run.js` 검증 진입점(기본·spine·`<NNNN>`) | §4 | ✅ — `node run.js`·`spine` 둘 다 ALL OK·exit 0(현재 step-0012, 12-step 비트 사슬) |
| 레코더 코어 `report.html`(자기완결·멀티프로세스 증명) | §5·§9-3 | ✅ — `run.js report` 한 줄 → 인라인 trace html 1장(pid·IPC·logDigest 일치) |
| 레코더 UI(스크럽 토폴로지·상태색·메시지 흐름·이벤트·6계층) | §5-2·§9-4 | ✅ |
| **레코더 엔티티 공간 위치 + AOI 시각화** | §5-2·§10-1 ⒜·⒞ | ✅ — `onTick(t,state)` 훅(0011 심음)을 레코더가 소비, `report.html` 에 격자 공간 맵(권위 엔티티 위치·AOI 반경 원·존 경계) 추가 |
| **`scenario` 검증 브리지(공유 번역기·trace 4기둥 단언)** | §5-4·§10-4 ⒝ | ✅ — `run.js scenario <file>`(verify.js 동결이라 run.js 에 둠, `loadScenario` 공유) |
| 시나리오 제어 `kill@t`·`transport`·`opts` | §5-3 | ✅ — `scenarios/*.json`(커밋), 레코더·검증 공유 |
| 시나리오 `inject`(클라 intent 주입) | §5-3·§10-4 | ✅ — **step-0016 복사 전진에서 write-seam 심음**(`opts.inject`, 미제공=no-op→reg 0·run()/runMulti() 같은 위치라 멀티프로세스도 비트 동일). run.js `loadScenario` 가 `cmds[].inject` 를 자동 번역(`NET.SUPPORTS.inject` 기능 탐지 — 미지원 과거 step 은 경고 후 무시). `scenarios/inject-move.json` → `run.js scenario` ALL OK. |
| 라이브 WS 대시보드(보류 카드) | §3-3·§10-3 | ✅(범위 외 보너스) — `live.js`(SSE·존 kill 인터랙티브 failover) |

> **구현 현황 전 항목 ✅ — testbed 마무리 완료(0016).** `inject` 는 동결 불변(frozen step + 둘째 구현 0)이 강제한 *타이밍* 문제였고, step-0016 의 net-core 복사 전진에서 reg-safe write-seam 으로 심겨 켜졌다(verify `inject` 모드: 실효·결정론·멀티 비트 동일 5/5). 이후 새 박스 추가 시 §10-5 의 addr→layer 선언 맵만 갱신하면 된다(0016 에서 bus/audit 추가).
</content>
