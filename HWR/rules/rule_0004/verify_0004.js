// verify_0004 — 껍질/원자가. 엔진+규칙(rule_0001~0004) 합성으로 굴려(뷰어와 동일) 단언한다.
//   node rules/rule_0004/verify_0004.js
import { stepWorld } from '../../engine.js';
import rule1 from '../rule_0001/rule_0001.js';
import rule2 from '../rule_0002/rule_0002.js';
import rule3 from '../rule_0003/rule_0003.js';
import rule4, { shellState } from './rule_0004.js';

const rules = [rule1, rule2, rule3, rule4];
const params = Object.assign({ dt: 1 }, rule1.defaults, rule2.defaults, rule3.defaults, rule4.defaults);
const step = w => stepWorld(w, rules, params);

let failed = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}
const world = els => ({ width: 1e6, height: 1e6, depth: 1e6, tick: 0, elements: els, impulses: [] });
const atom = (x, Z, m, vx = 0, y = 0) => ({ x, y, z: 0, vx, vy: 0, vz: 0, Z, m, r: 3 });
// 분자(합성체)의 구성 원자 Z 다중집합 — 정확한 조성 확인용
const composition = mol => (mol.parts || []).map(p => p.Z).filter(z => z != null).sort((a, b) => a - b);
const count = (arr, z) => arr.filter(x => x === z).length;

// ── A. 껍질 모형 — Z 에서 화학적 정체성이 창발(주기율표) ─────────────────────
{
  const H = shellState(1), C = shellState(6), O = shellState(8), Ne = shellState(10);
  const Na = shellState(11), Mg = shellState(12), Cl = shellState(17), Ar = shellState(18);
  const Li = shellState(3), F = shellState(9), K = shellState(19), He = shellState(2);

  check('껍질: 비활성 기체는 결합가 0(He·Ne·Ar)', He.valence === 0 && Ne.valence === 0 && Ar.valence === 0 && He.isNoble && Ne.isNoble && Ar.isNoble);
  check('껍질: 금속은 가진 원자가를 잃는다(Na·Mg 결합가 1·2)', Na.valence === 1 && Na.tendency === 'metal' && Mg.valence === 2 && Mg.tendency === 'metal');
  check('껍질: 비금속은 빈 자리를 채운다(O·Cl·F 결합가 2·1·1)', O.valence === 2 && O.tendency === 'nonmetal' && Cl.valence === 1 && F.valence === 1);
  check('껍질: H·C 는 절반(share, 결합가 1·4)', H.valence === 1 && H.tendency === 'share' && C.valence === 4 && C.tendency === 'share');
  // 주기성 — 같은 바깥 껍질 배치는 같은 결합가·성향으로 *재발*(Li≈Na 1족, F≈Cl 17족)
  check('주기성: Li 와 Na 가 같은 거동(둘 다 금속·결합가 1)', Li.valence === Na.valence && Li.tendency === Na.tendency);
  check('주기성: F 와 Cl 가 같은 거동(둘 다 비금속·결합가 1)', F.valence === Cl.valence && F.tendency === Cl.tendency);
  // 전기음성도 경향 — 같은 주기 오른쪽일수록↑(Na<Cl), 같은 족 아래일수록↓(F>Cl, Li>Na 는 cap 같아 동률)
  check('전기음성도(창발): 같은 주기 Na < Cl, 같은 족 F > Cl', Na.en < Cl.en && F.en > Cl.en, `Na=${Na.en.toFixed(3)} Cl=${Cl.en.toFixed(3)} F=${F.en.toFixed(3)}`);
}

// ── B. 결정론 ─────────────────────────────────────────────────────────────
{
  const mk = () => world([atom(-9, 8, 16), atom(-21, 1, 1, 0.3), atom(3, 1, 1, -0.3)]);
  const a = mk(); for (let i = 0; i < 50; i++) step(a);
  const b = mk(); for (let i = 0; i < 50; i++) step(b);
  check('결정론: 같은 입력 → 비트 동일', JSON.stringify(a) === JSON.stringify(b));
}

// ── C. 공유 결합 — 정확한 분자 조성 ────────────────────────────────────────
// H₂O: 산소(결합가 2) + 수소 둘 → 하나의 중성 분자(O 1 + H 2)로 병합, 잔여 원자가 0(포화)
{
  const w = world([atom(0, 8, 16), atom(-9, 1, 1, 0.3), atom(9, 1, 1, -0.3)]);  // 접촉 거리(O반경8+H반경2=10) 안
  for (let i = 0; i < 5; i++) step(w);
  check('공유: H₂O 단일 분자로 병합(3→1)', w.elements.length === 1, `개수=${w.elements.length}`);
  const mol = w.elements[0];
  const comp = composition(mol);
  check('공유: 조성이 정확히 O·H·H', count(comp, 8) === 1 && count(comp, 1) === 2, `Z=[${comp}]`);
  check('공유: 중성 분자(Σq=0)·질량 18', (mol.q || 0) === 0 && Math.abs(mol.m - 18) < 1e-9, `q=${mol.q || 0}, m=${mol.m}`);
  check('공유: 바깥 껍질 포화(잔여 원자가 0)', mol.freeValence === 0, `freeValence=${mol.freeValence}`);
}

