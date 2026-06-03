"""
히키토 통합 시뮬레이션 — 물질 레이어 프로토타입 (Step 1-3)
3 field (Potential / Affinity / Order) + 3 law (Threshold / Catalysis / Conservation)
순수 표준 라이브러리만 사용. UE5/Mass로 1:1 번역 가능한 구조.
"""
import random, argparse, math

# ---------------------------------------------------------------------------
# CONFIG — 이 블록이 곧 "튜닝 손잡이". Step 3는 여기 숫자만 바꾸는 작업이다.
# ---------------------------------------------------------------------------
class Config:
    W, H        = 60, 24      # 격자 크기 (= 거친 grid 해상도)
    SEED        = 7

    # --- 법칙1 임계(Threshold) ---
    IGNITE      = 0.35        # ★ criticality 손잡이. 점화 임계. (낮을수록 잘 탐)

    # --- 법칙2 촉매(Catalysis) ---
    SPREAD      = 0.50        # 타는 칸이 이웃에 주는 열 계수 (높을수록 연쇄 강함)

    # --- 법칙3 보존(Conservation) ---
    BURN_RATE   = 0.34        # 틱당 연료(P) 소모량
    ORDER_LOSS  = 0.25        # 틱당 질서(O) 파괴량
    ASH_FERT    = 0.80        # 소진 시 잿더미가 남기는 비옥도(=다음 레이어 잠재 다리)

    # --- 재생/되먹임 (루프를 닫아 "끝없음"을 만드는 부분) ---
    REGROW      = 0.04        # 비옥도→질서 회복 속도
    MATURE      = 0.60        # 이 이상이면 "성숙한 구조물"로 간주
    O_TO_P      = 0.03        # 성숙한 질서가 잠재를 다시 모으는 속도

    # --- 초기 분포 ---
    P0          = (0.5, 1.0)
    A0          = (0.4, 0.9)
    O0          = (0.5, 0.9)

DIRS = ((-1,0),(1,0),(0,-1),(0,1))

# ---------------------------------------------------------------------------
# WORLD — field = 격자에 올린 scalar map. (UE5: 거친 grid + Fragment)
# ---------------------------------------------------------------------------
class World:
    def __init__(self, cfg):
        self.cfg = cfg
        r = random.Random(cfg.SEED)
        H, W = cfg.H, cfg.W
        self.P = [[r.uniform(*cfg.P0) for _ in range(W)] for _ in range(H)]  # 잠재: 연료
        self.A = [[r.uniform(*cfg.A0) for _ in range(W)] for _ in range(H)]  # 친화: 인화성
        self.O = [[r.uniform(*cfg.O0) for _ in range(W)] for _ in range(H)]  # 질서: 숲
        self.heat    = [[0.0]*W for _ in range(H)]   # 상태: 옆에서 옮겨온 열
        self.fert    = [[0.0]*W for _ in range(H)]   # 다리: 잿더미 비옥도 (→ 다음 레이어 P)
        self.burning = [[False]*W for _ in range(H)]

    def ignite(self, y, x, amount=2.0):
        self.heat[y][x] = amount

# ---------------------------------------------------------------------------
# LAWS — 각 함수가 UE5의 Processor 하나에 대응. field 차이를 읽고 상태를 바꾼다.
# 핵심: 이 함수들은 "산불"을 모른다. P/A/O만 안다. → 다른 레이어에 그대로 재사용.
# ---------------------------------------------------------------------------
def law_threshold(w):
    """안 타던 칸이 (들어온 열 × 친화) > IGNITE 면 점화. 절벽형 변화."""
    c = w.cfg
    for y in range(c.H):
        for x in range(c.W):
            if not w.burning[y][x] and w.P[y][x] > 0.05:
                if w.heat[y][x] * w.A[y][x] > c.IGNITE:
                    w.burning[y][x] = True

def law_catalysis(w):
    """타는 칸이 이웃 heat를 올린다 → 연쇄. (이웃 쓰기 = sampling, 쿼리 폭발 회피)"""
    c = w.cfg
    new_heat = [[0.0]*c.W for _ in range(c.H)]
    for y in range(c.H):
        for x in range(c.W):
            if w.burning[y][x]:
                for dy,dx in DIRS:
                    ny,nx = y+dy, x+dx
                    if 0<=ny<c.H and 0<=nx<c.W:
                        new_heat[ny][nx] += c.SPREAD * w.P[y][x]
    w.heat = new_heat

def law_conservation(w):
    """탈수록 P·O가 준다(공짜 없음). 소진되면 꺼지고 비옥도를 남긴다."""
    c = w.cfg
    for y in range(c.H):
        for x in range(c.W):
            if w.burning[y][x]:
                w.P[y][x] -= c.BURN_RATE
                w.O[y][x] = max(w.O[y][x] - c.ORDER_LOSS, 0.0)
                if w.P[y][x] <= 0.05:
                    w.burning[y][x] = False
                    w.P[y][x] = 0.0
                    w.fert[y][x] += c.ASH_FERT          # ★ 질서 잔해 → 다음 잠재

