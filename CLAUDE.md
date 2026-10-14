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
- options for shape (rect / arch / point), leather colour, thread colour, ring (finish and size) and initials
- a grid & measurements toggle, with a "lock top view" mode (pan instead of rotate)
- fullscreen, "Download image" (PNG) and "Download pattern" (1:1 A4 PDF)

All text is in `content.<locale>.editor`.

### The key ring
Modelled on the rings the owner actually uses — Buckleguy **B2020**, solid iron, a
*split* ring. Photographed in the hand (`renders/14923–14925.jpg`) and from the
product page: flat strip wire wound **two turns**, and the two turns lie side by
side along the ring's axis, touching — a close-wound coil, so the band is two
wires wide with a groove between them and the pair is one wire's thickness apart.
It is **one continuous spiral, not two rings**: `bandGeo()` is called once, over
two turns, and `yAt(u)` (u running 0→1 over the sweep) is where the wire sits
along the axis as it winds — flat on the back turn, then eased across to the
front turn over `RING_RAMP 0.35` rad, flat again. Building each turn as its own
arc (what the code did until 2026-10-13) left four ends showing and read as two
rings stacked; the owner's photos — and the object — have one wire with two cut
ends, which sit `RING_GAP 0.22` rad apart at the split, one layer apart, exactly
as the hand photos show. Both turns are at the **same** radius: a coil is wound
on one mandrel, and the turns have to be free to slide along each other or the
ring cannot open. (An earlier version nested the back turn `wire * 0.28` further
in, which is not physical and is gone with the two-arc build.)

`bandGeo()` sweeps the wire's chamfered-rectangle section round an arc and caps
both ends by hand: a lathe leaves those ends open, and a lathe or tube section is
round where the real wire is flat, its wide face outwards. Wound so the surface
faces out; the section runs CCW in (radial, axial), which is what makes the end
fans come out right too — get it backwards and the band shades black.

