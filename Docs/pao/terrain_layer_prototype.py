"""
히키토 통합 시뮬레이션 — 지형(地形) 레이어 프로토타입 (실세계화 심화)
=====================================================================
물질(불) 레이어에 이어, 같은 3축 + 같은 3법칙을 "지형"에 박는다.
이 파일 하나로 침식 시뮬을 돌리고 그림 3장을 뽑는다 (numpy + matplotlib).

  실행:
    python3 terrain_layer_prototype.py            # 시뮬 + 그림 3장 저장
    python3 terrain_layer_prototype.py --ticks 60 # 더 오래 침식

  출력:
    terrain_evolution.gif   초기 노이즈 → 침식된 지형 (음영기복 애니메이션)
    terrain_final.png       최종 4분할: 고도 / 강줄기 / 퇴적O / 경사
    landslide_powerlaw.png  산사태 크기 분포 (자기조직화 임계성 = 멱법칙)

---------------------------------------------------------------------
설계 핵심과의 매핑 (이 Processor들은 "지형"을 모른다. P/A/O 차이만 읽는다):

  축(field)            지형에서의 의미                     설계 문서의 축
  -------------------  ----------------------------------  ----------------------
  P  잠재(Potential)   고도(중력 위치에너지) + 물          고도·지각응력·지하수
  A  친화(Affinity)    침식성 — 얼마나 쉽게 깎이는가        침식/퇴적 성향
  O  질서(Order)       퇴적·토양(쌓여 남는 지층)            지층·지형 → 다음 잠재

  법칙(Processor)      지형에서의 모양                      법칙형
  -------------------  ----------------------------------  ----------------------
  law_catalysis        물방울이 물길을 파고, 판 물길이      촉매: 반응이 반응을
                       다음 물을 더 모은다 (되먹임 침식)    낳음 → 덴드라이트 강
  law_threshold        경사 > 안식각이면 산사태(절벽형)     임계: 경사 아닌 절벽
                                                            → 자기조직화 임계성
  law_conservation     깎인 흙은 어딘가 쌓인다(질량 보존)   보존: 공짜 없음
  law_uplift           느린 융기로 잠재를 다시 채운다        되먹임: 끝없음의 엔진

UE5/Mass 번역 구조:
  field  = 거친 grid 위 scalar map      → FMassFragment (P,A,O,flow,...)
  law_*  = field 차이를 읽는 함수        → 각각 UProcessor 하나
  tick   = 정해진 실행 순서              → ExecutionOrder 고정
  O(질서)→ 다음 레이어(날씨)의 P(잠재)   → "질서→잠재" 수직 결합 계약(Step 4)

수치 안정성 핵심(둘 다 실세계화 과정에서 직접 부딪힌 함정):
  · 물방울 침식/퇴적을 4 격자 코너에 쌍선형 분배 + per-step 상한 → 스파이크 폭주 방지.
  · 산사태(4이웃 확산) 완화계수는 CFL 한계 0.25 미만(=0.2)이어야 안정. 0.5면 가파른
    지형에서 발산한다(값이 ±로 진동하며 폭발, 총합은 보존되지만 max가 터짐).
"""
import numpy as np

# ---------------------------------------------------------------------------
# CONFIG — 튜닝 손잡이. 재밌는/안정적인 구간은 여기 숫자에서만 나온다.
# ---------------------------------------------------------------------------
class Config:
    N            = 192
    SEED         = 7
    # 촉매(물방울 침식)
    DROPLETS     = 4500
    DROP_LIFE    = 38
    INERTIA      = 0.05
    EROSION      = 0.30
    DEPOSITION   = 0.30
    CAPACITY     = 4.0
    EVAPORATE    = 0.02
    GRAVITY      = 4.0
    MAXDELTA     = 0.04      # per-step 침식/퇴적 상한 (스파이크 방지)
    # 임계(산사태 = 안식각)
    TALUS        = 0.022     # 안식각(임계 경사). 넘으면 무너진다
    SLIDE_F      = 0.20      # 완화계수 (CFL<0.25 → 안정)
    SLIDE_PASSES = 6
    # 되먹임(융기/풍화)
    UPLIFT_RATE  = 0.0010
    WEATHER      = 0.004
    TICKS        = 40


