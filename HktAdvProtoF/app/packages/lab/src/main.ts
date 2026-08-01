// Lab 진입점 — 해시 라우팅. 페이지 그리기는 전부 순수 함수라 여기 남는 일은 마운트뿐이다.

import './style.css';

import { mount } from './mount.ts';
import { pageFor } from './pages/index.ts';
import { shellView } from './shell.ts';

function render(): void {
  const root = document.querySelector('#app');
  if (root === null) throw new Error('#app 을 찾을 수 없다');
  const route = window.location.hash.replace(/^#/, '') || '/v1';
  mount(shellView(pageFor(route)), root);
}

window.addEventListener('hashchange', render);
render();
