"""Crop the 3D canvas out of full-page screenshots and tile them with labels.

  python3 montage.py out.png "LABEL" file.png ["LABEL" file.png ...]

CROP is the .kf__stage area as it lands in a 1200x760 shot; a 1000x700 shot
needs (8, 196, 848, 668) shifted, so pass the same window size for every panel.
"""
import sys
from PIL import Image, ImageDraw

CROP = (8, 196, 848, 668)
HERE = "/home/mantassimkus/slou/renders/"

out_path = sys.argv[1]
rest = sys.argv[2:]
if len(rest) % 2:
    raise SystemExit("expected LABEL/file.png pairs, got an odd number of arguments")
panels = list(zip(rest[0::2], rest[1::2]))
cols = 2 if len(panels) > 2 else 1

ims = [(label, Image.open(HERE + name).convert("RGB").crop(CROP)) for label, name in panels]
w, h = ims[0][1].size
LH, PAD = 30, 10
rows = (len(ims) + cols - 1) // cols

out = Image.new("RGB", (cols * w + (cols + 1) * PAD, rows * (h + LH) + (rows + 1) * PAD), "white")
d = ImageDraw.Draw(out)
for i, (label, im) in enumerate(ims):
    c, r = i % cols, i // cols
    x = PAD + c * (w + PAD)
    y = PAD + r * (h + LH + PAD)
    d.text((x + 4, y + 8), label, fill="black")
    out.paste(im, (x, y + LH))

out.save(HERE + out_path)
print("wrote", HERE + out_path, out.size)
