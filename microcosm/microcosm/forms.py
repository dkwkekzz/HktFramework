"""forms.py - 요소 레시피 + 레지스트리.

요소는 새 물리가 아니라 같은 기질 위에 단위를 배치하는 레시피다.
새 요소: 함수 작성 -> @register('name'). 엔진은 손대지 않는다.
"""
import math
import random
import numpy as np
from .core import KIND

REGISTRY = {}


def register(name):
    def deco(fn):
        REGISTRY[name] = fn
        return fn
    return deco


@register('terrain')
def terrain(w):
    w.ground = lambda x: (20 + 17 * math.sin(x * 0.017 + 1.0)
                          + 7 * math.sin(x * 0.058 + 0.5) + 4 * math.sin(x * 0.11))
    return {'ground': w.ground}


@register('water')
def water(w, cx=100.0, count=60, spreadX=18.0, topY=None):
    y0 = w.H - 6 if topY is None else topY
    u = [w.spawn(cx + (random.random() - 0.5) * spreadX, y0 - random.random() * 14,
                 vx=(random.random() - 0.5) * 2, vy=-2, M=0.5, kind=KIND['WATER'], g_scale=1)
         for _ in range(count)]
    return {'units': u}


@register('character')
def character(w, cx=120.0, cy=90.0, radius=4.0, nring=10, hp=100.0):
    temp, k = 0.12, 30.0
    cy = max(cy, w.ground(cx) + 5)
    core = w.spawn(cx, cy, T=temp, M=1.4, kind=KIND['CHARACTER'], homeoT=temp, hp=hp, g_scale=1)
    ring = []
    for a in range(nring):
        ang = 2 * math.pi * a / nring
        ring.append(w.spawn(cx + radius * math.cos(ang), cy + radius * math.sin(ang),
                            T=temp, M=1, kind=KIND['CHARACTER'], homeoT=temp, hp=hp, g_scale=1))
    for i in ring:
        w.add_bond(core, i, k)
    for a in range(nring):
        w.add_bond(ring[a], ring[(a + 1) % nring], k)
    return {'core': core, 'units': [core] + ring}


@register('rock')
def rock(w, cx=120.0, cy=0.0, r=5.0):
    """2D 격자(비공선 결합 다수 → 전단 저항) + 고융점. 단단함."""
    sp = 2.3
    cy = w.ground(cx) + r + 1
    u = []
    yy = -r
    while yy <= r:
        xx = -r
        while xx <= r:
            if xx * xx + yy * yy <= r * r:
                u.append(w.spawn(cx + xx, cy + yy, M=1.2, kind=KIND['ROCK'], g_scale=1, hp=0))
            xx += sp
        yy += sp
    for a in range(len(u)):
        for b in range(a + 1, len(u)):
            d = w.P[u[a]] - w.P[u[b]]
            if d[0] * d[0] + d[1] * d[1] < 4.7 * 4.7:
                w.add_bond(u[a], u[b], 430, melt=9)
    return {'units': u}


