// C5 이미지 → 게놈 추출기 v0 — 컨셉 이미지 몇 장을 캐릭터 게놈(JSON)으로 *번역* 한다.
//
// 목표는 복원이 아니라 번역 (PLAN-CharacterGenesis 「이미지 → 게놈 추출 파이프라인」):
// 이미지의 인상(비율·색·재질·부속)을 게놈 어휘로 옮기고, 스타일 프로파일이 울타리를 친다.
// 추출은 비결정(LLM)이어도 게놈은 결정론 — 확정된 JSON 이 원본이고 이미지는 참고물로 남는다.
// 검증 실패는 클램프가 아니라 반려(exit 2) — 사유를 프롬프트에 되먹여 재추출한다.
//
// 사용:
//   node tools/genome-extract/extract.js front.png [side.png back.png detail.png] [옵션]
// 옵션:
//   --out <file>   출력 게놈 JSON (기본 genome.json)
//   --name <이름>  캐릭터 이름 힌트
//   --model <id>   기본 claude-opus-4-8
//   --mock <file>  LLM 호출 대신 준비된 응답(게놈 JSON)을 사용 — 오프라인/CI 경로
//   --raw <file>   LLM 원문 텍스트 저장 (디버그)
//
// 인증(실호출): ANTHROPIC_API_KEY 또는 ANTHROPIC_AUTH_TOKEN 환경변수.
// 프록시 뒤에서는 NODE_USE_ENV_PROXY=1 (Node 22.15+) 로 fetch 가 HTTPS_PROXY 를 따르게 한다.
//
// 입력 규약: 정면 필수, 측면 권장 (1장뿐이면 좌우 대칭 + 표준 두께로 번역된다).
// T포즈 유사·단색 배경 권장 — 실루엣이 곧 측정 대상이다.

'use strict';
const fs = require('fs');
const path = require('path');
const { validate } = require('./validate');
require('../../js/genome.js');
const G = globalThis.HktGenesisGenome;

// ── 인자 파싱 ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = { out: 'genome.json', model: 'claude-opus-4-8' };
const images = [];
for (let i = 0; i < args.length; i++) {
	if (args[i].startsWith('--')) { opt[args[i].slice(2)] = args[++i]; }
	else images.push(args[i]);
}
if (!images.length) {
	console.error('사용: node extract.js <정면.png> [측면.png ...] [--out genome.json] [--mock 응답.json]');
	process.exit(1);
}

// ── 게놈 JSON 스키마 (structured outputs) — 값 범위는 검증기가 반려로 강제 ──
const MORPH_ENTRY = {
	type: 'object',
	properties: { r: { type: 'number' }, l: { type: 'number' } },
	additionalProperties: false,
};
const morphProps = {}, palProps = {};
for (const g of [...G.GROUPS, 'appendix']) morphProps[g] = MORPH_ENTRY;
for (const g of G.GROUP_IDS.filter((x) => x !== 'other'))
	palProps[g] = {
		type: 'object',
		properties: { a: { type: 'string' }, b: { type: 'string' } },
		required: ['a', 'b'], additionalProperties: false,
	};
const GENOME_SCHEMA = {
	type: 'object',
	properties: {
		name: { type: 'string' },
		notes: { type: 'string' },
		morph: { type: 'object', properties: morphProps, additionalProperties: false },
		palette: { type: 'object', properties: palProps, additionalProperties: false },
		matter: {
			type: 'object',
			properties: {
				size: { type: 'number' }, stretch: { type: 'number' },
				opacity: { type: 'number' }, luminosity: { type: 'number' }, fleshK: { type: 'number' },
			},
			additionalProperties: false,
		},
		appendix: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					attach: { type: 'string' },
					dir: { type: 'array', items: { type: 'number' } },
					links: { type: 'integer' }, len: { type: 'number' },
					r0: { type: 'number' }, r1: { type: 'number' }, k: { type: 'number' },
				},
				required: ['attach', 'dir', 'links', 'len', 'r0', 'r1'],
				additionalProperties: false,
			},
		},
	},
	required: ['name', 'morph', 'palette'],
	additionalProperties: false,
};

