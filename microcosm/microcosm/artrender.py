"""artrender.py - SDF/메타볼 아트 렌더러.

물리 디버그 뷰(점·선)가 아니라 *아트*를 그린다. 핵심 아이디어:
입자 구름·뼈를 **거리장(SDF)** 으로 바꿔 매끈한 표면을 뽑고, 방향광으로 셰이딩하고
외곽선을 입힌다. 이 하나의 렌더러로 캐릭터 스킨·나무 캐노피·바다 표면을 모두 그린다
(같은 기질, 다른 재질). "아트 리소스"를 손으로 그리지 않고 기질에서 뽑아내는 것이 목표.

  뼈/가지/줄기  = capsule SDF (선분 + 반경), smooth-min 으로 관절에서 부드럽게 융합
  머리/캐노피   = blob (입자들의 metaball)
  바다          = 물 입자 metaball → 임계 표면
  지형          = 높이함수 아래 재질 밴드

읽기 전용: World 상태(P, skins, ground, water)만 읽어 RGBA 래스터를 만든다.
"""
import numpy as np
from .core import KIND

# 재질 팔레트 (base RGB, outline RGB)
MAT = {
    'skin':    ((0.86, 0.66, 0.52), (0.32, 0.20, 0.16)),
    'cloth':   ((0.27, 0.40, 0.62), (0.10, 0.15, 0.28)),
    'hair':    ((0.28, 0.20, 0.16), (0.10, 0.07, 0.06)),
    'bark':    ((0.47, 0.33, 0.20), (0.18, 0.12, 0.07)),
    'leaf':    ((0.30, 0.55, 0.27), (0.12, 0.24, 0.11)),
    'rock':    ((0.55, 0.53, 0.47), (0.22, 0.21, 0.18)),
}
WATER_COL = ((0.16, 0.42, 0.72), (0.40, 0.66, 0.92))  # deep, foam
SKY = (0.94, 0.95, 0.97)


def _seg_sdf(gx, gy, ax, ay, bx, by, r):
    """선분 (a,b) + 반경 r 캡슐의 부호거리장. <0 이면 내부."""
    pax = gx - ax; pay = gy - ay
    bax = bx - ax; bay = by - ay
    denom = bax * bax + bay * bay + 1e-9
    h = np.clip((pax * bax + pay * bay) / denom, 0.0, 1.0)
    dx = pax - bax * h; dy = pay - bay * h
    return np.sqrt(dx * dx + dy * dy) - r


def _smin(a, b, k):
    """polynomial smooth-min — 두 거리장을 부드럽게 합쳐 관절을 자연스럽게 잇는다."""
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)


def _shade(base, sdf, gx_step, light=(-0.6, 0.8), depth_r=3.0, ao=True):
    """SDF 로부터 노멀을 추정해 람베르트 셰이딩 + 가장자리 어둠(AO 느낌)."""
    gy_grad, gx_grad = np.gradient(sdf)
    nl = np.hypot(gx_grad, gy_grad) + 1e-6
    nx, ny = -gx_grad / nl, -gy_grad / nl   # 표면 바깥 노멀(내부에서 바깥으로)
    lx, ly = light
    lmag = np.hypot(lx, ly); lx, ly = lx / lmag, ly / lmag
    lam = np.clip(nx * lx + ny * ly, 0.0, 1.0)
    shade = 0.55 + 0.45 * lam
    if ao:
        depth = np.clip(-sdf / depth_r, 0.0, 1.0)   # 안쪽일수록 밝게(가장자리 그늘)
        shade *= 0.78 + 0.22 * depth
    return base[None, None, :] * shade[:, :, None]


def _composite(img, mask, color):
    m = mask[:, :, None]
    return img * (1 - m) + color * m


def render_scene(w, scale=4.0, smin_k=1.2, outline=0.6, supersample=2):
    """World → RGBA(float, HxWx3). scale=픽셀/단위. supersample 로 안티에일리어싱."""
    ss = max(1, int(supersample))
    pxw = int(w.W * scale * ss); pxh = int(w.H * scale * ss)
    xs = np.linspace(0, w.W, pxw)
    ys = np.linspace(0, w.H, pxh)
    gx, gy = np.meshgrid(xs, ys)         # (pxh, pxw), gy 아래=0

    img = np.ones((pxh, pxw, 3)) * np.array(SKY)

    # ── 지형: 높이함수 아래 재질 밴드 ──
    gline = np.array([w.ground(x) for x in xs])      # (pxw,)
    below = gy < gline[None, :]
    grass = below & (gy > (gline[None, :] - 2.5))
    img = _composite(img, below, np.array((0.42, 0.34, 0.22)))   # 흙
    img = _composite(img, grass, np.array((0.34, 0.52, 0.26)))   # 표토 풀

    # ── 바다: 물 입자 metaball → 임계 표면 ──
    n = w.n
    al = w.alive[:n]
    mW = al & (w.kind[:n] == KIND['WATER'])
    if mW.any():
        field = np.zeros((pxh, pxw))
        Pw = w.P[:n][mW]
        rad = 4.2
        for (px, py) in Pw:
            d2 = (gx - px) ** 2 + (gy - py) ** 2
            field += np.exp(-d2 / (rad * rad))
        surf = field > 0.9
        foam = (field > 0.9) & (field < 1.4)
        img = _composite(img, surf, np.array(WATER_COL[0]))
        img = _composite(img, foam, np.array(WATER_COL[1]))

    # ── 스킨 프리미티브(캡슐/블롭): 재질별로 거리장을 모아 셰이딩 ──
    P = w.P
    by_mat = {}
    for s in w.skins:
        by_mat.setdefault(s.get('mat', 'skin'), []).append(s)

    # 그리는 순서: 뒤(머리카락/옷) → 피부. 단순화를 위해 재질 순서 고정.
    order = ['leaf', 'bark', 'hair', 'cloth', 'rock', 'skin']
    for mat in order + [m for m in by_mat if m not in order]:
        prims = by_mat.get(mat)
        if not prims:
            continue
        sdf = np.full((pxh, pxw), 1e9)
        for s in prims:
            if s['kind'] == 'capsule':
                i, j = s['i'], s['j']
                if not (w.alive[i] and w.alive[j]):
                    continue
                d = _seg_sdf(gx, gy, P[i, 0], P[i, 1], P[j, 0], P[j, 1], s['r'])
            else:  # blob
                idx = [k for k in s['idx'] if w.alive[k]]
                if not idx:
                    continue
                d = np.full((pxh, pxw), 1e9)
                for k in idx:
                    d = np.minimum(d, np.hypot(gx - P[k, 0], gy - P[k, 1]) - s['r'])
            sdf = _smin(sdf, d, smin_k)
        inside = sdf < 0
        if not inside.any():
            continue
        base, oc = MAT.get(mat, MAT['skin'])
        shaded = _shade(np.array(base), sdf, 1.0)
        img = img * (~inside)[:, :, None] + shaded * inside[:, :, None]
        # 외곽선
        edge = (sdf >= 0) & (sdf < outline)
        img = _composite(img, edge, np.array(oc))

    # 다운샘플(안티에일리어싱)
    if ss > 1:
        img = img.reshape(pxh // ss, ss, pxw // ss, ss, 3).mean(axis=(1, 3))
    return np.flipud(img)   # 이미지 위=월드 위


def save_png(w, path, **kw):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    img = np.clip(render_scene(w, **kw), 0, 1)
    plt.imsave(path, img)
    return path
