# TESTBED — 단일 라이브 테스트 환경 설계

> step 마다 손수 만들던 `step-NNNN.html`(시각 관찰 셸, 0004~0010 7개)을 폐기하고,
> **현재 상태 하나만 원격에서 한 줄로 돌리는 살아있는 테스트 환경**으로 대체하는 설계.
> 방법론·규칙은 [CLAUDE.md](CLAUDE.md) · 현재 위치(SSOT)는 [STATE.md](STATE.md) · 큰 그림은 [SPINE.md](SPINE.md).
>
> **이 문서의 위상**: 설계 결정 문서(거의 불변 참조). 실제 러너·뷰는 본 설계 채택 후 별 step/작업으로 구현한다.

---

## 1. 문제 — 왜 step-NNNN.html 이 안 돕는가

현재 산출물 규약(CLAUDE.md §step 작성법)은 step 마다 `engine/panel-kit.js` 위에 `step-NNNN/panel.js` + `step-NNNN.html` 을 *손수* 올리게 한다. 결과:

- **검증을 안 한다** — html 은 인프로세스 `run()` 만 *그린다*. verify 4기둥(회귀·결정론·권위·가설)은 안 돈다. 그림일 뿐 증명이 아니다.
- **7개가 흩어진다** — 0004~0010 까지 7장. "지금 어디까지 도는가"를 보려면 *어느 step 인지 먼저 알고* 그 html 을 열어야 한다.
- **검증 권위가 분산** — 진짜 증명은 `step-NNNN/verify.js` 에 산다(`node verify.js all` → ALL OK). 그러나 step 마다 다른 디렉토리. "현재 상태 한 줄 검증"의 단일 진입점이 없다.
- **step 마다 손작업 2건** — `step-NNNN.html` 작성 + `SYSTEM.html` 손갱신. html 은 회귀로도 안 잡히는(브라우저 전용) 사각지대.

요컨대 **관찰 셸(html)은 정성적 그림인데 검증 가치는 verify 의 정량 수치에 있다.** 그림을 step 마다 손으로 7장 만드는 비용이 통찰을 못 따라간다.

---

## 2. 핵심 판단 — CI 는 필요 없다

`verify.js` 는 *이미* headless 이고 *이미* 이 원격 환경에서 `node` 한 줄로 돈다(제1 운영 제약 = "원격에서 한 줄로 빌드·검증" 은 **이미 충족**). GitHub Actions 가 더하는 건 *push 자동 게이팅* 한 가지뿐인데:

- step 은 어차피 **닫을 때 verify 를 통과시켜야** 닫힌다(CLAUDE.md §step 루프 4·검증 4기둥). 통과 못 하면 step 을 못 닫는다 — 게이트는 *절차에 이미 내장*.
- 에이전트 주도 단일 작업자 흐름에서 CI 는 같은 게이트를 한 번 더 거는 *중복 의식*. 러너·yml·러너 환경 관리 비용만 는다.

**결론: CI(Actions)는 본 설계에 넣지 않는다.** (원하면 후일 `node HktInfra/run.js` 한 줄을 호출하는 workflow 로 사소하게 붙일 수 있다 — 핵심이 아니므로 보류.)

진짜 빠진 것은 CI 가 아니라 다음 셋이고, 이것이 설계 대상이다:

| # | 빠진 것 | 채우는 산출물 |
|---|---|---|
| ① | 흩어진 verify 의 **단일 진입점** | `HktInfra/run.js` (§4) |
| ② | 현재 상태의 **단일 뷰** | 텍스트 대시보드(본체) + 선택적 생성 html 1장 (§5) |
| ③ | step 갱신의 **자동화**(손 html 제거) | 현재 step 자동 탐지 + 루프 절차 변경 (§4·§7) |

---

## 3. 설계 원칙 (정합 불변)

본 설계는 기존 불변을 *하나도 깨지 않는다* — 셸 작성 방식만 바꾼다.

- **frozen step dir 불변** — `step-NNNN/` 는 동결 스냅샷(anti-DRY, 복사 전진). 러너는 step dir 을 **읽기/실행만** 한다(수정 0). 회귀 0·동결 단위 보존.
- **SSOT = STATE.md** — "현재 어디까지" 의 권위는 여전히 STATE.md. 러너는 현재 step 을 *파생 탐지*할 뿐(아래 §4) 권위를 새로 만들지 않는다.
- **수치 = verify 출력** — 대시보드는 verify 의 *출력을 집계*할 뿐 자체 수치를 만들지 않는다. 새 진실 원천을 만들지 않는다(중복 SSOT 금지).
- **headless·원격 제1** — 본체 뷰는 텍스트(콘솔). 브라우저·서버·빌드 0 으로 이 환경에서 한 줄로 돈다.
- **dual-mode 무관** — `run.js` 는 Node 전용 *오케스트레이터*(브라우저 로드 대상 아님). engine/net-core 의 dual-mode 규약과 충돌하지 않는다.