@register('tree')
def tree(w, baseX=120.0, segs=5, seg=4.0):
    """2열 트러스 줄기(대각 브레이싱→굽힘 강성) + 넓은 고정 뿌리 + 분기/잎.
    기본 융점이라 불에 결합이 녹아 쓰러진다."""
    baseY = w.ground(baseX); hw, k, mt, hp = 2.0, 130.0, 0.6, 40.0
    Lc, Rc, leaves = [], [], []
    for s in range(segs + 1):
        y = baseY + s * seg; fx = (s <= 2)
        li = w.spawn(baseX - hw, y, M=0.7, kind=KIND['WOOD'], g_scale=1, fixed=fx, hp=hp)
        ri = w.spawn(baseX + hw, y, M=0.7, kind=KIND['WOOD'], g_scale=1, fixed=fx, hp=hp)
        Lc.append(li); Rc.append(ri); w.add_bond(li, ri, k, melt=mt)
        if s > 0:
            w.add_bond(Lc[s - 1], li, k, melt=mt); w.add_bond(Rc[s - 1], ri, k, melt=mt)
            w.add_bond(Lc[s - 1], ri, k * 0.7, melt=mt); w.add_bond(Rc[s - 1], li, k * 0.7, melt=mt)
    rl = w.spawn(baseX - 5, baseY, M=0.8, kind=KIND['WOOD'], g_scale=1, fixed=True, hp=hp)
    rr = w.spawn(baseX + 5, baseY, M=0.8, kind=KIND['WOOD'], g_scale=1, fixed=True, hp=hp)
    w.add_bond(rl, Lc[0], k, melt=mt); w.add_bond(rl, Lc[1], k * 0.8, melt=mt); w.add_bond(rl, Rc[0], k * 0.6, melt=mt)
    w.add_bond(rr, Rc[0], k, melt=mt); w.add_bond(rr, Rc[1], k * 0.8, melt=mt); w.add_bond(rr, Lc[0], k * 0.6, melt=mt)

    def leaf(x, y, anc):
        lid = w.spawn(x, y, M=0.4, kind=KIND['LEAF'], g_scale=1, hp=12)
        w.add_bond(anc, lid, 26, melt=0.4); leaves.append(lid)

    for b in range(3, segs + 1):
        if random.random() < 0.3:
            continue
        for d in (-1, 1):
            col = Lc if d < 0 else Rc
            bx = baseX + d * (hw + seg * 1.2); by = baseY + b * seg
            bi = w.spawn(bx, by, M=0.45, kind=KIND['WOOD'], g_scale=1, hp=hp)
            w.add_bond(col[b], bi, k * 0.8, melt=mt); w.add_bond(col[b - 1], bi, k * 0.55, melt=mt)
            for _ in range(4):
                leaf(bx + (random.random() - 0.5) * 4, by + 2 + random.random() * 4, bi)
    for _ in range(8):
        leaf(baseX + (random.random() - 0.5) * 7, baseY + segs * seg + 2 + random.random() * 5,
             Lc[segs] if random.random() < 0.5 else Rc[segs])
    return {'trunk': Lc + Rc, 'Lc': Lc, 'Rc': Rc, 'leaves': leaves}


class CreatureCtrl:
    """방랑 추진력(입력항 I). agents에 등록되어 매 스텝 호출된다."""
    def __init__(self, units, core, speed=11.0):
        self.units, self.core, self.speed = units, core, speed
        self.target = 0.0; self.t = 0.0; self.hop = 1 + random.random()

    def update(self, w, dt):
        if not w.alive[self.core]:
            return
        self.t -= dt
        if self.t <= 0 or abs(w.P[self.core, 0] - self.target) < 8:
            self.target = 24 + random.random() * (w.W - 48); self.t = 2.5 + random.random() * 3
        dvx = (1 if self.target > w.P[self.core, 0] else -1) * self.speed
        for i in self.units:
            if w.alive[i]:
                w.F[i, 0] += 3.2 * (dvx - w.V[i, 0])
        self.hop -= dt
        if self.hop <= 0:
            self.hop = 1.6 + random.random() * 1.4
            for i in self.units:
                if w.alive[i]:
                    w.V[i, 1] += 5


@register('creature')
def creature(w, cx=120.0, cy=100.0, speed=11.0):
    radius, nring, temp, k, hp = 3.4, 8, 0.12, 32.0, 80.0
    cy = max(cy, w.ground(cx) + 5)
    core = w.spawn(cx, cy, T=temp, M=1.1, kind=KIND['CREATURE'], homeoT=temp, hp=hp, g_scale=1)
    units = [core]
    for a in range(nring):
        ang = 2 * math.pi * a / nring
        units.append(w.spawn(cx + radius * math.cos(ang), cy + radius * math.sin(ang),
                            T=temp, M=0.8, kind=KIND['CREATURE'], homeoT=temp, hp=hp, g_scale=1))
    ring = units[1:]
    for i in ring:
        w.add_bond(core, i, k)
    for a in range(len(ring)):
        w.add_bond(ring[a], ring[(a + 1) % len(ring)], k)
    ctrl = CreatureCtrl(units, core, speed)
    w.agents.append(ctrl)
    return {'core': core, 'units': units, 'ctrl': ctrl}