// ── 스타일 프로파일을 프롬프트 제약으로 — 울타리 안의 게놈만 나오게 유도 ──
const P = G.PROFILE;
const SYSTEM = `당신은 게임 캐릭터 파이프라인의 "이미지 → 게놈" 번역기다.
컨셉 이미지를 픽셀 재현하는 게 아니라, 이미지의 *인상*(비율·색·재질·부속)을
아래 게놈 어휘로 번역한다. 캐릭터는 표준 휴머노이드 리그 위에 스플랫 살로 배양되므로,
모든 수치는 절대값이 아니라 표준 체형 대비 배율이다.

게놈 어휘:
- morph: 부위 그룹(head/neck/torso/shoulder/arm/hand/finger/leg/foot/appendix) →
  {r: 반지름 배율, l: 길이 배율}. 배율 1 = 표준. 눈에 띄는 부위만 기록(항등은 생략).
- palette: 부위 그룹 → 램프 양 끝 {a: 저속(어두움), b: 고속(밝음)} — #rrggbb 2색.
  a 는 그 부위의 그늘/기본색, b 는 하이라이트. 이미지 대표색에서 뽑되 극단은 피한다.
- matter: 재질 어휘의 번역 — size(스플랫 굵기), stretch(이방성), opacity, luminosity(발광),
  fleshK(살 강성; 단단한 인상 = 높게). 기본 살과 다를 때만 기록.
- appendix: 리그에 없는 꼬리/뿔/귀/망토 = 가상 뼈 체인
  {attach: 부착 관절, dir: 부착 로컬 방향(정규화 불필요), links: 마디 수, len: 총 길이(m),
   r0/r1: 뿌리/끝 반지름(m), k: 스프링 강성(뻣뻣한 뿔 = 높게, 낭창한 꼬리 = 낮게)}.

번역 태도:
- **과감하게 번역한다.** 표준과 뚜렷이 다른 부위는 배율 범위의 끝값 가까이 써서 실루엣 차이가
  화면에서 보이게 한다 — 예: 짧고 굵은 다리 = leg {l 0.5~0.65, r 1.3~1.6},
  가녀린 팔 = arm {r 0.6~0.8, l 1.2~1.4}. 소극적 번역(±10%)은 배양 후 티가 나지 않는다.
- **큰 머리·큰 부위는 반지름과 길이를 함께 키운다.** 살은 뼈 캡슐(둥근 끝)을 채우므로,
  큰 머리를 r 만 키우면 납작한 원반이 된다 — 지배적인 둥근 공이 되려면 r 과 l 을 같이 올린다:
  큰 머리 = head {r 1.8~2.2, l 1.4~1.6}. 통통한 체형은 torso r 을 키워 둥근 배로, 마른 체형은 낮춰.
- **머리 큰 데포르메(치비)는 상하 3단으로 번역한다** — ① 큰 둥근 머리(head r·l 상단값) ②
  둥근 몸통(torso r 1.6~2.0, l 0.7~0.8 로 짧게) ③ 짧은 팔다리(arm·leg l 0.5~0.6). 목은
  너무 줄이면(l<0.6) 머리가 가슴을 덮어 상의 색이 가려지므로 l 0.7 안팎을 유지해 머리를
  몸 위에 얹는다. 하의(반바지)가 큰 배에 가려 안 보이면 leg l 을 조금 늘려(0.6) 몸 아래로
  드러낸다 — 옷 색 구획이 사진에서 살아 있어야 번역이 성립한다.
- **옷/장비는 부위 그룹 램프의 색 구획으로 번역한다** — 상의는 torso(+어깨/소매가 덮이면
  shoulder/arm), 하의는 leg, 신발은 foot 에 옷 색 램프를 주고, 맨살 부위는 피부 램프를 유지한다.
  옷의 색 경계가 곧 텍스처의 1차 인상이다. 무늬·직물 결·로고는 번역 대상이 아니다
  (장비 오버레이 C6 / 디테일 층 R3 소관).

스타일 프로파일(위반 시 반려되므로 반드시 지킬 것):
- 반지름 배율 ${P.radiusMul.min}~${P.radiusMul.max}, 길이 배율 ${P.lengthMul.min}~${P.lengthMul.max}
- 팔레트: 채도 0.1~0.9, 명도 0.08~0.97 (순흑/순백/네온 금지), 부위당 정확히 2색
- matter 범위: size 0.02~0.06, stretch 0.3~2.5, opacity 0.6~0.95, luminosity 0~1.5, fleshK 10~80
- 부속: 체인 최대 ${P.appendix.maxChains}개, 마디 ${P.appendix.links.min}~${P.appendix.links.max},
  길이 ${P.appendix.len.min}~${P.appendix.len.max}m, 반지름 ${P.appendix.radius.min}~${P.appendix.radius.max}m,
  강성 ${P.appendix.k.min}~${P.appendix.k.max}. 부착 관절은 Hips/Spine/Spine1/Spine2/Neck/Head/
  LeftShoulder/RightShoulder/LeftHand/RightHand/LeftFoot/RightFoot 중에서.
- 얼굴 디테일·손가락 미세 실루엣은 번역 대상이 아니다(스타일로 흡수) — 비율과 색에 집중.
- 이미지가 1장(정면)뿐이면 좌우 대칭 + 표준 두께로 가정한다.

notes 에 번역 근거를 1~2문장으로 남긴다.`;

