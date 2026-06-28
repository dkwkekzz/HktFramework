"""
render.py - matplotlib 시각화 헬퍼.

종류별로 색을 다르게, 불은 온도 컬러맵으로, 결합은 선으로, 번개는 가지로.
"""
import numpy as np

KIND_STYLE = {
    1: dict(color="#1D9E75", s=46, label="character"),  # 캐릭터(teal)
    4: dict(color="#9aa0a6", s=30, label="chainmail"),   # 사슬갑옷(gray)
}


def draw(w, ax, lightning_segs=None, title=None):
    ax.clear()
    ax.set_xlim(0, w.size[0])
    ax.set_ylim(0, w.size[1])
    ax.set_facecolor("#0d0d14")
    ax.set_aspect("equal")
    ax.axis("off")
    if title:
        ax.set_title(title, color="#e8e6df", fontsize=12, pad=6)

    # 결합선(구조)
    for (i, j, rest, k) in w.bonds:
        ax.plot([w.P[i, 0], w.P[j, 0]], [w.P[i, 1], w.P[j, 1]],
                color="#3a3a45", lw=0.7, zorder=1)

    n = w.n
    P, kind, T = w.P[:n], w.kind[:n], w.T[:n]

    # 정적 종류
    for kd, st in KIND_STYLE.items():
        m = kind == kd
        if m.any():
            ax.scatter(P[m, 0], P[m, 1], c=st["color"], s=st["s"], zorder=3,
                       edgecolors="none")

    # 번개 가지
    if lightning_segs:
        for a, b in lightning_segs:
            ax.plot([a[0], b[0]], [a[1], b[1]], color="#bcb6f5",
                    lw=1.4, alpha=0.85, zorder=4)
    lm = kind == 3
    if lm.any():
        ax.scatter(P[lm, 0], P[lm, 1], c="#e9e6ff", s=8, zorder=5,
                   edgecolors="none")

    # 불(온도 컬러맵)
    fm = kind == 2
    if fm.any():
        ax.scatter(P[fm, 0], P[fm, 1], c=np.clip(T[fm], 0, 2),
                   cmap="inferno", vmin=0, vmax=2, s=70, alpha=0.85,
                   zorder=6, edgecolors="none")