@register('skeleton')
def skeleton(w, cx=120.0, scale=1.0, anchored=True):
    """휴머노이드 스켈레톤: 관절=입자, 뼈=본드(+스킨 캡슐). 뼈별 두께·재질로
    아트 렌더러(artrender)가 셰이딩된 사람 실루엣을 뽑는다.
    anchored=True 면 관절을 고정(정지 포즈). 보행 단계에서 해제한다."""
    baseY = w.ground(cx)
    K = KIND['CHARACTER']

    def J(dx, dy):
        return w.spawn(cx + dx * scale, baseY + dy * scale, M=1.0, kind=K,
                       fixed=anchored, g_scale=0.0 if anchored else 1.0)

    # 관절 (정면 휴머노이드, baseY=발끝)
    j = dict(
        footL=J(-2.5, 0.6), footR=J(2.5, 0.6),
        kneeL=J(-2.2, 7.0), kneeR=J(2.2, 7.0),
        hipL=J(-2.0, 14.0), hipR=J(2.0, 14.0),
        pelvis=J(0.0, 14.0), chest=J(0.0, 22.0), neck=J(0.0, 25.0),
        head=J(0.0, 29.2), hair=J(0.0, 30.4),
        shL=J(-3.2, 24.0), shR=J(3.2, 24.0),
        elL=J(-5.0, 18.5), elR=J(5.0, 18.5),
        haL=J(-5.3, 12.8), haR=J(5.3, 12.8),
    )

    # 뼈(본드): 구조 강성 — 보행 단계에서 쓰인다
    bones = [
        ('hipL', 'kneeL'), ('kneeL', 'footL'), ('hipR', 'kneeR'), ('kneeR', 'footR'),
        ('hipL', 'hipR'), ('hipL', 'pelvis'), ('hipR', 'pelvis'),
        ('pelvis', 'chest'), ('chest', 'neck'), ('neck', 'head'),
        ('chest', 'shL'), ('chest', 'shR'),
        ('shL', 'elL'), ('elL', 'haL'), ('shR', 'elR'), ('elR', 'haR'),
    ]
    for a, b in bones:
        w.add_bond(j[a], j[b], 120.0, melt=9)

    # 스킨 프리미티브 (뼈 두께·재질) — artrender 가 읽는다
    def cap(a, b, r, mat):
        w.skins.append({'kind': 'capsule', 'i': j[a], 'j': j[b], 'r': r * scale, 'mat': mat})

    def blob(name, r, mat):
        w.skins.append({'kind': 'blob', 'idx': [j[name]], 'r': r * scale, 'mat': mat})

    cap('pelvis', 'chest', 2.6, 'cloth')          # 몸통
    cap('hipL', 'hipR', 2.2, 'cloth')             # 골반
    cap('chest', 'shL', 1.6, 'cloth'); cap('chest', 'shR', 1.6, 'cloth')  # 어깨
    cap('hipL', 'kneeL', 1.9, 'cloth'); cap('kneeL', 'footL', 1.5, 'cloth')  # 다리(바지)
    cap('hipR', 'kneeR', 1.9, 'cloth'); cap('kneeR', 'footR', 1.5, 'cloth')
    blob('footL', 1.6, 'cloth'); blob('footR', 1.6, 'cloth')              # 신발
    cap('shL', 'elL', 1.4, 'cloth'); cap('shR', 'elR', 1.4, 'cloth')      # 위팔(소매)
    cap('elL', 'haL', 1.05, 'skin'); cap('elR', 'haR', 1.05, 'skin')      # 아래팔(피부)
    blob('haL', 1.25, 'skin'); blob('haR', 1.25, 'skin')                  # 손
    cap('chest', 'neck', 1.0, 'skin'); cap('neck', 'head', 0.85, 'skin')  # 목(얇게)
    blob('hair', 3.4, 'hair')                                             # 머리카락(뒤)
    blob('head', 3.2, 'skin')                                             # 머리(앞)

    return {'joints': j, 'units': list(j.values())}


