// HktSplatLife — F1 이펙트 트랙: 이벤트 구동 이펙트 (classic script, 전역 HktGenesisFx)
//
// ── 명제 ──────────────────────────────────────────────────────────────────
// 이펙트도 세포다. 절대 원칙 1(렌더 속성 직접 생성 금지)·3(개체 정의 = 유전자 벡터)은
// 이펙트에도 그대로 적용된다 — 스프라이트 시트도, 키프레임 커브도, "모양을 그리는" 코드도 없다.
//
//   이펙트 = 게놈(무엇인가) + 이벤트(언제·어디서)
//
//   · 게놈  = 8개 F1 유전자 (fxK/burst/cone/swirl/shell/grow/curve/ember) + 기존 유전자
//             (수명·감쇠·중력·부력·난류·크기·불투명도·발광·색 램프). presets.js GENE_DEFS 가 원본.
//   · 이벤트 = 런타임에 켜지는 슬롯 하나 (원점·축·세기·스케일·시각). GPU 이벤트 테이블.
//   · 규칙  = wgsl.js SIM 의 F1 경로 하나. 발생 방향·속도는 스플랫 시드 해시에서 *유도*하고,
//             색·크기·불투명도는 렌더가 수명 위상(u = age/lifeBase)에서 다시 유도한다.
//
// F2(굴절): 이펙트가 *색*이 아니라 *빛의 경로*로 나타나는 갈래. refract 유전자가 켜지면 그
// 개체의 스플랫은 색 패스에서 빠지고, 제 밀도 기울기(∇가우시안)만큼 배경을 휘게 한다
// (wgsl.js DISTORT/COMPOSITE). 충격파처럼 "보이지 않는 공기"가 보이는 현상이 여기서 나온다.
//
// 따라서 **새 이펙트 = FX_PRESETS 에 게놈 한 줄. 새 코드 0.** 타격이냐 폭발이냐 오라냐는
// 코드 분기가 아니라 게놈 좌표가 가른다 (지향성 cone·구각 shell·팽창 grow·소멸 곡선 curve …).
//
// ── 예산 ──────────────────────────────────────────────────────────────────
// 스플랫 풀은 균등 슬라이스로 개체에 배정된다(engine.setScene). 이펙트는 그 슬라이스를
// 나눠 받고, 슬라이스마다 이벤트 슬롯 몇 개를 갖는다 = 동시 발생 가능 수.
// 슬롯은 링으로 재사용된다 — 같은 슬롯을 다시 켜면 그 세대가 통째로 새로 태어난다
// (스플랫 할당·해제 0, CPU 왕복 0 — 이펙트는 "생성"이 아니라 *깨어남*이다).

