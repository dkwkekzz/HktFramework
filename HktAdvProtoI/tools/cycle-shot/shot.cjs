// Cycle 마감 촬영 — 관찰 가능한 결과를 실제로 띄운 게임에서 눈으로 볼 수 있게 찍는다.
//
// 세계 + 클라이언트를 한 프로세스(vite)에서 띄우고, 시나리오 JSON 의 걸음대로 키를 누르고
// HUD 글자를 기다리며 PNG 를 남긴다. 게임 명사를 모른다 — 무엇을 찍을지는 전부 시나리오가 준다.
// 판정하지 않는다 — expect 는 HUD 글자의 유무를 **기록**할 뿐, 판단은 Human(TODO.md)의 몫이다.
//
// 사용: node tools/cycle-shot/shot.cjs <scenario.json>
//
// 시나리오 형식 (경로는 시나리오 파일 기준):
//   {
//     "out": "shots",                       PNG 를 둘 폴더
//     "viewport": [560, 420],               (선택) 작게 — 소프트웨어 GPU 는 화면이 크면 한 프레임이 수 초다
//     "runs": [                             run 마다 세계를 새로 띄운다 (HKT_SPAWN 이 다를 수 있으므로)
//       { "spawn": "0,17",                  (선택) 관찰자의 몸이 처음 놓일 자리 — vite.config.ts 의 검증용 손잡이
//         "region": "FOREST_DEEP",           (선택) 어느 방에서 — 방이 여럿일 때 (같은 손잡이)
//         "npcs": "none",                    (선택) 자율 존재 없이 — 맞아 쓰러지면 조작이 이어지지 않을 때
//         "steps": [
//           { "wait": "세계 시간", "tries": 60 },   HUD 글자가 정규식에 맞을 때까지 초 단위로 되묻는다
//           { "press": "KeyT", "times": 4 },        키를 누른다 (한 번 누르는 키 — 느린 프레임에서도 이어진다)
//           { "pressUntil": "KeyQ", "wait": "잠겨", "tries": 10,      기대한 글자가 뜰 때까지 다시 누른다
//             "blockedBy": "끊김" },                                   (선택) 이 글자가 사라진 뒤에 누른다
//           { "hold": "KeyW", "ms": 1500 },         키를 누르고 있는다 (걷기 — 소프트웨어 GPU 에서는 짧게만)
//           { "sleep": 1000 },
//           { "expect": "문명권", "note": "X-⑤" },   HUD 글자에 있는가를 기록한다
//           { "shot": "X-01-floor", "note": "…" }   <out>/<shot>.png
//         ] }
//     ]
//   }
const fs = require('fs');
const path = require('path');
const { spawn } = require('node:child_process');
const { launch, collectErrors } = require('../fx-lab/test/_common');

const ROOT = path.join(__dirname, '..', '..');
const PORT = 5210;
const scenarioPath = process.argv[2];
if (!scenarioPath) {
  console.error('사용: node tools/cycle-shot/shot.cjs <scenario.json>');
  process.exit(2);
}
const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
const baseDir = path.dirname(path.resolve(scenarioPath));
const outDir = path.resolve(baseDir, scenario.out ?? 'shots');
fs.mkdirSync(outDir, { recursive: true });
const [vw, vh] = scenario.viewport ?? [560, 420];

function startVite(spawnAt, npcs, region) {
  const env = { ...process.env };
  if (spawnAt) env.HKT_SPAWN = spawnAt;
  else delete env.HKT_SPAWN;
  // 어느 방에서 시작할 것인가 — 방이 여럿이면 자리만으로는 고를 수 없다 (vite.config.ts)
  if (region) env.HKT_SPAWN_REGION = region;
  else delete env.HKT_SPAWN_REGION;
  if (npcs === 'none') env.HKT_NPCS = 'none';
  else delete env.HKT_NPCS;
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', '--port', String(PORT), '--strictPort'],
    // detached — npx → sh → vite 로 이어지는 나무를 통째로 죽이기 위해 (kill 은 프로세스 그룹으로)
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env, detached: process.platform !== 'win32' },
  );
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (b) => {
      if (/localhost:\d+/.test(String(b))) resolve(child);
    });
    child.stderr.on('data', (b) => {
      if (process.env.FXLAB_TRACE) console.error('[vite]', String(b).trim());
    });
    child.on('exit', (code) => reject(new Error(`vite 가 떴다 말았다 (code ${code})`)));
    setTimeout(() => reject(new Error('vite 가 뜨지 않는다')), 60000);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// HUD 의 글자 전부 — 어느 칸에 무엇이 뜨는지 이 도구는 모른다
