// =====================================================================
// 콘텐츠 단계 데모 — C1~C7 을 실제로 굴려 관전 스냅샷을 만든다.
// ---------------------------------------------------------------------
// 자동 회귀(test/content-*.test.js)와 같은 코드 경로 (불변 원칙 ⑤). 각 단계의
// "완성되는 루프"와 검증을 한 줄 headline + 실행 로그로 눈 검증에 노출한다.
// =====================================================================
import { runC1 } from '../src/content/c1.js';
import { runC2 } from '../src/content/c2.js';
import { runC3 } from '../src/content/c3.js';
import { runC4 } from '../src/content/c4.js';
import { runC5 } from '../src/content/c5.js';
import { runC6 } from '../src/content/c6.js';
import { runC7, runC7AccessGate } from '../src/content/c7.js';

export function buildContentDemo(graph) {
  const c1 = runC1(graph, { delay: 0 });
  const c1f = runC1(graph, { delay: 25 });
  const c2 = runC2(graph);
  const c3 = runC3(graph);
  const c4 = runC4(graph);
  const c5 = runC5(graph);
  const c6 = runC6(graph);
  const c7 = runC7(graph);
  const gate = runC7AccessGate(graph);

  const stages = [
    {
      id: 'C1', title: '첫 사냥터 (R1 절반)',
      headline: `순행 창 안 4목적 완주=${c1.result === 'success'} · 창 놓침(25틱 지체)=${c1f.result}`,
      pass: c1.result === 'success' && c1f.result === 'timeout',
      log: c1.log,
    },
    {
      id: 'C2', title: '가설의 탄생 (R1 완성)',
      headline: `심장 이중 파문 ${c2.heart.branches.join('+')} · H1=${c2.hypothesis.h1}/H2=${c2.hypothesis.h2}(경합) · 약점 발견=${c2.weakness.done}`,
      pass: c2.heart.branches.length === 2 && c2.hypothesis.h1 === '확인' && c2.weakness.done,
      log: c2.log,
    },
    {
      id: 'C3', title: '재료의 세계 (R2 + R3)',
      headline: `무기급 재료 다중 해법: 채굴형=${c3.mine.done}·전투형=${c3.fight.done} · 역결합=${c3.retrobind.links.length > 0} · 무기 결합 아직 막힘=${c3.weaponBlocked}`,
      pass: c3.multiPath && c3.retrobind.links.length > 0 && c3.weaponBlocked,
      log: c3.log,
    },
    {
      id: 'C4', title: '앎의 문 (R4)',
      headline: `문전 차단=${c4.doorGate.noknowBlocked}·지식 봇 개방=${c4.doorGate.knowOpened} · E2 백로그 0.1.1.3.3 이탈=${c4.backlog.dropped} · 무기 사슬 완성 가능=${c4.weaponReady}`,
      pass: c4.doorGate.noknowBlocked && c4.doorGate.knowOpened && c4.backlog.dropped,
      log: c4.log,
    },
    {
      id: 'C5', title: '타인의 세계 (R5)',
      headline: `거래·강탈 같은 표본 충족=${c5.sameGoal} · 세계 상태(적대) 다르게 남음=${c5.differentState} · 수송 차단→세력 약화=${c5.raid.factionDone}`,
      pass: c5.sameGoal && c5.differentState && c5.raid.factionDone,
      log: c5.log,
    },
    {
      id: 'C6', title: '기다림의 세계 (R6)',
      headline: `내한 장비/적응=${c6.equip.made}/${c6.equip.coldAdapt} · H2 반증=${c6.h2.verdict} · 반증 후 진행 잔존=${c6.retained.equip} · 한파 창 판정 유효`,
      pass: c6.equip.made && c6.h2.verdict === '반증' && c6.retained.equip,
      log: c6.log,
    },
    {
      id: 'C7', title: '결전과 그 후 (R0)',
      headline: `두 해법(파괴/아사) 같은 done_when=${c7.pathIndependent} · 월식 밖 R0 차단=${gate.blocked} · 재개방 ${c7.aftermath.reopened.join(',')} · 신규 목적 편입 ${c7.aftermath.admittedGoals.length}`,
      pass: c7.pathIndependent && gate.blocked && c7.aftermath.reopened.length > 0 && c7.aftermath.admittedGoals.length > 0,
      log: c7.log,
    },
  ];

  return { stages, allPass: stages.every((s) => s.pass) };
}
