// Web HUD — HUD Capability 엔진. counter / flag 위젯 · 프롬프트 · 획득 토스트 ·
// entity 라벨을 그릴 뿐, 라벨·아이콘·문구는 전부 Snapshot 의 지시를 그대로 표시한다.

import type { SessionPresentation } from '../presentation/session-presentation';
import type { SceneState } from '../scene/scene-state';

export interface EntityLabel {
  /** 어느 몸의 것인가 — 프레임 사이에 같은 요소를 이어 쓰기 위한 키 */
  id: string;
  x: number;
  y: number;
  text: string;
}

// 몸 위에 붙는 관찰 (C007 entityHud) — 화면 좌표는 조립 루트가 투영해 준다.
export interface EntityPlate {
  /** 어느 몸의 것인가 — 프레임 사이에 같은 요소를 이어 쓰기 위한 키 */
  id: string;
  x: number;
  y: number;
  name: string;
  health: number;
  healthMaximum: number;
  healthRatio: number;
  downed: boolean;
  /** 속성 관찰이 켜졌을 때 함께 펼칠 줄들 (C007 R2) */
  inspect?: string[];
}

// 타격 결과 표시 (C007) — age 는 0(방금) .. 1(사라질 때)
export interface StrikeMark {
  x: number;
  y: number;
  text: string;
  emphasis: boolean;
  age: number;
  /** 그 숫자가 나온 경위 (C010·C011) — 관찰 토글 또는 막기가 채운다 */
  detail?: string;
  /** 막기가 한 일 (C011) — 무너짐은 막힘과 다르게 그린다 */
  guard?: 'blocked' | 'broken';
}

export interface HudOverlays {
  plates: EntityPlate[];
  strikes: StrikeMark[];
}

export interface Hud {
  render(
    scene: SceneState,
    labels: EntityLabel[],
    session?: SessionPresentation,
    overlays?: HudOverlays,
  ): void;
}

/** 값이 그대로면 DOM 을 건드리지 않는다 — 프레임마다 글자를 다시 래스터화하지 않게 한다 */
function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

function setAttribute(element: HTMLElement, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

/**
 * 몸에 붙어 다니는 표시들의 층 — 프레임마다 다시 만들지 않고 **자리만 옮긴다**.
 *
 * 매 프레임 innerHTML 로 갈아 끼우면 브라우저가 요소를 지웠다 다시 만들고 글자를
 * 처음부터 래스터화한다. 그 비용이 프레임마다 들쭉날쭉해서 몸은 매끄럽게 흐르는데
 * 표시만 늦거나 앞서 보이고, left/top 을 소수점 px 로 밀면 그때마다 글자가 반 픽셀씩
 * 다른 자리에 다시 그려져 지글거린다 — 움직일 때 HUD 가 떨리던 것이 이것이다.
 *
 * 살아 있는 요소를 transform 으로만 옮기면 배치도 그리기도 다시 하지 않고 합성기가
 * 자리를 맡는다. 소수점 좌표도 그대로 매끄럽게 반영된다.
 */
function pinnedLayer<T extends { id: string; x: number; y: number }>(
  layer: HTMLElement,
  create: () => HTMLElement,
  update: (body: HTMLElement, value: T) => void,
): (values: readonly T[]) => void {
  const nodes = new Map<string, { anchor: HTMLElement; body: HTMLElement }>();

  return (values) => {
    const seen = new Set<string>();
    for (const value of values) {
      seen.add(value.id);
      let node = nodes.get(value.id);
      if (!node) {
        const anchor = document.createElement('div');
        anchor.className = 'hud-anchor';
        const body = create();
        anchor.appendChild(body);
        layer.appendChild(anchor);
        node = { anchor, body };
        nodes.set(value.id, node);
      }
      node.anchor.style.transform = `translate3d(${value.x}px, ${value.y}px, 0)`;
      update(node.body, value);
    }

    // 지시에서 사라진 몸의 표시는 함께 사라진다
    for (const [id, node] of nodes) {
      if (seen.has(id)) continue;
      node.anchor.remove();
      nodes.delete(id);
    }
  };
}

function createHudElement(className: string, tag = 'div'): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}

