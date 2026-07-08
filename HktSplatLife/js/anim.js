// HktSplatGenesis — 애니메이션 시스템 (A 트랙)  ·  입력 → 상태 → 클립
//
// 하나의 표준 스켈레톤 위에서 도는 3층. 각 층은 요청 1·2·3 에 그대로 대응한다:
//  1) CharacterInput        : 입력 주입 인터페이스 — 입력 *소스*(키보드/에디터/AI/네트워크)를
//                             캐릭터에서 분리한다. 연속 축(move)과 1회성 트리거(jump/action)를 구분.
//  2) CharacterStateMachine : 입력에 반응하는 상태 그래프 — 선언적(직렬화 가능) 전이 조건 DSL.
//                             기본 휴머노이드 그래프 내장, 데이터로 완전 교체 가능(정체성=데이터 원칙).
//  3) AnimationController    : 상태 → 클립 바인딩 — built-in 절차 클립 / FBX 명명 클립을 해석해
//                             매 프레임 세그먼트(살 규칙의 유일한 형태 입력)를 낸다. **FBX 로 배선한다.**
//
// 불변(친화 인덱스): 클립 전환/크로스페이드는 **같은 소스·같은 리그** 안에서만 매끄럽게 한다
// (세그먼트 순서 = 뼈 친화 rest.w 의 기준). built-in↔FBX 처럼 세그먼트 수/순서가 바뀌는 전환은
// 하드 컷이며, 호출측이 재시드(bindBones 재계산)해야 한다 — controller.update 가 sourceChanged 로 알린다.
// (skeleton.js AppendixRig 주석·app.js currentBindBones 규약과 동일.)

