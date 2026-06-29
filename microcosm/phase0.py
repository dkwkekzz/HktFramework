"""phase0.py - 층위(layer) 창발 검증. systems.pdf 2~3장을 *측정*으로 시험한다.

오픈월드 MMO 를 "거대한 세계로 창발"시키려면 두 주장이 사실이어야 한다.
이 스크립트는 가장 싼 파이썬 프로토타입에서 그 둘을 입증한다.

  ExpA (R1·창발 메커니즘)  L0 단위 클러스터가 *그 자체로* L1 상위 단위가 되는가?
                            승격→미세화 라운드트립이 질량·운동량·질량중심을 보존하는가?
  ExpB (분기·식 3)         제어변수(응집강도)를 임계점 너머로 올리면 질서변수 φ 가
                            0 근처에서 1 로 솟아오르는가? (Landau 분기의 입자계 실현)
  ExpC (R2·재규격화)       거칠게 본(coarse) 거시 모델이 미세(fine) 시뮬의 질량중심
                            궤적을 재현하는가? 그리고 소산 결합이 거칠게 보기에서
                            재규격화되어야 함을 보인다 (couplings flow).

실행:  python phase0.py   ->  phase0_results.png + 콘솔 지표
"""
import os
import random
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from microcosm import World, standard_fields
from microcosm.core import KIND
from microcosm.fields import PairField, EnvField, DRAG_C
from microcosm import (find_clusters, order_parameter, promote, refine,
                       total_mass, total_momentum, center_of_mass)

OUT = os.path.dirname(os.path.abspath(__file__))
WATER = KIND['WATER']
AGG = KIND['AGG']
LINK = 4.5          # 클러스터 연결 반경(접촉 거리). 응집 사거리(6.5)보다 작게.


# ───────────────────────────── ExpA : 승격/미세화 라운드트립 ──────────────────
def exp_a():
    """물을 지형 분지에 정착시켜 호수 클러스터를 만들고, 각 호수를 L1 메타-단위로
    승격한 뒤 다시 미세화한다. 라운드트립 보존을 검증한다."""
    random.seed(7); np.random.seed(7)
    w = World(); standard_fields(w)
    w.spawn_form('terrain')
    for cx in range(20, 230, 10):
        w.spawn_form('water', cx=cx, count=6, spreadX=6, topY=w.ground(cx) + 40)
    w.run(500)   # 흘러내려 분지에 고이도록 정착

    m0 = total_mass(w, [WATER]); p0 = total_momentum(w, [WATER]); c0 = center_of_mass(w, [WATER])
    n_l0 = int((w.alive[:w.n] & (w.kind[:w.n] == WATER)).sum())

    clusters = find_clusters(w, WATER, LINK)
    # 스냅샷(렌더용): 승격 전 위치 + 클러스터 색
    snap = [(np.array([w.P[i].copy() for i in c]), c) for c in clusters if c]

    metas = [promote(w, c) for c in clusters]
    metas = [m for m in metas if m]
    n_l1 = len(metas)
    lake_com = np.array([w.P[m.index].copy() for m in metas])
    lake_mass = np.array([m.mass for m in metas])

    # 승격 직후 거시량 (AGG 단위로 측정) — promote 가 보존하는지
    m1 = total_mass(w, [AGG]); p1 = total_momentum(w, [AGG]); c1 = center_of_mass(w, [AGG])

    for m in metas:
        refine(w, m)
    m2 = total_mass(w, [WATER]); p2 = total_momentum(w, [WATER]); c2 = center_of_mass(w, [WATER])
    n_l0b = int((w.alive[:w.n] & (w.kind[:w.n] == WATER)).sum())

    print("── ExpA  승격/미세화 (R1) ──────────────────────────────")
    print(f"  L0 물입자 {n_l0} → L1 호수 {n_l1}  (압축비 {n_l0 / max(n_l1,1):.1f}×)")
    print(f"  질량   원본 {m0:.4f} | 승격 {m1:.4f} | 복원 {m2:.4f}   err={abs(m0-m2):.2e}")
    print(f"  운동량 |원본-승격|={np.hypot(*(p0-p1)):.2e}  |원본-복원|={np.hypot(*(p0-p2)):.2e}")
    print(f"  질량중심 |원본-승격|={np.hypot(*(c0-c1)):.2e}  |원본-복원|={np.hypot(*(c0-c2)):.2e}")
    print(f"  미세화 후 L0 복원 개수 {n_l0b} (원본과 동일해야 함)")
    return dict(snap=snap, lake_com=lake_com, lake_mass=lake_mass,
                n_l0=n_l0, n_l1=n_l1, ground=w.ground)


