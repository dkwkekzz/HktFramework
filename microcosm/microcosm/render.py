"""render.py - matplotlib 헤드리스 렌더. World를 읽어 한 프레임을 그린다."""
import numpy as np
from .core import KIND

COL = {KIND['ROCK']: '#8b8576', KIND['WOOD']: '#7a5630', KIND['LEAF']: '#4f9a3e',
       KIND['CHARACTER']: '#46d08a', KIND['CREATURE']: '#e0913a'}


def _fire_rgb(T):
    t = min(1.0, T / 2)
    return (1.0, min(1.0, 0.35 + t * 0.6), max(0.0, t - 0.55))


def draw_world(w, ax):
    ax.clear()
    ax.set_xlim(0, w.W); ax.set_ylim(0, w.H); ax.set_aspect('equal'); ax.axis('off')
    ax.set_facecolor('#10131c')
    # 지형
    xs = np.linspace(0, w.W, 240)
    gy = np.array([w.ground(x) for x in xs])
    ax.fill_between(xs, 0, gy, color='#3a3526', zorder=1)
    ax.plot(xs, gy, color='#5a8f3c', lw=2, zorder=2)
    n = w.n
    al = w.alive[:n]
    P = w.P[:n]; kind = w.kind[:n]; T = w.T[:n]
    # 물
    mW = al & (kind == KIND['WATER'])
    if mW.any():
        ax.scatter(P[mW, 0], P[mW, 1], s=34, c='#3278d2', alpha=0.5, zorder=3, edgecolors='none')
    # 결합 (나무=갈색)
    for (i, j, rest, k, melt) in w.bonds:
        if not (w.alive[i] and w.alive[j]):
            continue
        wood = w.kind[i] in (KIND['WOOD'], KIND['LEAF'])
        ax.plot([w.P[i, 0], w.P[j, 0]], [w.P[i, 1], w.P[j, 1]],
                color='#7a5630' if wood else '#9a9cb0',
                lw=1.4 if wood else 0.7, alpha=0.9 if wood else 0.3, zorder=3)
    # 단위
    for kd, c in COL.items():
        m = al & (kind == kd)
        if m.any():
            ax.scatter(P[m, 0], P[m, 1], s=26 if kd != KIND['ROCK'] else 30,
                       c=c, zorder=5, edgecolors='none')
    # 불 + 가열 글로우
    mF = al & (kind == KIND['FIRE'])
    if mF.any():
        ax.scatter(P[mF, 0], P[mF, 1], s=60, c=[_fire_rgb(t) for t in T[mF]],
                   alpha=0.85, zorder=6, edgecolors='none')
    mH = al & (kind != KIND['FIRE']) & (kind != KIND['WATER']) & (T > 0.45)
    if mH.any():
        ax.scatter(P[mH, 0], P[mH, 1], s=50, c=[_fire_rgb(t) for t in T[mH]],
                   alpha=0.7, zorder=7, edgecolors='none')
