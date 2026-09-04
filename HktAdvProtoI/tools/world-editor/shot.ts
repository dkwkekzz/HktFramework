// World Shot — 실제로 띄운 게임의 그 방을 찍는다 (C007 ADDED · SPEC-008).
//
//   npm run world:shot -- <REGION_ID> [--at x,z] [--out <file>]
//
// 방은 `HKT_SPAWN_REGION` · 자리는 `HKT_SPAWN` 으로 vite 에 넘긴다 — 둘 다 vite.config.ts 가 이미
// 가진 **검증용 손잡이**이고 세계의 규칙을 바꾸지 않는다. 소프트웨어 GPU 에서는 한 프레임이 수 초라
// 걷는 조작이 이어지지 않으므로, 먼 방을 보려면 거기서 시작하는 수밖에 없다
// (tools/fx-lab/test/terrain-shot.js 가 같은 이유로 그렇게 한다).
//
// vite 를 띄우고 죽이는 방식은 tools/cycle-shot/shot.cjs 를 그대로 따른다:
//   · --strictPort 로 포트를 못 잡으면 조용히 다른 포트로 새지 않고 그 자리에서 죽는다
//   · detached 로 띄워 npx → sh → vite 로 이어지는 **프로세스 나무를 통째로** 죽인다 (kill 은 그룹으로)
//
// **브라우저가 없으면 무엇이 없는지 말하고 멈춘다** — 조용히 빈 그림을 남기지 않는다 (SPEC-008 경계).
// 밝힌 그림 파일 말고는 아무것도 쓰지 않는다 (SPEC-007).

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import { REGION_SPECS, regionSpec } from '../../content/regions';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
/**
 * 띄울 자리 — 고정하지 않는다.
 *
 * 고정 포트에 `--strictPort` 를 걸면 그 자리를 누가 쥐고 있을 때 도구가 그냥 죽는다:
 * 방금 돌린 자기 자신이 아직 자리를 놓지 못한 경우까지 포함이라, 이어 돌리면 깜빡인다
 * (실측: 같은 시험을 세 번 돌리면 한 번 죽었다). 비어 있는 자리를 먼저 찾아 쓴다 —
 * 어느 자리든 우리가 띄운 그 자리로 브라우저를 보내므로 번호 자체는 뜻이 없다.
 */
const PORT_FROM = 5211;
const PORT_TRIES = 40;

/** 그 자리가 비어 있는가 — 잡아 보고 바로 놓는다 */
function freePort(from: number, tries: number): Promise<number> {
  return new Promise((done, fail) => {
    let port = from;
    const attempt = (): void => {
      if (port >= from + tries) {
        fail(new Error(`빈 자리를 찾지 못했다 — ${from}~${from + tries - 1} 이 전부 차 있다`));
        return;
      }
      const probe = createServer();
      probe.once('error', () => {
        port += 1;
        probe.close(() => attempt());
      });
      probe.once('listening', () => {
        const taken = port;
        probe.close(() => done(taken));
      });
      probe.listen(port, '127.0.0.1');
    };
    attempt();
  });
}
const DEFAULT_OUT_DIR = 'tools/world-editor/out';
/** 작게 찍는다 — 소프트웨어 GPU 는 화면이 크면 한 프레임이 수 초다 (cycle-shot 과 같은 값) */
const VIEWPORT = { width: 560, height: 420 };

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * 브라우저가 어디 있는가 — 없으면 **무엇이 없는지**를 글자로 돌려준다.
 *
 * `CHROMIUM_PATH` 로 지정할 수 있다 (tools/fx-lab/test/_common.js 의 launch() 와 같은 계약).
 * 이 환경에서는 `/opt/pw-browsers/chromium` 이다.
 */
function findBrowser(): { path?: string } | { missing: string } {
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv) {
    if (existsSync(fromEnv)) return { path: fromEnv };
    return { missing: `CHROMIUM_PATH 가 가리키는 자리에 실행 파일이 없다 — ${fromEnv}` };
  }
  let bundled: string | undefined;
  try {
    bundled = chromium.executablePath();
  } catch (error) {
    return { missing: `playwright 가 크로뮴의 자리를 모른다 — ${String(error)}` };
  }
  if (!bundled || !existsSync(bundled)) {
    return {
      missing:
        `playwright 가 받아 둔 크로뮴이 없다 — ${bundled ?? '(자리를 모른다)'}\n` +
        '  받으려면 npx playwright install chromium · 이미 있다면 CHROMIUM_PATH 로 그 자리를 밝혀라',
    };
  }
  return { path: bundled };
}