# ───────────────────────────── ExpB : 분기(질서변수 창발) ────────────────────
def _disperse(coh_k, seed, n=5, g=5.0, steps=2000):
    """중력 끈 박스 안에 물입자를 격자로 흩뿌리고 응집강도 coh_k 로 정착시킨다.
    중력 off → 오직 쌍힘(반발·응집)과 소산이 최종 질서를 결정한다."""
    random.seed(seed); np.random.seed(seed)
    w = World(W=80.0, H=80.0)
    w.fields = [PairField(coh_k=coh_k), EnvField()]   # 지형/결합 없음, 소산은 있음
    c = 40.0
    for a in range(n):
        for b in range(n):
            x = c + (a - (n - 1) / 2) * g + (random.random() - 0.5) * 0.4
            y = c + (b - (n - 1) / 2) * g + (random.random() - 0.5) * 0.4
            w.spawn(x, y, vx=(random.random() - 0.5), vy=(random.random() - 0.5),
                    M=0.5, kind=WATER, g_scale=0.0)
    w.run(steps)
    return order_parameter(w, WATER, LINK)


def exp_b(seeds=6):
    """제어변수(응집강도 K)를 스윕하며 질서변수 φ 를 측정. 시드 평균으로 노이즈 억제.
    임계점 너머에서 φ 가 0→1 로 솟아오르면 분기(창발)다."""
    ks = np.array([0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 14, 20], float)
    phi = np.array([np.mean([_disperse(float(k), s) for s in range(seeds)]) for k in ks])
    crit = next((ks[i] for i in range(len(ks)) if phi[i] >= 0.5), None)
    print("── ExpB  분기: 질서변수 φ(응집강도) ────────────────────")
    print(f"  φ(K=0)={phi[0]:.3f}  φ(K=max)={phi[-1]:.3f}  임계 K≈{crit}  (시드 {seeds}개 평균)")
    print("  " + "  ".join(f"{k:g}:{p:.2f}" for k, p in zip(ks, phi)))
    return dict(ks=ks, phi=phi, crit=crit)


# ───────────────────────────── ExpC : 거칠게 보기 일관성 + 재규격화 ───────────
def exp_c():
    """응집 물방울을 옆으로 던져 자유낙하시키고, 미세 시뮬의 질량중심 궤적을
    두 거시 모델(소산 결합 재규격화 전/후)과 비교한다."""
    random.seed(5); np.random.seed(5)
    g_acc = 16.0; m_p = 0.5; cnt = 30; dt = 0.02; steps = 60
    # 미세 시뮬: 전체 입자(내부 응집·반발 + 중력 + 소산)
    w = World(W=240.0, H=120.0, gravity=g_acc)
    w.fields = [PairField(), EnvField()]   # 지형 없음
    cx, cy = 60.0, 95.0
    for _ in range(cnt):
        w.spawn(cx + (random.random() - 0.5) * 6, cy + (random.random() - 0.5) * 6,
                vx=9.0, vy=0.0, M=m_p, kind=WATER, g_scale=1.0)
    Mtot = cnt * m_p
    com = center_of_mass(w, [WATER]); v = total_momentum(w, [WATER]) / Mtot
    fine = []
    for _ in range(steps):
        w.step(dt)
        fine.append(center_of_mass(w, [WATER]).copy())
    fine = np.array(fine)

    # 거시 점질량 explicit-Euler (엔진 적분기와 동일). 중력은 질량에 외연적이라 그대로,
    # 소산은 입자마다 걸리므로 점으로 묶으면 N배로 재규격화되어야 한다.
    def integrate(drag_coeff):
        p = com.copy(); vel = v.copy(); traj = []
        for _ in range(steps):
            acc = np.array([0.0, -g_acc]) - drag_coeff * vel / Mtot
            vel = vel + acc * dt
            p = p + vel * dt
            traj.append(p.copy())
        return np.array(traj)

    naive = integrate(DRAG_C)             # 순진한 묶음: 원래 소산계수 그대로
    renorm = integrate(DRAG_C * cnt)      # 재규격화: 소산계수 ×N

    e_naive = np.hypot(*(fine - naive).T).max()
    e_renorm = np.hypot(*(fine - renorm).T).max()
    print("── ExpC  거칠게 보기 일관성 (R2) ──────────────────────")
    print(f"  미세 vs 거시(순진)     최대 질량중심 오차 {e_naive:.3f}")
    print(f"  미세 vs 거시(재규격화) 최대 질량중심 오차 {e_renorm:.2e}  (머신 정밀도)")
    print(f"  → 소산 결합을 ×{cnt} 로 재규격화하면 거시 궤적이 미세와 정확히 일치한다")
    t = np.arange(steps) * dt
    return dict(t=t, fine=fine, naive=naive, renorm=renorm,
                e_naive=e_naive, e_renorm=e_renorm)