# ---------------------------------------------------------------------------
# 초기 지형 합성 — 프랙탈(부드러운 분지) + 능선(ridge) 혼합. 단일 돔이 아닌 산맥/분지.
# ---------------------------------------------------------------------------
def _fbm(rng, N, octaves, persist=0.5, ridged=False):
    out = np.zeros((N, N)); amp, total = 1.0, 0.0
    for o in range(octaves):
        cells = 2 ** (o + 1)
        coarse = rng.random((cells + 1, cells + 1))
        ys = np.linspace(0, cells, N); xs = np.linspace(0, cells, N)
        y0 = np.clip(np.floor(ys).astype(int), 0, cells - 1)
        x0 = np.clip(np.floor(xs).astype(int), 0, cells - 1)
        fy = (ys - y0)[:, None]; fx = (xs - x0)[None, :]
        c00 = coarse[y0][:, x0]; c10 = coarse[y0 + 1][:, x0]
        c01 = coarse[y0][:, x0 + 1]; c11 = coarse[y0 + 1][:, x0 + 1]
        layer = (c00 * (1 - fy) * (1 - fx) + c10 * fy * (1 - fx)
                 + c01 * (1 - fy) * fx + c11 * fy * fx)
        if ridged:
            layer = 1.0 - np.abs(2.0 * layer - 1.0)   # 능선 변환
        out += amp * layer; total += amp; amp *= persist
    return out / total


def build_terrain(N, seed):
    rng = np.random.default_rng(seed)
    base  = _fbm(rng, N, 7, 0.52)
    ridge = _fbm(rng, N, 6, 0.55, ridged=True)
    P = 0.55 * base + 0.45 * ridge ** 1.3
    P = (P - P.min()) / (np.ptp(P) + 1e-9)
    yy, xx = np.mgrid[0:N, 0:N]
    ring = np.minimum.reduce([yy, xx, N - 1 - yy, N - 1 - xx])
    P -= np.clip((10 - ring) / 10.0, 0, 1) * 0.45    # 가장자리 띠만 낮춰 물 출구
    return np.clip(P, 0, None)


# ---------------------------------------------------------------------------
# WORLD — field = 격자 위 scalar map (UE5: 거친 grid + Fragment)
# ---------------------------------------------------------------------------
class World:
    def __init__(self, cfg):
        self.cfg = cfg
        self.rng = np.random.default_rng(cfg.SEED)
        N = cfg.N
        self.P = build_terrain(N, cfg.SEED)                          # 잠재=고도
        self.A = 0.6 + 0.4 * _fbm(np.random.default_rng(cfg.SEED + 1), N, 3)  # 친화=침식성
        self.O = np.zeros((N, N))                                    # 질서=퇴적/토양
        self.flow   = np.zeros((N, N))
        self.eroded = np.zeros((N, N))
        self.injected = 0.0
        self.lost     = 0.0
        self.slide_events = []
        self.P0 = self.P.copy()


# ---------------------------------------------------------------------------
# LAWS = Processors
# ---------------------------------------------------------------------------
def _bilin_add(P, O, xi, yi, fx, fy, amount):
    """4 격자 코너에 쌍선형 분배 — 단일칸 스파이크 방지."""
    w00 = (1 - fx) * (1 - fy); w10 = fx * (1 - fy)
    w01 = (1 - fx) * fy;       w11 = fx * fy
    P[yi, xi] += amount * w00;     P[yi, xi + 1] += amount * w10
    P[yi + 1, xi] += amount * w01; P[yi + 1, xi + 1] += amount * w11
    if O is not None:
        O[yi, xi] += amount * w00;     O[yi, xi + 1] += amount * w10
        O[yi + 1, xi] += amount * w01; O[yi + 1, xi + 1] += amount * w11


