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
  - Watermark (`watermark(doc)`, the owner, 2026-10-27): a round stamp - SLOU in
    the middle, LEATHERCRAFT and SLOU.LT round the ring, Helvetica capitals as in
    the logo - placed by hand per page (`watermark(doc, spots)`, a list per page,
    set in `makePattern`) over what someone would most want to clean off and
    take: each template, the picture, the specs, the work process and links,
    with smaller ones round the rest (the owner, 2026-10-29); big and small
    (0.4-1.35 × a 48 mm stamp; on the card page 1 the templates each get a clearly different size), each at its own tilt, no two touching, every
    download alike. It is drawn solid
    black on its own jsPDF (`wm`, a page per page)
    and coloured in `flatten(doc, wm)` with a diagonal gradient (`WM_STOPS`, leather
    browns and olive) plus a radial one, varying in darkness (~4-12% darker than
    the paper; 3-9% until 2026-10-29) and not only colour, since most people print black and white (the
    owner), and a random ink grain on every pixel; multiplied into the
    page at 200 dpi, so there is no single tone to select (the owner, 2026-10-27).
    Call it on any new PDF, then `flatten(doc, wm)` and save what that
    returns: every page is rendered by pdf.js 3.11.174 (cdnjs, loaded with jsPDF)
    at 400 dpi into one JPEG filling the A4 page, so the watermark is in the same
    pixels as the lines and a PDF editor finds no object or text to delete (the
    owner, 2026-10-27: harder to remove). 400 dpi stays under phones' 16.7 M px
    canvas limit; sizes and calibration are unchanged. ~0.8 MB a page.
  - Copyright footer (the owner, 2026-10-29, after another maker's pattern):
    "© SLOU" and `pattern.rights` (personal use and small businesses only, no
    mass production, no sharing or reselling) centred at the foot of every
    page of every PDF, y 287-293, under the rulers and the process text.
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

### The card holder (kortelinė)
Added 2026-10-19 at the owner's request: an "Item" toggle (`product`: keyfob /
card) at the top of the panel; the card holder hides the shape and ring
controls. Built under the same rules as the keyfob, and its stitching is the
locked keyfob stitch, unchanged:
- Shapes come from the owner's own drawing, `pavyzdziai/korteline/korteline.pdf`
  (measured off its vectors, 2026-10-19): 70 × 100 mm standing up (`CARD_W`,
  `CARD_H`), every body corner rounded to `CARD_R 1.4`. Four pieces of veg-tan,
  as the owner cuts them: the two middle bodies `CARD_BODY 1.5 mm` each and
  the two outer pockets `CARD_POCKET 1.2 mm` each, so 5.4 mm at the stitched
  edge (`CARD_THICK`). Front to back: pocket,
  body, body, pocket (`outline('pocket')`, `outline('card')`). The bodies are
  full size, and the slot between them is the middle pocket. The pocket top
  is slanted (`pocketTop(x)`): level at 48 mm (52 until 2026-10-20) for 10 mm (11.3 mm until 2026-10-20), straight up to
  88 mm (81 until 2026-10-20), level for the last 10 mm (11.3 mm until 2026-10-20), with square top corners. The bends are
  eased over `POCKET_EASE 0.2` (2 mm; 0.5 until the owner asked for a firmer angle, 2026-10-20), soft but not a long curve. The
  drawing's second pocket is the mirror image, which once turned over onto
  the back lines up with the first, so the 3D uses one shape for both.
