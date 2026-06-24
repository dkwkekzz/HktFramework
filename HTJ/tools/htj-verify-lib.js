// tools/htj-verify-lib.js — verify 공용 가드 (장면 통일 U2·확인용 도구).
//
//   왜: per-step verify 가 매번 보존·결정론·항등 검사를 손으로 다시 짰다(보일러플레이트). 이 모듈이
//   *반복되는 가드* 를 한 곳에 모은다 — 앞으로의 verify 는 "이 step 이 도입한 *새 법칙* 의 핵심 단언"
//   만 직접 쓰고, 보존·결정론·항등은 여기 한 줄로 부른다(design/scene-unify.md §2-4).
//
//   각 함수는 { pass, name, value } 를 돌려준다(verify.js 의 PASS/FAIL 표와 같은 형식). verify 가
//   ok(c.pass, `${c.name} = ${c.value}`) 로 출력한다. engine 을 *읽지도* 않는다 — 순수 수치 유틸.
//
//   API:
//     conserved(label, before, after, tol=1e-9)              — |after−before|/max(|before|,ε) < tol
//     deterministic(label, run)                              — run() 두 번 → 깊은 동일(JSON)
//     identity(label, baseline, withKnobZero, tol=0)         — 노브=0 결과가 baseline 과 동일(회귀 0)
//     fnv1a(str) -> hex                                      — 결정론 지문용 32비트 해시
'use strict';

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}

// 보존 — 어떤 스칼라(질량·운동량·총E…)가 법칙 전후로 보존되는가. relErr < tol.
function conserved(label, before, after, tol) {
  tol = tol != null ? tol : 1e-9;
  const rel = Math.abs(after - before) / Math.max(Math.abs(before), 1e-300);
  return { pass: rel < tol, name: `보존 — ${label}`, value: `${before} → ${after} (rel ${rel.toExponential(2)} < ${tol})` };
}

// 결정론 — 같은 입력 → 같은 출력. run() 을 두 번 돌려 깊은 동일(JSON 직렬화)인지.
function deterministic(label, run) {
  const a = JSON.stringify(run()), b = JSON.stringify(run());
  return { pass: a === b, name: `결정론 — ${label}`, value: `지문 0x${fnv1a(a)}${a === b ? '' : ' ≠ 0x' + fnv1a(b)}` };
}

// 항등(회귀 0) — 새 노브를 0 으로 끄면 *옛 거동* 과 byte 동일해야 한다. baseline/withKnobZero = 비교 가능한 값(수·문자열·배열).
function identity(label, baseline, withKnobZero, tol) {
  let pass, detail;
  if (typeof baseline === 'number' && typeof withKnobZero === 'number') {
    const d = Math.abs(baseline - withKnobZero); pass = d <= (tol || 0); detail = `Δ ${d.toExponential(2)}`;
  } else {
    const a = JSON.stringify(baseline), b = JSON.stringify(withKnobZero); pass = a === b; detail = `0x${fnv1a(a)}${pass ? '' : ' ≠ 0x' + fnv1a(b)}`;
  }
  return { pass, name: `항등(노브=0→회귀 0) — ${label}`, value: detail };
}

module.exports = { fnv1a, conserved, deterministic, identity };