const hudText = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[class^="hud-"], [class*=" hud-"]')]
      .map((n) => n.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

async function until(page, ok, tries) {
  let text = await hudText(page);
  for (let i = 0; i < tries && !ok(text); i++) {
    await sleep(1000);
    text = await hudText(page);
  }
  return text;
}

async function runOne(run, index, report) {
  const vite = await startVite(run.spawn, run.npcs, run.region);
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  const errors = collectErrors(page);
  if (process.env.FXLAB_TRACE) page.on('console', (m) => console.error('[page]', m.text()));
  try {
    await page.goto(`http://localhost:${PORT}/`);
    await until(page, (t) => /세계 시간/.test(t), 60);
    // 겹쳐 뜬 표면을 닫는다 — 열려 있으면 방향키가 삼켜진다 (terrain-shot.js 선례).
    //
    // **캔버스를 클릭하지 않는다.** 클릭은 "그 자리로 가라" 는 이동 요청이라 spawn 으로
    // 세워 둔 몸이 옮겨진다 — 표식 앞에 세워 놓고 찍으려던 것이 어긋난다. 자판은
    // window 가 듣는다 (engine/view-kernel/input/keyboard.ts) 므로 초점 클릭도 필요 없다.
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Escape');
      await sleep(300);
    }
    for (const step of run.steps ?? []) {
      if (step.pressUntil) {
        // 기대한 글자가 뜰 때까지 다시 누른다 — 소프트웨어 GPU 에서는 프레임이 밀려
        // 이어짐이 끊겼다 붙었다 하고, 죽은 창에 떨어진 키는 세계에 닿지 않는다.
        // blockedBy 가 있으면 그 글자가 화면에서 사라진 뒤에 누른다.
        const re = new RegExp(step.wait);
        const blocked = step.blockedBy ? new RegExp(step.blockedBy) : null;
        let text = await hudText(page);
        for (let i = 0; i < (step.tries ?? 10) && !re.test(text); i++) {
          if (blocked) {
            for (let w = 0; w < (step.settle ?? 20) && blocked.test(await hudText(page)); w++) {
              await sleep(1000);
            }
          }
          await page.keyboard.press(step.pressUntil);
          await sleep(step.gap ?? 1200);
          text = await hudText(page);
        }
        report.push({ run: index, kind: 'pressUntil', what: `${step.pressUntil} → ${step.wait}`, ok: re.test(text), note: step.note, hud: text });
      } else if (step.wait !== undefined) {
        const re = new RegExp(step.wait);
        const text = await until(page, (t) => re.test(t), step.tries ?? 30);
        report.push({ run: index, kind: 'wait', what: step.wait, ok: re.test(text), note: step.note });
      } else if (step.press) {
        for (let i = 0; i < (step.times ?? 1); i++) {
          await page.keyboard.press(step.press);
          await sleep(step.gap ?? 300);
        }
      } else if (step.hold) {
        await page.keyboard.down(step.hold);
        await sleep(step.ms ?? 1000);
        await page.keyboard.up(step.hold);
      } else if (step.sleep !== undefined) {
        await sleep(step.sleep);
      } else if (step.expect !== undefined) {
        const text = await hudText(page);
        report.push({ run: index, kind: 'expect', what: step.expect, ok: new RegExp(step.expect).test(text), note: step.note, hud: text });
      } else if (step.shot) {
        const file = path.join(outDir, `${step.shot}.png`);
        await page.screenshot({ path: file }).catch((e) => report.push({ run: index, kind: 'shot', what: step.shot, ok: false, note: String(e) }));
        if (fs.existsSync(file)) report.push({ run: index, kind: 'shot', what: path.relative(baseDir, file), ok: true, note: step.note });
      }
    }
  } finally {
    const real = errors.filter((e) => !e.includes('404'));
    if (real.length) report.push({ run: index, kind: 'error', what: `${real.length} 페이지 오류`, ok: false, note: real.slice(0, 3).join(' | ') });
    // 정리는 기다리지 않는다 — 소프트웨어 GPU 가 밀린 프레임을 게울 때까지 붙잡히면 돌아오지 않는다
    browser.close().catch(() => {});
    try { process.platform === 'win32' ? vite.kill('SIGKILL') : process.kill(-vite.pid, 'SIGKILL'); } catch { vite.kill('SIGKILL'); }
    await sleep(800);
  }
}

(async () => {
  const report = [];
  const runs = scenario.runs ?? [{ spawn: scenario.spawn, steps: scenario.steps }];
  for (let i = 0; i < runs.length; i++) await runOne(runs[i], i + 1, report);
  console.log(`\n촬영 보고 — ${path.relative(ROOT, outDir)}`);
  console.log('| run | 종류 | 무엇 | 결과 | 비고 |');
  console.log('|---|---|---|---|---|');
  for (const r of report) {
    console.log(`| ${r.run} | ${r.kind} | ${r.what} | ${r.ok ? 'OK' : '없음'} | ${r.note ?? ''} |`);
  }
  if (process.env.FXLAB_TRACE) for (const r of report) if (r.hud) console.error(`[hud run${r.run}] ${r.hud}`);
  const shots = report.filter((r) => r.kind === 'shot' && r.ok).length;
  console.log(`\n찍은 장수 ${shots} · 판정은 하지 않는다 — TODO.md 의 Human 판정 항목에 붙인다`);
  setTimeout(() => process.exit(0), 500).unref();
})().catch((e) => { console.error(e); process.exit(1); });