def law_catalysis(w):
    """촉매: 물방울이 경사를 따라 흐르며 물길을 판다. 판 물길이 다음 물을 더 모은다
    → 덴드라이트(가지치는) 강줄기가 떠오른다. (반응이 반응을 낳는 되먹임 침식.)"""
    c = w.cfg; N = c.N; P = w.P; A = w.A; O = w.O; rng = w.rng; flow = w.flow
    md = c.MAXDELTA; lost = 0.0
    sx = rng.uniform(1, N - 2, c.DROPLETS); sy = rng.uniform(1, N - 2, c.DROPLETS)
    for k in range(c.DROPLETS):
        x = sx[k]; y = sy[k]; dx = 0.0; dy = 0.0
        speed = 1.0; water = 1.0; sediment = 0.0
        for _ in range(c.DROP_LIFE):
            xi = int(x); yi = int(y)
            if xi < 1 or xi >= N - 2 or yi < 1 or yi >= N - 2:
                lost += sediment; sediment = 0.0; break
            fx = x - xi; fy = y - yi
            h00 = P[yi, xi]; h10 = P[yi, xi + 1]; h01 = P[yi + 1, xi]; h11 = P[yi + 1, xi + 1]
            gx = (h10 - h00) * (1 - fy) + (h11 - h01) * fy
            gy = (h01 - h00) * (1 - fx) + (h11 - h10) * fx
            dx = dx * c.INERTIA - gx * (1 - c.INERTIA)
            dy = dy * c.INERTIA - gy * (1 - c.INERTIA)
            mag = (dx * dx + dy * dy) ** 0.5
            if mag < 1e-8:
                ang = rng.random() * 6.283185; dx = np.cos(ang); dy = np.sin(ang); mag = 1.0
            dx /= mag; dy /= mag
            nx = x + dx; ny = y + dy; nxi = int(nx); nyi = int(ny)
            if nxi < 1 or nxi >= N - 2 or nyi < 1 or nyi >= N - 2:
                lost += sediment; sediment = 0.0; break
            f2x = nx - nxi; f2y = ny - nyi
            nh = (P[nyi, nxi] * (1 - f2x) * (1 - f2y) + P[nyi, nxi + 1] * f2x * (1 - f2y)
                  + P[nyi + 1, nxi] * (1 - f2x) * f2y + P[nyi + 1, nxi + 1] * f2x * f2y)
            h_here = (h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy)
                      + h01 * (1 - fx) * fy + h11 * fx * fy)
            dh = nh - h_here
            cap = max(max(-dh, 0.0) * speed * water * c.CAPACITY, 0.01)
            if dh > 0 or sediment > cap:
                drop = min(sediment, dh) if dh > 0 else (sediment - cap) * c.DEPOSITION
                drop = min(max(drop, 0.0), sediment, md)
                _bilin_add(P, O, xi, yi, fx, fy, drop); sediment -= drop
            else:
                take = (cap - sediment) * c.EROSION * A[yi, xi]
                take = max(min(take, -dh, md), 0.0)         # 상한 + ≤ 내리막 높이차
                _bilin_add(P, None, xi, yi, fx, fy, -take)
                O[yi, xi] = max(O[yi, xi] - take * 0.3, 0.0)
                sediment += take; w.eroded[yi, xi] += take
            flow[yi, xi] += water
            speed = min((max(speed * speed + (-dh) * c.GRAVITY, 0.0)) ** 0.5, 8.0)
            water *= (1 - c.EVAPORATE); x = nx; y = ny
            if water < 0.01:
                _bilin_add(P, O, xi, yi, fx, fy, min(sediment, md)); sediment = 0.0; break
        else:
            xi = int(x); yi = int(y)
            if 1 <= xi < N - 2 and 1 <= yi < N - 2:
                _bilin_add(P, O, xi, yi, x - xi, y - yi, min(sediment, md))
    w.lost += lost