export function createHud(container: HTMLElement): Hud {
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div class="hud-panel" id="hud-items"></div>
    <div class="hud-keys" id="hud-keys"></div>
    <div id="hud-labels"></div>
    <div id="hud-plates"></div>
    <div id="hud-strikes"></div>
    <div class="hud-self" id="hud-self"></div>
    <div class="hud-toast" id="hud-toast"></div>
    <div class="hud-hint" id="hud-mine-hint"></div>
    <div class="hud-link" id="hud-link"></div>
    <div class="hud-linkpanel" id="hud-linkpanel"></div>
  `;
  container.appendChild(root);

  const items = root.querySelector('#hud-items') as HTMLElement;
  const keys = root.querySelector('#hud-keys') as HTMLElement;
  const labelLayer = root.querySelector('#hud-labels') as HTMLElement;
  const plateLayer = root.querySelector('#hud-plates') as HTMLElement;
  const strikeLayer = root.querySelector('#hud-strikes') as HTMLElement;
  const selfPanel = root.querySelector('#hud-self') as HTMLElement;
  const toast = root.querySelector('#hud-toast') as HTMLElement;
  const hint = root.querySelector('#hud-mine-hint') as HTMLElement;
  const link = root.querySelector('#hud-link') as HTMLElement;
  const linkPanel = root.querySelector('#hud-linkpanel') as HTMLElement;

  const lastCounters = new Map<string, number>();
  let toastUntil = 0;

  // entity 라벨 — 몸 위에 붙는 한 줄 (예: "돌 4")
  const renderLabels = pinnedLayer<EntityLabel>(
    labelLayer,
    () => createHudElement('hud-label'),
    (body, label) => setText(body, label.text),
  );

  // 존재 HUD (C007) — 이름과 생명은 그 몸 위에 늘 붙어 있다.
  // 이 코드는 무엇이 hp 인지 모른다. 이름과 비율과 쓰러짐 여부를 그릴 뿐이다.
  //
  // 줄마다 따로 가운데를 맞춘다 (CSS 의 width:0) — 생명 숫자의 자릿수가 바뀌어도
  // (100 → 98) 표지 전체 폭이 달라지지 않으므로 이름이 옆으로 밀리지 않는다.
  const renderPlates = pinnedLayer<EntityPlate>(
    plateLayer,
    () => {
      const body = createHudElement('hud-plate');
      const bar = createHudElement('hud-plate-bar', 'span');
      bar.appendChild(document.createElement('i'));
      body.append(
        createHudElement('hud-plate-name', 'span'),
        bar,
        createHudElement('hud-plate-hp', 'span'),
        createHudElement('hud-plate-inspect', 'span'),
      );
      return body;
    },
    (body, plate) => {
      const part = (selector: string) => body.querySelector(selector) as HTMLElement;

      setAttribute(body, 'data-downed', String(plate.downed));
      setText(part('.hud-plate-name'), plate.name);

      const fill = part('.hud-plate-bar i');
      const width = `${Math.round(plate.healthRatio * 100)}%`;
      if (fill.style.width !== width) fill.style.width = width;

      setText(part('.hud-plate-hp'), `${plate.health} / ${plate.healthMaximum}`);
      // 속성 관찰이 켜졌을 때만 채워진다 — 비면 CSS 가 자리째 감춘다 (:empty).
      // 줄바꿈은 white-space:pre 가 맡으므로 태그를 섞지 않는다.
      setText(part('.hud-plate-inspect'), plate.inspect?.join('\n') ?? '');
    },
  );

  return {
    render(scene, labels, session, overlays) {
      // 이어짐 상태 — 세계의 상태가 아니라 관찰자 쪽 상태다 (C003)
      if (session) {
        link.textContent = session.state === 'connected' ? '' : session.text;
        link.dataset.state = session.state;
        container.dataset.stale = String(session.stale); // 화면 전체 표시용

        // 이어짐 패널 — 정상일 때도 보인다 (C005 session.visibility: always).
        // 여기 있는 줄은 전부 결정 Layer 가 만든 것이며, 이 코드는 의미를 모른다.
        const lines = [...session.binding, ...session.telemetry];
        linkPanel.innerHTML = lines
          .map(
            (l) =>
              `<span class="hud-linkline"${l.grade ? ` data-grade="${l.grade}"` : ''}>` +
              `<b>${l.label}</b> ${l.value}</span>`,
          )
          .join('');
        linkPanel.dataset.state = session.state;
      }

      // HUD 위젯 — 지시받은 widget 종류대로 그린다
      const parts: string[] = [];
      for (const item of scene.hud) {
        if (item.widget === 'counter') {
          const value = item.value as number;
          parts.push(`<span class="hud-item">${item.icon ?? ''} ${item.label}: ${value}</span>`);
          // 획득 토스트 — celebrateGain 지시가 있는 counter 의 증가를 표시
          const prev = lastCounters.get(item.id);
          if (item.celebrateGain && prev !== undefined && value > prev) {
            toast.textContent = `+${value - prev} ${item.label} 획득!`;
            toastUntil = performance.now() + 1600;
          }
          lastCounters.set(item.id, value);
        } else if (item.widget === 'label') {
          // 값 + (있으면) 진행 막대 — 진행 중인 행동이 얼마나 남았는지 보인다
          const bar =
            item.progress === undefined
              ? ''
              : `<span class="hud-bar"><i style="width:${Math.round(item.progress * 100)}%"></i></span>`;
          parts.push(`<span class="hud-item">${item.label}: ${item.value}${bar}</span>`);
        } else {
          parts.push(
            `<span class="hud-item hud-flag" data-on="${item.value}">${item.label} ${item.value ? '✓' : '✗'}</span>`,
          );
        }
      }
      items.innerHTML = parts.join('');
      toast.style.opacity = performance.now() < toastUntil ? '1' : '0';

      // 조작 안내 — 이동(엔진 기본) + 키 지시가 있는 interaction
      // 같은 키·프롬프트가 대상 수만큼 오더라도 안내는 한 줄이다
      // 충돌체 관찰 토글은 View 자체 기능이라 엔진 기본 안내에 둔다 (C006)
      // 속성 관찰 토글도 View 자체 기능이라 엔진 기본 안내에 둔다 (C007 R2)
      // C009 — 명령 표면을 여는 안내가 맨 위다. 여기부터가 "무엇을 할 수 있는지"의
      // 입구이며, 아래 두 줄은 그 목록에도 있는 것의 지름길이다.
      const keyLines = new Set([
        '명령: /',
        '이동: WASD / 방향키',
        '충돌체 관찰: C',
        '속성 관찰: V',
      ]);
      for (const i of scene.interactions) {
        if (i.key && i.prompt) keyLines.add(`${i.prompt}: ${i.keyLabel ?? i.key}`);
      }
      keys.innerHTML = [...keyLines].join('<br/>');

      // 몸에 붙는 표시 — 요소를 이어 쓰고 자리만 옮긴다 (pinnedLayer 참고)
      renderLabels(labels);
      renderPlates(overlays?.plates ?? []);

      // 타격 결과 (C007) — 맞은 자리에서 떠올랐다 옅어진다
      strikeLayer.innerHTML = (overlays?.strikes ?? [])
        .map(
          (s) =>
            `<div class="hud-strike" data-emphasis="${s.emphasis}" ` +
            (s.guard ? `data-guard="${s.guard}" ` : '') +
            `style="left:${s.x}px;top:${s.y - s.age * 34}px;opacity:${(1 - s.age).toFixed(2)}">` +
            `${s.text}` +
            // C010 — 경위는 숫자 아래에 작게. 켜져 있을 때만 온다.
            (s.detail ? `<span class="hud-strike-detail">${s.detail}</span>` : '') +
            `</div>`,
        )
        .join('');

      // 자기 정보 (C007) — 자원 막대와 능력치·배율. 늘 눈앞에 있는 자리다.
      if (scene.self) {
        const s = scene.self;
        selfPanel.dataset.downed = String(s.downed);
        selfPanel.innerHTML =
          `<span class="hud-self-row"><b>HP</b>` +
          `<span class="hud-self-bar" data-kind="hp"><i style="width:${Math.round(s.healthRatio * 100)}%"></i></span>` +
          `<em>${s.health} / ${s.healthMaximum}</em></span>` +
          `<span class="hud-self-row"><b>CP</b>` +
          `<span class="hud-self-bar" data-kind="cp"><i style="width:${Math.round(s.energyRatio * 100)}%"></i></span>` +
          `<em>${s.energy} / ${s.energyMaximum}</em></span>` +
          `<span class="hud-self-mode">${s.moveMode}</span>` +
          // C011 — 막기는 스스로 끝나지 않는다. 들고 있다는 것이 늘 보여야 한다.
          (s.guard.text
            ? `<span class="hud-self-stance" data-broken="${s.guard.broken}">${s.guard.text}</span>`
            : '') +
          s.lines.map((line) => `<span class="hud-self-line">${line}</span>`).join('');
      } else {
        selfPanel.innerHTML = '';
      }

      // 프롬프트 — 키 지시 interaction 중: 가용한 것 우선, 아니면 불가 문구
      const keyed = scene.interactions.filter((i) => i.key);
      const active = keyed.find((i) => i.available) ?? keyed.find((i) => i.unavailableText);
      if (active?.available) {
        hint.textContent = `[${active.keyLabel ?? active.key}] ${active.prompt ?? ''}`.trim();
        hint.dataset.state = 'available';
      } else if (active?.unavailableText) {
        hint.textContent = active.unavailableText;
        hint.dataset.state = 'unavailable';
      } else {
        hint.textContent = '';
      }
    },
  };
}