# ───────────────────────────── 플롯 ─────────────────────────────────────────
def plot(a, b, c):
    fig, ax = plt.subplots(1, 3, figsize=(15.5, 4.4), facecolor='white')

    # ExpB 분기  (matplotlib 한글 폰트 부재 → 라벨은 영문)
    ax[0].plot(b['ks'], b['phi'], 'o-', color='#2a6f97', lw=2)
    if b['crit'] is not None:
        ax[0].axvline(b['crit'], ls='--', color='#bb3e03', alpha=0.7,
                      label=f"critical K~{b['crit']:g}")
        ax[0].legend(loc='lower right', fontsize=9)
    ax[0].set_title("ExpB - bifurcation: disorder->order (eq.3)", fontsize=11)
    ax[0].set_xlabel("control parameter: cohesion K")
    ax[0].set_ylabel("order parameter phi (largest-cluster mass frac)")
    ax[0].set_ylim(-0.05, 1.05); ax[0].grid(alpha=0.3)

    # ExpC 거칠게 보기 일관성
    ax[1].plot(c['t'], c['fine'][:, 0], 'o', ms=3, color='#222', label='fine COM (all particles)')
    ax[1].plot(c['t'], c['naive'][:, 0], '-', color='#bb3e03',
               label=f"coarse naive  err={c['e_naive']:.2f}")
    ax[1].plot(c['t'], c['renorm'][:, 0], '-', color='#2a9d8f',
               label=f"coarse renorm xN  err={c['e_renorm']:.2f}")
    ax[1].set_title("ExpC - coarse-graining reproduces macro (R2)", fontsize=11)
    ax[1].set_xlabel("time t"); ax[1].set_ylabel("center of mass x")
    ax[1].legend(loc='upper left', fontsize=8.5); ax[1].grid(alpha=0.3)

    # ExpA 승격: 클러스터 + 호수 COM
    cmap = plt.get_cmap('tab20')
    xs = np.linspace(0, 240, 240)
    ax[2].plot(xs, [a['ground'](x) for x in xs], color='#3a352a', lw=1.2)
    for k, (pts, _c) in enumerate(a['snap']):
        ax[2].scatter(pts[:, 0], pts[:, 1], s=8, color=cmap(k % 20), alpha=0.55)
    if len(a['lake_com']):
        s = 30 + 4 * a['lake_mass']
        ax[2].scatter(a['lake_com'][:, 0], a['lake_com'][:, 1], s=s,
                      facecolor='none', edgecolor='#bb3e03', lw=2,
                      label='L1 lake (promoted)')
        ax[2].legend(loc='upper right', fontsize=9)
    ax[2].set_title(f"ExpA - promote: L0 {a['n_l0']} -> L1 {a['n_l1']} "
                    f"({a['n_l0']/max(a['n_l1'],1):.1f}x)", fontsize=11)
    ax[2].set_xlabel("x"); ax[2].set_ylabel("y"); ax[2].set_xlim(0, 240); ax[2].set_ylim(0, 90)
    ax[2].grid(alpha=0.3)

    fig.suptitle("microcosm Phase 0 - layer emergence (systems.pdf sec.2-3)", fontsize=13)
    fig.tight_layout(rect=(0, 0, 1, 0.96))
    path = os.path.join(OUT, 'phase0_results.png')
    fig.savefig(path, dpi=110, facecolor='white')
    print(f"\n저장: {path}")


def main():
    a = exp_a(); b = exp_b(); c = exp_c()
    plot(a, b, c)


if __name__ == '__main__':
    main()
