# HTJ — 장면 통일 설계 (capture.js ↔ viewer 일원화 · verify 경량화)

> **성격**: 이 문서는 *닫은 step 산출물이 아니라* 앞으로의 **작업 방식(per-step 의례) 개선 계획**이다. 세계(engine)의 법칙을 바꾸지 않는다 — 오직 *확인용 도구*(viewer·capture·verify)의 중복을 걷어내 step 한 바퀴의 코드 작업량을 줄인다. 권위는 여전히 [../STATE.md](../STATE.md)·`.claude/skills/htj-step/SKILL.md`. 도입은 사다리(U1~U4)를 `htj-step` 으로 잘게 쪼개 진행하며, **닫은 step 은 소급하지 않는다**(아래 §5).

---

## §0. 목적 (이 설계가 노리는 것)

한 step 을 닫으려면 지금은 같은 시뮬레이션을 사실상 **3벌** 쓴다:

| 위치 | 하는 일 | 분량 |
|---|---|---|
| `viewer.html` `STEPS['NNNN']` | `init(w)` + `advance(w,p)` + `note`/`defaults` — 브라우저 **라이브 장면** | 인라인 |
| `steps/step_NNNN/capture.js` | 장면을 **다시** 짜고 → 엔진 굴리고 → PNG 그리고 → 눈 검증 단언 | ~60–90줄 |
| `steps/step_NNNN/verify.js` | 또 **다른** 장면을 짜고 → 법칙 수치 검증(보존·항등·결정론·새 거동) | ~75–156줄 |

셋의 N·파라미터·셋업이 제각각이라(예: `step_0066` — viewer `init` 1472–1497줄, capture.js `build()`+5000스텝, verify.js 또 다른 앵커+합성 deposits) **같은 세계를 세 번 손으로 재현**하는 게 비효율의 정체다.

**노리는 것**: 한 step 의 *시뮬레이션 시나리오를 1벌만* 쓰고 —

1. **viewer** 가 그것을 라이브로 보여주고,
2. **범용 헤드리스 캡처** 가 *같은 시나리오* 를 굴려 `capture.png` 를 만든다(per-step `capture.js` 폐지),
3. **verify** 는 시나리오 재구성·눈 검증을 들어내고 **"이 step 이 도입한 새 법칙이 유효한가"만** 검증한다.

step 당 손작업: **3벌 → 시나리오 1벌 + verify(새 법칙만)**.

---

## §0-1. 한 줄 요약

`STEPS` 의 장면 정의를 viewer.html *밖*으로 빼 **UMD 시나리오 모듈 1벌**로 만들면, 브라우저(viewer 라이브)와 Node(헤드리스 PNG·verify)가 *같은 한 벌* 을 읽는다. engine 이 이미 UMD(브라우저 전역·`require` 양립)라 가능하다 — 세계는 안 바뀌고 확인용 중복만 사라진다.

---

## §1. 통일이 가능한 근거

1. **engine 이 UMD 다.** `engine/*.js` 는 viewer.html 의 `<script src>`(브라우저 전역)와 capture.js/verify.js 의 `require()`(Node) **양쪽에서 같은 파일로 돈다**(예: `htj-entity.js` 끝 `return {...}` UMD 래퍼). 따라서 *시나리오 정의 1벌* 도 양쪽에서 굴러갈 수 있다.
2. 장면이 실제로 쓰는 건 `init(w)` / `advance(w,p)` 뿐 — 이미 `STEPS` 에 있다. capture.js 가 *추가로* 하는 일은 "**world 상태 → 그릴 점들**"(`toFrame`)인데, step 마다 다르긴 해도 한 함수로 떼어낼 수 있다(셀·에너지장·지형 단면·개체 디스크 등 표현만 다름).
3. PNG 인코더·heat 색·디스크 그리기는 이미 `tools/htj-capture.js`(`writeFramesPNG`) 한 곳에 모여 있다 — 시나리오가 `toFrame` 만 주면 범용 러너가 그걸 호출한다.

---

## §2. 설계 — 시나리오 1개, 소비처 2개

### 2-1. 시나리오 SSOT 모듈

