#!/usr/bin/env node
// W4 자동화 — 이미지 컨셉 → 월드 게놈 추출기 (Node CLI, 오프라인 제작 파이프라인)
//
// 컨셉 이미지 한 장을 LLM vision(Anthropic Messages API)으로 읽어 월드 게놈 JSON 으로 번역한다.
// 복원이 아니라 인상 번역 — 스타일 프로파일(W2)을 프롬프트 제약으로 주고, 반환 게놈을 validate 로
// 검증해 벗어나면 위반을 되먹여 재시도한다(클램프가 아니라 반려·재추출, C 트랙 원칙).
//
// 사용:
//   ANTHROPIC_API_KEY=... node extract.js <image> <out.json> [seed]
//   HKT_EXTRACT_MOCK=<mockGenome.json> node extract.js <image> <out.json>   # API 없이 파이프라인 검증
//
// 모델: 기본 claude-opus-4-8 (HKT_EXTRACT_MODEL 로 재정의). base_url 은 ANTHROPIC_BASE_URL.
'use strict';
const fs = require('fs');
const path = require('path');
const WP = require('../../js/world-profile.js');

const IMAGE = process.argv[2];
const OUT = process.argv[3];
const SEED = parseInt(process.argv[4] || '7');
if (!IMAGE || !OUT) { console.error('사용: node extract.js <image> <out.json> [seed]'); process.exit(2); }

const MODEL = process.env.HKT_EXTRACT_MODEL || 'claude-opus-4-8';
const MAX_ATTEMPTS = 3;

// 스타일 프로파일(W2) → 프롬프트에 넣을 사람이 읽는 울타리 요약
function profileText() {
	const P = WP.PROFILE;
	return [
		`- 전역 relief: amp ${P.amp.join('~')}, scale ${P.scale.join('~')}, octaves ${P.octaves.join('~')}(정수), base ${P.base.join('~')}, warpAmp ${P.warpAmp.join('~')}, biomeScale ${P.biomeScale.join('~')}, biomeSharp ${P.biomeSharp.join('~')}`,
		`- 바이옴: ${P.biomeCount.join('~')}개, ampMul ${P.ampMul.join('~')}, scaleMul ${P.scaleMul.join('~')}, ridged ${P.ridged.join('~')}, warpMul ${P.warpMul.join('~')}, temp/humid ${P.tempHumid.join('~')}, 서로 중심 거리 ≥ ${P.biomeMinSep}`,
		`- 색: lo/hi 각 채널 0~1, 채도 ≤ ${P.satMax}(설선 같은 저채도 흰색 허용)`,
		`- 수역: waterY 는 relief 포락(base±amp*2.2) 안. water.shallow/deep 각 채널 0~1`,
	].join('\n');
}

const GENOME_SCHEMA = `{
  "seed": <int>,
  "amp": <num>, "scale": <num>, "octaves": <int>, "base": <num>,
  "warpAmp": <num>, "warpScale": <num>, "biomeScale": <num>, "biomeSharp": <num>,
  "waterY": <num>,
  "water": { "shallow": [r,g,b], "deep": [r,g,b] },
  "biomeSet": [
    { "id": <int>, "key": "<en>", "name": "<ko>", "temp": <0..1>, "humid": <0..1>,
      "ampMul": <num>, "scaleMul": <num>, "ridged": <0..1>, "warpMul": <num>,
      "lo": [r,g,b], "hi": [r,g,b] }
  ]
}`;

function buildPrompt(feedback) {
	let p = `너는 컨셉 아트를 절차 지형 월드 게놈으로 번역하는 도구다. 이 이미지의 *인상*(지배 팔레트,
지형 성격=뾰족한 봉우리/완만한 구릉/평탄 사막, 물 유무·수위, 바이옴 혼합)을 아래 월드 게놈 JSON 으로
번역하라. 픽셀 복원이 목표가 아니라 번역이다 — 하늘·구름·나무·건물 같은 스캐터/대기 요소는 제외하고
**지형·바이옴·수역**만 담는다.

게놈은 반드시 아래 스타일 프로파일 울타리 안이어야 한다 (벗어나면 반려된다):
${profileText()}

바이옴 중심(temp/humid)은 저주파 기후 평면 [0,1]²의 점이며 소프트맥스로 경계 보간된다. 지배 바이옴을
기후 평면 중앙(≈0.5,0.5) 근처에, 소수 바이옴을 바깥에 두면 그 바이옴이 화면을 지배한다. lo=저지대색,
hi=고지대색.

seed 는 ${SEED} 로 고정하라. 출력은 **오직 게놈 JSON 하나** (설명·코드펜스 없이). 스키마:
${GENOME_SCHEMA}`;
	if (feedback) p += `\n\n이전 시도가 프로파일 검증에 실패했다. 위반을 고쳐 다시 출력하라:\n${feedback}`;
	return p;
}

