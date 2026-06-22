'use strict';
// HTJ/tools/check-viewer.js — viewer 등록 누락 가드.
//
//   닫힌 step(`steps/step_NNNN/step_NNNN.md` 존재)이 `viewer.html` 의 STEPS
//   갤러리에 등록됐는지 검사한다. 등록도 안 됐고 아래 EXEMPT(면제 사유)에도
//   없으면 FAIL(비-0 종료).
//
//   왜 필요한가: 눈 검증이 chromium 부재로 step별 capture.js(engine 직접 PNG)
//   폴백으로 옮겨가면서, "viewer 에 등록해야 캡처가 나온다"는 강제력이 사라졌다.
//   그 결과 0015~0021 이 *조용히* viewer 에서 누락됐다(드롭다운에 안 뜸). 이 가드는
//   그 누락을 *돌리면 깨지는 검사*로 바꾼다 — 빠뜨리려면 의식적으로 EXEMPT 에
//   사유를 적어야만 통과한다.
//
//   verify.js 와 같은 부류의 *가드* — 돌리는 법도 같다:  node HTJ/tools/check-viewer.js
//   step 닫기 직전(닫기 체크리스트 #1, 전 step verify 재실행)에 함께 돌린다.

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

// viewer 갤러리에 *개별* 장면을 띄우지 않아도 되는 닫힌 step — 반드시 사유를 적는다.
// (사유 없이 빠지는 것을 막는 게 이 가드의 핵심. 새 면제는 의식적으로 여기 추가.)
//   주: 0016~0025(확장성 인프라)의 거동은 viewer.html STEPS 의 'scal' *통합 오버레이*에서
//   눈으로 확인할 수 있다(희소·활성·동결 블록을 같은 별 위에 덧그림). 개별 장면이 없을 뿐 viewer 부재 아님.
const EXEMPT = {
  '0015': 'S1 측정 베이스라인 — 산출물이 벤치마크 차트(capture.js)이고 시뮬 장면이 아님',
  '0016': 'S2 희소 컨테이너 — 조밀과 비트 동일한 등가 변환, 화면 거동이 0014와 동일(새 장면 없음)',
  '0017': '진공 전이 규칙 — near-vacuum 희소화, 눈 검증은 capture.js(조밀 파이프라인과 거동 동일)',
  '0018': 'S2 활성 순회 절감 측정 — 조밀과 비트 동일(비용만 변화)',
  '0019': 'S2 활성 집합 유지 — 조밀과 비트 동일(비용만 변화)',
  '0020': 'S2 확산 활성 일반화 — 조밀과 비트 동일(화면 거동 0014와 동일)',
  '0021': 'S2 advect 활성 일반화 — 조밀과 비트 동일(화면 거동 0014와 동일)',
  '0022': 'S2 압력(∇P 힘) 활성 일반화 — 조밀과 비트 동일(화면 거동 0014와 동일)',
  '0023': 'S2 통합 측정 게이트 — 산출물이 마이크로벤치 vs 실제 별 비교 차트(capture.js)이고 시뮬 장면 아님(0015 류)',
  '0024': '진공 동반 수송(보존 완성)+희소화 천장 측정 — 진공은 파이프라인 밖 측정(셀vs블록 점유 차트)이고 시뮬 장면 아님(0017 류)',
  '0025': 'S3 활동도/동결 판정 — 조밀과 비트 동일(동결=0연산), 산출물이 활성 순회 절감 진단 차트(capture.js)이고 새 시뮬 장면 아님(0018 류)',
  '0026': 'S5 승격/역승격 이관 mechanism — 눈 검증은 capture(별 본체가 격자서 빠져 구체 1개+보존). 자동 트리거(동결→승격) viewer 장면은 후속 step',
};

// 1) 닫힌 step 목록 — steps/step_NNNN/step_NNNN.md 가 있으면 "닫힌" 것으로 본다.
const stepsDir = path.join(root, 'steps');
const closed = fs.readdirSync(stepsDir)
  .map(d => (d.match(/^step_(\d{4})$/) || [])[1])
  .filter(Boolean)
  .filter(n => fs.existsSync(path.join(stepsDir, 'step_' + n, 'step_' + n + '.md')))
  .sort();

// 2) viewer.html 의 STEPS 키 — 줄 시작 들여쓰기 + '\d{4}': { 패턴(STEPS 항목 줄).
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const registered = new Set();
for (const m of viewer.matchAll(/^\s*'(\d{4})':\s*\{/gm)) registered.add(m[1]);

// 3) 대조 — 등록도 면제도 안 된 닫힌 step = 누락.
const missing = closed.filter(n => !registered.has(n) && !EXEMPT[n]);
// 면제 목록이 실제 닫힌 step 만 가리키는지(오타·유령 면제 방지).
const ghost = Object.keys(EXEMPT).filter(n => !closed.includes(n));

// 보고 — verify.js 와 같은 PASS/FAIL 형식.
let ok = true;
function line(pass, name, value) {
  if (!pass) ok = false;
  console.log((pass ? 'PASS  ' : 'FAIL  ') + name + (value ? ' = ' + value : ''));
}

line(missing.length === 0, 'viewer 등록 누락 0',
  missing.length === 0
    ? `닫힘 ${closed.length}개 = 등록 ${closed.length - Object.keys(EXEMPT).filter(n => closed.includes(n)).length}개 + 면제 ${Object.keys(EXEMPT).filter(n => closed.includes(n)).length}개`
    : `누락 ${missing.join(',')} → viewer STEPS 등록 또는 EXEMPT 사유 추가 필요`);
line(ghost.length === 0, '면제 목록 유효(유령 없음)',
  ghost.length === 0 ? `면제 ${Object.keys(EXEMPT).length}개 모두 닫힌 step` : `유령 면제 ${ghost.join(',')}(닫힌 step 아님)`);

console.log(ok ? '\nPASS — viewer 갤러리 정합' : '\nFAIL — 위 누락을 viewer 에 등록하거나 EXEMPT 에 사유를 적어라');
process.exit(ok ? 0 : 1);