def _topple_pass(P, T, f):
    """안식각 T 초과분의 f배를 더 낮은 이웃에 분배. (질량 보존; f<0.25 안정)"""
    d_up = np.zeros_like(P); d_dn = np.zeros_like(P)
    d_lf = np.zeros_like(P); d_rt = np.zeros_like(P)
    d_up[1:, :]  = P[1:, :]  - P[:-1, :]
    d_dn[:-1, :] = P[:-1, :] - P[1:, :]
    d_lf[:, 1:]  = P[:, 1:]  - P[:, :-1]
    d_rt[:, :-1] = P[:, :-1] - P[:, 1:]
    diffs = np.stack([d_up, d_dn, d_lf, d_rt], 0)
    excess = np.clip(diffs - T, 0, None)
    unstable = int((excess.sum(0) > 1e-9).sum())
    if unstable == 0:
        return P, 0, None
    move = excess * f
    Pn = P - move.sum(0)
    Pn[:-1, :] += move[0, 1:, :]; Pn[1:, :] += move[1, :-1, :]
    Pn[:, :-1] += move[2, :, 1:]; Pn[:, 1:] += move[3, :, :-1]
    return Pn, unstable, (Pn - P + move.sum(0))


def law_threshold(w, measure=False):
    """임계: 경사가 안식각(TALUS)을 넘으면 산사태 — 경사가 아니라 절벽.
    연쇄되면 캐스케이드 → 자기조직화 임계성. (멱법칙은 measure_avalanches로 측정.)"""
    c = w.cfg; toppled = 0
    for _ in range(c.SLIDE_PASSES):
        Pn, n, gained = _topple_pass(w.P, c.TALUS, c.SLIDE_F)
        toppled += n
        if n == 0:
            break
        w.O += np.clip(gained, 0, None) * 0.5    # 무너져 받은 흙 = 퇴적(질서)
        w.P = Pn
    if measure:
        w.slide_events.append(toppled)
    return toppled


def law_conservation(w):
    """보존: 침식 누적분이 친화(A)를 올리고(풍화→양의 되먹임), P/O를 물리범위에 가둔다."""
    c = w.cfg
    np.clip(w.P, 0.0, None, out=w.P)
    np.clip(w.O, 0.0, None, out=w.O)
    w.A += c.WEATHER * (w.eroded > 1e-4)
    np.clip(w.A, 0.3, 1.6, out=w.A)
    w.eroded *= 0.96
    w.flow   *= 0.5


def law_uplift(w):
    """되먹임(끝없음의 엔진): 느린 융기가 잠재(고도)를 다시 채운다.
    침식 vs 융기 균형에서 정상상태 지형이 떠오른다 (공짜 아님 = 에너지 주입)."""
    c = w.cfg
    w.P += c.UPLIFT_RATE
    w.injected += c.UPLIFT_RATE * c.N * c.N


def tick(w, measure=False):
    """Processor를 정해진 순서로 한 번씩 = 한 tick (UE5 ExecutionOrder)."""
    law_catalysis(w)
    law_threshold(w, measure=measure)
    law_conservation(w)
    law_uplift(w)


# ---------------------------------------------------------------------------
# SOC 측정 — 임계 법칙의 가장 순수한 이산형 = BTW 모래더미.
# 한 알씩 쌓고 4이상이면 무너져 이웃에 1씩. 경계 밖으로 간 알은 소산.
# → 사태 크기 분포가 멱법칙(자기조직화 임계성). 지형 산사태는 이 규칙을 '옷 입힌' 형태.
# ---------------------------------------------------------------------------
def measure_avalanches(N=80, grains=30000, warmup=8000, seed=123):
    rng = np.random.default_rng(seed)
    z = np.zeros((N, N), dtype=np.int64); sizes = []
    for i in range(warmup + grains):
        z[int(rng.integers(0, N)), int(rng.integers(0, N))] += 1
        toppled = 0
        while True:
            over = z >= 4; n = int(over.sum())
            if n == 0:
                break
            toppled += n
            z[over] -= 4
            z[1:, :] += over[:-1, :]; z[:-1, :] += over[1:, :]
            z[:, 1:] += over[:, :-1]; z[:, :-1] += over[:, 1:]
        if i >= warmup and toppled > 0:
            sizes.append(toppled)
    return np.array(sizes)


