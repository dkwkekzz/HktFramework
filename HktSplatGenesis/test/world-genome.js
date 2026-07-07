// W1 검증 (순수 Node) — 월드 게놈의 데이터화가:
//  ① 회귀: 기본 프리셋(temperate) 경유가 현행 플랫 기본값과 수치 일치(diff 0) —
//     BIOMES/WATER 를 코드 상수에서 게놈 필드로 옮겼지만 거동은 바이트 동일하다는 근거.
//  ② 다채로움: 손으로 쓴 2번째 프리셋(ashen, 3바이옴·붉은 팔레트·물 없음)이 같은 좌표에서
//     temperate 와 색족·바이옴이 뚜렷이 다른 월드를 낸다 — 데이터만으로 성격이 바뀐다는 실증.
//
// 브라우저/GPU 불필요 (결정론 순수 함수). 사용: node world-genome.js [seed=7]
const T = require('../js/terrain-gen.js');
const SEED = parseInt(process.argv[2] || '7');

// 파노라마 영역을 규칙적으로 훑는 좌표열 (두 월드에 동일 입력)
function coords(n) {
	const S = 80, out = [];
	for (let i = 0; i < n; i++) {
		const x = -S + (i % 97) / 97 * 2 * S;
		const z = -S + ((i * 13) % 89) / 89 * 2 * S;
		out.push([x, z]);
	}
	return out;
}

// ── ① 회귀: temperate 프리셋 == 현행 플랫 기본 ──────────────────────────────
function regressionCheck() {
	const flat = T.world({ seed: SEED, amp: 0.9, scale: 3.0, octaves: 4 });
	const pre = T.world(Object.assign({ seed: SEED }, T.preset('temperate')));
	let maxH = 0, maxRel = 0, maxCol = 0, bmiss = 0, n = 0;
	for (const [x, z] of coords(3000)) {
		maxH = Math.max(maxH, Math.abs(flat.height(x, z) - pre.height(x, z)));
		maxRel = Math.max(maxRel, Math.abs(flat.heightAt(x, z) - pre.heightAt(x, z)));
		const ca = flat.colorAt(x, z), cb = pre.colorAt(x, z);
		for (let c = 0; c < 3; c++) maxCol = Math.max(maxCol, Math.abs(ca[c] - cb[c]));
		if (flat.biomeAt(x, z).id !== pre.biomeAt(x, z).id) bmiss++;
		n++;
	}
	const ok = maxH === 0 && maxRel === 0 && maxCol === 0 && bmiss === 0;
	console.log(`① 회귀(n=${n}): height Δ${maxH} · heightAt Δ${maxRel} · color Δ${maxCol} · biome 불일치 ${bmiss} → ${ok ? 'OK' : '실패'}`);
	return ok;
}

// ── ② 다채로움: ashen 프리셋이 temperate 와 뚜렷이 다르다 ──────────────────
function meanColorAndBiomes(W) {
	let r = 0, g = 0, b = 0, n = 0;
	const keys = {};
	for (const [x, z] of coords(4000)) {
		const c = W.colorAt(x, z);
		r += c[0]; g += c[1]; b += c[2]; n++;
		const bk = W.biomeAt(x, z).key;
		keys[bk] = (keys[bk] || 0) + 1;
	}
	return { mean: [r / n, g / n, b / n], keys };
}

function distinctCheck() {
	const temp = meanColorAndBiomes(T.world(Object.assign({ seed: SEED }, T.preset('temperate'))));
	const ash = meanColorAndBiomes(T.world(Object.assign({ seed: SEED }, T.preset('ashen'))));
	const f3 = (a) => a.map((v) => v.toFixed(3));
	console.log(`② temperate 평균색 ${JSON.stringify(f3(temp.mean))} · 바이옴 ${JSON.stringify(temp.keys)}`);
	console.log(`②     ashen 평균색 ${JSON.stringify(f3(ash.mean))} · 바이옴 ${JSON.stringify(ash.keys)}`);

	// 색족 대비: ashen 은 붉은색 우세(R>G), temperate 는 녹색이 붉은색에 밀리지 않음(G≥R).
	const ashRed = ash.mean[0] > ash.mean[1] + 0.02;
	const tempGreen = temp.mean[1] >= temp.mean[0];
	// 평균색 유클리드 거리 — 데이터만으로 팔레트가 크게 이동했는가
	const dist = Math.hypot(temp.mean[0] - ash.mean[0], temp.mean[1] - ash.mean[1], temp.mean[2] - ash.mean[2]);
	// 육상 바이옴 키가 완전히 다르다 (수역 제외 교집합 0)
	const land = (o) => Object.keys(o.keys).filter((k) => k !== 'water');
	const inter = land(temp).filter((k) => land(ash).includes(k));
	const disjoint = inter.length === 0 && land(ash).length >= 2;
	const ok = ashRed && tempGreen && dist > 0.08 && disjoint;
	console.log(`② 판정: ashen붉음 ${ashRed} · temp녹색 ${tempGreen} · 평균색거리 ${dist.toFixed(3)}(>0.08) · 육상바이옴 분리 ${disjoint}(공유 ${JSON.stringify(inter)}) → ${ok ? 'OK' : '실패'}`);
	return ok;
}

const ok1 = regressionCheck();
const ok2 = distinctCheck();
const ok = ok1 && ok2;
console.log(`\n판정: 회귀 ${ok1} · 다채로움 ${ok2} → ${ok ? 'OK' : '실패'}`);
process.exit(ok ? 0 : 1);