// D. 원자가 한도(포화) — 산소(결합가 2)에 수소 셋을 줘도 둘만 받는다(OH₃ 안 생김 = 정확한 조성)
{
  const w = world([atom(0, 8, 16), atom(-9, 1, 1, 0.3), atom(9, 1, 1, -0.3), atom(0, 1, 1, 0, -9)]);
  for (let i = 0; i < 5; i++) step(w);
  check('포화: H 셋 중 둘만 결합(분자 1 + 자유 H 1)', w.elements.length === 2, `개수=${w.elements.length}`);
  const mol = w.elements.find(e => Array.isArray(e.parts));
  const free = w.elements.find(e => e.Z === 1);
  check('포화: 분자는 O+H₂, 셋째 H 는 자유로 남음', mol && count(composition(mol), 1) === 2 && !!free, mol ? `분자 Z=[${composition(mol)}], 자유H=${!!free}` : '분자 없음');
}

// E. 이중결합 — CO₂: 탄소(결합가 4)에 산소(결합가 2) 둘이 차수 2씩 → 정확히 CO₂ 에서 포화
{
  const w = world([atom(0, 6, 12), atom(-12, 8, 16, 0.3), atom(12, 8, 16, -0.3)]);  // C반경6.9+O반경8 ≈ 15 안
  for (let i = 0; i < 5; i++) step(w);
  check('이중결합: CO₂ 단일 분자(3→1)', w.elements.length === 1, `개수=${w.elements.length}`);
  const mol = w.elements[0];
  check('이중결합: 조성이 정확히 C·O·O', count(composition(mol), 6) === 1 && count(composition(mol), 8) === 2, `Z=[${composition(mol)}]`);
  check('이중결합: 탄소 결합가 4 가 산소 둘에 2씩 → 포화(잔여 0)', mol.freeValence === 0, `freeValence=${mol.freeValence}`);
}

// ── F. 이온 결합 — 다중 결합가(주기율표가 화학량론을 만든다) ─────────────────
// MgCl₂: 마그네슘(금속, 결합가 2)이 염소(비금속) 둘에게 전자를 하나씩 → Mg²⁺ + 2Cl⁻ (병합 안 함)
{
  const w = world([atom(0, 12, 24), atom(-20, 17, 35, 0.2), atom(20, 17, 35, -0.2)]);  // Mg반경≈9.8+Cl반경≈11.8 안
  for (let i = 0; i < 3; i++) step(w);
  const mg = w.elements.find(e => e.Z === 12);
  const cls = w.elements.filter(e => e.Z === 17);
  check('이온: MgCl₂ 는 병합 안 함(이온 3개 유지)', w.elements.length === 3, `개수=${w.elements.length}`);
  check('이온: 다중 결합가 — Mg 가 전자 둘을 잃어 +2', mg && mg.q === 2, `Mg q=${mg ? mg.q : '—'}`);
  check('이온: 염소 둘이 각각 −1', cls.length === 2 && cls.every(c => c.q === -1), `Cl q=[${cls.map(c => c.q)}]`);
  const sumq = w.elements.reduce((s, e) => s + (e.q || 0), 0);
  check('이온: 전하 보존 Σq=0(전자는 이동만)', sumq === 0, `Σq=${sumq}`);
  // 전자 더 줄 게 없으면(포화) 더는 안 넘긴다 — 오래 굴려도 전하 안정
  for (let i = 0; i < 50; i++) step(w);
  check('이온: 포화 후 전하 안정(Mg 계속 +2)', w.elements.find(e => e.Z === 12).q === 2);
}

// NaCl: 나트륨(결합가 1)은 전자 하나만 — 다중 결합가가 *원소마다 다름*을 보임(주기율표의 핵심)
{
  const w = world([atom(0, 11, 23), atom(20, 17, 35, -0.2)]);
  for (let i = 0; i < 3; i++) step(w);
  const na = w.elements.find(e => e.Z === 11), cl = w.elements.find(e => e.Z === 17);
  check('이온: NaCl 은 전자 1개만 이동(Na⁺·Cl⁻)', na && cl && na.q === 1 && cl.q === -1, `Na=${na ? na.q : '—'} Cl=${cl ? cl.q : '—'}`);
}

// ── G. 비활성 — 꽉 찬 껍질은 결합 안 함(주기적 비활성) ───────────────────────
{
  const w = world([atom(0, 10, 20), atom(-9, 10, 20, 0.3), atom(9, 1, 1, -0.3)]);  // Ne·Ne·H 가 다 접촉
  for (let i = 0; i < 10; i++) step(w);
  const nes = w.elements.filter(e => e.Z === 10);
  check('비활성: Ne 는 서로도 H 와도 결합 안 함(개수 유지)', w.elements.length === 3, `개수=${w.elements.length}`);
  check('비활성: Ne 는 전하도 안 띤다(전자 안 주고받음)', nes.length === 2 && nes.every(e => (e.q || 0) === 0));
}

// ── H. 하위 호환 — Z 없는 구형 세계는 rule_0002 가 그대로 처리(rule_0004 가 안 건드림) ──
{
  // 시드 en 으로 공유 병합(ΔEN 작음): rule_0002 의 옛 거동이 유지돼야 한다
  const w = world([
    { x: 0, y: 0, z: 0, vx: 0.2, vy: 0, vz: 0, m: 2, en: 1.0, q: 0, r: 3 },
    { x: 4, y: 0, z: 0, vx: -0.2, vy: 0, vz: 0, m: 2, en: 1.0, q: 0, r: 3 },
  ]);
  for (let i = 0; i < 5; i++) step(w);
  check('하위호환: Z 없는 구형 공유 병합은 그대로(2→1)', w.elements.length === 1, `개수=${w.elements.length}`);
}

console.log(failed === 0 ? '\n전체 통과 ✅' : `\n실패 ${failed}건 ❌`);
process.exitCode = failed === 0 ? 0 : 1;
