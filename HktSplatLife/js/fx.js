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
	// 기존 유전자도 그대로 쓴다: lifeBase=지속시간, damping=공기 저항, gravity/updraft=부력,
	// volatility·flowFreq·flowSpeed=난류 결, size/stretch/opacity/luminosity/colorA·B=외형 재료.
	const FX_PRESETS = {
		// ① 물리적 타격 — 짧고 날카로운 지향성 분사. 임팩트 순간 흰-노랑 섬광이 터지고
		//    파편(ember 45%)이 중력을 받아 아래로 흩어진다. 타격 축(법선)으로 몰린다(cone 0.7).
		'타격': {
			lifeBase: 0.3, damping: 3.2, gravity: 6.0, updraft: 0.6,
			volatility: 1.4, flowFreq: 4.0, flowSpeed: 2.4,
			size: 0.011, stretch: 2.6, opacity: 0.2, luminosity: 2.0,
			fxK: 1, burst: 5.5, cone: 0.7, swirl: 0.12, shell: 0.15, grow: 0.5, curve: 2.6, ember: 0.45,
			colorA: '#fff6d8', colorB: '#ff3c0a', form: 4,
		},
		// ② 파이어볼 폭발 — 등방(cone 0) 화구가 부풀며(grow 2.4) 부력으로 말려 오른다(swirl 0.35).
		//    수명이 길고(1.5s) 소멸이 완만해(curve 1.6) 밝은 화구 → 검은 연기로 식는다.
		'파이어볼 폭발': {
			lifeBase: 1.5, damping: 1.9, gravity: 1.2, updraft: 2.8,
			volatility: 2.4, flowFreq: 1.6, flowSpeed: 1.3,
			size: 0.05, stretch: 0.12, opacity: 0.09, luminosity: 1.4,
			fxK: 1, burst: 4.5, cone: 0.0, swirl: 0.35, shell: 0.05, grow: 2.4, curve: 1.6, ember: 0.18,
			colorA: '#ffd27a', colorB: '#1c1210', form: 4,
		},
		// ③ 회복 오라 — 같은 규칙, 다른 좌표일 뿐임을 보이는 세 번째 게놈 (새 코드 0).
		//    위로 몰린 구각(cone 0.85·shell 0.8)이 느리게 소용돌이치며 떠오른다.
		'회복 오라': {
			lifeBase: 1.8, damping: 1.2, gravity: 0.0, updraft: 1.4,
			volatility: 0.9, flowFreq: 2.2, flowSpeed: 0.7,
			size: 0.022, stretch: 0.4, opacity: 0.14, luminosity: 1.3,
			fxK: 1, burst: 1.8, cone: 0.85, swirl: 0.85, shell: 0.8, grow: 0.8, curve: 1.1, ember: 0,
			colorA: '#9dffc0', colorB: '#2f7bff', form: 4,
		},
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
		this.names = (opts.names || Object.keys(FX_PRESETS)).slice();
		this.slices = opts.slices || (global.HktGenesisEngine && global.HktGenesisEngine.MAX_ENTITIES) || 8;
		// 슬라이스당 이벤트 슬롯 수 = 그 슬라이스의 스플랫을 몇 갈래로 나눌지.
		// 많을수록 동시 발생이 늘고, 적을수록 한 번의 이펙트가 촘촘해진다 (같은 예산의 교환).
		this.slotsPerSlice = opts.slots || 2;
		this._events = new Float32Array(MAX_FX * FX_STRIDE);
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
			g.fxSlotBase = Math.min(slot, MAX_FX - 1);
			g.fxSlots = Math.max(1, Math.min(slotsPer, MAX_FX - g.fxSlotBase));
			const slots = [];
			for (let j = 0; j < g.fxSlots; j++) slots.push(g.fxSlotBase + j);
			slot += g.fxSlots;
			ents.push(g);
			this._plan[name] = { slots, next: 0, life: FX_PRESETS[name].lifeBase };
		}
		return ents;
	};

	// 이펙트 발생 = 슬롯 하나를 켠다. ev = { origin, dir, time, strength, scale, radius }
	//   origin  발생 원점 (월드)
	//   dir     축 — 타격이면 충돌 법선(파편이 튀는 쪽), 폭발/오라면 보통 위(0,1,0)
	//   time    시뮬 시각 (engine.frame 의 opts.time 과 같은 시계여야 한다)
	//   strength 세기 배율(속도) · scale 크기 배율(초기 반경) · radius 초기 반경
	// 반환: 사용한 슬롯 인덱스 (미등록 이펙트면 -1)
	FxSystem.prototype.trigger = function (name, ev) {
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
		this._events.set([ev.radius != null ? ev.radius : 0.06, (++this._seq) * 7.13, ev.scale != null ? ev.scale : 1, 0], o + 8);
		return slot;
	};

	// 전 슬롯 소등 (장면 재시드 등) — 시뮬 시계가 되감기면 남은 이벤트가 되살아나지 않게
	FxSystem.prototype.clear = function () {
		this._events.fill(0);
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
				if (t0 > 0 && time - t0 >= 0 && time - t0 <= p.life) n++;
			}
		}
		return n;
	};

	global.HktGenesisFx = { FX_PRESETS, materializeFx, FxSystem, MAX_FX };
})(window);