const MEDIA = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

async function callLLM() {
	const base = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
	const headers = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
	if (process.env.ANTHROPIC_API_KEY) headers['x-api-key'] = process.env.ANTHROPIC_API_KEY;
	else if (process.env.ANTHROPIC_AUTH_TOKEN) {
		headers['authorization'] = `Bearer ${process.env.ANTHROPIC_AUTH_TOKEN}`;
		headers['anthropic-beta'] = 'oauth-2025-04-20';
	} else {
		console.error('ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN 없음 — 오프라인이면 --mock <응답.json> 사용');
		process.exit(1);
	}
	const content = images.map((p) => ({
		type: 'image',
		source: {
			type: 'base64',
			media_type: MEDIA[path.extname(p).toLowerCase()] || 'image/png',
			data: fs.readFileSync(p).toString('base64'),
		},
	}));
	content.push({
		type: 'text',
		text: `이 컨셉 이미지 ${images.length}장(첫 장이 정면)을 게놈으로 번역하라.` +
			(opt.name ? ` 캐릭터 이름: ${opt.name}.` : ''),
	});
	const res = await fetch(`${base}/v1/messages`, {
		method: 'POST', headers,
		body: JSON.stringify({
			model: opt.model,
			max_tokens: 16000,
			thinking: { type: 'adaptive' },
			system: SYSTEM,
			output_config: { format: { type: 'json_schema', schema: GENOME_SCHEMA } },
			messages: [{ role: 'user', content }],
		}),
	});
	if (!res.ok) { console.error(`API ${res.status}:`, await res.text()); process.exit(1); }
	const msg = await res.json();
	if (msg.stop_reason === 'refusal') { console.error('모델이 요청을 거부함 (stop_details:', JSON.stringify(msg.stop_details), ')'); process.exit(1); }
	if (msg.stop_reason === 'max_tokens') { console.error('출력이 잘림 (max_tokens) — 재시도 필요'); process.exit(1); }
	const text = (msg.content || []).find((b) => b.type === 'text');
	if (!text) { console.error('텍스트 블록 없음:', JSON.stringify(msg.content)); process.exit(1); }
	return text.text;
}

(async () => {
	for (const p of images) if (!fs.existsSync(p)) { console.error('이미지 없음:', p); process.exit(1); }

	// mock = 준비된 응답 텍스트(게놈 JSON) — 검증·저장 경로는 실호출과 동일
	const rawText = opt.mock ? fs.readFileSync(opt.mock, 'utf8') : await callLLM();
	if (opt.raw) fs.writeFileSync(opt.raw, rawText);

	let genome;
	try { genome = JSON.parse(rawText); }
	catch (e) { console.error('응답이 JSON 이 아님:', e.message); process.exit(1); }
	if (opt.name && !genome.name) genome.name = opt.name;

	// 프로파일 검증 — 벗어난 값은 클램프가 아니라 반려·재추출 (exit 2)
	const v = validate(genome);
	if (!v.ok) {
		console.error(`반려 — 프로파일 위반 ${v.errors.length}건 (재추출 프롬프트에 되먹일 것):`);
		for (const e of v.errors) console.error('  ·', e);
		process.exit(2);
	}

	fs.writeFileSync(opt.out, JSON.stringify(genome, null, '\t') + '\n');
	const n = (o) => Object.keys(o || {}).length;
	console.log(`게놈 저장: ${opt.out} — '${genome.name}'`);
	console.log(`  morph ${n(genome.morph)}부위 · palette ${n(genome.palette)}부위 · matter ${n(genome.matter)}유전자 · appendix ${(genome.appendix || []).length}체인`);
	if (genome.notes) console.log('  번역 메모:', genome.notes);
})().catch((e) => { console.error(e); process.exit(1); });