function startVite(region: string, at: string | undefined, port: number): Promise<ChildProcess> {
  const env: NodeJS.ProcessEnv = { ...process.env, HKT_SPAWN_REGION: region };
  if (at) env.HKT_SPAWN = at;
  else delete env.HKT_SPAWN;
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env, detached: process.platform !== 'win32' },
  );
  return new Promise((done, fail) => {
    child.stdout?.on('data', (b: Buffer) => {
      if (/localhost:\d+/.test(String(b))) done(child);
    });
    child.stderr?.on('data', (b: Buffer) => {
      if (process.env.FXLAB_TRACE) console.error('[vite]', String(b).trim());
    });
    child.on('exit', (code) => fail(new Error(`vite 가 떴다 말았다 (code ${code})`)));
    setTimeout(() => fail(new Error('vite 가 뜨지 않는다')), 60000);
  });
}

function stopVite(vite: ChildProcess): void {
  // 프로세스 나무를 통째로 — 그룹으로 죽인다 (cycle-shot 선례)
  try {
    if (process.platform === 'win32' || vite.pid === undefined) vite.kill('SIGKILL');
    else process.kill(-vite.pid, 'SIGKILL');
  } catch {
    vite.kill('SIGKILL');
  }
}

export function renderUsage(unknown: readonly string[]): string {
  return [
    '',
    `  모르는 인자: ${unknown.join(' ')}`,
    '  사용: npm run world:shot -- <REGION_ID> [--at x,z] [--out <file>]',
    `  아는 방: ${REGION_SPECS.map((spec) => spec.id).join(' · ')}`,
    '  아무것도 하지 않았다. 세계도 파일도 그대로다.',
    '',
  ].join('\n');
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  const unknown: string[] = [];
  let at: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--at' || arg === '--out') {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) unknown.push(arg);
      else {
        if (arg === '--at') at = value;
        else out = value;
        i++;
      }
    } else if (arg.startsWith('-')) unknown.push(arg);
    else positional.push(arg);
  }
  if (unknown.length > 0 || positional.length !== 1) {
    console.log(
      renderUsage(
        unknown.length > 0
          ? unknown
          : positional.length === 0
            ? ['(방 이름이 없다)']
            : positional.slice(1),
      ),
    );
    return 2;
  }
  const spec = regionSpec(positional[0]!);
  if (!spec) {
    console.log(renderUsage([positional[0]!]));
    return 2;
  }
  if (at !== undefined && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(at)) {
    console.log(renderUsage([`--at ${at}`]));
    return 2;
  }

  // 브라우저부터 본다 — 없으면 vite 도 띄우지 않고 그 자리에서 멈춘다 (SPEC-008 경계)
  const browserPath = findBrowser();
  if ('missing' in browserPath) {
    console.error('');
    console.error('  브라우저가 없어 찍지 못한다 — 빈 그림을 남기지 않는다.');
    console.error(`  ${browserPath.missing}`);
    console.error('');
    return 1;
  }

  const file = resolve(ROOT, out ?? join(DEFAULT_OUT_DIR, `${spec.id}.shot.png`));
  mkdirSync(dirname(file), { recursive: true });

  const port = await freePort(PORT_FROM, PORT_TRIES);
  const vite = await startVite(spec.id, at, port);
  const browser = await chromium.launch({
    executablePath: browserPath.path,
    args: [
      '--headless=new',
      '--no-sandbox',
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan',
      '--use-angle=swiftshader',
      '--use-vulkan=swiftshader',
      '--disable-vulkan-surface',
    ],
  });
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(`http://localhost:${port}/`);
    // HUD 에 세계 시간이 뜰 때까지 — 그것이 "세계가 붙었다" 는 유일한 신호다 (cycle-shot 선례)
    const hud = (): Promise<string> =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('[class^="hud-"], [class*=" hud-"]'))
          .map((n) => n.textContent ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      );
    let text = await hud();
    for (let i = 0; i < 60 && !/세계 시간/.test(text); i++) {
      await sleep(1000);
      text = await hud();
    }
    if (!/세계 시간/.test(text)) {
      console.error('');
      console.error('  세계가 붙지 않아 찍지 못한다 — 빈 그림을 남기지 않는다.');
      console.error(`  HUD 에서 읽은 것: ${text || '(비어 있다)'}`);
      console.error('');
      return 1;
    }
    // 겹쳐 뜬 표면을 닫는다. **캔버스를 클릭하지 않는다** — 클릭은 이동 요청이라 세워 둔 몸이 옮겨진다
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Escape');
      await sleep(300);
    }
    await sleep(1500); // 첫 프레임들이 땅을 다 올릴 때까지
    await page.screenshot({ path: file });
    console.log('');
    console.log(`  World Shot — ${spec.id}${at ? ` (자리 ${at})` : ''}`);
    console.log(`    ${file}`);
    console.log(`    HUD: ${text}`);
    console.log('');
    return 0;
  } finally {
    // 정리는 기다리지 않는다 — 소프트웨어 GPU 가 밀린 프레임을 게울 때까지 붙잡히면 돌아오지 않는다
    browser.close().catch(() => {});
    stopVite(vite);
    await sleep(800);
  }
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  main()
    .then((code) => {
      setTimeout(() => process.exit(code), 300).unref();
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