class WalkController:
    """보행 컨트롤러 — 입력항 I로 *걸음*을 물리 창발시킨다 (R3).

    스켈레톤은 정면 뷰라 척추 본드만으로는 서지 못하고 풀썩 주저앉는다(본드는
    축 신장만 막고 관절 각도는 못 잡는다). 컨트롤러가 '근육'처럼 관절을 목표로
    당기는 PD 힘(=입력항 I)을 주입한다. 진짜 관건은 **횡 균형**: 한 발을 들 때
    무게중심(골반)을 디딤발 위로 옮기지 않으면 옆으로 쓰러진다. CPG 위상(phase)이
    좌우 디딤/흔듦을 교대시키고, 골반을 디딤발 쪽으로 흔들어(체중 이동) 균형을
    잡는다. 걸음의 *입력*(위상·체중이동)은 I, *동역학*(접지 반력·바운스·관절 거동)은
    중력·지형·본드에서 창발한다. CreatureCtrl(목표속도 힘)의 정교한 형제.
    """
    def __init__(self, w, joints, scale, period=1.1, step_lift=3.2,
                 sway=1.7, speed=8.0, kp=70.0, kd=8.0):
        self.j = joints; self.scale = float(scale); self.period = float(period)
        self.step_lift = step_lift * scale       # 흔듦발 들어올림 높이
        self.sway = sway * scale                  # 골반 좌우 체중 이동 폭
        self.speed = float(speed)                 # 보행 속도(목표 지향 이동)
        self.kp = float(kp); self.kd = float(kd)
        self.phase = 0.0
        pel = w.P[joints['pelvis']].copy()
        self.rest = {n: (w.P[i] - pel).copy() for n, i in joints.items()}
        self.cx = float(pel[0]); self.y0 = float(pel[1])
        self.goal = None        # 목표 x (None=정지). 브레인이 set_goal 로 조종.
        self.march = False      # True=제자리 걸음(목표 없이도 걷는다, R3 데모용)
        self.walking = False
        self.reach = 0.0        # 동작 강도 0..1: 손을 내리고 웅크림(채집/사냥 손짓)

    def set_goal(self, x):
        """걸어갈 목표 x — 입력항 I의 '의도'(어디로)."""
        self.goal = float(x)

    def stop(self):
        self.goal = None

    def _pd(self, w, name, tx, ty, kp=None, kd=None):
        """관절을 (tx,ty) 세계좌표로 당기는 PD 힘 — 입력항 I."""
        i = self.j[name]
        kp = self.kp if kp is None else kp
        kd = self.kd if kd is None else kd
        w.F[i, 0] += kp * (tx - w.P[i, 0]) - kd * w.V[i, 0]
        w.F[i, 1] += kp * (ty - w.P[i, 1]) - kd * w.V[i, 1]

    def update(self, w, dt):
        if not w.alive[self.j['pelvis']]:
            return
        # ── 목표 지향 이동: 목표가 멀면 그쪽으로 보행, 도착·무목표면 정지(양발 디딤) ──
        moving = self.goal is not None and abs(self.goal - self.cx) > 1.2 * self.scale
        self.walking = moving or self.march
        if moving:
            d = 1.0 if self.goal > self.cx else -1.0
            self.cx += d * self.speed * dt          # 보행 기준점 전진(걸음은 물리로 따라옴)
        if self.walking:
            self.phase = (self.phase + dt / self.period) % 1.0
        ph = 2 * math.pi * self.phase
        gait = 1.0 if self.walking else 0.0          # 정지 시 들기·흔들기·스윙 0
        r = self.rest
        cx = self.cx
        gY = lambda x: w.ground(x)
        crouch = self.reach * 1.6 * self.scale       # 동작 시 살짝 웅크림

        # ── 횡 균형: 골반을 디딤발 쪽으로 흔든다(체중 이동) ──
        s_lat = math.sin(ph)
        bob = 0.35 * self.scale * math.cos(2 * ph) * gait
        pel_tx = cx + self.sway * s_lat * gait
        pel_ty = self.y0 + bob - crouch
        self._pd(w, 'pelvis', pel_tx, pel_ty, kp=self.kp * 1.3)

        # ── 상체: 골반 위로 세워 유지(자세 유지=균형의 윗부분) ──
        for name in ('chest', 'neck', 'head', 'hair', 'shL', 'shR', 'hipL', 'hipR'):
            self._pd(w, name, pel_tx + r[name][0], pel_ty + r[name][1])

        # ── 다리: 디딤발은 접지 고정, 흔듦발은 들어올려 교대 ──
        for side, hipN, kneeN, footN in (('L', 'hipL', 'kneeL', 'footL'),
                                         ('R', 'hipR', 'kneeR', 'footR')):
            footx0 = cx + r[footN][0]
            hip_tx = pel_tx + r[hipN][0]
            swingL = self.phase < 0.5
            swinging = swingL if side == 'L' else (not swingL)
            if swinging and self.walking:
                lp = (self.phase / 0.5) if side == 'L' else ((self.phase - 0.5) / 0.5)
                lift = self.step_lift * math.sin(math.pi * lp)
            else:
                lift = 0.0
            foot_ty = gY(footx0) + 0.5 * self.scale + lift
            self._pd(w, footN, footx0, foot_ty)
            # 무릎: 엉덩이-발 중점 + 흔듦 시 함께 들림(무릎 굽힘)
            knee_tx = 0.5 * (hip_tx + footx0)
            knee_ty = self.y0 - crouch + r[kneeN][1] + 0.55 * lift + bob
            self._pd(w, kneeN, knee_tx, knee_ty)

        # ── 팔: 보행 시 대측 스윙, 동작(reach) 시 손을 내려 모음(채집·사냥 손짓) ──
        arm = 1.4 * self.scale * math.sin(ph) * gait
        down = self.reach * 3.2 * self.scale
        inw = self.reach * 0.45
        self._pd(w, 'elL', pel_tx + r['elL'][0] * (1 - 0.3 * self.reach) + arm,
                 pel_ty + r['elL'][1] - 0.5 * down)
        self._pd(w, 'haL', pel_tx + r['haL'][0] * (1 - inw) + 1.4 * arm,
                 pel_ty + r['haL'][1] - down)
        self._pd(w, 'elR', pel_tx + r['elR'][0] * (1 - 0.3 * self.reach) - arm,
                 pel_ty + r['elR'][1] - 0.5 * down)
        self._pd(w, 'haR', pel_tx + r['haR'][0] * (1 - inw) - 1.4 * arm,
                 pel_ty + r['haR'][1] - down)


