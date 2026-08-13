// Cycle Scope 표시 — 지금 어느 Cycle 까지의 게임을 굴리고 있는지 알려주는 실행 배지.
//
// 이것은 게임 UI(View)가 아니라 실행 도구다. 그래서 view/hud 가 아니라 조립 루트(app/)에 둔다 —
// View 는 GameView Specification 만으로 동작해야 하므로 Cycle 을 알아서는 안 된다(원칙 14).

import type { CycleModule, CycleScope } from '../world/index';

function cycleUrl(cycle: string | null): string {
  const url = new URL(location.href);
  if (cycle === null) url.searchParams.delete('cycle');
  else url.searchParams.set('cycle', cycle);
  return url.toString();
}

/** 현재 Scope 배지 + Cycle 전환 선택기 */
export function createCycleBadge(
  container: HTMLElement,
  scope: CycleScope,
  cycles: readonly CycleModule[],
): void {
  const entry = cycles.find((c) => c.id === scope.target);

  const root = document.createElement('div');
  root.id = 'cycle-badge';
  root.dataset.mode = scope.isLatest ? 'latest' : 'past';

  const select = document.createElement('select');
  select.id = 'cycle-select';
  select.title = '어느 Cycle 까지의 게임을 굴릴지 고른다';
  for (const c of cycles) {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = `${c.id}${c.id === cycles[cycles.length - 1]?.id ? ' (최신)' : ''}`;
    option.selected = c.id === scope.target;
    select.appendChild(option);
  }
  select.addEventListener('change', () => {
    location.href = cycleUrl(select.value);
  });

  const label = document.createElement('span');
  label.className = 'cycle-title';
  label.textContent = entry ? entry.title : scope.target;

  root.appendChild(select);
  root.appendChild(label);
  if (!scope.isLatest) {
    const note = document.createElement('span');
    note.className = 'cycle-note';
    note.textContent = `과거 Cycle 재현 — 이후 Cycle 의 Rule 은 꺼져 있다 (실행 중: ${scope.cycles.join(' → ')})`;
    root.appendChild(note);
  }
  container.appendChild(root);
}

/** 알 수 없는 Cycle 을 지정한 경우 — 조용히 최신으로 굴리지 않고 멈춰서 알린다 */
export function showCycleError(
  container: HTMLElement,
  error: unknown,
  cycles: readonly CycleModule[],
): void {
  const root = document.createElement('div');
  root.id = 'cycle-error';
  const message = error instanceof Error ? error.message : String(error);
  const list = cycles.map((c) => `<li><a href="${cycleUrl(c.id)}">${c.id}</a> — ${c.title}</li>`);
  root.innerHTML = `
    <h1>Cycle 을 찾을 수 없다</h1>
    <p>${message}</p>
    <ul>${list.join('')}</ul>
    <p><a href="${cycleUrl(null)}">최신 Cycle 로 실행</a></p>
  `;
  container.appendChild(root);
}