(function (global) {
	'use strict';

	// ── (1) 입력 주입 인터페이스 ─────────────────────────────────────────────
	// 소스는 이 객체에만 쓴다 — 캐릭터/상태 머신은 소스를 모른다(디커플링).
	//  · 축(axis)   : 연속 값. 매 프레임 샘플(레벨). 예: move = 이동 방향.
	//  · 트리거(trigger): 1회성 에지. 눌린 프레임에 버퍼되었다가 상태 머신 스텝 후 소비/소멸.
	//    (공중에서 누른 점프처럼 아무도 안 먹은 트리거는 무한 버퍼하지 않고 버린다 — 게임 관례.)
	function CharacterInput() {
		this.move = { x: 0, z: 0 };  // 이동 방향 (대략 -1~1, 정규화는 소스 책임)
		this._triggers = {};         // { name: value } — 소비 전까지 유지
	}
	// 연속 축 주입 (WASD·스틱·AI 경로 추종 등이 매 프레임 호출)
	CharacterInput.prototype.setMove = function (x, z) { this.move.x = x; this.move.z = z; };
	// 1회성 트리거 주입 (Space=점프, 버튼=액션). value 로 액션 종류를 실어 보낸다.
	CharacterInput.prototype.trigger = function (name, value) {
		this._triggers[name] = (value === undefined) ? true : value;
	};
	// 이동 강도(0~1 근사) — 걷기/뛰기 축 판정에 쓴다.
	CharacterInput.prototype.moveMag = function () { return Math.hypot(this.move.x, this.move.z); };
	// 트리거 조회(비소비) — 조건 평가는 엿보기만, 실제 소비는 전이 성사 시.
	CharacterInput.prototype._peek = function (name) { return this._triggers[name]; };
	// 한 스텝 끝: 트리거 전부 소멸(에지 1프레임 수명).
	CharacterInput.prototype._clear = function () { this._triggers = {}; };

	// ── (2-a) 전이 조건 DSL — 선언적(직렬화 가능), 함수 이스케이프 허용 ──────────
	// 조건 형태:
	//   배열                        → AND (모두 참)
	//   { any: [...] }              → OR  (하나라도 참)
	//   { axis:'moveMag', op, value } → 연속 축 비교 (op: '>' '>=' '<' '<=' '==' '!=')
	//   { trigger:'jump' }          → 트리거 존재 (있으면 참)
	//   { trigger:'action', equals:'wave' } → 트리거 값 일치
	//   { clipDone:true }           → 현재 클립(원샷) 재생 완료
	//   { after: 0.4 }              → 상태 진입 후 경과 시간 ≥ 0.4s
	//   function(ctx)               → 커스텀 술어(비직렬화 — 최후 수단)
	function evalCond(cond, ctx) {
		if (cond == null) return true;
		if (typeof cond === 'function') return !!cond(ctx);
		if (Array.isArray(cond)) return cond.every((c) => evalCond(c, ctx));
		if (cond.any) return cond.any.some((c) => evalCond(c, ctx));
		if (cond.axis != null) {
			const v = (cond.axis === 'moveMag') ? ctx.moveMag
				: (cond.axis === 'timeInState') ? ctx.timeInState : 0;
			return compare(v, cond.op || '>', cond.value || 0);
		}
		if (cond.trigger != null) {
			const t = ctx.input._peek(cond.trigger);
			if (t === undefined) return false;
			return (cond.equals === undefined) ? true : (t === cond.equals);
		}
		if (cond.clipDone) return ctx.clipDone;
		if (cond.after != null) return ctx.timeInState >= cond.after;
		return false;
	}
	function compare(a, op, b) {
		switch (op) {
			case '>':  return a > b;   case '>=': return a >= b;
			case '<':  return a < b;   case '<=': return a <= b;
			case '==': return a === b; case '!=': return a !== b;
			default:   return false;
		}
	}

	// ── (2-b) 기본 휴머노이드 상태 그래프 (단일 스켈레톤) ─────────────────────
	// clip 은 논리 이름 — AnimationController 가 built-in/FBX 로 해석한다. loop=false 는 원샷
	// (clipDone 으로 복귀). run 은 built-in walk 클립을 빠르게(speed) 재생 — 새 클립 없이 축 전이 실증.
	// jump 는 built-in 절차 원샷(skeleton.js 'jump'), FBX 에 동명 클립이 있으면 그쪽이 우선.
	const DEFAULT_GRAPH = {
		initial: 'idle',
		states: [
			{ name: 'idle', clip: 'idle', loop: true, speed: 1.0, transitions: [
				{ to: 'jump', when: { trigger: 'jump' } },
				{ to: 'wave', when: { trigger: 'action', equals: 'wave' } },
				{ to: 'walk', when: { axis: 'moveMag', op: '>', value: 0.12 } },
			] },
			{ name: 'walk', clip: 'walk', loop: true, speed: 1.0, transitions: [
				{ to: 'jump', when: { trigger: 'jump' } },
				{ to: 'wave', when: { trigger: 'action', equals: 'wave' } },
				{ to: 'run',  when: { axis: 'moveMag', op: '>', value: 0.7 } },
				{ to: 'idle', when: { axis: 'moveMag', op: '<=', value: 0.12 } },
			] },
			{ name: 'run', clip: 'walk', loop: true, speed: 1.9, transitions: [
				{ to: 'jump', when: { trigger: 'jump' } },
				{ to: 'walk', when: { axis: 'moveMag', op: '<=', value: 0.7 } },
			] },
			{ name: 'wave', clip: 'wave', loop: false, speed: 1.0, duration: 2.4, transitions: [
				{ to: 'idle', when: { clipDone: true } },
			] },
			{ name: 'jump', clip: 'jump', loop: false, speed: 1.0, duration: 0.75, transitions: [
				{ to: 'walk', when: [{ clipDone: true }, { axis: 'moveMag', op: '>', value: 0.12 }] },
				{ to: 'idle', when: { clipDone: true } },
			] },
		],
	};

	// ── (2-c) 상태 머신 ───────────────────────────────────────────────────────
	function CharacterStateMachine(graph) {
		this.graph = graph || DEFAULT_GRAPH;
		this.states = {};
		for (const s of this.graph.states) this.states[s.name] = s;
		this.current = this.states[this.graph.initial] || this.graph.states[0];
		this.prev = null;          // 직전 상태 (전이 감지·크로스페이드용)
		this.timeInState = 0;
		this.justChanged = false;  // 이번 update 에서 상태가 바뀌었나
	}
	// 한 스텝: dt 만큼 진행하며 현재 상태의 전이를 순서대로 검사, 첫 참에서 전이.
	// clipDone 은 AnimationController 가 계산해 주입(원샷 완료 여부).
	CharacterStateMachine.prototype.update = function (dt, input, clipDone) {
		this.justChanged = false;
		this.timeInState += dt;
		const ctx = { input, moveMag: input.moveMag(), timeInState: this.timeInState, clipDone: !!clipDone };
		for (const tr of (this.current.transitions || [])) {
			if (evalCond(tr.when, ctx) && this.states[tr.to]) {
				this.prev = this.current;
				this.current = this.states[tr.to];
				this.timeInState = 0;
				this.justChanged = true;
				break;
			}
		}
		input._clear();            // 트리거 에지 소멸 (1프레임 수명)
		return this.current;
	};
	// 외부 강제 전이 (에디터·컷신 등). 없는 상태면 무시.
	CharacterStateMachine.prototype.force = function (name) {
		if (!this.states[name] || this.current === this.states[name]) return;
		this.prev = this.current; this.current = this.states[name];
		this.timeInState = 0; this.justChanged = true;
	};

	// ── (3) 상태 → 클립 바인딩 (built-in / FBX) ───────────────────────────────
	// controller 는 built-in Skeleton 을 항상 쥐고, FBX(ExternalSkeleton)는 선택적으로 붙인다.
	// 상태의 clip 을 실제 포즈 소스로 해석 — 소스가 바뀌면(내장↔FBX) 세그먼트 순서가 달라지므로
	// sourceChanged 를 올려 호출측 재시드를 유도한다. 같은 소스면 하드 컷도 살 스프링이 지연 흡수.
	function AnimationController(skeleton, sm) {
		this.skeleton = skeleton || new global.HktGenesisSkeleton.Skeleton();
		this.sm = sm || new CharacterStateMachine();
		this.ext = null;           // FBX 리그 (없으면 built-in 전용)
		this.map = {};             // 상태 이름 → FBX 클립 이름 (수동/자동 배선)
		this.clipTime = 0;         // 활성 클립 로컬 시각(초) — 원샷 clipDone·절차 위상 기준
		this.fat = 1.0;
		this.genome = null;
		this._active = null;       // 현재 재생 정보 { source, clip, loop, speed, duration }
		this._resolve(this.sm.current);
	}
	// FBX 리그 부착 + 상태↔클립 자동 배선. 상태 이름과 클립 이름을 정규화 매칭
	// (Mixamo 'mixamorig|Run', 'Armature|Walk' 등 접두어·구분자 흡수). override 로 수동 지정.
	AnimationController.prototype.useFbx = function (ext, override) {
		this.ext = ext;
		this.map = {};
		const names = ext ? ext.clipNames() : [];
		for (const s of this.sm.graph.states) {
			if (override && override[s.name]) { this.map[s.name] = override[s.name]; continue; }
			// 우선순위: 상태 이름(run→'Run') → 논리 클립명(run 은 clip 'walk' → 'Walk' 폴백).
			// 전용 클립이 있으면 그걸, 없으면 재사용 클립으로 — FBX 구성에 유연하게 붙는다.
			const byName = names.find((n) => normClip(n).indexOf(s.name.toLowerCase()) >= 0);
			const byClip = names.find((n) => normClip(n).indexOf(s.clip.toLowerCase()) >= 0);
			const hit = byName || byClip;
			if (hit) this.map[s.name] = hit;
		}
		this._resolve(this.sm.current, true);
	};
	// built-in 전용으로 되돌린다 (FBX 해제).
	AnimationController.prototype.useBuiltin = function () {
		this.ext = null; this.map = {};
		this._resolve(this.sm.current, true);
	};
	// 상태 → 재생 정보 결정. FBX 매핑이 있으면 fbx, 없으면 built-in.
	AnimationController.prototype._resolve = function (state, force) {
		const fbxClip = this.ext && this.map[state.name];
		const next = fbxClip
			? { source: 'fbx', clip: fbxClip, loop: state.loop !== false, speed: state.speed || 1, duration: state.duration || 0 }
			: { source: 'builtin', clip: state.clip, loop: state.loop !== false, speed: state.speed || 1, duration: state.duration || 0 };
		const prev = this._active;
		this._active = next;
		this.clipTime = 0;
		// FBX 는 mixer 크로스페이드; built-in 은 위상 리셋(즉시). 소스 전환은 하드 컷.
		if (next.source === 'fbx' && this.ext) {
			this.ext.play(next.clip, (prev && prev.source === 'fbx' && !force) ? 0.2 : 0);
		}
		return prev;
	};
	// 한 프레임: 입력 → 상태 → 세그먼트. 반환 { segs, state, sourceChanged }.
	// sourceChanged=true 면 세그먼트 순서가 바뀌었으니 호출측이 bindBones 재시드해야 한다.
	AnimationController.prototype.update = function (dt, input, opts) {
		opts = opts || {};
		if (opts.fat != null) this.fat = opts.fat;
		if (opts.genome !== undefined) this.genome = opts.genome;
		// 원샷 완료 판정 (클립 진행 후 판정하도록 clipTime 기준)
		const a = this._active;
		const clipDone = a && !a.loop && a.duration > 0 && this.clipTime >= a.duration;
		const prevSource = a ? a.source : null;
		this.sm.update(dt, input, clipDone);
		let sourceChanged = false;
		if (this.sm.justChanged) {
			this._resolve(this.sm.current);
			sourceChanged = (this._active.source !== prevSource);
		}
		// 클립 로컬 시각 전진 (일시정지 dt=0 이면 정지)
		this.clipTime += dt * this._active.speed;
		const segs = this._pose(dt);
		return { segs, state: this.sm.current, sourceChanged };
	};
	// 활성 클립 → 세그먼트. built-in 은 로컬 clipTime 을 절대 t 로(위상 결정), FBX 는 증분 dt.
	AnimationController.prototype._pose = function (dt) {
		const a = this._active;
		if (a.source === 'fbx' && this.ext) {
			return this.ext.pose((dt || 0) * a.speed, 1.0, this.fat, this.genome);
		}
		return this.skeleton.pose(a.clip, this.clipTime, a.speed, this.fat, this.genome);
	};
	// 재시드용 바인드 세그먼트 (현재 소스/리그의 t=0 포즈) — 순서가 친화 인덱스의 기준.
	AnimationController.prototype.bindBones = function () {
		const a = this._active;
		if (a && a.source === 'fbx' && this.ext) return this.ext.pose(0, 1, this.fat, this.genome);
		return this.skeleton.pose((a && a.clip) || 'idle', 0, 1, this.fat, this.genome);
	};

	// Mixamo/DCC 접두어·구분자 정규화 — 'mixamorig|Run' 'Armature|Walk.001' → 'run' 'walk'
	function normClip(n) {
		return String(n).toLowerCase()
			.replace(/^.*[|:]/, '')      // 'mixamorig|' 'armature:' 접두어 제거
			.replace(/\.\d+$/, '')       // '.001' 꼬리 제거
			.replace(/[^a-z]/g, '');     // 공백·기타 제거
	}

	global.HktGenesisAnim = {
		CharacterInput, CharacterStateMachine, AnimationController,
		DEFAULT_GRAPH, evalCond, normClip,
	};
})(typeof window !== 'undefined' ? window : globalThis);