@register('walker')
def walker(w, cx=120.0, scale=1.6, period=1.1, speed=8.0, march=False):
    """보행하는 스켈레톤(R3): anchored=False 스켈레톤 + WalkController.
    기본은 정지 대기(목표를 set_goal 로 줘야 이동). march=True 면 제자리 걸음."""
    info = w.spawn_form('skeleton', cx=cx, scale=scale, anchored=False)
    ctrl = WalkController(w, info['joints'], scale, period=period, speed=speed)
    ctrl.march = bool(march)
    w.agents.append(ctrl)
    return {'joints': info['joints'], 'units': info['units'], 'ctrl': ctrl}


class CritterCtrl:
    """소형 동물(사냥감): 방랑 추진(입력항 I) + 위협(사냥꾼) 근접 시 도주.
    threat(사냥꾼 core 인덱스)을 브레인이 매 스텝 주입한다."""
    def __init__(self, units, core, speed=6.5, flee=9.0):
        self.units, self.core, self.speed, self.flee = units, core, speed, flee
        self.target = 0.0; self.t = 0.0; self.hop = 1 + random.random()
        self.threat = None

    def update(self, w, dt):
        if not w.alive[self.core]:
            return
        cx = w.P[self.core, 0]
        fleeing = False
        if self.threat is not None and w.alive[self.threat]:
            d = cx - w.P[self.threat, 0]
            if abs(d) < self.flee:                      # 사냥꾼이 가까우면 반대로 도주
                self.target = cx + (28 if d >= 0 else -28); fleeing = True
        if not fleeing:
            self.t -= dt
            if self.t <= 0 or abs(cx - self.target) < 6:
                self.target = 16 + random.random() * (w.W - 32); self.t = 2 + random.random() * 3
        spd = self.speed * (1.5 if fleeing else 1.0)
        dvx = (1 if self.target > cx else -1) * spd
        for i in self.units:
            if w.alive[i]:
                w.F[i, 0] += 3.0 * (dvx - w.V[i, 0])
        self.hop -= dt
        if self.hop <= 0:
            self.hop = (0.5 if fleeing else 1.5) + random.random()
            for i in self.units:
                if w.alive[i]:
                    w.V[i, 1] += 4


