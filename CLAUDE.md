# SLOU: notes for Claude

Sails.js storefront for handmade leather goods (slou.lt). No database.

## Working rules (from the owner)
- **Translate every user-facing string into all 7 locales:** LT (default), EN, PT, FR, DE, ES, IT. UI copy lives in `config/content.js` (one block per locale, same keys); product copy is in `config/catalog.js`.
- **Never start the server** (`sails lift` etc.). The owner runs it. Verify with static checks or a headless-browser render of a standalone HTML copy instead.
- **Never edit `.tmp/` or `www/`.** They are build output.
- **Never `git commit` or `git push`.** Leave changes uncommitted for the owner.
- **Change only what was asked.** Don't carry a tweak over to parts already approved (e.g. a PDF change must not touch the 3D stitching). Offer related changes in one line instead.
- `config/routes.js` is in a public repo: unlisted pages (orders) are declared in `config/local.js`, which is gitignored.
- **Keep `README_updates.md` up to date** (owner's rule, 2026-10-14): every request he makes gets one line there, in that file's format — `[date time] - [message, max 5 words] - [description, max 50 words]`, newest first, one line per entry, never wrapped — so the history and the reason behind each change survive. Say *why* it was done, not just what.
- **Everything the browser can remember lives in `localStorage`, never on the server** (owner's rule, 2026-10-14): the calibration numbers are per PC, because another PC means another printer and another pair of numbers.

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
front turn across the split itself (the `RING_GAP` between the two ends), flat
again. The crossing must lie *between* the ends: until 2026-10-19 it ran over
`RING_RAMP 0.35` rad starting at 2π, right where the start end sits, so the wire
ran through that end and it faded out instead of ending like the other one.
The ends are cut on the slant, not square (2026-10-19, the owner's call): the
outer face of each end stops `RING_CUT 0.124` short of the inner one — 20° off
square (0.15, i.e. 24°, was too much) — so the back of the left (upward-facing)
end sits higher and of the right one lower, and their corners are rounded to
`RING_ROUND 0.02` (0.2 mm, "vos vos"). Where the wire crosses the gap it is
`RING_NECK 0.15` narrower in its radial width (seen face on, along the ring's
axis): one round curve (`sin`) between the two ends. The ends are slanted, so
it runs past each tip to the far corner of its cut (`RING_CUT` back) and is
full width only once the cut is passed entirely. Kept round on purpose (the
owner: less angular, "nepersistenk"): the ramp is a smootherstep, the neck
`sin^1.5` so it meets full width without a corner, and the band is sampled at
128 rings per radian so the short crossing is a curve, not facets. Over the
same stretch, on the same curve (`crossing(u)`), the section goes oval: its
chamfered corners blend into quarter-circles of radius `ht * 0.75` (the owner:
"ovalesnis", softer, only the gap). The section is 16 points for this — four
per corner, collinear along the chamfer everywhere else, so the band is unchanged. Its thickness along
the axis stays as it is — thinning that was tried first and reversed. Building each turn as its own
arc (what the code did until 2026-10-13) left four ends showing and read as two
rings stacked; the owner's photos — and the object — have one wire with two cut
ends, which sit `RING_GAP 0.26` rad apart at the split (0.22 until 2026-10-19), one layer apart, exactly
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
  - Red bracket at the joint, initials as a stamping guide, specs table.
  - **Print calibration** (2026-10-14, asked for by the owner, and reported
    working the same day: "viskas tiksliai atitinka, susikalibruoja tobulai"):
    his ML-2160 prints an A4 page small, and by a different amount on each axis
    — measured at about 4% off the width and 2.5% off the height (it fits the
    page into its printable area, ~202 × 291 mm). No printer setting changes it,
    and he has decided the customer should not have to touch the printer at all.
    So the pattern carries **two rulers and a square**: a vertical 270 mm line
    1 cm in from the left, centred vertically (equal distance from the top and
    bottom edges — a print that comes out crooked or shifted then cannot lose
    its ends in the printer's margin); a horizontal 180 mm line 4 cm up from the
    bottom, centred horizontally; and a 50 × 50 mm square in the bottom right,
    its right edge 15 mm from the page edge and its foot 1 cm above the
    horizontal ruler. All three are drawn `cfx`/`cfy` long like everything else
    that states a size, so on the first print (fields at their defaults, 18 and
    27) they show the raw damage; once the owner has measured them and typed the
    two lengths in (kept in `localStorage`) they print 270, 180 and 50 × 50 mm
    again and the whole sheet — keyfob, slits, hole, initials, rulers, square —
    is true size. Two factors, not one: the printer does not squeeze the two
    axes the same, so `X(x)` uses `cfx` and `Y(y)` uses `cfy`. Drawn ruler
    lengths are clamped to the page (292 / 198 mm) so nothing is ever drawn
    outside the A4 box.
  - The sheet carries no other test marks: the middle line, the four measuring
    lines and the earlier 10 mm square / 50 mm ruler were taken out again the
    same day, leaving the keyfob, the two rulers and the square.

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
