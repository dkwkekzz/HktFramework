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
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'node_modules', '.hkt');
const DIST = join(ROOT, 'apps', 'lab', 'dist');
const SHOT = join(ROOT, 'apps', 'lab', 'lab-screenshot.png');

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

  const panels = await page.$$('[data-testid="scenario-panel"]');
  const scenarios = {};
  for (const panel of panels) {
    const id = await panel.getAttribute('data-scenario');
    const passed = (await panel.getAttribute('data-passed')) === 'true';
    scenarios[id] = passed ? 'passed' : 'failed';
  }

  const allPassed = (await page.getAttribute('[data-testid="summary"]', 'data-all-passed')) === 'true';
  const registryVisible = (await page.$('[data-testid="registry-board"]')) !== null;
  const checkCount = (await page.$$('[data-testid="check"]')).length;

  await page.screenshot({ path: SHOT, fullPage: true });

  const summary = {
    scenarios,
    allPassed: allPassed && errors.length === 0 && registryVisible && Object.keys(scenarios).length > 0,
    panels: panels.length,
    checks: checkCount,
    registryVisible,
    consoleErrors: errors,
    screenshot: 'apps/lab/lab-screenshot.png',
  };
  writeFileSync(join(OUT_DIR, 'lab-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.allPassed) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