@register('critter')
def critter(w, cx=120.0, cy=None, speed=6.5):
    """렌더 가능한 소형 동물(사냥감): 몸통/머리 blob + 다리 캡슐(가죽 재질).
    CritterCtrl 로 방랑·도주. units 전체를 kill 하면 잡힌 것(렌더에서 사라짐)."""
    K = KIND['CREATURE']; baseY = w.ground(cx)
    cy = baseY + 3.0 if cy is None else cy
    core = w.spawn(cx, cy, M=1.0, kind=K, g_scale=1, hp=30)
    feet = []
    for dx in (-2.0, -0.7, 0.7, 2.0):
        f = w.spawn(cx + dx, baseY + 0.5, M=0.5, kind=K, g_scale=1, hp=30)
        feet.append(f); w.add_bond(core, f, 45)
    head = w.spawn(cx + 2.7, cy + 1.0, M=0.6, kind=K, g_scale=1, hp=30)
    w.add_bond(core, head, 45)
    units = [core] + feet + [head]
    w.skins.append({'kind': 'blob', 'idx': [core], 'r': 2.6, 'mat': 'hide'})
    w.skins.append({'kind': 'blob', 'idx': [head], 'r': 1.5, 'mat': 'hide'})
    for f in feet:
        w.skins.append({'kind': 'capsule', 'i': core, 'j': f, 'r': 0.6, 'mat': 'hide'})
    ctrl = CritterCtrl(units, core, speed)
    w.agents.append(ctrl)
    return {'core': core, 'units': units, 'ctrl': ctrl}


@register('berry_bush')
def berry_bush(w, cx=80.0, scale=1.0, nberry=4):
    """렌더 가능한 채집물: 바크 줄기 + 잎 캐노피 + 빨간 베리 blob.
    베리 unit 을 kill 하면 채집된 것(렌더에서 사라짐)."""
    baseY = w.ground(cx)
    WOOD, LEAF = KIND['WOOD'], KIND['LEAF']

    def P(dx, dy, kind):
        return w.spawn(cx + dx * scale, baseY + dy * scale, M=1.0, kind=kind,
                       fixed=True, g_scale=0.0)

    stem = P(0, 0, WOOD); top = P(0, 4.0, WOOD)
    w.skins.append({'kind': 'capsule', 'i': stem, 'j': top, 'r': 0.8 * scale, 'mat': 'bark'})
    for dx, dy in [(-2, 5), (2, 5), (0, 6.4), (-1, 4.2)]:
        leaf = P(dx, dy, LEAF)
        w.skins.append({'kind': 'blob', 'idx': [leaf], 'r': 2.7 * scale, 'mat': 'leaf'})
    spots = [(-1.6, 4.6), (1.6, 4.9), (0.0, 5.9), (0.7, 4.2), (-0.8, 5.4), (1.1, 6.0)]
    berries = []
    for dx, dy in spots[:nberry]:
        b = P(dx, dy, LEAF)
        w.skins.append({'kind': 'blob', 'idx': [b], 'r': 0.95 * scale, 'mat': 'berry'})
        berries.append(b)
    return {'cx': float(cx), 'berries': berries}