def powerlaw_slope(sizes, nbins=26):
    sizes = sizes[sizes > 0]
    lo, hi = sizes.min(), sizes.max()
    bins = np.logspace(np.log10(lo), np.log10(hi + 1), nbins)
    hist, edges = np.histogram(sizes, bins=bins, density=True)
    centers = np.sqrt(edges[:-1] * edges[1:])
    mask = hist > 0
    lx = np.log10(centers[mask]); ly = np.log10(hist[mask])
    fit = (lx > lx.min() + 0.15) & (lx < lx.max() - 0.4)
    if fit.sum() < 3:
        fit = np.ones_like(lx, bool)
    slope, intercept = np.polyfit(lx[fit], ly[fit], 1)
    return slope, centers[mask], hist[mask], (slope, intercept)


# ---------------------------------------------------------------------------
# 렌더 (matplotlib) — 화면 없이 PNG/GIF로 저장
# ---------------------------------------------------------------------------
def _render(w, snaps, frame_ticks, slides):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.animation as animation
    from matplotlib.colors import LightSource, LinearSegmentedColormap

    TERRAIN = LinearSegmentedColormap.from_list("hk_terrain", [
        (0.00, "#14304a"), (0.10, "#1d4a3a"), (0.30, "#2f6b3e"),
        (0.50, "#5e7a3c"), (0.68, "#9a8a52"), (0.82, "#b3a48c"),
        (0.93, "#d8cfc2"), (1.00, "#ffffff")])
    INK = "#eef0f5"; BG = "#08090d"

    def hill(P, vert=2.6):
        pn = (P - P.min()) / (np.ptp(P) + 1e-9)
        return LightSource(315, 45).shade(pn, cmap=TERRAIN, blend_mode="soft", vert_exag=vert)

    def rivers(P, flow):
        img = hill(P, 2.0)[..., :3].copy()
        pos = flow[flow > 0]
        m = (np.clip((flow - np.percentile(pos, 72)) / (flow.max() - np.percentile(pos, 72) + 1e-9), 0, 1) ** 0.6
             if pos.size else np.zeros_like(flow))
        img[..., 0] = img[..., 0] * (1 - m) + 0.16 * m
        img[..., 1] = img[..., 1] * (1 - m) + 0.62 * m
        img[..., 2] = img[..., 2] * (1 - m) + 0.95 * m
        return np.clip(img, 0, 1)

    # 1) 진화 GIF
    fig, ax = plt.subplots(figsize=(6, 6), dpi=90); fig.patch.set_facecolor(BG); ax.axis("off")
    frames = [hill(w.P0)] + [hill(snaps[t]) for t in frame_ticks]
    labels = [(0, 0)] + [(t, int(slides[t - 1])) for t in frame_ticks]
    im = ax.imshow(frames[0])
    txt = ax.text(0.03, 0.96, "", transform=ax.transAxes, va="top", color=INK, fontsize=11,
                  family="monospace", bbox=dict(boxstyle="round", fc="#11131b", ec="#23262f"))

    def upd(i):
        im.set_data(frames[i]); t, s = labels[i]; txt.set_text("tick %3d   landslide %5d" % (t, s))
        return im, txt
    animation.FuncAnimation(fig, upd, frames=len(frames), interval=200, blit=False)\
        .save("terrain_evolution.gif", writer=animation.PillowWriter(fps=5))
    plt.close(fig)

    # 2) 최종 합성
    fig, axs = plt.subplots(2, 2, figsize=(12, 12), dpi=110); fig.patch.set_facecolor(BG)
    for ax in axs.ravel():
        ax.set_facecolor(BG); ax.axis("off")
    axs[0, 0].imshow(hill(w.P)); axs[0, 0].set_title("P (Potential) — elevation hillshade", color=INK, fontsize=13)
    axs[0, 1].imshow(rivers(w.P, w.flow)); axs[0, 1].set_title("Catalysis — rivers carved by flow (dendritic)", color=INK, fontsize=13)
    axs[1, 0].imshow(w.O, cmap="YlOrBr", vmax=np.percentile(w.O, 97))
    axs[1, 0].set_title("O (Order) — sediment/soil  (-> next layer potential)", color=INK, fontsize=13)
    gy, gx = np.gradient(w.P); slope = np.hypot(gx, gy)
    axs[1, 1].imshow(slope, cmap="magma", vmax=np.percentile(slope, 98))
    axs[1, 1].set_title("Threshold — slope (carved to angle of repose)", color=INK, fontsize=13)
    plt.tight_layout(); fig.savefig("terrain_final.png", facecolor=BG, bbox_inches="tight"); plt.close(fig)

    # 3) 산사태 멱법칙
    sizes = measure_avalanches()
    tau, centers, hist, (slope, intercept) = powerlaw_slope(sizes)
    fig, ax = plt.subplots(figsize=(7.5, 6), dpi=110); fig.patch.set_facecolor(BG); ax.set_facecolor("#0d0f16")
    ax.loglog(centers, hist, "o", color="#ff7a45", ms=7, label="landslide size dist.")
    xf = np.array([centers.min(), centers.max()])
    ax.loglog(xf, 10 ** intercept * xf ** slope, "--", color="#22c79a", lw=2,
              label="power-law fit  tau = %.2f" % (-slope))
    ax.set_xlabel("landslide size (toppled cells)", color="#cfd3de", fontsize=12)
    ax.set_ylabel("frequency (pdf)", color="#cfd3de", fontsize=12)
    ax.set_title("Self-organized criticality — landslides of every size", color=INK, fontsize=13)
    ax.tick_params(colors="#828aa0")
    for sp in ax.spines.values():
        sp.set_color("#23262f")
    ax.grid(True, which="both", color="#1a1c24", lw=0.6)
    leg = ax.legend(facecolor="#11131b", edgecolor="#23262f", fontsize=11)
    for t in leg.get_texts():
        t.set_color(INK)
    plt.tight_layout(); fig.savefig("landslide_powerlaw.png", facecolor=BG, bbox_inches="tight"); plt.close(fig)
    return -slope, len(sizes), int(sizes.max())


