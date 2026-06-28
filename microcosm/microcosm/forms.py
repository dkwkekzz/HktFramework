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
