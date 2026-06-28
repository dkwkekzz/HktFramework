"""demo.py - 점진적 창발 데모. 캐릭터->파이어볼->벼락->사슬갑옷."""
import os
import io
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image

from microcosm import World, standard_fields
from microcosm.render import draw

OUT = os.environ.get("MC_OUT", os.path.dirname(os.path.abspath(__file__)))


def frame_image(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=70, facecolor="#0d0d14")
    buf.seek(0)
    return Image.open(buf).convert("RGB")


def main():
    w = World(size=(120, 120), dt=0.05, gravity=9.0)
    standard_fields(w)
    fig, ax = plt.subplots(figsize=(5, 5))
    frames = []
    marks = {}
    state = {"segs": None}

    def snap(title, steps, stride=3):
        for s in range(steps):
            w.step()
            if (s % stride == 0) or (s == steps - 1):
                draw(w, ax, lightning_segs=state["segs"], title=title)
                frames.append(frame_image(fig))

    w.spawn_form("character", center=(26, 58))
    snap("1) Character  (bond + homeostasis)", 42)
    marks["character"] = len(frames) - 1

    w.spawn_form("fireball", origin=(40, 60), direction=(1, 0.18), speed=24, seed=3)
    snap("2) Fireball  (thermal field)", 26)
    marks["fireball"] = len(frames) - 1

    lt = w.spawn_form("lightning", top=(86, 114), seed=5)
    state["segs"] = lt.segs
    snap("3) Lightning  (fractal discharge)", 22)
    marks["lightning"] = len(frames) - 1

    w.spawn_form("chainmail", topleft=(66, 104), cols=13, rows=9)
    snap("4) Chain mail  (bond network)", 48)
    marks["chainmail"] = len(frames) - 1

    keys = ["character", "fireball", "lightning", "chainmail"]
    tiles = [frames[marks[k]] for k in keys]
    tw, th = tiles[0].size
    montage = Image.new("RGB", (tw * 2, th * 2), "#0d0d14")
    for idx, im in enumerate(tiles):
        montage.paste(im, ((idx % 2) * tw, (idx // 2) * th))
    montage.save(os.path.join(OUT, "demo_stages.png"))

    gif = frames[::2]
    gif[0].save(os.path.join(OUT, "microcosm_demo.gif"), save_all=True,
                append_images=gif[1:], duration=55, loop=0)
    print("units=%d bonds=%d frames=%d" % (w.n, len(w.bonds), len(frames)))


if __name__ == "__main__":
    main()
