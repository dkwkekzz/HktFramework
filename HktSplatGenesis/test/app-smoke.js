// 앱 UI 스모크 — 실제 index.html 부트: 프리셋 왕복, 뼈대 탭, 클립 전환, (FBX 있으면) 드롭 입력
// swiftshader 가 rAF 를 못 따라가 큐가 밀리므로 rAF 를 수동 스테핑한다.
// 사용: node app-smoke.js   (test/samba.fbx 있으면 FBX 경로까지 검사)
const fs = require('fs');
const path = require('path');
const { serve, launch, collectErrors } = require('./_common');

(async () => {
	const server = await serve(8133);
	const browser = await launch();
	const page = await browser.newPage({ viewport: { width: 900, height: 720 } });
	const errors = collectErrors(page);
	await page.addInitScript(() => {
		window.__rafCbs = [];
		window.requestAnimationFrame = (cb) => { window.__rafCbs.push(cb); return 1; };
		const orig = GPUAdapter.prototype.requestDevice;
		GPUAdapter.prototype.requestDevice = async function (...a) {
			const d = await orig.apply(this, a);
			window.__device = d;
			return d;
		};
	});
	await page.goto('http://localhost:8133/', { waitUntil: 'load' });
	await page.waitForTimeout(1000);
	await page.selectOption('#count', '65536');

	let ts = 1000;
	const step = async (n) => {
		for (let i = 0; i < n; i++) {
			ts += 50;
			await page.evaluate(async (t) => {
				const cbs = window.__rafCbs;
				window.__rafCbs = [];
				for (const cb of cbs) cb(t);
				await window.__device.queue.onSubmittedWorkDone();
			}, ts);
		}
	};
	const clickPreset = (name) => page.evaluate(
		(n) => [...document.querySelectorAll('#presets button')].find((b) => b.textContent === n).click(), name);

	await clickPreset('히키토');
	await page.click('#tabs .tab[data-tab="skel"]');
	await step(8);
	await page.selectOption('#skelClip', 'wave');
	await step(4);
	await clickPreset('슬라임');   // bones 없는 경로
	await step(4);
	await clickPreset('히키토');
	await step(4);

	const fbx = path.join(__dirname, 'samba.fbx');
	if (fs.existsSync(fbx)) {
		await page.setInputFiles('#fbxFile', fbx);
		// polling 명시 필수 — 기본 rAF 폴링은 위의 rAF 스텁 때문에 영영 안 돈다
		await page.waitForFunction(() => /불러오기 완료|파싱 실패/.test(document.getElementById('skelStatus').textContent),
			{ timeout: 60000, polling: 500 });
		const st = await page.evaluate(() => ({
			status: document.getElementById('skelStatus').textContent,
			clip: document.getElementById('skelClip').value,
		}));
		console.log('FBX:', JSON.stringify(st));
		if (st.clip !== 'external' || !/불러오기 완료/.test(st.status)) { console.error('FBX 로드 실패'); process.exit(1); }
		await step(6);
		await page.selectOption('#skelClip', 'walk'); // 외부 → built-in 재배정 경로
		await step(4);
	} else {
		console.log('samba.fbx 없음 — FBX 경로 생략 (fbx-shot.js 주석의 curl 참조)');
	}

	const fps = await page.evaluate(() => document.getElementById('fps').textContent);
	const real = errors.filter((e) => !e.includes('404'));
	console.log('fps 표시:', fps, '· 오류:', real.length ? real : '없음');
	await browser.close();
	server.close();
	process.exit(real.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