- From the owner's photos of the real piece (`pavyzdziai/2026091*.jpg`,
  2026-10-19):
  - Two colours: brown bodies (`state.leather`) and olive pockets
    (`state.pocket`, the "Pocket colour" control, card only).
  - Seen from the window side, the pocket is high on the **right**.
  - Naming (the owner, 2026-10-20): the SLOU-stamp side is the **front**, the window side the **back**; the code still calls the window pocket "front" (`zp`), but every user-facing text must use the owner's names. The window pocket (the initials side) has an arch-shaped thumb window (`windowPath`, 40 × 32 mm (38 tall until the owner lowered it, 2026-10-20); its sides placed so the hole inside the window, in the body, is 1 mm past the green edge, as at the pocket top (42 mm with the edge halfway between holes left a long slope; 34 mm at first), so the arch sits `WIN_CX` 1 mm left of centre and its left foot falls just into the corner rounding, and a superellipse top `WIN_TOP 2.6`, `WIN_FULL 2.3` (a plain half ellipse read as an egg; 1.9 tall at first) for a rounder, oval top that bends from 6 mm up, with no long straight sides),
    open at the bottom: cut up through the bottom edge (2026-10-20; it was a closed arch 7 mm up). Inside it the stitches lie on the body (`inPocket`, `face(x, y, side)`), and its sides are the pocket's own edge (`frontStack`). The stitch that crosses each side is `stitchGeo` itself, cloned and bent along the line over the edge (`lay`): flat and sunk on the pocket face, then over the edge straight into the body hole (laid flat on the body after the edge, it crept along the leather, which the owner rejected), never a separate tube: a tube looked faceted and blunt next to the plain stitches (the owner, 2026-10-20: threads must look perfect). In the window the bottom edge is a three-layer stack, its dome rounding over into the brown face (`stackTop`, the `top` argument of `leatherPiece`; it was a dark square cut).
  - The back pocket carries a SLOU stamp at the foot (`logoTex`, drawn
    mirrored because the back face is seen from behind).
  - The stitching runs only as high as the pockets: up to the low edge on the
    left and the high one on the right. The body above is not sewn.
  - From the close-ups in `pavyzdziai/korteline/`: the last stitch of each side
    hugs the pocket edge. Its end hole is in the body, `POCKET_END` (1 mm; it was 1.9 mm until the owner asked for it closer to the green)
    *above* the pocket edge, and the hole before it is about as far below, so
    the stitch climbs over the edge. It is one of the doubled end stitches,
    so it is sewn twice, which is the reinforcement. On the PDF those holes
    are on the body template only.
  - **That stitch looks like every other stitch in the row** (the owner's
    photos `pavyzdziai/korteline/20261019_2057*.jpg`): one thread, the same
    slant and thickness, in line with the rest, and it flows on into the next
    stitch. In `lay()` it is one `TubeGeometry` along a `CurvePath`: a
    straight run from the pocket hole to the pocket edge, one short bend over
    the edge that presses it in only just (`POCKET_DENT` 0.12 mm, through
    `pocketDent()` → `leatherPiece(..., squeeze)`, so the pockets are built
    after the stitches, `addPockets`), then a straight run down into the body
    hole. Its ends sink into the holes like a plain stitch's.
  - **It is two threads**, as on every doubled end stitch (the owner's
    close-ups; taking one away was a mistake the owner caught). Each of the
    two is that same plain stitch. On the card holder (`open`) a doubled stitch
    sits **exactly where a single stitch would**: same line, same slit tips,
    same slant (photo `pavyzdziai/korteline/20261019_162207.jpg`). The two
    threads are offset ±`JOINT_GAP`/2 across the line and overlap a little,
    so together they read as one slightly fuller, plied stitch in the row.
    They are drawn by `layPair()` as one smooth tube each. They **meet at the slit
    tips** and spread apart, just touching, only between the holes. Each end
    runs on into the cut and down 0.45 mm, so both threads are seen to go into
    the hole (the owner, 2026-10-19).
    Over the pocket edge it is **not** a steep drop: it starts down 1.4 mm
    before the edge, pressing the rounded edge in, and runs on one easy slope
    straight into the body hole, with no levelling out on the brown. The tube
    follows straight runs with quadratic-rounded corners, not Catmull-Rom,
    which swung the thread out into the air at the bend.
    Where the threads cross the green edge, the rounded edge itself is
    pressed in under them (`POCKET_DENT` 0.25 mm, ~0.6 mm wide): only the
    edge ring moves (`vert(..., edge)`), nothing at the glued face, deepest high
    on the dome, and none right at the outer face so it stays joined to the flat
    face. Tried and dropped: a dark shadow decal on the face (its square showed
    and it covered the thread), and 0.2 mm edge sampling (the inset outline
    crossed itself at the pocket corners and threw up a flap). The pocket side
    eases into the glued-stack dome over 1.5 mm below its top (`pocketStack`).
    The dent is a little wider than the thread (1 mm across, ~0.8 mm into the
    pocket), so the small shoulder of leather beside the thread slopes off
    instead of standing up steep (`pavyzdziai/korteline/1.png`). Mini
    corrections only here. A slanted pocket corner and a wide band worked
    down along the edge were both tried and reverted the same day.
    From `pavyzdziai/korteline/2.png` (the owner's paint-over, side view):
    - **Never widen or reshape the edge under the thread** (the owner,
      2026-10-20). The burnished edge is the same width everywhere
      (`CARD_ROUND`), and the green face stays matte green right up to it.
      A slope made by widening the edge there (`pocketRamp`, 0.9 mm) turned
      that green into glossy edge and was rejected; so was the narrow dent.
      The thread simply lies over the edge as it is (`layPair`, R = `CARD_ROUND`).
    - At the pocket's square top corner the switch is clean (`pocketStack`):
      the side keeps the stack's dome right up to the corner, and the top keeps
      its own narrow edge right to it. Easing down the side made the corner
      stick out. Easing along the top widened the glossy band into a bend
      (the owner, 2026-10-20).
      At a sharp corner `leatherPiece` places the corner point where the two
      set-in edges meet (each with its own rounding), not along the bisector.
      So the top edge runs straight and horizontal right into the side, square
      to it. A single bisector mitre ran it off at a slant.
    - `leatherPiece` adds no resample points within 2 mm of a sharp corner,
      because points closer than the edge's inset cross over and fold a flap.
    On the owner's piece the brown slit at the last hole still shows beside
    the thread; that is right. Tried and rejected on 2026-10-19: threads placed
    inside the slit at different points along it, and the pair centred on
    the end hole. Both bent the pair out of line and made the holes look
    distorted. The keyfob joint keeps its own approved `JOINT_GAP`/`JOINT_DROP` layout.
  - Rejected (the owner: "like a stuck-on worm crawling"): grooves pressed
    into the pocket, wide or hugging bends round the edge, and segmented
    pieces. Keep each thread plain.
- Edges (the owner, 2026-10-19): rounded with an edge beveler and burnished
  with Tokonole for a natural sheen, and not all alike. The pieces are built
  by `leatherPiece()`, not ExtrudeGeometry, because ExtrudeGeometry rounds
  every edge the same.
  - Where the four pieces are glued (the stitched sides and bottom) the edge
    is one polished dome across the whole 5.4 mm, "like a little hill, not a
    cut-off corner". It is elliptical, `CARD_DOME` 1 mm deep, flat-crowned,
    and meets the faces with no corner or step between the layers. Each layer
    keeps **its own colour**: seen from the side it reads green, brown,
    brown, green, with a faint darker glue line (`GLUE_LINE`) at each joint,
    because it has to show that it is glued (the owner, 2026-10-19). A
    single-colour edge, all green or blended, was tried and rejected.
  - Where a piece ends on its own (the pocket tops, the window, the bodies
    above the pockets) it has its own dome, `CARD_ROUND` 0.5 mm deep, in its
    own shade. A body eases from the stack to its own edge over the first
    1.2 mm above the pocket edge.
  - One corner only, the front (SLOU-side) pocket's high top corner, is
    rounded `POCKET_CORNER` 1.5 mm in the 3D (`sanded()`, `sandedStack`): the
    stack is sanded flush, as on the owner's piece; square, it stood out past
    the inner piece's edge (`korteline/11.png`). The owner asked for that one
    corner alone (2026-10-26): every other pocket corner stays square, and
    the pattern keeps them all square.
  - To keep the dome smooth across the joints, the normals come straight off the dome,
    not from each piece's own faces. Each layer's edge tucks 0.08 mm past
    its glued faces, 0.03 mm under its neighbour, and its glued faces stop
    0.1 mm short of the edge. Without those three, a light hairline showed
    at every joint.
  - The edge colour is in vertex colours (`burnished()`: a satin physical
    material with a light clearcoat, ×0.62 of the grain), so a leather or
    pocket colour change rebuilds the card holder. Card holder only: the
    keyfob keeps `edgeMat` and its 3-step extruded bevel.
- **Work on the card holder only** (the owner, 2026-10-19). Do not change
  the keyfob unless the owner names it, and keep shared code behaving as
  before for it.
- The drawing also recommends a 3.5 mm stitch line and a 3.75 mm pitch. The
  locked keyfob values (2.8 / 3.85) are kept until the owner decides.
- The grain faces out on both sides (`grainBackMat` on the back pieces);
  initials sit on the front pocket.
- Stitching is an open U (`seamHoles`): down the sides and round the bottom,
  the top left open, ending just under the pocket edge on each side. `build()` handles the
  open seam (no stitch after the last hole, `chordIn`), and the last
  `OVERLAP` stitches at each end are doubled like the keyfob joint. The thread
  sits on the pocket face below the pocket top and on the body face above it (`face(x, y)`).
- Pattern PDF (the owner, 2026-10-20): three templates. On top the two
  pockets as a mirrored pair, each as seen from its own face: the front
  piece (drawn with `m = -1`; never mention the SLOU stamp on the pattern, buyers may use their own) and the back
  piece (window as a solid cut line, initials). On page 2 both are one row, "Išorinė detalė × 2" (`C.outer`, the owner, 2026-10-26). Below, the
  inner piece × 2 (`C.body`; never call it a "main" piece), with the legend; each template carries its name only inside (`inside()`, "× 2" only where cut twice), so it survives cutting out,
  numbered 1-4 in a circle (0.5 mm line) left of its count (`number()`, the owner, 2026-10-27), down each column: left inner 1, front pocket 2, right inner 3, back pocket 4;
  beside it. The picture on page 2 is orthographic, turned only 15° and raised 6° (the owner, 2026-10-29): the front reads 67.6 × 100. A 42° turn read narrower than 70 × 100; square on (a cavalier view) did not look turned enough. Its leader lines end in a black dot in a white ring and run over a white halo, so they show on the dark leather in a colour or grey print (the owner, 2026-10-29). Under the picture on page 2, the owner's work process, 9 steps (`C.process`, the owner, 2026-10-27), two columns, paragraphs never split, the rest on a third page with balanced columns. No 50 mm square on this pattern (the owner, 2026-10-20), so the specs table fits under the legend: one A4 sheet. No
  doubled-stitch brackets and no slit angle in the legend (`C.holes`; the owner, 2026-10-20). The
  body carries the slanted pocket edge as a dashed line, like the grey line on
  the drawing. Thread
  ends are not marked. Calibration is shared with the keyfob.

### Card holder Nr. 2 (sulankstoma kortelinė)
Added 2026-10-29: the third "Item" (`product: 'card2'`, texts in `content.*.editor.card2`),
from a pattern the owner found (`pavyzdziai/pvz1.pdf` drawing, `pvz2.pdf` notes;
GR Handcraft). Only its shape and size are taken from it: the stitch and every
technique are the owner's own, as on the keyfob and Nr. 1 (the owner: always).
- One piece of 1.6 mm veg-tan (`FOLD_T`), 70 × 184.4 mm flat (`FOLD_W`, 2 × `FOLD_L`),
  folded in the middle; corners rounded 6 mm (`FOLD_R`); a Ø 25 mm hole on the fold
  (`FOLD_HOLE`), so each face has a half-round thumb notch. Where the corner
  roundings meet beside the fold (a point on the drawing) there is a 1 mm round
  (`FOLD_RHO`), so the edge can be set in.
- 3D: built flat by `leatherPiece` (new `stackT` argument, the stack is the two
  halves) and folded by `folded()`: triangles cut finer across the bend (no edge over
  0.3 mm along the piece; cutting them small every way made 300 000 triangles and
  stalled the PDF), then wrapped round a centre line of radius FOLD_T / 2, so the
  flesh sides meet. Sides and corners one glued dome; the open tops and the thumb
  hole each their own edge.
- Two open seams (`runs`), down the left, up the right, from 6 mm under the top to
  6 mm above the fold (`FOLD_END`), the last 2 stitches at each of the 4 ends doubled.
- Pattern: one sheet, the flat piece grain up, front half on top, fold dashed, slits on
  both halves mirrored across the fold, legend and specs on the right, no 50 mm square.
- From the owner's Etsy screenshots (`pavyzdziai/Ekrano kopija 2026-10-29 *.png`, the
  GR Handcraft listing): the fold with the thumb notch is the bottom, the cards go in at
  the open top and show through the notch, and with cards in it the halves bulge apart
  in the middle while staying glued at the sides. So the 3D carries a bank card standing
  on the fold (`cardMat`), and the halves stand `FOLD_OPEN` 1 mm apart round it
  (`foldLift`: nothing within 1 mm of the stitch line, eased over 3 mm), the bend opening
  with them. `FOLD_RHO` is 0.3 mm (1 mm left a dimple in the folded corner; a little is
  still there close up). Easing the dome out at the fold was tried and opened a gap
  between the layers there instead.
