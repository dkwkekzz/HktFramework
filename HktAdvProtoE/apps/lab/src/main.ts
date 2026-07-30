import { runV0Scenarios, v0Module, v0ScenarioCount } from '@hkt/v0-module-contract/lab';
import { runV1Scenarios, v1Module, v1ScenarioCount } from '@hkt/v1-schema/lab';
import { buildRegistry, sha256Hex, type ScenarioRun } from '@hkt/v0-module-contract';
import './style.css';

/**
 * 브라우저 Lab (원문 「24. 브라우저 Lab의 공통 화면」).
 *
 * 등록된 모듈마다 같은 형태의 검증 화면을 그린다. 모듈 상태 관리·증거 발급은 V4 의 몫이므로
 * 여기서는 계약 레지스트리와 각 모듈의 대표 장면만 보여 준다.
 */

// 저장소의 실제 MODULE.yaml — V0 의 입력 그대로를 브라우저에서 읽는다.
const rawContracts = import.meta.glob('../../../packages/*/*/MODULE.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const documents = Object.entries(rawContracts)
  .map(([path, text]) => ({ path: path.replace(/^(\.\.\/)+/, ''), text }))
  .sort((a, b) => (a.path < b.path ? -1 : 1));

const workspaceReport = buildRegistry(documents);

interface LabModule {
  id: string;
  version: string;
  purpose: string;
  scenarioCount: number;
  run(seedOffset: bigint): ScenarioRun[];
}

const modules: LabModule[] = [
  {
    id: v0Module.id,
    version: v0Module.version,
    purpose: v0Module.purpose,
    scenarioCount: v0ScenarioCount,
    run: runV0Scenarios,
  },
  {
    id: v1Module.id,
    version: v1Module.version,
    purpose: v1Module.purpose,
    scenarioCount: v1ScenarioCount,
    run: runV1Scenarios,
  },
];

/** 화면 상태 — [1틱 실행] 은 하나씩, [전체 실행] 은 전부, [다른 시드] 는 시드만 바꾼다. */
const state = {
  moduleId: modules[0]?.id ?? 'V0',
  seedOffset: 0n,
  revealed: Number.POSITIVE_INFINITY,
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app 이 없다.');

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function rowTable(rows: { label: string; value: string }[]): HTMLElement {
  const table = el('table', 'rows');
  for (const row of rows) {
    const tr = el('tr');
    tr.append(el('th', undefined, row.label), el('td', undefined, row.value));
    table.append(tr);
  }
  return table;
}

function section(title: string, body: HTMLElement | string): HTMLElement {
  const wrap = el('section', 'panel-section');
  wrap.append(el('h3', undefined, title));
  wrap.append(typeof body === 'string' ? el('p', undefined, body) : body);
  return wrap;
}

function scenarioPanel(run: ScenarioRun, index: number, total: number): HTMLElement {
  const panel = el('article', run.passed ? 'panel pass' : 'panel fail');
  panel.dataset['testid'] = 'scenario-panel';
  panel.dataset['scenario'] = run.scenarioId;
  panel.dataset['passed'] = String(run.passed);

  const header = el('header', 'panel-header');
  header.append(
    el('span', 'index', `${index + 1}/${total}`),
    el('h2', undefined, `${run.scenarioId} — ${run.title}`),
    el('span', run.passed ? 'badge ok' : 'badge no', run.passed ? '통과' : '실패'),
  );
  panel.append(header);

  panel.append(section('모듈 목적', run.view.purpose));
  panel.append(section('입력 상태', rowTable([...run.view.input])));
  panel.append(section('후보', rowTable([...run.view.candidates])));
  panel.append(section('선택 결과', run.view.result));

  const reasons = el('ul', 'reasons');
  for (const reason of run.view.reasons) reasons.append(el('li', undefined, reason));
  panel.append(section('이유', reasons));

  panel.append(
    section(
      '상태 전후',
      rowTable([
        { label: '전', value: run.view.before },
        { label: '후', value: run.view.after },
      ]),
    ),
  );

  const checks = el('ul', 'checks');
  for (const check of run.view.checks) {
    const item = el('li', check.passed ? 'ok' : 'no', `${check.passed ? '✓' : '✗'} ${check.label}`);
    item.dataset['testid'] = 'check';
    checks.append(item);
  }
  panel.append(section(`검증 (시드 ${run.seed})`, checks));

  const details = el('details', 'assertions');
  details.append(el('summary', undefined, '단정 상세 (expected / actual)'));
  details.append(el('pre', undefined, JSON.stringify(run.assertions, null, 2)));
  panel.append(details);

  return panel;
}

function registryBoard(): HTMLElement {
  const wrap = el('article', 'panel registry');
  wrap.dataset['testid'] = 'registry-board';
  const header = el('header', 'panel-header');
  header.append(
    el('h2', undefined, '모듈 레지스트리 (저장소의 실제 MODULE.yaml)'),
    el(
      'span',
      workspaceReport.rejected.length === 0 ? 'badge ok' : 'badge no',
      `등록 ${workspaceReport.registered.length} / 거부 ${workspaceReport.rejected.length}`,
    ),
  );
  wrap.append(header);

  const table = el('table', 'rows');
  const head = el('tr');
  for (const label of ['id', 'name', '선행', '소유 상태', '목적']) {
    head.append(el('th', undefined, label));
  }
  table.append(head);
  for (const module of workspaceReport.registry.modules) {
    const tr = el('tr');
    tr.dataset['module'] = module.id;
    tr.append(
      el('td', undefined, module.id),
      el('td', undefined, module.name),
      el('td', undefined, module.dependsOn.length > 0 ? module.dependsOn.join(', ') : 'none'),
      el('td', undefined, module.ownsState.length > 0 ? module.ownsState.join(', ') : 'none'),
      el('td', undefined, module.purpose),
    );
    table.append(tr);
  }
  wrap.append(section('등록된 모듈', table));
  wrap.append(
    section(
      '의존성 그래프',
      rowTable(
        workspaceReport.registry.modules.map((module) => ({
          label: module.id,
          value:
            (module.dependsOn.length > 0 ? `선행 ${module.dependsOn.join(', ')}` : '선행 없음') +
            ` · 후행 ${(workspaceReport.registry.dependents[module.id] ?? []).join(', ') || '없음'}`,
        })),
      ),
    ),
  );
  wrap.append(
    section(
      '레지스트리 해시 · 위상 순서',
      rowTable([
        { label: 'registryHash', value: workspaceReport.registry.hash },
        { label: 'order', value: workspaceReport.registry.order.join(' → ') },
      ]),
    ),
  );
  if (workspaceReport.issues.length > 0) {
    const list = el('ul', 'reasons');
    for (const issue of workspaceReport.issues) {
      list.append(el('li', undefined, `${issue.path} · ${issue.code} · ${issue.message}`));
    }
    wrap.append(section('실패한 검증', list));
  }
  return wrap;
}

function render(): void {
  const active = modules.find((module) => module.id === state.moduleId) ?? (modules[0] as LabModule);
  const runs = active.run(state.seedOffset);
  const visible = runs.slice(0, Math.max(state.revealed, 0));
  const allPassed = runs.every((run) => run.passed);

  app!.replaceChildren();

  const title = el('header', 'app-header');
  title.append(
    el('h1', undefined, 'HktAdvProtoE Lab'),
    el('p', 'subtitle', `${active.id} v${active.version} · ${active.purpose}`),
  );
  app!.append(title);

  const tabs = el('div', 'controls');
  for (const module of modules) {
    const tab = el(
      'button',
      module.id === active.id ? 'tab active' : 'tab',
      `${module.id} (${module.scenarioCount})`,
    );
    tab.dataset['testid'] = `module-tab-${module.id}`;
    tab.addEventListener('click', () => {
      state.moduleId = module.id;
      state.revealed = Number.POSITIVE_INFINITY;
      render();
    });
    tabs.append(tab);
  }
  app!.append(tabs);

  const controls = el('div', 'controls');
  const tick = el('button', undefined, '1틱 실행');
  tick.dataset['testid'] = 'run-tick';
  tick.addEventListener('click', () => {
    const shown = Math.min(state.revealed, active.scenarioCount);
    state.revealed = shown >= active.scenarioCount ? 1 : shown + 1;
    render();
  });
  const runAll = el('button', undefined, '전체 실행');
  runAll.dataset['testid'] = 'run-all';
  runAll.addEventListener('click', () => {
    state.revealed = active.scenarioCount;
    render();
  });
  const reseed = el('button', undefined, '다른 시드');
  reseed.dataset['testid'] = 'reseed';
  reseed.addEventListener('click', () => {
    state.seedOffset += 1000n;
    render();
  });
  controls.append(tick, runAll, reseed);

  const summary = el(
    'span',
    allPassed ? 'badge ok' : 'badge no',
    `${active.id} 시나리오 ${runs.filter((run) => run.passed).length}/${runs.length} 통과 · 시드 오프셋 +${state.seedOffset}`,
  );
  summary.dataset['testid'] = 'summary';
  summary.dataset['allPassed'] = String(allPassed);
  summary.dataset['module'] = active.id;
  controls.append(summary);
  app!.append(controls);

  app!.append(registryBoard());

  visible.forEach((run, index) => app!.append(scenarioPanel(run, index, runs.length)));
}

/**
 * 리플레이 측정 훅.
 *
 * 같은 모듈의 대표 장면을 여러 번 다시 실행해 결과 해시가 하나인지 센다.
 * tools/lab-shot.mjs 가 이 값을 읽어 증거(원문 「21」의 `replay`)에 넣는다 —
 * 증거의 리플레이 수치는 손으로 적지 않고 실제 실행에서 나온다.
 */
declare global {
  interface Window {
    __hktReplayDigest?: (moduleId: string, runs: number) => { runs: number; uniqueHashes: number };
  }
}

window.__hktReplayDigest = (moduleId: string, runs: number) => {
  const target = modules.find((module) => module.id === moduleId) ?? (modules[0] as LabModule);
  const hashes = new Set<string>();
  for (let run = 0; run < runs; run += 1) {
    hashes.add(sha256Hex(JSON.stringify(target.run(0n))));
  }
  return { runs, uniqueHashes: hashes.size };
};

render();
