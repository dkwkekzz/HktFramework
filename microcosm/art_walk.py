"""art_walk.py - R3: 물리 창발 보행을 아트 렌더로 굴려 GIF 생성.

art_anim.py(절차적 포즈=관절 텔레포트)와 결정적으로 다르다: 여기선 관절을
직접 옮기지 않는다. WalkController 가 '근육'처럼 PD 힘(입력항 I)만 주입하고,
중력·지형 접지·본드 스프링이 나머지를 굴린다 → 걸음과 균형이 *물리로 창발*한다.
정면 biped 의 관건인 횡 균형(디딤발 위로 체중 이동)을 컨트롤러가 잡는다.

실행:  python art_walk.py  ->  art_walk.gif (+ art_walk_sheet.png 컨택트시트)
"""
import os
import numpy as np
from PIL import Image
from microcosm import World, standard_fields
from microcosm.artrender import render_scene

OUT = os.path.dirname(os.path.abspath(__file__))


def build():
    w = World(W=120.0, H=80.0)
    standard_fields(w)
    w.spawn_form('terrain')
    w.ground = lambda x: 12.0          # 평지(검증용)
    info = w.spawn_form('walker', cx=60.0, scale=1.6, period=1.1)
    info['ctrl'].march = True          # 제자리 걸음(R3 보행 데모)
    return w


def main():
    w = build()
    dt = 0.02
    # 정상 상태까지 워밍업(과도 응답 제거)
    w.run(int(1.5 * 1.1 / dt), dt=dt)

    # 정확히 2 주기를 캡처해 매끄럽게 루프
    period_steps = int(round(1.1 / dt))     # 55
    total = 2 * period_steps
    stride = 2                              # 2 스텝마다 1 프레임 → 55 프레임
    frames, sheet = [], []
    for s in range(total):
        w.step(dt)
        if s % stride == 0:
            img = np.clip(render_scene(w, scale=4.0, smin_k=1.4, supersample=2), 0, 1)
            frames.append(Image.fromarray((img * 255).astype(np.uint8)))
            if s % (period_steps // 3) == 0 and len(sheet) < 6:
                sheet.append((img * 255).astype(np.uint8))

    gif = os.path.join(OUT, 'art_walk.gif')
    frames[0].save(gif, save_all=True, append_images=frames[1:], duration=60, loop=0)
    print(f"frames={len(frames)} -> {gif}")

    # 컨택트시트(한 주기 6 포즈 가로로)
    if sheet:
        strip = np.concatenate(sheet, axis=1)
        Image.fromarray(strip).save(os.path.join(OUT, 'art_walk_sheet.png'))
        print(f"sheet={len(sheet)} -> art_walk_sheet.png")


if __name__ == '__main__':
    main()
