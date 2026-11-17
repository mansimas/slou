// Offline regression check: real geometry, lossless transport, recolouring and
// bounded cache reuse. Never starts Sails or writes to .tmp/www.
const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createBuilder } = require('./editor-models.cjs');
const models = require('../api/services/EditorModelService');

function geometryHash(children, skipColour) {
  const hash = crypto.createHash('sha256');
  const add = a => hash.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  for (const mesh of children) {
    for (const [name, attr] of Object.entries(mesh.geometry.attributes)) {
      if (skipColour && name === 'color') { continue; }
      hash.update(name); add(attr.array);
    }
    if (mesh.geometry.index) { add(mesh.geometry.index.array); }
    if (mesh.isInstancedMesh) { add(mesh.instanceMatrix.array); hash.update(String(mesh.count)); }
    mesh.updateMatrix();
    hash.update(JSON.stringify([mesh.matrix.toArray(), mesh.geometry.groups]));
  }
  return hash.digest('hex');
}

async function check() {
  // The strip cutter must cover a flat piece exactly, with consistent winding
  // and shared vertices on internal edges, including duplicate/boundary cuts.
  const view = fs.readFileSync(path.join(__dirname, '../views/pages/editor.ejs'), 'utf8');
  const stripSource = view.slice(view.indexOf('  function w2SliceAt('), view.indexOf('  function k2Bend('));
  const cut = new Function('return (' + stripSource + ');')();
  let square = { P: [0,0,0, 3,0,0, 3,3,0, 0,3,0], Nm: [0,0,1, 0,0,1, 0,0,1, 0,0,1],
    U: [0,0, 3,0, 3,3, 0,3], Cl: [1,0,0, 1,0,0, 1,0,0, 1,0,0], tris: [[0,1,2,7],[0,2,3,7]] };
  const lines = [0, 0.5, 0.5, 1, 1.5, 2, 2.5, 3];
  square = cut(cut(square, 0, lines), 1, lines);
  let area = 0;
  const edges = new Map();
  for (const [a,b,c,group] of square.tris) {
    const twice = (square.P[b*3]-square.P[a*3])*(square.P[c*3+1]-square.P[a*3+1]) -
      (square.P[b*3+1]-square.P[a*3+1])*(square.P[c*3]-square.P[a*3]);
    assert(twice > 0, 'no inverted or degenerate triangles');
    area += twice / 2; assert.equal(group, 7);
    for (const [i,j] of [[a,b],[b,c],[c,a]]) {
      const key = [Math.min(i,j),Math.max(i,j)].join(':'); edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  assert(Math.abs(area - 9) < 1e-10, 'flat surface area is unchanged');
  for (const [edge,n] of edges) {
    const [a,b] = edge.split(':').map(Number);
    const boundary = [0,1].some(axis => [0,3].some(v => Math.abs(square.P[a*3+axis]-v)<1e-9 && Math.abs(square.P[b*3+axis]-v)<1e-9));
    assert.equal(n, boundary ? 1 : 2, 'no gaps on shared edges');
  }
  console.log('Wallet 2 strip coverage, winding and shared edges passed.');
  const { THREE, builder } = await createBuilder();
  const baseline = process.env.SLOU_MODEL_BASELINE ? (await createBuilder(fs.readFileSync(process.env.SLOU_MODEL_BASELINE, 'utf8'))).builder : null;
  const { MeshoptEncoder, MeshoptDecoder } = require('meshoptimizer');
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const { encodeModel, decodeModel } = await import('../assets/js/editor-model-codec.mjs');
  for (const variant of models.variants()) {
    const config = { product: variant.product, shape: variant.shape, slot: variant.slot,
      leather: '#9a5527', pocket: '#5b5a35', second: '#222020' };
    Object.assign(builder.state, config); builder.measures.visible = variant.flat;
    builder.build();
    const expected = geometryHash(builder.fob.children);
    if (baseline) {
      Object.assign(baseline.state, config); baseline.measures.visible = variant.flat; baseline.build();
      if (variant.product === 'wallet2') {
        const stitches = (b) => b.fob.children.filter(m => m.isInstancedMesh || m.material === b.materials.threadMat);
        assert.equal(geometryHash(stitches(builder)), geometryHash(stitches(baseline)), variant.key + ' locked stitching');
        for (const field of ['holes', 'chords', 'E', 'corner', 'open', 'runs', 'frontRuns', 'spine']) {
          assert.deepEqual(builder.getCurrent()[field], baseline.getCurrent()[field], variant.key + ' PDF ' + field);
        }
      } else {
        assert.equal(expected, geometryHash(baseline.fob.children), variant.key + ' original geometry');
      }
    }
    const packed = encodeModel(THREE, builder.fob, builder.getCurrent(), builder.materials, MeshoptEncoder, builder.state);
    const decoded = decodeModel(THREE, packed.buffer, builder.getLiveMaterials(), MeshoptDecoder, builder.state);
    assert.equal(geometryHash(decoded.children), expected, variant.key + ' lossless roundtrip');
    decoded.children.filter(m => m.isInstancedMesh).forEach(m => {
      assert(m.instanceMatrix.isInstancedBufferAttribute, 'GPU instance divisor must be retained');
    });
    const layout = builder.getCurrent();
    for (let k = 0; k < layout.holes.length; k++) {
      assert.deepEqual(decoded.current.holes[k], layout.holes[k]);
      assert.deepEqual(decoded.current.chordIn(k), layout.chordIn(k));
    }
    assert.deepEqual(decoded.current.spine, layout.spine || []);
    const originalChild = builder.fob.children[0];
    const start = performance.now(); builder.build();
    assert.equal(builder.fob.children[0], originalChild, variant.key + ' cache reuse');
    assert(builder.cacheStats().bytes <= 96 * 1024 * 1024);
    assert(builder.cacheStats().size <= 8);
    console.log(variant.key, 'exact; cached', (performance.now() - start).toFixed(2) + ' ms');
    // Check contrasting leather/pocket/strap colours against a full rebuild.
    const colours = { leather: '#222020', pocket: '#c08a55', second: '#5b5a35' };
    const recoloured = decodeModel(THREE, packed.buffer, builder.getLiveMaterials(), MeshoptDecoder, { ...config, ...colours });
    Object.assign(builder.state, colours); builder.build();
    assert.equal(geometryHash(recoloured.children, true), geometryHash(builder.fob.children, true));
    let error = 0;
    for (let i = 0; i < recoloured.children.length; i++) {
      const a = recoloured.children[i].geometry.attributes.color, b = builder.fob.children[i].geometry.attributes.color;
      if (!a) { continue; }
      for (let j = 0; j < a.array.length; j++) { error = Math.max(error, Math.abs(a.array[j] - b.array[j])); }
    }
    assert(error < 0.000002, variant.key + ' recolour error ' + error);
    for (const result of [decoded, recoloured]) {
      const geometries = new Set(result.children.map(m => m.geometry));
      result.children.forEach(m => { if (m.isInstancedMesh) { m.dispose(); } });
      geometries.forEach(g => g.dispose());
    }
  }
  // Reject stale versions and path traversal before accessing the filesystem.
  const controller = require('../api/controllers/EditorModelsController');
  for (const params of [{ version: 'old', key: 'wallet2-curved-open' }, { version: models.version(), key: '../secret' }]) {
    let status;
    await controller.model({ param: key => params[key] }, { status(n) { status = n; return this; }, end() {} });
    assert.equal(status, 404);
  }
  const file = path.join(models.directory(), 'wallet2-curved-open.bin.gz');
  if (fs.existsSync(file)) {
    const compressed = fs.readFileSync(file), stored = zlib.gunzipSync(compressed);
    assert.equal(new DataView(stored.buffer, stored.byteOffset).getUint32(0, true), 0x554f4c53);
    for (const gzip of [true, false]) {
      const res = new (require('stream').PassThrough)(), headers = {}, chunks = [];
      res.set = (name, value) => { headers[name] = value; return res; };
      res.on('data', chunk => chunks.push(chunk));
      const done = new Promise((resolve, reject) => { res.on('end', resolve); res.on('error', reject); });
      await controller.model({ param: key => ({ version: models.version(), key: 'wallet2-curved-open' })[key], acceptsEncodings: () => gzip }, res);
      await done;
      assert.deepEqual(Buffer.concat(chunks), gzip ? compressed : stored);
      assert.equal(headers['Cache-Control'], 'public, max-age=31536000, immutable');
      assert.equal(headers['Content-Encoding'], gzip ? 'gzip' : undefined);
    }
  }
  console.log('All prepared variants, palettes, PDF layouts and cache limits passed.');
}
check().catch(err => { console.error(err); process.exitCode = 1; });