if __name__ == "__main__":
    import argparse, time
    ap = argparse.ArgumentParser()
    ap.add_argument("--ticks", type=int, default=Config.TICKS)
    ap.add_argument("--no-render", action="store_true", help="시뮬만(그림 생략)")
    a = ap.parse_args()

    cfg = Config(); cfg.TICKS = a.ticks
    w = World(cfg)
    frame_ticks = sorted(t for t in {1, 3, 6, 10, 15, 21, 28, 34, cfg.TICKS} if 1 <= t <= cfg.TICKS)
    snaps = {}; slides = []
    print("grid %dx%d, ticks %d, droplets/tick %d" % (cfg.N, cfg.N, cfg.TICKS, cfg.DROPLETS))
    t0 = time.time()
    for t in range(1, cfg.TICKS + 1):
        tick(w, measure=True)
        slides.append(w.slide_events[-1])
        if t in frame_ticks:
            snaps[t] = w.P.copy()
        if t % 10 == 0:
            print("  t=%3d  meanH=%.3f maxH=%.3f slides=%d" % (t, w.P.mean(), w.P.max(), slides[-1]))
    print("sim %.1fs  conservation: uplift_in=%.1f boundary_out=%.1f"
          % (time.time() - t0, w.injected, w.lost))

    if not a.no_render:
        tau, ns, smax = _render(w, snaps, frame_ticks, slides)
        print("rendered 3 images. landslide power-law tau=%.2f (%d events, max %d cells)" % (tau, ns, smax))