function mediaType(file) {
	const e = file.toLowerCase();
	if (e.endsWith('.png')) return 'image/png';
	if (e.endsWith('.webp')) return 'image/webp';
	if (e.endsWith('.gif')) return 'image/gif';
	return 'image/jpeg';
}

// 응답 텍스트에서 게놈 JSON 파싱 (코드펜스/잡텍스트 관용)
function parseGenome(text) {
	let s = text.trim();
	const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fence) s = fence[1].trim();
	else { const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a >= 0 && b > a) s = s.slice(a, b + 1); }
	return JSON.parse(s);
}

const violText = (v) => v.map((x) => `${x.field}: ${x.rule} (값 ${JSON.stringify(x.value)})`).join('\n');

async function callVision(imageB64, mtype, prompt) {
	const key = process.env.ANTHROPIC_API_KEY;
	if (!key) throw new Error('ANTHROPIC_API_KEY 미설정 — 라이브 추출 불가 (HKT_EXTRACT_MOCK 으로 파이프라인 검증 가능)');
	const base = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
	const res = await fetch(base + '/v1/messages', {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
		body: JSON.stringify({
			model: MODEL, max_tokens: 4000,
			messages: [{ role: 'user', content: [
				{ type: 'image', source: { type: 'base64', media_type: mtype, data: imageB64 } },
				{ type: 'text', text: prompt },
			] }],
		}),
	});
	if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
	const data = await res.json();
	const textBlock = (data.content || []).find((b) => b.type === 'text');
	if (!textBlock) throw new Error('응답에 text 블록 없음');
	return textBlock.text;
}

// 한 번의 추출 시도: 게놈 텍스트 → 파싱 → 검증. { ok, genome, violations } 반환.
function evaluate(genomeText) {
	let genome;
	try { genome = parseGenome(genomeText); } catch (e) { return { ok: false, parseError: e.message }; }
	genome.seed = SEED;
	const val = WP.validate(genome);
	return { ok: val.ok, genome, violations: val.violations };
}

(async () => {
	const MOCK = process.env.HKT_EXTRACT_MOCK;
	let attempt = 0, feedback = null, last = null;

	if (MOCK) {
		// 목 모드: 파일이 곧 "모델 응답 게놈". 파이프라인(파싱·검증·기록·반려)만 검증.
		const mockText = fs.readFileSync(MOCK, 'utf8');
		last = evaluate(mockText);
		attempt = 1;
	} else {
		const imageB64 = fs.readFileSync(IMAGE).toString('base64');
		const mtype = mediaType(IMAGE);
		while (attempt < MAX_ATTEMPTS) {
			attempt++;
			const text = await callVision(imageB64, mtype, buildPrompt(feedback));
			last = evaluate(text);
			if (last.ok) break;
			feedback = last.parseError ? `JSON 파싱 실패: ${last.parseError}` : violText(last.violations || []);
			console.error(`시도 ${attempt} 반려:\n${feedback}\n`);
		}
	}

	if (!last || !last.ok) {
		console.error(`추출 실패(시도 ${attempt}) — 프로파일 반려. 게놈을 쓰지 않는다.`);
		if (last && last.violations) console.error(violText(last.violations));
		process.exit(1);
	}

	// 확정 게놈에 _meta 부착 후 저장
	const out = Object.assign({
		_meta: {
			source: path.basename(IMAGE),
			extractor: MOCK ? `W4 자동화(목: ${path.basename(MOCK)})` : `W4 자동화 (${MODEL})`,
			attempts: attempt,
		},
	}, last.genome);
	fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
	console.log(`OK — ${OUT} (시도 ${attempt}, 바이옴 ${last.genome.biomeSet ? last.genome.biomeSet.length : 0}, 프로파일 통과)`);
	console.log(`렌더 대조: node test/concept-shot.js ${path.relative(path.join(__dirname, '../..'), OUT)} <원본이미지> card.png`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
