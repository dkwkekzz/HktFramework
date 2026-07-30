import {
  runV0Scenarios,
  v0Module,
  v0ScenarioCount,
} from '@hkt/v0-module-contract/lab';
import { buildRegistry, type ScenarioRun } from '@hkt/v0-module-contract';
import './style.css';

/**
 * 브라우저 Lab (원문 「24. 브라우저 Lab의 공통 화면」).
 *
 * 지금은 V0 만 등록되어 있으므로 이 화면은 V0 의 대표 장면과 레지스트리를 보여준다.
 * 모듈 상태 관리·증거 발급은 V4 의 몫이므로 여기서 하지 않는다.
 */

// 저장소의 실제 MODULE.yaml — V0 의 입력 그대로를 브라우저에서 읽는다.
const rawContracts = import.meta.glob('../../../packages/*/*/MODULE.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const documents = Object.entries(rawContracts)
  .map(([path, text]) => ({
    path: path.replace(/^(\.\.\/)+/, ''),
    text,
  }))
  .sort((a, b) => (a.path < b.path ? -1 : 1));

const workspaceReport = buildRegistry(documents);

/** 화면 상태 — [1틱 실행] 은 하나씩, [전체 실행] 은 전부, [다른 시드] 는 시드만 바꾼다. */
const state = {
  seedOffset: 0n,
  revealed: 0,
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

function scenarioPanel(run: ScenarioRun, index: number): HTMLElement {
  const panel = el('article', run.passed ? 'panel pass' : 'panel fail');
  panel.dataset['testid'] = 'scenario-panel';
  panel.dataset['scenario'] = run.scenarioId;
  panel.dataset['passed'] = String(run.passed);

  const header = el('header', 'panel-header');
  header.append(
    el('span', 'index', `${index + 1}/${v0ScenarioCount}`),
    el('h2', undefined, `${run.scenarioId} — ${run.title}`),
    el('span', run.passed ? 'badge ok' : 'badge no', run.passed ? '통과' : '실패'),
  );
  panel.append(header);

  panel.append(section('모듈 목적', run.view.purpose));
  panel.append(section('입력 상태', rowTable([...run.view.input])));
  panel.append(section('후보 (문서별 판정)', rowTable([...run.view.candidates])));
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
  const pre = el('pre', undefined, JSON.stringify(run.assertions, null, 2));
  details.append(pre);
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
            ` · 후행 ${
              (workspaceReport.registry.dependents[module.id] ?? []).join(', ') || '없음'
            }`,
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
  const runs = runV0Scenarios(state.seedOffset);
  const visible = runs.slice(0, Math.max(state.revealed, 0));
  const allPassed = runs.every((run) => run.passed);

  app!.replaceChildren();

  const title = el('header', 'app-header');
  title.append(
    el('h1', undefined, 'HktAdvProtoE Lab'),
    el(
      'p',
      'subtitle',
      `${v0Module.id} v${v0Module.version} · ${v0Module.purpose}`,
    ),
  );
  app!.append(title);

  const controls = el('div', 'controls');
  const tick = el('button', undefined, '1틱 실행');
  tick.dataset['testid'] = 'run-tick';
  tick.addEventListener('click', () => {
    state.revealed = state.revealed >= v0ScenarioCount ? 0 : state.revealed + 1;
    render();
  });
  const runAll = el('button', undefined, '전체 실행');
  runAll.dataset['testid'] = 'run-all';
  runAll.addEventListener('click', () => {
    state.revealed = v0ScenarioCount;
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
    `시나리오 ${runs.filter((r) => r.passed).length}/${runs.length} 통과 · 시드 오프셋 +${state.seedOffset}`,
  );
  summary.dataset['testid'] = 'summary';
  summary.dataset['allPassed'] = String(allPassed);
  controls.append(summary);
  app!.append(controls);

  app!.append(registryBoard());

  if (visible.length === 0) {
    app!.append(
      el('p', 'hint', '[전체 실행] 을 누르면 V0 의 대표 검증 장면 6개가 순서대로 나타난다.'),
    );
  }
  visible.forEach((run, index) => app!.append(scenarioPanel(run, index)));
}

// 첫 화면부터 전부 보이게 한다 — 눈으로 확인하는 것이 이 화면의 목적이다.
state.revealed = v0ScenarioCount;
render();
