#!/usr/bin/env node
/**
 * 브라우저 Lab 을 헤드리스로 띄워 판정을 읽고 스크린샷을 남긴다.
 *
 * 원문 「5」 G4 직관 게이트는 "브라우저 Lab에서 전후 상태와 원인이 보임"을 요구한다.
 * 사람이 눈으로 보는 것을 대체하지는 않지만, 화면이 실제로 렌더되고 모든 장면이
 * 통과했다는 사실을 증거로 남긴다.
 */
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'node_modules', '.hkt');
const DIST = join(ROOT, 'apps', 'lab', 'dist');
const SHOT = join(ROOT, 'apps', 'lab', 'lab-screenshot.png');
/** 브라우저에서 대표 장면을 다시 실행하는 횟수 — 결과 해시가 하나여야 한다. */
const REPLAY_RUNS = 20;

mkdirSync(OUT_DIR, { recursive: true });

// 개발 서버 대신 정적 빌드를 쓴다 — 포트 대기 없이 결정적으로 로드된다.
execFileSync('pnpm', ['run', 'lab:build'], { cwd: ROOT, stdio: 'inherit' });

/**
 * Playwright 가 기대하는 빌드 번호와 설치된 Chromium 이 다를 수 있으므로
 * 환경에 있는 실행 파일을 직접 지목한다.
 */
function resolveChromium() {
  const candidates = [
    process.env['CHROMIUM_PATH'],
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ].filter((path) => typeof path === 'string' && path !== '');
  return candidates.find((path) => existsSync(path));
}

/** file:// 에서는 ES 모듈 로드가 막히므로 정적 서버로 띄운다. */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(DIST, normalize(requested).replace(/^(\.\.[/\\])+/, ''));
  if (!existsSync(filePath)) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
  response.end(readFileSync(filePath));
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();

const executablePath = resolveChromium();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('[data-testid="summary"]', { timeout: 15000 });

  const registryVisible = (await page.$('[data-testid="registry-board"]')) !== null;

  /**
   * 원문 「8」의 "V 단계 완료 결과" — 브라우저에서 다음 여섯 구획이 **실제로 그려지는지** 본다.
   * 구획이 있기만 하고 비어 있으면 통과가 아니다. 빈 표를 보여 주는 화면은 증거가 아니다.
   */
  const V_PHASE_SECTIONS = [
    '모든 모듈 상태',
    '실패한 검증',
    '의존성 그래프',
    '최신 코드 해시',
    '리플레이 해시',
    '자동 검증 결과',
  ];
  const vPhaseBoard = await page.evaluate((names) => {
    const board = document.querySelector('[data-testid="v-phase-board"]');
    if (!board) return { present: false, sections: {} };
    const sections = {};
    for (const name of names) {
      const node = board.querySelector(`[data-section="${name}"]`);
      // 제목(h3)을 뺀 본문에 글자가 남아 있어야 채워진 것으로 본다.
      const body = node ? (node.textContent ?? '').replace(name, '').trim() : '';
      sections[name] = { present: node !== null, filled: body.length > 0 };
    }
    return {
      present: true,
      sections,
      moduleRows: board.querySelectorAll('[data-module]').length,
    };
  }, V_PHASE_SECTIONS);

  const vPhaseComplete =
    vPhaseBoard.present &&
    vPhaseBoard.moduleRows > 0 &&
    V_PHASE_SECTIONS.every(
      (name) => vPhaseBoard.sections[name]?.present && vPhaseBoard.sections[name]?.filled,
    );
  if (!vPhaseComplete) {
    console.error(
      '[lab] 원문 「8」의 V 단계 완료 결과 화면이 갖춰지지 않았다: ' +
        JSON.stringify(vPhaseBoard, null, 2),
    );
  }

  // 모듈 탭을 하나씩 눌러 각 모듈의 대표 장면을 모두 확인한다.
  const moduleIds = await page.$$eval('[data-testid^="module-tab-"]', (nodes) =>
    nodes.map((node) => node.dataset.testid.replace('module-tab-', '')),
  );
  const modules = {};
  for (const moduleId of moduleIds) {
    await page.click(`[data-testid="module-tab-${moduleId}"]`);
    await page.waitForSelector(`[data-testid="summary"][data-module="${moduleId}"]`);

    const panels = await page.$$('[data-testid="scenario-panel"]');
    const scenarios = {};
    for (const panel of panels) {
      const id = await panel.getAttribute('data-scenario');
      scenarios[id] = (await panel.getAttribute('data-passed')) === 'true' ? 'passed' : 'failed';
    }
    const allPassed =
      (await page.getAttribute('[data-testid="summary"]', 'data-all-passed')) === 'true';
    const screenshot = SHOT.replace('.png', `-${moduleId}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });

    // 리플레이: 같은 장면을 브라우저에서 여러 번 다시 실행해 결과 해시 개수를 센다.
    const replay = await page.evaluate(
      ([id, runs]) => window.__hktReplayDigest?.(id, runs) ?? null,
      [moduleId, REPLAY_RUNS],
    );

    modules[moduleId] = {
      scenarios,
      allPassed: allPassed && panels.length > 0 && replay?.uniqueHashes === 1,
      panels: panels.length,
      checks: (await page.$$('[data-testid="check"]')).length,
      replay,
      screenshot: relative(ROOT, screenshot).split(sep).join('/'),
    };
  }

  const requested = process.argv[2];
  const target = requested && modules[requested] ? modules[requested] : null;

  // 요청한 모듈이 Lab 에 없으면 다른 모듈의 판정을 그 모듈의 증거로 넘겨서는 안 된다.
  // 남의 장면으로 LAB_PASS 를 받는 경로를 여기서 끊는다 (원문 「23」: 증거 없이 통과 표시 금지).
  const missingRequested = requested !== undefined && target === null;
  if (missingRequested) {
    console.error(
      `[lab] 모듈 ${requested} 의 탭이 Lab 에 없다. ` +
        `lab/index.ts 가 \`labModule\` 을 내보내는지 확인할 것. 발견된 모듈: ${moduleIds.join(', ') || '없음'}`,
    );
  }

  const summary = {
    modules,
    requestedModule: requested ?? null,
    error: missingRequested ? `E_LAB_MODULE_NOT_FOUND: ${requested}` : null,
    // verify.mjs 가 특정 모듈로 물어보면 그 모듈의 판정을 위로 올려 준다.
    scenarios: missingRequested
      ? {}
      : target
        ? target.scenarios
        : Object.values(modules).reduce((all, module) => ({ ...all, ...module.scenarios }), {}),
    replay: target?.replay ?? null,
    screenshot: target?.screenshot ?? null,
    allPassed:
      errors.length === 0 &&
      registryVisible &&
      vPhaseComplete &&
      moduleIds.length > 0 &&
      !missingRequested &&
      (target ? target.allPassed : Object.values(modules).every((module) => module.allPassed)),
    registryVisible,
    vPhaseBoard,
    vPhaseComplete,
    consoleErrors: errors,
  };
  writeFileSync(join(OUT_DIR, 'lab-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.allPassed) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
