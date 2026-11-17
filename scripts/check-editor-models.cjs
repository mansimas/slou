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
      assert.equal(expected, geometryHash(baseline.fob.children), variant.key + ' original geometry');
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