---

## 4. 산출물 ① — `HktInfra/run.js` (단일 진입점 러너)

흩어진 `step-NNNN/verify.js` 앞에 서는 얇은 오케스트레이터. **살아있다 = 손수정 없이 step 마다 자동으로 최신을 가리킨다.**

### 현재 step 자동 탐지

`step-*/` 디렉토리 중 **최대 번호**를 현재로 본다(파일시스템 사실 — 결정적, STATE 파싱보다 견고). 닫힌 step 만 디렉토리가 존재하므로 STATE.md §1 NOW 와 어긋날 일이 없다(둘이 어긋나면 STATE 가 권위 — 그 땐 경고 출력). 

### 모드

| 명령 | 동작 |
|---|---|
| `node run.js` (기본) | 현재 step 의 `verify.js all` 을 자식 프로세스로 실행. stdout 중계 + 종료코드 전파. **"현재 상태 한 줄 검증"의 정답.** |
| `node run.js spine` | **회귀 척추**: step-0002..NNNN 각자 `verify.js reg` 를 순차 실행(+0001 `det`). 전 사슬이 비트 동일인지 한 줄 요약. *신규 가치 — 전 시리즈 무결성을 한 번에.* (기존엔 각 step 의 reg 가 직전 step 만 본다.) |
| `node run.js <NNNN> [mode]` | 특정 step·모드 지정 실행(디버깅·과거 재현). |
| `node run.js html` | 현재 상태 대시보드 html 1장 생성(§5-B). *선택 모드.* |

### 출력 — 단일 대시보드(콘솔)

기본 모드 끝에 현재 step 의 **4기둥 + 척추5 PASS/FAIL 표**와 핵심 수치를 한 화면으로 집계한다. verify 의 `결과: ALL OK / FAIL` 를 파싱해 종합. "지금 통과하는가"가 한 화면에서 끝난다.

### 의사 코드(스켈레톤)

