// A 트랙(애니메이션) 촬영 — 입력 → 상태 → 클립 3층의 재현 하니스.
// 사용: node anim-shot.js [walk.png] [프레임수] [스플랫수(2^n)]
//
// 판정 (전부 결정론 — CPU 상태 전이 + FBX 배선 + GPU 살 사진):
//  A. 상태 전이  : 입력 주입에 상태 머신이 반응한다 —
//       무입력→idle · 약이동→walk · 강이동→run · 정지→idle ·
//       wave 트리거→wave 후 clipDone 자동 복귀 idle · jump 트리거→jump 후 복귀.
//  B. FBX 배선   : useFbx 가 클립 이름(mixamorig| 접두어 흡수)을 상태에 자동 매핑 (요청 3).
//  C. 살 사진    : 컨트롤러가 낸 세그먼트 위에 살이 자란다 (walk 주입 구동).
const path = require('path');
const { serve, launch, collectErrors, savePng, HARNESS_ROUTE, DRIVE_AND_SHOOT } = require('./_common');

const [walkOut = 'anim-walk.png', framesArg = '240', nArg = '16384'] = process.argv.slice(2);

(async () => {
	const server = await serve(8143, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8143/harness.html');

	const result = await page.evaluate(async ({ FRAMES, N, DRIVE }) => {
		eval(DRIVE);
		const A = HktGenesisAnim;
		const skel = new HktGenesisSkeleton.Skeleton();

		// ── A. 상태 전이 (결정론) ──────────────────────────────────────────────
		const ctrl = new A.AnimationController(skel);      // 기본 그래프, built-in
		const input = new A.CharacterInput();
		const dt = 1 / 60;
		// n 프레임 진행하며 각 프레임 직전 mut(input,i) 로 입력 주입. 마지막 상태 반환.
		function run(n, mut) {
			let st = ctrl.sm.current.name, sawWave = false, sawJump = false;
			for (let i = 0; i < n; i++) {
				if (mut) mut(input, i);
				const r = ctrl.update(dt, input, { fat: 1 });
				st = r.state.name;
				if (st === 'wave') sawWave = true;
				if (st === 'jump') sawJump = true;
			}
			return { st, sawWave, sawJump };
		}
		const s_idle = run(15, (inp) => inp.setMove(0, 0)).st;                 // 무입력 → idle
		const s_walk = run(20, (inp) => inp.setMove(0.4, 0)).st;              // 약이동 → walk
		const s_run  = run(20, (inp) => inp.setMove(1.0, 0)).st;              // 강이동 → run
		const s_stop = run(60, (inp) => inp.setMove(0, 0)).st;               // 정지 → idle
		const wv     = run(170, (inp, i) => { inp.setMove(0, 0); if (i === 0) inp.trigger('action', 'wave'); }); // wave→(2.4s)→idle
		const jp     = run(60,  (inp, i) => { inp.setMove(0, 0); if (i === 0) inp.trigger('jump'); });           // jump→(0.75s)→idle
		const transitions = {
			idle: s_idle, walk: s_walk, run: s_run, stop: s_stop,
			waveSeen: wv.sawWave, waveEnd: wv.st, jumpSeen: jp.sawJump, jumpEnd: jp.st,
		};

		// ── B. FBX 배선 — 실제 THREE 클립 없이 매핑 로직만 검증 (요청 3) ──────────
		// 가짜 ext: clipNames 만 제공(Mixamo 접두어 포함). useFbx 가 상태에 자동 매핑.
		const ctrl2 = new A.AnimationController(new HktGenesisSkeleton.Skeleton());
		const fakeExt = {
			clipNames: () => ['mixamorig|Idle', 'Armature|Walking', 'Running', 'Jump.001'],
			play() {}, pose() { return skel.pose('idle', 0, 1, 1, null); },
		};
		ctrl2.useFbx(fakeExt);
		const wiring = {
			idle: ctrl2.map['idle'] || null,   // 이름 매칭 → mixamorig|Idle
			walk: ctrl2.map['walk'] || null,   // 이름 매칭 → Armature|Walking
			run:  ctrl2.map['run'] || null,    // 이름 우선 → Running (논리클립 walk 아님)
			jump: ctrl2.map['jump'] || null,   // 이름 매칭 → Jump.001
			wave: ctrl2.map['wave'] || null,   // 매칭 클립 없음 → null (built-in 폴백)
		};
		const norm = A.normClip('mixamorig|Running.002'); // 접두어·꼬리 정규화 → 'running'

		// ── C. 살 사진 — 컨트롤러 구동(강이동=run) 세그먼트 위에 살 배양 ─────────
		const shotCtrl = new A.AnimationController(new HktGenesisSkeleton.Skeleton());
		const shotIn = new A.CharacterInput();
		const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
		genes.bindBones = shotCtrl.bindBones();
		const shot = await driveAndShoot({
			FRAMES, N, genes,
			makeBones: (simTime, d) => { shotIn.setMove(1.0, 0); return shotCtrl.update(d, shotIn, { fat: 1 }).segs; },
		});
		return { transitions, wiring, norm, dataUrl: shot.dataUrl, gpuErrs: shot.gpuErrs };
	}, { FRAMES: parseInt(framesArg), N: parseInt(nArg), DRIVE: DRIVE_AND_SHOOT });

	const T = result.transitions, W = result.wiring;
	const stateOk = T.idle === 'idle' && T.walk === 'walk' && T.run === 'run' && T.stop === 'idle'
		&& T.waveSeen && T.waveEnd === 'idle' && T.jumpSeen && T.jumpEnd === 'idle';
	const wiringOk = W.idle === 'mixamorig|Idle' && W.walk === 'Armature|Walking' && W.run === 'Running'
		&& W.jump === 'Jump.001' && W.wave === null && result.norm === 'running';

	console.log('A. 상태 전이:', JSON.stringify(T), stateOk ? '✅' : '❌');
	console.log('B. FBX 배선 :', JSON.stringify(W), `norm=${result.norm}`, wiringOk ? '✅' : '❌');
	if (!result.dataUrl) { console.error('C. GPU 오류:', result.gpuErrs); process.exit(1); }
	savePng(result.dataUrl, path.resolve(walkOut));
	console.log('C. 살 사진 :', walkOut, '✅');
	console.log('페이지 오류:', errors.filter((e) => !e.includes('404')).length ? errors : '없음');

	await browser.close();
	server.close();
	process.exit(stateOk && wiringOk ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