`STEPS` 항목을 viewer.html 밖 **UMD 모듈**로 추출한다(`viewer/scenes/step_NNNN.js`, 또는 한 파일 `viewer/scenes.js` 의 한 항목). 한 step 의 시나리오가 이만 선언한다:

```js
// viewer/scenes/step_NNNN.js — UMD(브라우저·Node 공용·확인용·engine 은 이걸 모른다)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else root.HTJScenes = (root.HTJScenes || {}), root.HTJScenes['NNNN'] = factory(null);
})(typeof self !== 'undefined' ? self : this, function (require) {
  // require 가 있으면 Node(engine require), 없으면 브라우저 전역(window.HTJ*)을 집는다.
  const E = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  return {
    label, sub, note, defaults, mode, dynamics, render,
    init(w)       { /* 지금 STEPS.init 그대로 */ },
    advance(w, p) { /* 지금 STEPS.advance 그대로 */ },
    // ── 캡처용(헤드리스 PNG) ──
    frames: [1, 600, 2000, 5000],          // 캡처할 step 마크
    toFrame(w)    { return { pts: [/* {cx,cy,r,v} */] }; },  // capture.js 의 핵심만
  };
});
```

- **engine 단방향 의존 불변**: 시나리오는 *확인용* 이라 engine 을 *읽기만* 한다. engine 은 시나리오·viewer·capture 를 절대 모른다(`HTJ/CLAUDE.md` 원칙 유지).
- **브라우저/Node 분기**는 UMD 래퍼가 흡수 — 시나리오 본문은 `E.applyEntityGravity(...)` 처럼 한 가지로만 쓴다.

### 2-2. viewer.html = 시나리오를 라이브로

viewer.html 의 `const STEPS = { ... }` 인라인 정의를 걷고, 대신 `viewer/scenes/*.js` 를 `<script>` 로 로드해 `window.HTJScenes` 를 `STEPS` 로 쓴다. **viewer 의 렌더·UI·드롭다운 로직은 그대로** — 데이터 출처만 인라인 → 모듈로 바뀐다.

### 2-3. 범용 헤드리스 캡처 — per-step capture.js 폐지

신규 `tools/htj-capture-run.js` 하나가 *모든* step 의 capture 를 대신한다:

```
node tools/htj-capture-run.js NNNN
  → scenes/step_NNNN.js 로드 → init(world) → advance 를 frames 마크까지 굴리며
    각 마크에서 toFrame(world) 수집 → tools/htj-capture.js writeFramesPNG → steps/step_NNNN/capture.png
```

per-step `capture.js` 는 **더 안 쓴다**. "눈 검증" 의 *서술* 은 viewer `note` 가 집(이미 §4 의 원칙). 캡처는 "그림을 남긴다" 역할만.

> **픽셀 동일이 아니라 *세계* 동일** (한계 §3): viewer 의 캔버스 렌더(`htj-render.js`, 3D voxel/heat)와 헤드리스 PNG(`htj-capture.js`, top-down 디스크)는 *그리는 법이 다르다*. 같은 *world* 를 두 방식으로 그릴 뿐 픽셀이 같지는 않다. 이는 지금 폴백(per-step capture.js)이 이미 하던 방식이라 품질 손실 없음.

### 2-4. verify = "새 법칙이 유효한가"만 (보존·결정론은 공용 가드)

verify 에서 **시나리오 재구성·눈 검증 단언·보존/결정론 보일러플레이트를 걷어낸다.** per-step verify 는 *이 step 이 도입한 새 거동(법칙)* 한 축만 직접 쓴다.

- **공용 가드 라이브러리** `tools/htj-verify-lib.js`(신규): `assertConserved(before, after, {mass,momentum,energy})`·`assertDeterministic(run)`·`assertIdentity(knobZero)` 같은 *반복되는* 검사를 한 곳에 모은다. per-step verify 가 필요하면 한 줄로 부른다(중복 제거).
- per-step verify 본문 = **새 법칙의 핵심 단언 1~2개** + (해당되면) 공용 가드 호출. SKILL.md 의 "적정 검증 — 고정 6종 채우려 늘리지 말 것" 과 일치, 더 빡빡하게.
- verify 는 여전히 **순수·독립·영구**(다른 step 에 의존 0). 닫기 전 전 step verify 재실행(회귀 0)은 **그대로** — 이건 알맹이.

