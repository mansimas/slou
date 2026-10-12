# renders — scratch harness for the /editor 3D view

Not part of the app. Nothing here is required to run Sails; the whole folder can
be deleted without effect. It exists because the editor's three.js scene can
only be judged by looking at it, and the server must not be started (CLAUDE.md).

## Images to look at

- `holes-full.png` — before/after of the holes: top row with the thread on them,
  bottom row with the thread hidden. The bottom row is what changed shape.
- `old-vs-new.png` — the committed version vs now: the stitch run, one hole, the
  whole fob.
- `g2.png` / `g3.png` / `g4.png` — how it stands now: the stitch run, the whole
  fob, and the back face.

## Opening the scene yourself

The `*.html` files are standalone copies of the page that need no server — open
one in a browser and orbit it with the mouse:

- `g3.html` — whole fob
- `g2.html` — zoomed on the stitching
- `g4.html` — the back face

three.js is still loaded from the CDN, so they need a network connection.

## The harness

- `render.js` — renders `views/pages/editor.ejs` (through `ejs` + `config/content.js`)
  into a standalone HTML page, optionally patching the camera, swapping code in,
  or rendering a different copy of the view, so the scene can be screenshotted
  without the server.
- `shot.sh` — headless Chrome screenshot of such a page.
- `montage.py` — crops the canvas out of screenshots and tiles them for comparison.
- `editor-HEAD.ejs` — the committed view, for rendering "before" images. Refresh
  it with `git show HEAD:views/pages/editor.ejs > renders/editor-HEAD.ejs`.
- `noThread.json` — patch that hides the stitches, to see the holes on their own.

Usage:

```
OUT=$PWD/renders/out.html CAM="camX,camY,camZ,tgtX,tgtY,tgtZ,minDist" node renders/render.js
renders/shot.sh $PWD/renders/out.html $PWD/renders/out.png 1200,760
python3 renders/montage.py out.png "LABEL" a.png "LABEL" b.png
```

`VIEW_FILE=<copy of the view>` renders that instead, `PATCH_FILE=<json list of
[find, replace] pairs>` swaps code in before rendering, and `LOC=en` picks a
locale. To check a render's script parses, extract the `<script type="module">`
body and run `node --check` on it.

## Snapshot: 2026-10-12, "thread OK" state

`editor-2026-10-12-thread-ok.ejs` is a copy of `views/pages/editor.ejs` at the
point the owner said the thread looked right. Restore with:

```
cp renders/editor-2026-10-12-thread-ok.ejs views/pages/editor.ejs
```

Parameters in that state (also in `params-thread-ok.txt`): thread 0.55 mm
(`THREAD_R 0.0275`), pitch 3.85 mm, slit 1.2 x 0.34 mm at 45 deg, `TURN 0.2`,
each stitch `len + 0.07` between slit inner tips, dip 0.55 mm over the outer 28%
of each end.

After that snapshot the dip was taken from 0.55 mm down to **0.25 mm**, which is
what makes the run read as one continuous thread with the stitches covering the
hole instead of sitting as separate beads. Everything else is unchanged from the
snapshot.

What is being worked on next: whether that dip is shallow enough, and whether the
cut under the thread should be smaller still when the piece is sewn.