def law_regrow(w):
    """루프를 닫는 되먹임: 비옥도→질서, 성숙한 질서→잠재. (끝없음의 엔진)"""
    c = w.cfg
    for y in range(c.H):
        for x in range(c.W):
            if w.fert[y][x] > 0 and not w.burning[y][x]:
                w.O[y][x] = min(w.O[y][x] + c.REGROW, 0.9); w.fert[y][x] -= 0.02
            if w.O[y][x] > c.MATURE and not w.burning[y][x]:
                w.P[y][x] = min(w.P[y][x] + c.O_TO_P, 1.0)

LAWS = [law_threshold, law_catalysis, law_conservation, law_regrow]

def tick(w):
    for law in LAWS:   # Processor를 정해진 순서로 한 번씩 = 한 tick
        law(w)

# ---------------------------------------------------------------------------
# OBSERVE — 통계 + 렌더링. criticality 자동 판정용.
# ---------------------------------------------------------------------------
def stats(w):
    c = w.cfg
    burning = sum(r.count(True) for r in w.burning)
    total = c.W*c.H
    avgP = sum(sum(r) for r in w.P)/total
    return burning, avgP

def render(w, t):
    c = w.cfg
    print(f"--- t={t} ---")
    for y in range(c.H):
        row = ""
        for x in range(c.W):
            if w.burning[y][x]: row += "@"
            elif w.P[y][x] <= 0.05 and w.O[y][x] < 0.3: row += "."
            elif w.O[y][x] > c.MATURE: row += "#"
            else: row += ":"
        print(row)
    print()

def run(cfg, ticks=60, draw_at=None, verbose=True):
    w = World(cfg)
    w.ignite(cfg.H//2, 2)                  # 왼쪽 가운데 불씨 하나
    peak_burn = 0
    burned_total = 0
    if verbose and draw_at and 0 in draw_at: render(w, 0)
    for t in range(1, ticks+1):
        tick(w)
        b, _ = stats(w)
        peak_burn = max(peak_burn, b)
        burned_total += b
        if verbose and draw_at and t in draw_at: render(w, t)
    total = cfg.W*cfg.H
    return {
        "peak_burn_pct": round(100*peak_burn/total, 1),   # 동시 최대 화재 면적
        "burned_total":  burned_total,                    # 누적 연소(=캐스케이드 크기)
    }

# ---------------------------------------------------------------------------
# CRITICALITY SWEEP — Step 3 자동화. 손잡이를 훑어 "재밌는 구간"을 찾는다.
# 판정은 cascade(누적 연소)로 한다. 절벽(=상전이)이 여기서 드러난다.
# ---------------------------------------------------------------------------
def classify(cascade, ticks):
    grid = Config.W * Config.H
    frac = cascade / (grid * ticks)        # 평균 동시 연소 비율
    if cascade < 50:  return "FROZEN   (다 얼어죽음 — 불이 안 번짐)"
    if frac > 0.15:   return "MELTED   (다 타죽음 — 통제불능 전소)"
    return             "PLAYABLE (재밌는 구간 — 번지지만 형태 유지)"

def sweep_ignite(ticks=60):
    print("=== SWEEP 1: IGNITE (점화 임계) — 절벽을 찾는다 ===\n")
    print(f"{'IGNITE':>8} | {'cascade':>8} | verdict")
    print("-"*60)
    for ig in [0.10,0.20,0.25,0.27,0.30,0.40,0.60,0.90]:
        c = Config(); c.IGNITE = ig
        r = run(c, ticks=ticks, verbose=False)
        print(f"{ig:>8.2f} | {r['burned_total']:>8} | {classify(r['burned_total'], ticks)}")
    print("\n→ 0.25와 0.30 사이가 절벽. 재밌는 임계점은 그 좁은 구간에 있다.\n")

def sweep_regrow(ticks=60):
    print("=== SWEEP 2: 재생속도 — 끝없음 루프가 너무 세면 다 타죽는다 ===\n")
    print(f"{'REGROW/O_TO_P':>14} | {'cascade':>8} | verdict")
    print("-"*60)
    for rg in [0.03, 0.20, 0.50, 0.90]:
        c = Config(); c.IGNITE=0.25; c.SPREAD=0.7; c.REGROW=rg; c.O_TO_P=rg
        r = run(c, ticks=ticks, verbose=False)
        print(f"{rg:>14.2f} | {r['burned_total']:>8} | {classify(r['burned_total'], ticks)}")
    print("\n→ 재생이 연소보다 빠르면 영구 화염폭풍. 루프를 닫되 너무 세면 안 된다.\n")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sweep", action="store_true", help="criticality 스윕 (IGNITE + 재생)")
    ap.add_argument("--ignite", type=float, help="IGNITE 직접 지정 후 렌더")
    a = ap.parse_args()
    try:
        if a.sweep:
            sweep_ignite(); sweep_regrow()
        else:
            c = Config()
            if a.ignite is not None: c.IGNITE = a.ignite
            run(c, ticks=40, draw_at={0,4,10,20,40})
    except BrokenPipeError:
        pass