---

## §3. 정직한 한계

- **픽셀 동일 캡처는 chromium 필요.** viewer 캔버스를 그대로 스크린샷하려면 `viewer/capture.js`(playwright) 길뿐인데, 이 환경엔 chromium 바이너리는 있어도 **playwright 모듈이 없어** SKIP 된다. 그래서 통일의 실체는 "같은 *world*(시나리오 1벌)를 viewer 는 라이브·캡처는 htj-capture 로" — 픽셀 동일이 *아니다*. (chromium+playwright 가 갖춰지면 범용 러너에 "viewer 스크린샷" 모드를 추가하는 길은 열려 있음.)
- **`toFrame` 은 step 마다 다르다.** 표현(셀/장/지형 단면/개체 디스크)이 달라 완전 제로화는 안 된다 — 다만 *시나리오 1벌* 안에 모이고, 엔진 셋업·루프 중복은 사라진다.
- **viewer 특수 헬퍼**(`updateTemperature`·`rebuildSurface0066`·`drawField` 등 viewer.html 안의 보조)는 시나리오 모듈이 쓰려면 함께 노출/이동해야 한다 — 추출 시 한 번에 정리(U1 범위).

---

## §4. 도입 사다리 (U1~U4 — 각 단계 = `htj-step` 한 바퀴 이상)

작은 단위로 끊어 회귀 0 을 매번 확인하며 진행한다.

- **U1 — 시나리오 추출 골격 ☑(파일럿)**: `viewer/scenes/` UMD 래퍼 + 범용 `tools/htj-render-capture.js` 작성. **step_0066 을 파일럿**으로 `viewer/scenes/step_0066.js`(engine 만 의존·viewer 보조함수 인라인) 추출 → viewer 라이브(인라인 대체·`Object.assign(STEPS, HTJScenes)`)와 헤드리스 PNG(`node tools/htj-render-capture.js 0066`)가 *같은 한 벌* 에서 나옴을 확인. (닫은 step_0066 폴더는 불변 — 모듈은 새 파일·시범.)
- **U2 — verify 공용 가드 ☑**: `tools/htj-verify-lib.js`(`conserved`·`deterministic`·`identity`·`fnv1a`) 작성. 앞으로의 verify 는 "새 법칙 핵심 단언 + 공용 가드 한 줄 호출".
- **U3 — 절차 문서 갱신 ☑**: `.claude/skills/htj-step/SKILL.md` §2~3 와 `HTJ/CLAUDE.md` 인덱스를 새 의례로 교체(capture.js → 시나리오 모듈+범용 러너, verify=새 법칙만+공용 가드).
- **U4 — 정착·확산(다음부터)**: 이후 모든 새 step 이 `viewer/scenes/step_NNNN.js` 1벌 + 범용 러너 + 경량 verify 로 닫는다. **닫은 step 은 소급 안 함**(§5) — 신·구가 공존하되 새 step 만 새 길. (선택: `tools/check-viewer.js` 가 `scenes/` 모듈도 등록으로 인정하도록 확장 — 현재는 viewer.html 인라인/병합 키를 본다.)

---

## §5. 가로지르는 제약 (어기면 안 되는 것)

1. **세계 ↔ 확인용 단방향 의존 불변** — 시나리오·viewer·capture·verify 는 engine 을 *읽기만*. engine 은 이들을 모른다. (`HTJ/CLAUDE.md`)
2. **닫은 step 불변 — 소급 리팩터링 금지.** 기존 59개 `capture.js`·verify 는 그대로 둔다. 새 구조는 *다음 step부터*. (SKILL.md "과거 capture.js 를 새 헬퍼로 소급 리팩터링하지 않는다")
3. **engine·물리 회귀 0** — 이 작업은 확인용 트랙이라 engine 변경이 0 이어야 한다. 전 step verify 재실행 PASS 가 그 보증.
4. **검증의 알맹이는 유지** — verify 를 줄이되 "새 법칙 유효성 + (해당 시) 보존·결정론" 은 공용 가드로 *반드시* 남는다. "검증 없는 step 을 닫지 않는다"(SKILL.md)는 불변.
</content>
</invoke>