(function (global) {
	'use strict';

	const MAX_FX = (global.HktGenesisEngine && global.HktGenesisEngine.MAX_FX) || 16;
	const FX_STRIDE = (global.HktGenesisEngine && global.HktGenesisEngine.FX_STRIDE) || 12;

	// ── 이펙트 게놈 = 이펙트의 정의 ────────────────────────────────────────
	// 읽는 법 (F1 유전자):
	//   fxK   이벤트 응답 강도 (0 = 이펙트 개체가 아님 — 전역 속도 배율도 겸한다)
	//   burst 방사 속도 · cone 지향성(0 등방 ↔ 0.95 축 분사) · swirl 축 둘레 와류
	//   shell 구각 집중(0 꽉 찬 구 ↔ 1 같은 속도 = 팽창 구각) · grow 수명에 따른 팽창
	//   curve 소멸 곡선 지수(클수록 급감) · ember 탄도 파편(잔불) 비율
	// 읽는 법 (F2 유전자 — 굴절 이펙트):
	//   refract 굴절 세기(0 = 색 이펙트) · chroma 색 분산(프리즘) · caustic 집광 밝기
	//   rarefy  희박파 비율(0 압축=안으로 꺾임 ↔ 1 희박=밖으로 꺾임, 0.5 는 상쇄)
	// 읽는 법 (F3 유전자 — 파열: 파면이 균질하지 않다 = 타격감):
	//   shred 조각별 속도 편차(0 매끈한 구면 ↔ 1 앞뒤로 크게 갈림) · shredFreq 조각 크기
	//   tear  통째로 사라지는 조각 비율(= 파면에 뚫린 틈) · shredPow 빠른 조각의 희소성
	// 읽는 법 (F5 유전자 — 방위: 평면 안에서 어디로 몰리는가):
	//   arc 방위 집중(0 온 고리=물결파 ↔ 0.9 근처 한 줄=검격) · arcSharp 부채꼴의 뾰족함
	//   기준 방향은 이벤트의 roll(축 둘레 회전) — 가로 베기·대각 베기를 각도로만 가른다
	// 읽는 법 (F4 유전자 — 광선: 파면을 빛살로 세운다):
	//   disc  축에 수직인 평면 집중(0 구면 ↔ 1 종잇장 링 — 가운데가 빈다) · discThick 평면 두께
	//   rayLen 바늘 길이 상한(속도 신축의 상한) · rayThin 바늘 가늘기(횡방향 수축 지수)
	//   동반 발생: with = ['다른 이펙트'] — 한 *사건*이 여러 게놈을 켠다(같은 원점·축·시각)
	// 읽는 법 (F6 유전자 — 표현 강도: 사건의 세기에 이 이펙트가 얼마나 반응하는가):
	//   powVel 속도(도달 반경) 감도 · powSize 크기(굵기) 감도 · powLum 밝기·불투명도 감도
	//   powLife 수명 감도. 응답 = pow(이벤트 strength, 감도) — 0 이면 그 채널은 강도를 무시한다.
	//   같은 이펙트를 약하게/세게 쓰는 것은 새 게놈이 아니라 *이벤트의 세기*다(스침 ↔ 정통).
	// 읽는 법 (F7 유전자 — 시간 결: 수명 안에서 밝기가 어떻게 변주되는가):
	//   flicker 점멸 깊이 · flickerHz 점멸 주기(방전의 서명) · flash 탄생 순간 섬광
	//   coreGlow 느린 조각(=중심에 남은 코어)의 과노출
	// 읽는 법 (F8 유전자 — 방사 구조: 바깥으로만 흐르지 않아도 된다):
	//   implode 수축(1 = 도달 반경 밖에서 태어나 중심으로 모인다 = 차징·흡수)
	//   ripple  속도를 계단으로 잘라 만든 동심 다중 파문(겹 수) · twist 속도 비례 나선 팔
	// 기존 유전자도 그대로 쓴다: lifeBase=지속시간, damping=공기 저항, gravity/updraft=부력,
	// volatility·flowFreq·flowSpeed=난류 결, size/stretch/opacity/luminosity/colorA·B=외형 재료.
	const FX_PRESETS = {
		// ① 물리적 타격 — 맞은 중심점에서 *사방으로 날카롭게* 터지는 방사 성게별(임팩트 플래시).
		//    레퍼런스: 애니메이션 타격 섬광 — 불규칙한 길이의 흰 가시가 중심에서 바깥으로만 뻗는다.
		//    "오목한 분수"로 읽히던 옛 좌표의 원인 셋을 전부 걷어냈다:
		//      · cone 0.7 → 0 — 축 분사(호스 물줄기)가 아니라 방사. 대신 disc 0.9 로 타격 면에
		//        눕힌다(법선이 카메라를 향하면 별이 정면으로 보인다 — 레퍼런스와 같은 구도).
		//      · gravity 6 + ember 0.45 → 0 — 파편이 포물선으로 떨어지는 것이 곧 분수 실루엣이었다.
		//        (섬광 0.3s 안에서 낙하는 모양만 해치고 타격감엔 기여하지 않는다 — 눈검증.)
		//      · swirl 0.12 → 0 — 축 둘레로 감기는 속도는 가시를 휘게 해 오목하게 읽힌다.
		//    "중심에서 바깥으로만"의 두 조건(CLAUDE.md·검격과 동일): shell 0(속도 0..burst 로
		//    중심부터 채움) + grow(안쪽 끝이 중심에서 떨어져 나가지 않게 수명 따라 신장).
		//    빛의 위계가 곧 형태다(F3): shredPow 4 + shred 0.95 로 대다수 조각은 *저속*(= 밝은
		//    중심 코어로 남는다), 소수만 멀리 쏜다(= 길이가 들쭉날쭉한 긴 광선). tear 0.45 가
		//    광선 사이를 확실히 비워 이웃 조각이 호(arc)로 합쳐지는 것을 막는다.
		//    rayAlign 1 은 조각 안 방향을 조각 중심으로 스냅 — 다발(엇갈린 평행 바늘)이 아니라
		//    *한 줄기* 광선이 선다. 수명 0.24s + curve 3: 비기 전에 죽는다(링으로 수렴 금지).
		//    눈검증 실측(+0.1s): 무게중심 발생점 잔류 · 36섹터 도달/밀도/밝기 축:대각 비 ≈ 1.00
		//    (완전 방사) · CPU 선분 대조군과 GPU 렌더 일치(ewaProject 부호 수정 후 — wgsl.js 참조).
		'타격': {
			lifeBase: 0.24, damping: 3.0, gravity: 0.0, updraft: 0.0,
			volatility: 0.05, flowFreq: 2.0, flowSpeed: 0.5,
			size: 0.016, stretch: 0.7, opacity: 0.9, luminosity: 4.5,
			fxK: 1, burst: 8.5, cone: 0.0, swirl: 0.0, shell: 0.0, grow: 2.0, curve: 3.0, ember: 0,
			shred: 0.95, shredFreq: 40, tear: 0.45, shredPow: 4.0,
			disc: 0.92, discThick: 0.12, rayLen: 4, rayThin: 1.0, rayAlign: 1.0,
			// F6 표현 강도: 타격은 *네 채널 전부*로 반응한다 — 세게 맞으면 멀리(powVel) 굵게
			// (powSize) 밝게(powLum) 오래(powLife) 남는다. 속도만 반응시키면 "빠른 스침"이
			// 될 뿐 묵직해지지 않는다(강도 눈검증). 강도 1 = 예전 그림 그대로(회귀 0).
			powVel: 0.55, powSize: 0.4, powLum: 0.85, powLife: 0.35,
			// F7 시간 결: 탄생 순간의 과노출(flash)이 "번쩍"이고, 느린 조각(=중심에 남는 코어)이
			// 과노출(coreGlow)되어 흰 심지가 선다 — 둘 다 알파가 아니라 밝기만 건드린다.
			flash: 2.5, coreGlow: 1.2,
			colorA: '#ffffff', colorB: '#9fb4d8', form: 4, // 흰 섬광 → 서늘한 회청 잔광 (레퍼런스)
			// 물리적 타격 = 방사 가시(이것) + 칼자국(검격) + 공기 굴절(굴절 파면) — 한 사건, 세 게놈
			with: ['검격', '굴절 파면'],
		},
		// ② 파이어볼 폭발 — 등방(cone 0) 화구가 부풀며(grow 2.4) 부력으로 말려 오른다(swirl 0.35).
		//    수명이 길고(1.5s) 소멸이 완만해(curve 1.6) 밝은 화구 → 검은 연기로 식는다.
		'파이어볼 폭발': {
			lifeBase: 1.5, damping: 1.9, gravity: 1.2, updraft: 2.8,
			volatility: 2.4, flowFreq: 1.6, flowSpeed: 1.3,
			size: 0.05, stretch: 0.12, opacity: 0.09, luminosity: 1.4,
			fxK: 1, burst: 4.5, cone: 0.0, swirl: 0.35, shell: 0.05, grow: 2.4, curve: 1.6, ember: 0.18,
			// 화구는 *부피*가 강도다 — 크기·수명이 크게 반응하고(powSize/powLife) 속도는 덜(0.4):
			// 속도만 키우면 화구가 아니라 흩어지는 파편이 된다.
			powVel: 0.4, powSize: 0.6, powLum: 0.5, powLife: 0.45,
			flash: 1.2, coreGlow: 0.8,
			colorA: '#ffd27a', colorB: '#1c1210', form: 4,
		},
		// ③ 회복 오라 — 같은 규칙, 다른 좌표일 뿐임을 보이는 세 번째 게놈 (새 코드 0).
		//    위로 몰린 구각(cone 0.85·shell 0.8)이 느리게 소용돌이치며 떠오른다.
		'회복 오라': {
			lifeBase: 1.8, damping: 1.2, gravity: 0.0, updraft: 1.4,
			volatility: 0.9, flowFreq: 2.2, flowSpeed: 0.7,
			size: 0.022, stretch: 0.4, opacity: 0.14, luminosity: 1.3,
			fxK: 1, burst: 1.8, cone: 0.85, swirl: 0.85, shell: 0.8, grow: 0.8, curve: 1.1, ember: 0,
			// 회복은 세기가 *지속*으로 읽히는 이펙트 — 수명이 가장 크게 반응한다.
			powVel: 0.25, powSize: 0.3, powLum: 0.5, powLife: 0.8,
			colorA: '#9dffc0', colorB: '#2f7bff', form: 4,
		},
		// ④ 물결파 — 타격 지점에서 *빛살 링*이 사방으로 번진다. 온 고리(arc 0)라 방향이 없다:
		//    파문·충격 확산처럼 "퍼지는" 사건에 쓴다. 레퍼런스: 가운데가 빈 고리 + 가는 빛살.
		//    ⓐ 가운데가 비는 근거는 disc 0.96 — 방사 방향을 타격 축에 수직인 평면으로 눕힌다.
		//       구면으로 쏘면 투영이 원반으로 꽉 차 중심이 비지 않는다(눈검증: 링 vs 원반).
		//    ⓑ 빛살(가는 결)의 근거는 shell 0.55 + shredFreq 70 — 방위를 280칸으로 나눠
		//       갈래를 만들고(=갈래 수), 한 갈래 *안에서* 스플랫이 반경으로 퍼지게 한다.
		//       퍼진 스플랫들이 줄지어 하나의 빛살이 된다. shred 0.4 로 갈래마다 길이가 갈리고
		//       tear 0.08 로 드문드문 빈다.
		//    ⓒ stretch 0.55 는 결을 세우는 정도까지만. (기록 정정: "1 이상이면 화면 축 사각별"은
		//       렌더 한계가 아니라 ewaProject 야코비안 부호 버그였다 — 수정됨, wgsl.js 주석 참조.
		//       그래도 빛살 길이는 신축보다 ⓑ 의 반경 퍼짐이 촘촘하고 예쁘다 — 문법은 유지.)
		'물결파': {
			lifeBase: 0.45, damping: 2.2, gravity: 0.0, updraft: 0.0,
			volatility: 0.05, flowFreq: 2.0, flowSpeed: 0.6,
			size: 0.014, stretch: 0.55, opacity: 0.8, luminosity: 4.0,
			fxK: 1, burst: 4.2, cone: 0.0, swirl: 0.0, shell: 0.55, grow: 0.2, curve: 2.0, ember: 0,
			shred: 0.4, shredFreq: 70, tear: 0.08, shredPow: 1.3,
			disc: 0.96, discThick: 0.2, rayLen: 3, rayThin: 1.2,
			// 파문의 세기 = 얼마나 멀리 번지는가(powVel) + 얼마나 밝은가(powLum)
			powVel: 0.7, powSize: 0.2, powLum: 0.7, powLife: 0.3,
			colorA: '#ffffff', colorB: '#3d8bff', form: 4, // 흰 섬광 → 푸른 잔광
			slots: 1, // 슬라이스를 통째로 = 한 번에 배로 촘촘 (동시 발생은 1회로 족하다)
			with: ['굴절 파면'], // 단독 발생 때도 공기 굴절이 함께 (타격은 제 목록으로 켠다)
		},
		// ⑥ 검격 — 같은 규칙, 방위만 몰아 세운 *칼자국*. 물결파가 온 고리라면 이것은 한 줄이다:
		//    arc 0.86 이 방사 방향을 칼날 축 둘레로 몰아 양쪽으로 벌어진 부채꼴을 만들고
		//    (기준 각도는 발생 쪽이 roll 로 준다 — 가로 베기·대각 베기가 같은 게놈에서 나온다),
		//    *중심에서 바깥으로만* 뻗게 하는 근거는 shell 0 + grow 3.0 이다:
		//      shell 0  — 속도가 0..burst 로 퍼져 스플랫이 중심부터 앞까지 *채워진다*.
		//                 (shell 이 크면 전원이 같은 속도라 얇은 껍질이 되어 중심을 비우고 떠난다
		//                  = 가운데가 뚫린 채 이동 → 오목하게 읽힌다.)
		//      grow 3.0 — 시간이 갈수록 스플랫이 길어진다. 바늘 길이는 속도에 비례하는데 반경은
		//                 속도×시간이라, 그냥 두면 안쪽 끝이 중심에서 떨어져 나가 구멍이 생긴다.
		//    shredFreq 90 이 갈래마다 길이가 갈리는 *뾰족한 살*을 세운다.
		//    (부채꼴로 몰면 같은 갈래 수가 좁은 각에 겹친다 — 물결파보다 조각을 잘게 나눠야
		//     덩어리가 아니라 베인 결로 읽힌다: 눈검증에서 22 → 90 으로 올렸다.)
		//    lifeBase 0.3 · curve 3.0 = 번쩍이고 곧장 꺼진다(검격의 짧은 타격감).
		//    날카로움은 색이 아니라 분포다 — 길이 편차(shred 0.7)와 빈 갈래(tear 0.2)가
		//    고른 부채가 아니라 *베인 자국*으로 읽히게 한다.
		'검격': {
			lifeBase: 0.3, damping: 2.6, gravity: 0.0, updraft: 0.0,
			volatility: 0.04, flowFreq: 2.0, flowSpeed: 0.5,
			size: 0.012, stretch: 0.8, opacity: 0.85, luminosity: 4.6,
			fxK: 1, burst: 6.5, cone: 0.0, swirl: 0.0, shell: 0.0, grow: 3.0, curve: 3.0, ember: 0,
			shred: 0.5, shredFreq: 90, tear: 0.04, shredPow: 1.8,
			disc: 0.97, discThick: 0.1, rayLen: 5, rayThin: 1.6,
			arc: 0.96, arcSharp: 3.0,
			// 베기의 세기 = 자국의 길이(powVel)와 잔광의 밝기(powLum). 두께는 조금만 — 굵어지면
			// 베인 자국이 아니라 뭉개진 붓질이 된다.
			powVel: 0.75, powSize: 0.25, powLum: 0.9, powLife: 0.3,
			flash: 3.0,
			colorA: '#ffffff', colorB: '#8fd0ff', form: 4, // 흰 섬광 → 서늘한 강철빛
			slots: 1,
		},
		// ⑤ 굴절 파면 — 색이 없는 이펙트(refract>0 이면 색 패스에서 빠진다): 보이는 것은
		//    오직 휘어진 배경이다. 빛살 링과 같은 사건에서 함께 깨어나 "공기가 밀린" 층을 만든다.
		//    "밖으로 퍼지는" 읽힘의 근거: damping 1.35(수명 내내 나아간다) · grow 0.3(퍼져도
		//    두꺼워지지 않는다) · size 0.045(파면 두께 = 반경의 몇 %).
		//    타격감의 근거(F3): shred 0.3 로 테두리가 톱니처럼 갈리고 tear 0.25 로 호가 끊긴다.
		//    함정: stretch 는 0 이어야 한다 — 얇은 파면에서 방사 방향으로 늘이면 굴절 누적이
		//    구가 아니라 *팔면체*로 보인다(눈검증 확인). 바늘은 빛살(④)의 몫이다.
		'굴절 파면': {
			lifeBase: 0.8, damping: 1.35, gravity: 0.0, updraft: 0.0,
			volatility: 0.18, flowFreq: 2.6, flowSpeed: 1.0,
			size: 0.045, stretch: 0.0, opacity: 0.55, luminosity: 0,
			fxK: 1, burst: 4.2, cone: 0.3, swirl: 0.03, shell: 1.0, grow: 0.3, curve: 1.2, ember: 0,
			refract: 3.0, chroma: 0.32, caustic: 1.4, rarefy: 0.0,
			shred: 0.3, shredFreq: 2.6, tear: 0.25, shredPow: 1.6,
			// 굴절의 세기 = 밀어낸 공기의 양(powLum 이 굴절 밀도를 곱한다)과 도달 반경(powVel)
			powVel: 0.6, powSize: 0.3, powLum: 0.8, powLife: 0.3,
			colorA: '#ffffff', colorB: '#ffffff', form: 4, // 색은 쓰이지 않는다 (굴절 개체)
		},
		// ⑦ 전격 — *점멸*이 정체성인 이펙트(F7). 방전은 매끈하게 꺼지지 않는다: 조각마다
		//    제 시드로 위상이 어긋난 채 지글거려야(flicker 0.9 · 45Hz) 전기로 읽힌다.
		//    (같은 위상으로 껌뻑이면 전기가 아니라 조명 스위치가 된다 — 그래서 위상은 스플랫 시드.)
		//    가시는 타격 문법 그대로(rayAlign 1 로 한 줄기, tear 로 사이를 비운다)지만 disc 를
		//    낮춰 링이 아니라 사방으로 뻗는 가지로 두고, flash 6 으로 켜지는 순간을 태운다.
		'전격': {
			lifeBase: 0.5, damping: 2.4, gravity: 0.0, updraft: 0.0,
			volatility: 1.2, flowFreq: 5.0, flowSpeed: 2.4,
			size: 0.011, stretch: 1.1, opacity: 0.9, luminosity: 5.2,
			fxK: 1, burst: 5.5, cone: 0.0, swirl: 0.0, shell: 0.25, grow: 1.6, curve: 2.2, ember: 0, // 도달 ≈1.6m
			shred: 0.8, shredFreq: 30, tear: 0.5, shredPow: 2.6,
			disc: 0.35, discThick: 0.9, rayLen: 6, rayThin: 2.0, rayAlign: 1.0,
			// 24Hz — 60fps 에서 프레임마다 위상이 0.4 주기씩 도는 값. 훨씬 높이면 프레임률과
			// 엇박이 나 점멸이 아니라 잡음으로 보인다(에일리어싱).
			flicker: 0.9, flickerHz: 24, flash: 6.0, coreGlow: 1.6,
			powVel: 0.6, powSize: 0.35, powLum: 1.0, powLife: 0.4,
			colorA: '#eaf4ff', colorB: '#5f7cff', form: 4, // 흰 방전 → 푸른 잔광
			slots: 1,
		},
		// ⑧ 기 모으기 — 부호가 반대인 방사(F8 implode). 도달 거리만큼 *밖에서* 태어나 속도를
		//    뒤집으면 수명이 다할 때 중심에 모인다 = 차징·흡수. 나선(twist)이 빨려드는 결을 만들고,
		//    coreGlow 가 모여드는 중심을 태운다(느린 조각 = 도착한 조각). 램프는 탄생색 → 소멸색이라
		//    푸른 기운이 중심에서 흰빛으로 수렴한다. 감쇠가 크면 다 모이기 전에 멈춘다 — damping 낮게.
		'기 모으기': {
			// 도달 반경 = burst(1-e^{-damping·life})/damping ≈ 0.9m — *캐릭터 둘레*의 기운이어야 한다.
			// 크게 잡으면(2m 이상) 화면을 뒤덮는 눈보라가 되고 바닥에 닿아 튄다(눈검증).
			// 와류도 인장 속도에 견줘 크면 궤도를 돌 뿐 모이지 않는다 — swirl·burst 곱이 작아야 한다.
			lifeBase: 1.3, damping: 0.9, gravity: 0.0, updraft: 0.0,
			volatility: 0.35, flowFreq: 2.0, flowSpeed: 0.8,
			size: 0.016, stretch: 0.6, opacity: 0.5, luminosity: 2.6,
			fxK: 1, burst: 1.2, cone: 0.0, swirl: 0.22, shell: 0.35, grow: 0.25, curve: 0.7, ember: 0,
			shred: 0.25, shredFreq: 18, tear: 0.12, shredPow: 1.4,
			disc: 0.3, discThick: 0.8, rayLen: 4, rayThin: 1.2,
			implode: 1.0, twist: 1.2,
			coreGlow: 2.6, flash: 0.0,
			powVel: 0.6, powSize: 0.3, powLum: 0.7, powLife: 0.5,
			colorA: '#74f0ff', colorB: '#ffffff', form: 4, // 푸른 기운 → 흰 코어(수렴)
			slots: 1,
		},
		// ⑨ 삼중 파문 — 물결파와 *같은 규칙*, 속도만 계단으로 잘랐다(F8 ripple 3): 연속 속도면
		//    한 겹으로 번지고, 3계단이면 서로 다른 반경으로 달리는 고리가 셋이다. "링을 세 번
		//    그리는" 코드가 아니라 속도 양자화 하나 — 겹 수는 게놈 값이다.
		'삼중 파문': {
			lifeBase: 0.9, damping: 1.4, gravity: 0.0, updraft: 0.0,
			volatility: 0.04, flowFreq: 2.0, flowSpeed: 0.5,
			size: 0.016, stretch: 0.45, opacity: 0.75, luminosity: 3.4,
			// shell 은 ripple 이 대신 정한다(속도 계단) — 남겨 둬도 무시된다.
			fxK: 1, burst: 4.2, cone: 0.0, swirl: 0.0, shell: 0.4, grow: 0.35, curve: 1.5, ember: 0,
			shred: 0.15, shredFreq: 45, tear: 0.05, shredPow: 1.2,
			disc: 0.96, discThick: 0.12, rayLen: 3, rayThin: 1.2,
			ripple: 3,
			powVel: 0.7, powSize: 0.2, powLum: 0.6, powLife: 0.35,
			colorA: '#ffffff', colorB: '#46d8ff', form: 4,
			slots: 1,
		},
		// ⑩ 나선 폭풍 — 방향을 *속도에 비례해* 감으면(F8 twist) 빠른 조각이 앞서 돌아 나선 팔이
		//    선다. 통째로 돌린 파면은 그냥 돌아간 원이지, 팔이 생기지 않는다 — 속도 비례가 핵심.
		//    원판(disc 0.88)에 눕혀 위에서 본 소용돌이로 읽히게 하고, 두께를 남겨 기둥으로 세운다.
		'나선 폭풍': {
			lifeBase: 1.1, damping: 1.5, gravity: 0.0, updraft: 1.2,
			volatility: 1.1, flowFreq: 2.2, flowSpeed: 1.1,
			size: 0.02, stretch: 0.5, opacity: 0.45, luminosity: 2.2,
			fxK: 1, burst: 3.2, cone: 0.0, swirl: 0.25, shell: 0.1, grow: 1.4, curve: 1.4, ember: 0, // 도달 ≈1.7m
			// 팔이 보이려면 *덩어리*가 남아야 한다: 조각을 굵게(shredFreq 14) 나누고 사이를
			// 비운다(tear 0.32). 회전이 너무 크면(2.6=149°) 조각이 방위로 뭉개져 그냥 고리가 된다.
			shred: 0.5, shredFreq: 14, tear: 0.32, shredPow: 2.0,
			disc: 0.88, discThick: 0.45, rayLen: 5, rayThin: 1.4, rayAlign: 0.6,
			twist: 1.3,
			powVel: 0.8, powSize: 0.25, powLum: 0.6, powLife: 0.35,
			flash: 1.0, coreGlow: 0.6,
			colorA: '#ffd9a8', colorB: '#8a3bff', form: 4, // 뜨거운 팔 → 보랏빛 잔풍
			slots: 1,
		},
	};

	// ── 이펙트 세트 = 슬라이스 예산의 데이터 ────────────────────────────────
	// 슬라이스(개체 슬롯)는 8개뿐이고, 이펙트가 가져간 나머지가 곧 캐릭터(기반 개체)의 밀도다.
	// 그래서 "전 이펙트를 동시에 올린다"는 선택지가 아니다 — 무엇을 같이 쓸지를 *세트*로 묶어
	// 고르게 한다(이것도 코드가 아니라 데이터). 첫 세트가 기본값.
	const FX_SETS = {
		'타격 계열': ['타격', '파이어볼 폭발', '물결파', '검격', '굴절 파면'],
		'마법 계열': ['전격', '기 모으기', '나선 폭풍', '삼중 파문', '회복 오라'],
	};

	// 이펙트 프리셋 → 엔진 입력 유전자 (form 4). 슬롯 배정(fxSlotBase/fxSlots)은 FxSystem 몫.
	function materializeFx(name, origin) {
		const p = FX_PRESETS[name];
		if (!p) throw new Error('알 수 없는 이펙트: ' + name);
		return HktGenesisGenes.materialize(p, origin || [0, 0, 0]);
	}

	// ── FxSystem: 슬라이스·슬롯 예산 + 이벤트 테이블 ───────────────────────
	// 사용법
	//   const fx = new HktGenesisFx.FxSystem();          // 기본 = FX_PRESETS 전부
	//   engine.setScene(N, fx.compose(baseGenes));       // 기반 개체 + 이펙트 개체 슬라이스
	//   fx.trigger('타격', { origin, dir, time: simTime });
	//   engine.frame({ ..., fxEvents: fx.buffer() });
	function FxSystem(opts) {
		opts = opts || {};
		// 기본 세트 = FX_SETS 의 첫 세트. 슬라이스(=개체 슬롯)는 8개뿐이고 남는 만큼이
		// 기반 개체(캐릭터)의 밀도라, "전부 올린다"는 선택지가 아니다 (opts.names 로 직접 지정 가능).
		this.names = (opts.names || FX_SETS[Object.keys(FX_SETS)[0]]).slice();
		this.slices = opts.slices || (global.HktGenesisEngine && global.HktGenesisEngine.MAX_ENTITIES) || 8;
		// 슬라이스당 이벤트 슬롯 수 = 그 슬라이스의 스플랫을 몇 갈래로 나눌지.
		// 많을수록 동시 발생이 늘고, 적을수록 한 번의 이펙트가 촘촘해진다 (같은 예산의 교환).
		this.slotsPerSlice = opts.slots || 2;
		this._events = new Float32Array(MAX_FX * FX_STRIDE);
		this._expiry = new Float32Array(MAX_FX); // 슬롯별 소등 시각 (F6 유효 수명 — 지표용)
		for (let k = 0; k < MAX_FX; k++) this._events[k * FX_STRIDE + 3] = -1; // t0 <= 0 = 비활성
		this._plan = null;
		this._seq = 0;
	}

	// 장면 조립: [기반 개체 슬라이스…, 이펙트 개체 슬라이스…] — 총합 = this.slices.
	// 기반 개체는 남는 슬라이스를 전부 갖는다(같은 유전자 객체를 여러 슬라이스에 올린다).
	// 슬라이스는 *예산 단위*일 뿐이라 구름·살(form 0/3)에겐 그냥 더 촘촘해지는 것과 같다.
	// 골렘(form 1)·나무(form 2)만은 슬라이스마다 독립 골격/가지가 서므로 "같은 자리에 겹친
	// 여러 인스턴스"가 된다 — 밀도는 보존되고(합계 스플랫 수 동일) 골격만 여러 벌로 나뉜다.
	// (1 슬라이스로 묶으면 밀도가 1/N 로 떨어져 훨씬 나쁘다 — 겹침 쪽이 덜 해롭다.)
	FxSystem.prototype.compose = function (baseGenes) {
		const fxCount = this.names.length;
		if (fxCount + 1 > this.slices) throw new Error('슬라이스 부족: 이펙트 ' + fxCount + '개 + 기반 1개');
		const baseSlices = this.slices - fxCount;   // 이펙트는 각 1 슬라이스, 나머지는 기반 개체
		const slotsPer = Math.max(1, Math.min(this.slotsPerSlice, Math.floor(MAX_FX / fxCount)));

		const ents = [];
		for (let i = 0; i < baseSlices; i++) ents.push(baseGenes);
		this._plan = {};
		let slot = 0;
		for (const name of this.names) {
			const g = materializeFx(name);
			// 슬롯 수 = 동시 발생 수 ↔ 한 번의 밀도. 촘촘해야 사는 이펙트(빛살 코로나)는
			// 프리셋이 slots: 1 로 제 슬라이스를 통째로 쓴다 — 이것도 코드가 아니라 데이터다.
			const want = FX_PRESETS[name].slots || slotsPer;
			g.fxSlotBase = Math.min(slot, MAX_FX - 1);
			g.fxSlots = Math.max(1, Math.min(want, MAX_FX - g.fxSlotBase));
			const slots = [];
			for (let j = 0; j < g.fxSlots; j++) slots.push(g.fxSlotBase + j);
			slot += g.fxSlots;
			ents.push(g);
			// genes = *살아 있는* 유전자 객체 — 엔진이 매 프레임 다시 패킹하므로 여기 값을 고치면
			// 다음 프레임에 반영된다(재시드 불필요). 게놈 슬라이더 UI 의 근거.
			this._plan[name] = { slots, next: 0, life: FX_PRESETS[name].lifeBase, genes: g };
		}
		return ents;
	};

	// 이펙트 발생 = 슬롯 하나를 켠다. ev = { origin, dir, time, strength, scale, radius }
	//   origin  발생 원점 (월드)
	//   dir     축 — 타격이면 충돌 법선(파편이 튀는 쪽), 폭발/오라면 보통 위(0,1,0)
	//   time    시뮬 시각 (engine.frame 의 opts.time 과 같은 시계여야 한다)
	//   strength 세기 배율(속도) · scale 크기 배율(초기 반경) · radius 초기 반경
	//   roll     축 둘레 회전(rad) — 부채꼴(arc>0) 이펙트의 기준 각도 = 칼날 각도
	// 반환: 사용한 슬롯 인덱스 (미등록 이펙트면 -1)
	// 동반 이펙트(FX_PRESETS[name].with)는 *같은 사건*으로 함께 켜진다 — 타격의 파편과
	// 공기 충격파처럼 한 사건이 여러 게놈으로 나타나는 경우. 미등록 동반은 조용히 무시된다
	// (그 이펙트에 슬라이스를 안 준 장면에서도 부모 이펙트는 그대로 동작한다).
	FxSystem.prototype.trigger = function (name, ev, _depth) {
		const preset = FX_PRESETS[name];
		if (preset && preset.with && !(_depth > 0))
			for (const w of preset.with) this.trigger(w, ev, 1); // 동반은 1단 — 순환 없음
		const p = this._plan && this._plan[name];
		if (!p || !p.slots.length) return -1;
		const slot = p.slots[p.next % p.slots.length];
		p.next++;
		const o = slot * FX_STRIDE;
		const d = ev.dir || [0, 1, 0];
		const dl = Math.hypot(d[0], d[1], d[2]) || 1;
		const org = ev.origin || [0, 0, 0];
		// t0 는 반드시 > 0 — 셰이더가 t0 <= 0 을 "비활성 슬롯" 으로 읽는다
		this._events.set([org[0], org[1], org[2], Math.max(ev.time || 0, 1e-4)], o);
		this._events.set([d[0] / dl, d[1] / dl, d[2] / dl, ev.strength != null ? ev.strength : 1], o + 4);
		// 시드 오프셋: 같은 슬롯을 다시 켜도 파편 패턴이 반복되지 않게 한다 (결정론은 시퀀스로 유지)
		// w = 롤(rad): 축 둘레 기준 방향 — 검격의 칼날 각도 (온 고리 이펙트는 무시한다)
		this._events.set([ev.radius != null ? ev.radius : 0.06, (++this._seq) * 7.13,
			ev.scale != null ? ev.scale : 1, ev.roll || 0], o + 8);
		// F6: 유효 수명 = lifeBase × 강도^powLife (셰이더 fxLifeOf 와 같은 식). 지표·UI 전용이라
		// 렌더 경로와 무관하지만, 어긋나면 "몇 개가 살아 있나"가 거짓말이 된다.
		const I = Math.max(ev.strength != null ? ev.strength : 1, 1e-3);
		const g = p.genes || {};
		this._expiry[slot] = Math.max(ev.time || 0, 1e-4) + p.life * Math.pow(I, g.powLife || 0);
		return slot;
	};

	// 전 슬롯 소등 (장면 재시드 등) — 시뮬 시계가 되감기면 남은 이벤트가 되살아나지 않게
	FxSystem.prototype.clear = function () {
		this._events.fill(0);
		this._expiry.fill(0);
		for (let k = 0; k < MAX_FX; k++) this._events[k * FX_STRIDE + 3] = -1;
		if (this._plan) for (const n of Object.keys(this._plan)) this._plan[n].next = 0;
	};

	// GPU 업로드용 이벤트 테이블 (engine.setFxEvents / frame({ fxEvents }))
	FxSystem.prototype.buffer = function () { return this._events; };

	// 지금 살아 있는(수명 안) 이벤트 수 — UI·하니스 지표용 (렌더 경로와 무관)
	FxSystem.prototype.activeCount = function (time) {
		let n = 0;
		if (!this._plan) return 0;
		for (const name of Object.keys(this._plan)) {
			const p = this._plan[name];
			for (const s of p.slots) {
				const t0 = this._events[s * FX_STRIDE + 3];
				if (t0 > 0 && time >= t0 && time <= (this._expiry[s] || t0 + p.life)) n++;
			}
		}
		return n;
	};

	// 살아 있는 유전자 편집 — 게놈 슬라이더(UI)·하니스 공용. 프리셋 원본과 현재 장면의
	// 유전자 객체를 함께 고치므로 다음 프레임에 반영된다(엔진이 매 프레임 개체 테이블을
	// 다시 패킹하기 때문 — 재시드 없음). 게놈만 고치는 것이지 코드 경로는 그대로다.
	FxSystem.prototype.setGene = function (name, key, value) {
		const preset = FX_PRESETS[name];
		if (!preset) return false;
		preset[key] = value;
		const p = this._plan && this._plan[name];
		if (p) {
			if (p.genes) p.genes[key] = value;
			if (key === 'lifeBase') p.life = value;
		}
		return true;
	};

	// 이펙트의 현재 유전자 값 (UI 슬라이더 초기값) — 장면에 올라와 있으면 살아 있는 값,
	// 아니면 프리셋 원본. materialize 폴백(미지정 = 0, 일부 1)을 거친 값이라 UI 가 빈칸을 만들지 않는다.
	FxSystem.prototype.geneValue = function (name, key) {
		const p = this._plan && this._plan[name];
		if (p && p.genes && p.genes[key] != null) return p.genes[key];
		const g = HktGenesisGenes.materialize(FX_PRESETS[name] || {}, [0, 0, 0]);
		return g[key];
	};

	global.HktGenesisFx = { FX_PRESETS, FX_SETS, materializeFx, FxSystem, MAX_FX };
})(window);