class ForagerHunterBrain:
    """채집·사냥 브레인(상태기계). 몸(WalkController)의 *의도*(어디로/무엇을)를
    고른다 = 입력항 I 의 상위 선택자. 동역학(걸음·균형·접지)은 물리로 창발.

      GATHER: 베리 덤불로 걸어가 → 멈춰 손 내려 베리를 하나씩 채집(사라짐)
      HUNT  : 사냥감(critter)을 쫓아가 → 잡으면 제거. 사냥감은 근접 시 도주.
      DONE  : 정지.
    """
    def __init__(self, w, ctrl, core, bushes, preys, reach=7.0, act=0.8):
        self.ctrl = ctrl; self.core = core
        self.bushes = bushes; self.preys = preys
        self.reach = float(reach); self.act = float(act)
        self.state = 'GATHER'; self.timer = 0.0
        self.gathered = 0; self.hunted = 0

    def _px(self, w):
        return float(w.P[self.core, 0])

    def _alive(self, w, units):
        return [i for i in units if w.alive[i]]

    def update(self, w, dt):
        for p in self.preys:                 # 사냥감에게 '나'를 위협으로 알림(도주 유발)
            p['ctrl'].threat = self.core
        if not w.alive[self.core]:
            return
        px = self._px(w)

        if self.state == 'GATHER':
            bush = next((b for b in self.bushes if self._alive(w, b['berries'])), None)
            if bush is None:
                self.state = 'HUNT'; self.ctrl.reach = 0.0; self.timer = 0.0; return
            if abs(px - bush['cx']) <= self.reach:
                self.ctrl.stop(); self.ctrl.reach = 1.0
                self.timer += dt
                if self.timer >= self.act:    # act 주기마다 베리 하나 채집
                    self.timer = 0.0
                    al = self._alive(w, bush['berries'])
                    if al:
                        w.kill(al[0]); self.gathered += 1
            else:
                self.ctrl.set_goal(bush['cx']); self.ctrl.reach = 0.0

        elif self.state == 'HUNT':
            prey = next((p for p in self.preys if w.alive[p['core']]), None)
            if prey is None:
                self.state = 'DONE'; self.ctrl.stop(); self.ctrl.reach = 0.0; return
            tx = float(w.P[prey['core'], 0])
            if abs(px - tx) <= self.reach:
                self.ctrl.stop(); self.ctrl.reach = 1.0    # 잡기 손짓
                self.timer += dt
                if self.timer >= self.act * 0.6:
                    self.timer = 0.0
                    for i in prey['units']:
                        w.kill(i)
                    self.hunted += 1
            else:
                self.ctrl.set_goal(tx); self.ctrl.reach = 0.0

        else:  # DONE
            self.ctrl.stop(); self.ctrl.reach = 0.0


@register('art_tree')
def art_tree(w, baseX=120.0, scale=1.0):
    """아트용 나무: 줄기·가지=바크 캡슐, 캐노피=잎 blob 메타볼. w.skins 채움.
    (물리 트러스인 'tree' 와 별도 — 이쪽은 렌더 형태 전용.)"""
    baseY = w.ground(baseX)
    WOOD, LEAF = KIND['WOOD'], KIND['LEAF']

    def P(dx, dy, kind):
        return w.spawn(baseX + dx * scale, baseY + dy * scale, M=1.0, kind=kind,
                       fixed=True, g_scale=0.0)

    base = P(0, 0, WOOD); mid = P(0.4, 9, WOOD); top = P(-0.3, 17, WOOD)
    bL = P(-6, 21, WOOD); bR = P(6, 20, WOOD); bM = P(0, 24, WOOD)

    def cap(i, j, r):
        w.skins.append({'kind': 'capsule', 'i': i, 'j': j, 'r': r * scale, 'mat': 'bark'})

    cap(base, mid, 2.3); cap(mid, top, 1.6)
    cap(top, bL, 1.0); cap(top, bR, 1.0); cap(top, bM, 1.1)        # 가지

    centers = [(0, 25), (-6, 22), (6, 21), (-3, 28), (4, 27), (0, 30.5), (-8, 26), (8, 25)]
    canopy = [P(dx, dy, LEAF) for dx, dy in centers]
    for k in canopy:
        w.skins.append({'kind': 'blob', 'idx': [k], 'r': 5.0 * scale, 'mat': 'leaf'})

    return {'trunk': [base, mid, top, bL, bR, bM], 'canopy': canopy}


@register('fireball')
def fireball(w, cx=120.0, cy=60.0, count=40, temp=2.0):
    """점화 버스트: 부력이 약해 제자리에서 번지며 나무·잎을 태운다."""
    u = []
    for _ in range(count):
        a = random.random() * 6.283; sp = 1 + random.random() * 4
        u.append(w.spawn(cx + (random.random() - 0.5) * 4, cy + (random.random() - 0.5) * 4,
                         vx=math.cos(a) * sp, vy=math.sin(a) * sp,
                         T=temp * (0.7 + random.random() * 0.6), M=0.8, kind=KIND['FIRE'], g_scale=0))
    return {'units': u}