`ring` (top of the view) gives the **inside** diameter and the wire width — the two
figures the product is sold by: 26.0 mm bore, 3.4 mm strip, in the scene
`2.60 / 0.34`. **Only the 1″ ring is offered** (the owner's call, 2026-10-13);
there is no size control, so no size labels in `content.*.editor` either. The
stated inside diameter is the bore, so the band is `wire` across and the ring is
`id + 2 · wire` over all — 3.4 mm of band, comfortable in the Ø 8 mm hole
(`y = HOLE_Y + ri + wire/2` centres the band on the hole). Four finishes in
`RINGS`, one per thing the owner stocks: silver (nickel plate), brass, matt
black, gold.

The finish is the one place the metal is not physical: at `metalness 1` with the
mirror roughness the finishes used to have, the *flat* band reflected one dark
corner of the studio environment and read as black plastic rather than nickel. It
is now `metalness 0.9` with satin roughness (0.36–0.48 in `RINGS`), which keeps a
highlight and lets the band read as its finish.

### The initials stamp
Drawn into the leather texture by `drawText()`: Helvetica (it was Georgia), and
`rgba(28,13,2,.62)` — darker than the 0.45 it was, at the owner's request. Debossed,
so the same pass draws the letters into the bump map in black; `textLayout()` is
shared with the pattern PDF, which still sets them in embedded DejaVu Sans (it
needs the Lithuanian letters).

### The stitching is APPROVED and LOCKED
It was tuned step by step against photos of the owner's real keyfob. Change it only when explicitly asked, and reuse it as-is for new items (wallets, straps…) by adding new `outline()` shapes only.

Measured from the real piece:

| Measurement | Value | Constant |
|---|---|---|
| Pricking iron pitch | 3.85 mm | `STITCH_PITCH 0.385` |
| Slit angle to the stitch line | 45° | `SLIT_ANGLE` |
| Stitch line from the edge | 2.8 mm | `STITCH_INSET 0.28` |
| End arc radius | ~18 mm | `ARC_R 1.8` |
| Thread diameter | 0.55 mm | `THREAD_R 0.0275` |
| Iron slit (the mark) | ~1.2 × 0.34 mm | `holeGeo` |

How it works:
- **`outline(kind, i)`:** only forms an iron can follow (straight runs + gentle arcs meeting at real corners), with exact insets. The body uses `outline(BEVEL)` so the outer size is exact (30 × 80 × 3.5 mm, Ø8 ring hole).
- **`stitchHoles` + `divide`:** holes spaced at equal chord length, with a hole forced on every sharp corner (tangent jump > 20°). Each run is bisected to close evenly. A run with no corners starts at the top centre.
- **Each stitch** runs between the inner ends of two slits, so its ends sit ~0.4 mm to the side of the holes they run into, and that offset is what tilts the stitch line ~13° off the row of holes (measured on the owner's own piece). Running hole centre to hole centre was tried and rejected: it lands the ends on the holes but straightens the run, and the owner wants the slant. Nor can a straight strand do both — only one that curves into the slit (`TURN` near 1) manages it, and that bend was rejected too. The back is mirrored (`side = -1`, `flipBack` turns back-face strands so their ends dive into the leather).
- **Thread strand:** a ringed capped cylinder (r 0.0275 — 0.55 mm thread, the size the owner sews with — length 0.28, 28 rings) with a shallow 3-ply texture (`bumpScale 0.25`; at 0.6 it read as twisted rope). Round in section: the instance scale is `1 × 1` and was `1.3 × 0.8`, which made a flat ribbon. Capped rather than open-ended: the ends are buried, but where the cord crosses the grain an open tube showed its dark inside as a hole at the end of every stitch. Every strand uses that one radius — the joint's two threads included (the second was scaled to 0.92, i.e. 0.51 mm, a leftover from the old 1.3/1.1 ratio). The only place the thread is not 0.55 mm is the barely-tapered ends below. The cord rides in the grain about 40% of its thickness (`z + side * 0.005`; it was `z - side * 0.015`, i.e. 77% buried, which was right for the old 0.8 mm cord and left only a flat sliver showing at 0.55 mm). `len` is the distance between slit inner tips; the strand is `len + 0.07`. What the other lengths did, on this geometry: `len + 0.17` overshot both holes by ~0.5 mm and the thread read as lying across the top of the hole; `len + 0.08` pushed the two ends through each other at the hole centre; `len + 0.055` left a gap of bare leather between stitches; `len + 0.07` is where the two end faces meet edge to edge. (On the hole-to-hole line the equivalent is `len + 0.01`.) Its ends:
  - barely narrow at all: 8% over the last 30%. A real taper is seen from the side as a cone driving into the hole — at 30% over the outer half that is exactly what it looked like. A 0.55 mm thread is not squeezed through a 1.5 mm cut, so keep this near zero.
  - turn into the slit by `TURN 0.2` of the slit's own angle, from 58% out (`endTurn` computed once). The owner's call: keep it low. The stitch should drop *down* into the hole, not curl round to run along the cut — at 1 the ends bend visibly and the run reads as a braid, so it sits between 0.1 (ends barely turn at all) and 0.3.
  - dive: a shallow, even dip into each hole — 0.25 mm over the outer 28% of the end. It was 0.55 mm, and before that 1.1 mm. This is the dial that decides whether the run reads as one thread or as separate pieces, and it only shows from a low viewing angle: deepen it (it was 1.1 mm) and the cord disappears at every hole, so the run breaks into beads with bare leather between them, which is what made the ends look like they were not going into the hole at all. Measure against the sample from the side, not from directly above.
- **Slits:** the cut a pricking iron makes, seen from above, leaning at `SLIT_ANGLE` (45°: the French convention, and what the owner measured off their own piece — Jun Lin, whose Artemis iron this is sized from, publishes no set angle). A pricking iron is a flat chisel, so the cut is a blunt chip — near-parallel sides with the corners knocked off — about 1.2 mm long and 0.34 mm wide, in a solid dark shape (leather × 0.12). The 1.2 mm is the slit measured on the owner's own punched piece — and it is what a 2.7 mm Jun Lin iron cuts (their published bevel widths run 1.2/1.3/1.4/1.5 mm for 2.7/3.0/3.38/3.85). The sample in `renders/` reads nearer 1.5 × 0.48 mm, but at that size the mark pulled the eye once thread was over it: on a sewn piece the thread fills the cut and the leather closes up on it, so an obvious hole is wrong. The 3D is sized for the sewn look, not for the bare-punched sample. It was built as a lens (two curves meeting at points): that gives a parabolic width profile, widest in the middle and zero at both ends, which narrows to a needle and reads as a scratch rather than a cut. (There was a `lipGeo` sliver beside each cut — a bright hair of leather standing on the edge, on the theory that a 70–80° bevel separates the fibres instead of slicing them. On screen it read as a chip of a different material lying beside the thread, so it is gone: the mark is the dark cut alone.) The "dimple" of pressed-in grain is kept faint and small (opacity 0.22, 0.5 × 0.7 of the old blob) — bigger and it paints a dark hole round every cut, and where it crosses the sunk thread it fizzes.
- Sizes above are measured off the pricked sample in `renders/` (3.85 mm row: 22.4 px pitch, 5.82 px/mm). Measure the *visible* dark mark, not the near-black core: the core is 1–2 px, but the penumbra either side of it is what the eye reads, and it roughly doubles the width.
- **Thread joint** (as on the real piece): on the left straight side, ~37% down from the top; `OVERLAP = 2` stitches sewn twice.
  - The first thread sits where a single stitch would.
  - The second sits on the inner side by `JOINT_GAP 0.045` and slides `JOINT_DROP 0.04` along the line (multiplied by `side`, so it is mirrored on the back). It is almost flush, with ends level.
  - The joint's holes are the same size as every other hole — two threads through one hole is the finishing and the tying-off, and nothing enlarges it. (They used to be cut 1.47× longer.) Its slit sits on the punch line, like every other hole. It used to be nudged inward by `JOINT_GAP/2` to sit centred under the pair — but both joint threads *end* where a single stitch's thread ends (on the line), so the cut stuck out past them on the inner side and read as a hole beside the second thread (the owner's complaint of 2026-10-13). On the line the first thread covers it and the second lies on the leather beside it: exposed-cut pixels 84 → 10.
  - The two melted thread-end nubs that used to sit on the back are gone (they read as dots beside the joint; the owner asked for them removed).
- **Pattern PDF (`makePattern`):** jsPDF 2.5.1 (cdnjs) + DejaVu Sans (for LT letters), both lazy-loaded on the first click.
  - Cut line and ring hole.
  - Iron slits drawn 1.6 × 0.45 mm.
  - Corner holes: a black awl dot, a circle, and both slits drawn grey with a black border (marked, not punched).
  - Red bracket at the joint, initials as a stamping guide, specs table, 10 mm square and 50 mm ruler.
  - **Print calibration** (2026-10-14, asked for by the owner): the owner's
    ML-2160 prints an A4 page 2.5–4 % small — it fits the page to its printable
    area (202 × 291 mm), which is 96 % across and 97.5 % down, and no printer
    setting changes it. So the pattern now carries a **200 mm line down the left
    edge of the sheet, always drawn at its true length** (it is the ruler, not
    the thing measured — no calibration is applied to it), with the note that
    says what to do, translated into all 7 locales. The owner measures that
    line, types the real length in the editor field `KALIBRAVIMAS, CM` (kept in
    `localStorage`), and everything the sheet states a size for — the template
    (cut line, slits, hole, initials), the check square, the 50 mm ruler and
    the four test lines — is drawn `cf = 200 / measured` times larger, so the
    next print is true size. `cf` is 1 while the field reads 20.
  - Also for the same reason: a line down the middle of the template (apex to
    apex, the keyfob's own length) and, at the foot of the sheet, four lines of
    80/60/40/20 mm 30 mm apart, plus a 50 × 50 mm square with an 80 mm line
    through it. All of those are scaled by `cf` too, so after calibration they
    print at the size they say.

### Status (2026-10-12)
The stitching and pattern are approved. Work in progress, asked for by the owner, is to make the stitching read as French pricking-iron work, tuned against a reference photo of pricked and stitched samples at 2.7/3.0/3.38/3.85 mm (`renders/il_794xN.1989616036_szkp.webp`):

- Thread diameter is 0.55 mm, not the 0.8 mm cord it was — that cord was wider than the 1 mm punch hole, which is why the holes were never visible.
- The slits are shaped iron-cut slots with a lit standing edge, not soft radial blobs. Done and measured: `renders/cmp-holes.png` puts mine against the reference at the same pitch.
- The stitch is close but not yet matched: `renders/cmp-final.png` puts both rows at the same pitch. Mine gives thread segments with a dark notch at each junction; the reference's thread is plumper and runs in a shallower wave, covering more of each pitch. The dials are the thread's radius, `TURN`, and how early the ends sink.

Earlier tweaks were thread-end shape (fuller, slightly rounded ends) and the joint mirrored correctly on the back.

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
