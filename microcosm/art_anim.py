"""art_anim.py - 스켈레톤 캐릭터 보행 프리뷰를 아트 렌더로 굴려 GIF 생성.

관절을 프레임마다 포즈(제자리 걸음 + 팔 스윙 + 상체 바운스)시켜 같은 SDF 렌더러로
그린다. R3(물리 창발 보행)의 미리보기 — 여기선 절차적 포즈.
실행:  python art_anim.py  ->  art_character.gif
"""
import os
import math
import numpy as np
from PIL import Image
from microcosm import World, standard_fields
from microcosm.artrender import render_scene

OUT = os.path.dirname(os.path.abspath(__file__))


def main():
    w = World(W=120.0, H=80.0)
    standard_fields(w)
    w.spawn_form('terrain')
    w.ground = lambda x: 12.0
    info = w.spawn_form('skeleton', cx=60.0, scale=1.6, anchored=True)
    j = info['joints']
    base = {name: w.P[idx].copy() for name, idx in j.items()}
    s = 1.6

    frames = []
    N = 28
    for f in range(N):
        ph = 2 * math.pi * f / N
        # 좌/우 다리 교대로 들기 (제자리 걸음)
        Lf = max(0.0, math.sin(ph)); Rf = max(0.0, math.sin(ph + math.pi))
        bob = 0.6 * s * abs(math.sin(2 * ph))      # 상체 바운스
        sw = 1.6 * s * math.sin(ph)                # 팔 스윙

        def setj(name, dx=0.0, dy=0.0):
            w.P[j[name]] = base[name] + np.array([dx, dy])

        # 기본 = 베이스
        for name in j:
            setj(name)
        # 상체 바운스
        for name in ('pelvis', 'hipL', 'hipR', 'chest', 'neck', 'head', 'hair', 'shL', 'shR'):
            setj(name, dy=bob)
        # 다리 들기 (무릎/발 위로 + 약간 앞으로)
        setj('kneeL', dx=1.2 * s * Lf, dy=2.6 * s * Lf + bob * 0.5)
        setj('footL', dx=1.6 * s * Lf, dy=3.4 * s * Lf)
        setj('kneeR', dx=1.2 * s * Rf, dy=2.6 * s * Rf + bob * 0.5)
        setj('footR', dx=1.6 * s * Rf, dy=3.4 * s * Rf)
        # 팔 스윙 (좌우 반대)
        setj('elL', dx=sw, dy=bob); setj('haL', dx=1.5 * sw, dy=bob)
        setj('elR', dx=-sw, dy=bob); setj('haR', dx=-1.5 * sw, dy=bob)

        img = np.clip(render_scene(w, scale=4.0, smin_k=1.4, supersample=2), 0, 1)
        frames.append(Image.fromarray((img * 255).astype(np.uint8)))

    path = os.path.join(OUT, 'art_character.gif')
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=70, loop=0)
    print(f"frames={len(frames)} -> {path}")


if __name__ == '__main__':
    main()
