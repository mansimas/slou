# SLOU: notes for Claude

Sails.js storefront for handmade leather goods (slou.lt). No database.

## Working rules (from the owner)
- **Translate every user-facing string into all 7 locales:** LT (default), EN, PT, FR, DE, ES, IT. UI copy lives in `config/content.js` (one block per locale, same keys); product copy is in `config/catalog.js`.
- **Never start the server** (`sails lift` etc.). The owner runs it. Verify with static checks or a headless-browser render of a standalone HTML copy instead.
- **Never edit `.tmp/` or `www/`.** They are build output.
- **Never `git commit` or `git push`.** Leave changes uncommitted for the owner.
- **Change only what was asked.** Don't carry a tweak over to parts already approved (e.g. a PDF change must not touch the 3D stitching). Offer related changes in one line instead.
- `config/routes.js` is in a public repo: unlisted pages (orders) are declared in `config/local.js`, which is gitignored.

## /editor: 3D leather keyfob designer
Route `GET /editor` → `PagesController.editor` → `views/pages/editor.ejs` (layout `slou`). three.js 0.160.0 comes from jsDelivr via an import map. Scene units are **cm**. The page has:
- options for shape (rect / arch / point), leather colour, thread colour, ring and initials
- a grid & measurements toggle, with a "lock top view" mode (pan instead of rotate)
- fullscreen, "Download image" (PNG) and "Download pattern" (1:1 A4 PDF)

All text is in `content.<locale>.editor`.

### The stitching is APPROVED and LOCKED
It was tuned step by step against photos of the owner's real keyfob. Change it only when explicitly asked, and reuse it as-is for new items (wallets, straps…) by adding new `outline()` shapes only.

Measured from the real piece:

| Measurement | Value | Constant |
|---|---|---|
| Pricking iron pitch | 3.85 mm | `STITCH_PITCH 0.385` |
| Slit angle to the stitch line | 45° | `SLIT_ANGLE` |
| Stitch line from the edge | 2.8 mm | `STITCH_INSET 0.28` |
| End arc radius | ~18 mm | `ARC_R 1.8` |

How it works:
- **`outline(kind, i)`:** only forms an iron can follow (straight runs + gentle arcs meeting at real corners), with exact insets. The body uses `outline(BEVEL)` so the outer size is exact (30 × 80 × 3.5 mm, Ø8 ring hole).
- **`stitchHoles` + `divide`:** holes spaced at equal chord length, with a hole forced on every sharp corner (tangent jump > 20°). Each run is bisected to close evenly. A run with no corners starts at the top centre.
- **Each stitch** runs between the inner ends of two slits, and both slits lean off that stitch's chord, so every stitch has the same length and lean (~13°, opposite to the slit). The back is mirrored (`side = -1`, `flipBack` turns back-face strands so their ends dive into the leather).
- **Thread strand:** a ringed open cylinder (r 0.04, length 0.28, 28 rings) with a 3-ply diagonal texture (even v along the length). Its ends:
  - stay nearly full width (taper from 75% out, down to 0.75), with a tiny dome over the last 4%
  - dip under the surface over the last 18%
  - turn sideways (from 55% out, `endTurn` computed once) so the tip runs along the slit's 45° line
- **Slits:** soft dark slots (`CircleGeometry` + radial `alphaMap`) with a faint wider shadow ("dimple") under each.
- **Thread joint** (as on the real piece): on the left straight side, ~37% down from the top; `OVERLAP = 2` stitches sewn twice.
  - The first thread sits where a single stitch would.
  - The second sits on the inner side by `JOINT_GAP 0.045` and slides `JOINT_DROP 0.04` along the line (multiplied by `side`, so it is mirrored on the back). It is almost flush, with ends level.
  - The joint's 3 slits are longer (2.8 vs 1.9) and nudged inward by GAP/2.
  - Two melted thread-end nubs sit on the back.
- **Pattern PDF (`makePattern`):** jsPDF 2.5.1 (cdnjs) + DejaVu Sans (for LT letters), both lazy-loaded on the first click.
  - Cut line and ring hole.
  - Iron slits drawn 1.6 × 0.45 mm.
  - Corner holes: a black awl dot, a circle, and both slits drawn grey with a black border (marked, not punched).
  - Red bracket at the joint, initials as a stamping guide, specs table, 10 mm square and 50 mm ruler.

### Status (2026-10-12)
The stitching and pattern are approved. The last tweaks were thread-end shape (fuller, slightly rounded ends) and the joint mirrored correctly on the back.

Open ideas, not done and not asked for yet:
- size each shape so the spacing is exactly 3.85 mm everywhere (would move the size by up to ~2 mm)
- turn thread ends only partly toward the slit, so the bend is softer
- a "no ring" option

### Testing without the server
Render the view with `ejs` + `config/content.js` into a standalone HTML file, then use headless Chrome:
```
google-chrome --headless=new --no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader --virtual-time-budget=8000 --screenshot=out.png file://...
```
For close-ups, patch `camera.position`, `controls.target` and `controls.minDistance` in the rendered copy. For the PDF, replace `doc.save(...)` with `doc.output('datauristring')` written into the DOM, then `--dump-dom`, base64-decode, and render with `pdftoppm`.
