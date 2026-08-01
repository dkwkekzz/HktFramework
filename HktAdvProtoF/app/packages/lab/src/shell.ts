// Lab 셸 — 좌측 모듈 목록 + 본문. 셸도 VNode 다.

import { LAB_PAGES, type LabPage } from './pages/index.ts';
import { h, type VElement } from './vnode.ts';

export function shellView(active: LabPage): VElement {
  return h('div', { class: 'shell' }, [
    h('nav', { class: 'nav' }, [
      h('h1', { class: 'brand' }, ['HktAdvProtoF Lab']),
      h('p', { class: 'brand-note' }, ['모듈이 눈으로 확인되지 않으면 완료가 아니다.']),
      h(
        'ul',
        {},
        LAB_PAGES.map((page) =>
          h('li', {}, [
            h(
              'a',
              {
                href: `#${page.route}`,
                class: page.route === active.route ? 'nav-link active' : 'nav-link',
              },
              [h('span', { class: 'nav-id' }, [page.id]), h('span', { class: 'nav-title' }, [page.title])],
            ),
          ]),
        ),
      ),
    ]),
    h('div', { class: 'content' }, [active.render()]),
  ]);
}