```js
// HktInfra/run.js — 단일 라이브 테스트 진입점 (Node 전용 오케스트레이터)
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const ROOT = __dirname;
function steps() {                       // step-NNNN 디렉토리 오름차순
  return fs.readdirSync(ROOT)
    .filter(d => /^step-\d{4}$/.test(d) && fs.existsSync(path.join(ROOT, d, 'verify.js')))
    .sort();
}
function current() { const s = steps(); return s[s.length - 1]; }   // 최대 번호 = 현재

function runVerify(step, mode) {         // 자식 프로세스로 verify 실행, {ok, out}
  try {
    const out = execFileSync('node', [path.join(step, 'verify.js'), mode],
                             { cwd: ROOT, encoding: 'utf8' });
    return { ok: /결과: ALL OK/.test(out), out };
  } catch (e) {                          // verify 가 exit 1 → 실패
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const mode = process.argv[2] || 'now';
if (mode === 'spine') {                  // 전 시리즈 회귀 사슬
  let allOk = true;
  for (const s of steps()) {
    const m = s === 'step-0001' ? 'det' : 'reg';
    const { ok } = runVerify(s, m);
    allOk = allOk && ok;
    console.log(`${s}  ${m.padEnd(4)}  ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(allOk ? '\n척추 회귀: ALL OK' : '\n척추 회귀: FAIL');
  process.exit(allOk ? 0 : 1);
} else if (mode === 'html') {
  require('./testbed-gen.js').generate(current());   // §5-B (선택)
} else if (/^\d{4}$/.test(mode)) {
  const { out, ok } = runVerify('step-' + mode, process.argv[3] || 'all');
  process.stdout.write(out); process.exit(ok ? 0 : 1);
} else {                                 // 기본 = 현재 상태 전체 검증
  const cur = current();
  const { out, ok } = runVerify(cur, 'all');
  process.stdout.write(out);
  console.log(`\n[testbed] 현재 step = ${cur} · 판정 ${ok ? 'ALL OK' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}
```

> 50줄 내외의 얇은 래퍼다. 로직은 전부 기존 verify 에 산다 — run.js 는 *모으기만* 한다(중복 SSOT 0).

---

## 5. 산출물 ② — 단일 뷰

### A. 텍스트 대시보드 (본체 — 권장 기본)

`node run.js` / `node run.js spine` 콘솔 출력이 단일 뷰의 본체다. "수치=verify·헤드리스" 문화에 가장 정합하고 브라우저·서버 0. **현재 상태를 보는 정답 경로**이며 step 마다 손작업이 *사라진다*(자동 탐지).

### B. 생성형 html 1장 (선택 — 관찰이 통찰 주는 step 에서만)

panel(토폴로지·대역폭·desync 타임라인) 관찰이 필요할 때, **`step-NNNN.html` 7장 대신 generic 1장**으로:

- `node run.js html` 이 verify 출력을 파싱해 `HktInfra/testbed.html` 한 장을 **생성**(손수 작성 아님 → step 마다 자동 갱신).
- 이 1장은 현재 step 의 net-core/panel 을 `<script src="step-NNNN/...">` 로 *동적 로드*(현재 step 번호만 주입). 7개 → 1개. 기존 dual-mode·"html 그냥 열기" 규약을 그대로 탄다(`<script>` 만, 번들러·fetch 0).
- panel.js(관찰 데이터 `compute()`) 자체는 dual-mode·헤드리스 ASCII(`node step-NNNN/panel.js`)로 가치가 있으니 **유지**. 폐기 대상은 *셸(html)을 step 마다 손으로 만드는 것* 뿐.

> 기본은 A. B 는 *관찰이 통찰을 주는 step* 에서만 켠다. **공통 원칙: 손수 7장은 끝.**

---

## 6. `step-NNNN.html` 폐기 + `SYSTEM.html` 과의 역할 구분

두 html 은 역할이 다르다 — 하나만 폐기한다.

| 파일 | 역할 | 본 설계 후 |
|---|---|---|
| `step-NNNN.html` (0004~0010) | step 별 관찰 셸(인프로세스 run 그림) | **폐기** — 더 안 만든다. 기존 7장은 그 step 의 동결 기록으로 남기되 갱신 대상 아님. 관찰은 §5-B generic 1장 또는 `node panel.js` 로. |
| `SYSTEM.html` | 현재 *작동 시스템 전체도*(SVG 토폴로지 + 서버 상태색 + 6계층표) = STATE 의 *정성적 시각 렌더* | **유지** — testbed 가 대체하지 않는다. SYSTEM 은 "무엇이 도는가(구조)", testbed 는 "지금 통과하는가(수치)". 직교. |

즉 testbed(정량·자동)는 step-NNNN.html(관찰 셸)을 대체하고, SYSTEM.html(정성·구조)은 그대로 둔다.

---

## 7. step 루프 절차 변경 (CLAUDE.md §step 루프 5·작성법)

| 단계 | 기존 | 변경 후 |
|---|---|---|
| 검증(§4) | `cd step-NNNN && node verify.js all` | `node HktInfra/run.js` (현재 자동) + `node HktInfra/run.js spine` (전 사슬 회귀). 둘 다 ALL OK 라야 닫는다. |
| 갱신(§5) | STATE.md + **SYSTEM.html 손갱신** + (선택) **step-NNNN.html 손작성** | STATE.md + SYSTEM.html 손갱신은 유지. **step-NNNN.html 손작성 제거.** 관찰 필요 시 `node run.js html`(generic 1장 자동 생성). |
| 산출물 규약(작성법) | `step-NNNN/panel.js` + `step-NNNN.html` (선택, 권장) | `step-NNNN/panel.js` 는 유지(헤드리스 ASCII 가치). **`step-NNNN.html` 항목 삭제** — generic testbed 1장이 대신한다. |

채택 시 CLAUDE.md 의 해당 절(시각 관찰 셸 규약 ⒝·step 루프 5·작성법 산출물 목록)을 위 표대로 고친다.

---

## 8. 불변 정합 체크

- **회귀 0** — run.js 는 step dir 을 *실행만*. 기존 reg 가 그대로 비트동일을 증명. ✅
- **frozen 동결** — step dir 수정 0(읽기·spawn 뿐). 복사 전진·동결 단위 보존. ✅
- **SSOT** — 현재 step 은 파일시스템에서 *파생 탐지*, 권위는 STATE.md. 새 진실 원천 0. ✅
- **수치=verify** — 대시보드는 verify 출력 *집계*. 자체 수치 0. ✅
- **headless·원격 제1** — 본체 뷰 텍스트, `node` 한 줄. 브라우저·서버·빌드 0. ✅
- **dual-mode·HTML 그냥 열기** — run.js 는 Node 전용 래퍼(규약 무관). 선택 html 은 `<script>` 동적 로드로 규약 유지. ✅

---

## 9. 점진 적용 순서 (구현 시)

1. `HktInfra/run.js` 추가(§4 스켈레톤) — `node run.js` / `spine` 두 모드만 먼저. 기존 verify·step dir 무수정.
2. `node run.js spine` 으로 전 시리즈 회귀 사슬 1회 통과 확인(기준선 확보).
3. CLAUDE.md §step 루프·작성법을 §7 표대로 갱신(검증 명령 = run.js, step-NNNN.html 항목 제거).
4. (선택) `run.js html` + `testbed.html` generic 1장 — *관찰이 통찰 주는 step* 에서만.
5. 기존 `step-0004~0010.html` 7장은 동결 기록으로 잔존(삭제 불필요 — 더 안 만들 뿐).

> 1~3 만으로 "현재 상태 하나를 원격에서 한 줄로, step 마다 자동 갱신" 이 성립한다. 4 는 관찰 보강(선택).
</content>
</invoke>