- SLOU stamp (the owner, 2026-10-29) on the back half, just above the thumb notch
  (`logo2Tex`, `fold2BackMat`), mirrored like Nr. 1's; not on the pattern.
- One piece, one colour (the owner, 2026-10-29): both faces use the same leather; for
  Nr. 2 `build()` makes the back light as strong as the front one (2.2) and its mirror
  image, or the back read darker. Other items keep 1.2.
- `folded()` lays both faces again on a grid (4 mm cells, 0.25 mm across the bend, 0.5 mm
  where the bulge eases out), clipped to the face's outline with the thumb hole joined
  by a keyhole cut; without it the faces were long triangles that could not bulge.
- Leather (the owner, 2026-10-29: as natural and real a brown as possible): Nr. 2 has
  its own texture, `natural` (`col` and `bump`), after the brown pieces in the Etsy
  screenshots: wandering soft darker and lighter patches, lighter pull-up scuffs, fine
  fibres and pores, a flatter relief (bumpScale 0.8) and roughness 0.6
  (`fold2FrontMat` with the initials, `fold2BackMat` with the stamp). The map averages
  ~0.8, so the colour is lifted × 1.2. The keyfob and Nr. 1 keep the pebbled `grain`.
- The thumb hole is bevelled like the outer edges (the owner, 2026-10-29): `foldStack`
  gives it the stack's dome, so each half's edge is rounded on its grain side.
  `folded()` takes the face outlines from `leatherPiece` (`mesh.userData.caps`):
  rebuilt from the triangles the hole came apart in two and left a sliver of face
  across it.
