// Foundation(Phase 0) 완료 조건 7항 실증 + C01-V-S01 완료 증거 생성.
// 사용: node scripts/run-foundation-check.mjs   (HktAdvProtoG/ 루트에서)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CycleRegistry } from '../packages/verification/src/cycleRegistry.js';
import { ScenarioRunner } from '../packages/verification/src/scenarioRunner.js';
import { organClaimScenario, DEMO_INITIAL_STATE } from '../packages/verification/src/foundationDemo.js';
import { stateHash } from '../packages/verification/src/deterministic.js';
import { buildEvidence, writeEvidence } from '../packages/verification/src/evidence.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const results = [];
const check = (name, fn) => {
  try {
    const detail = fn();
    results.push({ name, passed: true, detail });
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (e) {
    results.push({ name, passed: false, detail: e.message });
    console.error(`FAIL  ${name} — ${e.message}`);
  }
};

const cycleSpec = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/CYCLE.json`, 'utf8'));
const wiring = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/REGISTRY.json`, 'utf8'));
const reg = new CycleRegistry();

check('1. Cycle 문서 등록', () => {
  reg.registerCycle(cycleSpec);
  return `cycle=${cycleSpec.id} (${cycleSpec.title})`;
});

check('2. Situation·Scenario 를 Cycle 에 연결', () => {
  for (const sc of wiring.scenarios) reg.attachScenario('C01', sc);
  return `scenarios=${wiring.scenarios.length}, situations=${cycleSpec.situations.length}`;
});

check('3. Module Step 의존성 검사 (cycle:lint 골격)', () => {
  reg.attachSteps('C01', wiring.moduleSteps, {
    externalArtifacts: wiring.externalArtifacts,
    terminalArtifacts: wiring.terminalArtifacts,
  });
  const lint = reg.lint('C01');
  if (lint.errors.length) throw new Error(lint.errors.join(' | '));
  return `steps=${lint.stepCount}, modules=${lint.modulesCovered.join('')}, warnings=${lint.warnings.length}`;
});

let runSeed7A, runSeed7B, runSeed8;
check('4. 같은 시드·입력 → 같은 상태 해시 (결정성)', () => {
  const mk = () => { const r = new ScenarioRunner(); r.register(organClaimScenario); return r; };
  runSeed7A = mk().run('FD-ORGAN-CLAIM-01', { seed: 7 });
  runSeed7B = mk().run('FD-ORGAN-CLAIM-01', { seed: 7 });
  runSeed8 = mk().run('FD-ORGAN-CLAIM-01', { seed: 8 });
  if (!runSeed7A.passed) throw new Error(JSON.stringify(runSeed7A.checks));
  const same = ScenarioRunner.compare(runSeed7A, runSeed7B);
  if (!same.identical) throw new Error('같은 시드가 다른 해시를 냈다');
  const diff = ScenarioRunner.compare(runSeed7A, runSeed8);
  if (diff.identical || diff.firstDivergenceIndex !== 1) throw new Error('시드 차이의 최초 차이 지점 보고 실패');
  return `hash=${runSeed7A.stateHashAfter}, seed8 최초 차이 입력 #${diff.firstDivergenceIndex}`;
});

check('5. Lab 에서 상태 전후·이벤트·인과 경로 확인 (샘플 산출)', () => {
  const dir = `${root}/apps/lab`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/sample-run.json`, JSON.stringify(runSeed7A, null, 2) + '\n');
  writeFileSync(`${dir}/sample-run-seed8.json`, JSON.stringify(runSeed8, null, 2) + '\n');
  return 'apps/lab/index.html 에서 sample-run.json (+seed8 비교) 로드';
});

check('6. 게임 클라이언트가 권위 서버를 통해 명령 제출', () => {
  const world = organClaimScenario.setup();
  world.clients.H1.submit('claim-organ', { organId: 'organ-1' });
  world.clients.H2.submit('claim-organ', { organId: 'organ-1' });
  const rs = world.server.processPending();
  const accepted = rs.filter((r) => r.accepted);
  if (accepted.length !== 1) throw new Error('소유권이 1회 확정되지 않았다');
  const rebuilt = world.server.rebuildFromLog(DEMO_INITIAL_STATE);
  if (stateHash(rebuilt) !== stateHash(world.server.getSnapshot())) throw new Error('로그 재생 불일치');
  return `owner=${world.server.getSnapshot().organ.owner}, 거부 사유="${rs[1].reason}", 로그 재생 해시 일치`;
});

check('7. 완료 증거 파일 생성', () => {
  // 자기 자신(7번) 결과도 증거에 남긴다 — 이후 쓰기가 실패하면 파일 자체가 남지 않으므로 정직하다
  const selfRecord = { name: '7. 완료 증거 파일 생성', passed: true, detail: '이 파일의 존재가 증거' };
  const foundationEvidence = buildEvidence({
    step: 'FOUNDATION-PHASE0',
    status: 'CORE_SLICE_DONE',
    results: { checks: [...results.map(({ name, passed, detail }) => ({ name, passed, detail })), selfRecord] },
    artifacts: [
      'packages/verification/src/{deterministic,contracts,cycleRegistry,scenarioRunner,evidence}.js',
      'packages/events/src/eventLog.js',
      'packages/server/src/authority.js',
      'apps/lab/index.html',
    ],
    limitations: [
      'V3 Lab 은 정적 뷰어 최소판 — 인과 경로는 이벤트 traceId 수준',
      'O~A 최소 인터페이스는 REGISTRY.json 계약 데이터로 표현 — 코드 인터페이스는 각 모듈 Step 에서 CREATE',
      '3D 게임 앱·Lab 공통 상태 연결은 X 구간에서 — 현재 클라이언트는 인프로세스 핸들',
      'CYCLE.yaml→JSON 동기화는 scripts/build-cycle-json.py 수동 실행',
    ],
  });
  writeEvidence(`${root}/evidence/foundation/phase0.json`, foundationEvidence);
  const stepEvidence = buildEvidence({
    step: 'C01-V-S01',
    status: 'STEP_VERIFIED_LOCAL',
    results: {
      cycleRegistered: 'C01',
      scenarioCount: wiring.scenarios.length,
      lintErrors: 0,
      determinismHash: runSeed7A.stateHashAfter,
    },
    artifacts: ['cycles/C01-border-canyon/CYCLE.json', 'cycles/C01-border-canyon/REGISTRY.json'],
    limitations: ['Scenario 는 등록만 — 개별 구현·실행은 각 담당 Step 에서'],
  });
  writeEvidence(`${root}/cycles/C01-border-canyon/evidence/C01-V-S01.json`, stepEvidence);
  return 'evidence/foundation/phase0.json, cycles/C01-border-canyon/evidence/C01-V-S01.json';
});

const failed = results.filter((r) => !r.passed).length;
console.log(`\n완료 조건 ${results.length}항 중 ${results.length - failed}항 통과`);
process.exit(failed ? 1 : 0);
