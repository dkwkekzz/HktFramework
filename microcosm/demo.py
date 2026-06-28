"""demo.py - 헤드리스 데모. 지형·바다·바위·나무·개체 세계를 굴려
demo_world.png(4단계 몽타주)와 microcosm_world.gif를 생성한다."""
import os, io, random
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image
from microcosm import World, standard_fields
from microcosm.render import draw_world

OUT = os.path.dirname(os.path.abspath(__file__))


def frame(fig):
    buf = io.BytesIO(); fig.savefig(buf, format='png', dpi=64, facecolor='#10131c'); buf.seek(0)
    return Image.open(buf).convert('RGB')


def main():
    random.seed(3); np.random.seed(3)
    w = World(); standard_fields(w)
    w.spawn_form('terrain')
    for cx in (70, 100, 130):
        w.spawn_form('water', cx=cx, count=55, spreadX=26, topY=112)
    for bx in (44, 92, 198):
        w.spawn_form('tree', baseX=bx)
    w.spawn_form('rock', cx=150, cy=0, r=5)
    w.spawn_form('creature', cx=116, cy=100); w.spawn_form('creature', cx=175, cy=100)
    w.spawn_form('character', cx=224, cy=95)

    fig, ax = plt.subplots(figsize=(7, 3.5))
    frames, marks = [], {}

    def run_capture(label, steps, stride=6):
        for s in range(steps):
            w.step(0.02)
            if s % stride == 0 or s == steps - 1:
                draw_world(w, ax); frames.append(frame(fig))
        marks[label] = len(frames) - 1

    run_capture('settle', 240)                       # 정착(물 고이고 나무 섬)
    for cx in (95, 110):                              # 물 더 붓기
        w.spawn_form('water', cx=cx, count=40, spreadX=10, topY=110)
    run_capture('pour', 150)
    run_capture('walk', 150)                          # 개체 이동
    w.spawn_form('fireball', cx=44, cy=w.ground(44) + 12, count=46, temp=2.3)
    w.spawn_form('fireball', cx=44, cy=w.ground(44) + 24, count=30, temp=2.3)
    run_capture('burn', 220)                          # 나무 연소

    tiles = [frames[marks[k]] for k in ('settle', 'pour', 'walk', 'burn')]
    tw, th = tiles[0].size
    mont = Image.new('RGB', (tw * 2, th * 2), '#10131c')
    for idx, im in enumerate(tiles):
        mont.paste(im, ((idx % 2) * tw, (idx // 2) * th))
    mont.save(os.path.join(OUT, 'demo_world.png'))

    gif = frames[::2]
    gif[0].save(os.path.join(OUT, 'microcosm_world.gif'), save_all=True,
                append_images=gif[1:], duration=70, loop=0)
    print('units=%d bonds=%d frames=%d -> demo_world.png, microcosm_world.gif' % (w.n, len(w.bonds), len(frames)))


if __name__ == '__main__':
    main()