- The cards never go right down into the fold (the owner, 2026-10-29): the card stands
  `FOLD_CARD` 4 mm above it, so the fold stays closed. The bulge is done as Nr. 1's
  picture does it: `foldLift(x, y)` is full over the card and 1 mm past it, easing to
  nothing (smoothstep) over the next 3 mm all the way round, by distance from the card's
  rounded rectangle (`BANK_HW`, `BANK_LEN`, `BANK_CR`), so its corners are round. A 2 mm
  ease centred on the card's edge (to put the line where the card ends) was tried and
  undone the same day: it looked unnatural (the owner). A hard
  step at the card's foot (t², read as a strong shadow) and the long slow slope there
  were both rejected. The face grid is finer where it eases out.
- Not done yet: a page 2 picture and work process like Nr. 1.

### Example photos
`pavyzdziai/` (one folder per item: `korteline/`, `pakabukas/`) is where the
owner drops photos of real pieces. Look there before working on an item, and
measure off the photos where they allow it.

### Testing without the server
Render the view with `ejs` + `config/content.js` into a standalone HTML file, then use headless Chrome:
```
google-chrome --headless=new --no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader --virtual-time-budget=8000 --screenshot=out.png file://...
```
For close-ups, patch `camera.position`, `controls.target` and `controls.minDistance` in the rendered copy. For the PDF, replace `out.save(...)` with `out.output('datauristring')` written into the DOM, then `--dump-dom`, base64-decode, and render with `pdftoppm`.
