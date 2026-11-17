// Lossless geometry transport. Materials/textures stay in the editor, so initials,
// thread colours and metal finishes remain live without downloading them again.
const MAGIC = 0x554f4c53;
const align = n => Math.ceil(n / 8) * 8;
const arrays = { Float32Array, Uint32Array, Uint16Array, Uint8Array, Int32Array, Int16Array, Int8Array };

export function encodeModel(THREE, fob, current, materials, encoder, palette) {
  const chunks = [], geometries = [], seen = new Map();
  let bytes = 0;
  function array(a, itemSize, index) {
    const raw = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const mode = index ? 'INDICES' : 'ATTRIBUTES', count = a.length / itemSize, stride = a.BYTES_PER_ELEMENT * itemSize;
    const packed = encoder.encodeGltfBuffer(raw, count, stride, mode);
    const info = { type: a.constructor.name, offset: bytes, length: a.length, packedLength: packed.length, mode, count, stride };
    chunks.push({ offset: bytes, data: packed });
    bytes = align(bytes + packed.length);
    return info;
  }
  function attribute(a, index = false) {
    return { ...array(a.array, a.itemSize, index), itemSize: a.itemSize, normalized: a.normalized };
  }
  const names = new Map(Object.entries(materials).map(([name, mat]) => [mat, name]));
  const meshes = fob.children.map(mesh => {
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(mat => {
      if (!names.has(mat)) { throw new Error('Unknown editor material'); }
      return names.get(mat);
    });
    const g = mesh.geometry;
    if (!seen.has(g)) {
      seen.set(g, geometries.length);
      if (!g.attributes.position.array.every(Number.isFinite)) { throw new Error('Non-finite model position'); }
      g.computeBoundingBox(); g.computeBoundingSphere();
      geometries.push({
        palette: mats.some(name => /^(pocket|walSlot)/.test(name)) ? 'pocket' : mats.includes('fob2BackMat') ? 'second' : 'leather',
        attributes: Object.fromEntries(Object.entries(g.attributes).map(([name, a]) => [name, attribute(a)])),
        index: g.index ? attribute(g.index, true) : null, groups: g.groups,
        sphere: [g.boundingSphere.center.toArray(), g.boundingSphere.radius],
        box: [g.boundingBox.min.toArray(), g.boundingBox.max.toArray()],
      });
    }
    mesh.updateMatrix();
    if (mesh.isInstancedMesh) { mesh.computeBoundingSphere(); }
    return {
      geometry: seen.get(g), materials: mats, multi: Array.isArray(mesh.material),
      matrix: mesh.matrix.toArray(), renderOrder: mesh.renderOrder, userData: mesh.userData,
      instances: mesh.isInstancedMesh ? attribute(mesh.instanceMatrix) : null,
      count: mesh.isInstancedMesh ? mesh.count : null,
      sphere: mesh.boundingSphere ? [mesh.boundingSphere.center.toArray(), mesh.boundingSphere.radius] : null,
    };
  });
  const layout = {
    holes: current.holes.map(v => v.toArray()), chords: current.chords.map(v => v.toArray()),
    E: current.E, corner: current.corner, open: current.open, runs: current.runs, frontRuns: current.frontRuns,
    spine: (current.spine || []).map(h => ({ p: h.p.toArray(), dir: h.dir.toArray(), from: h.from.toArray() })),
  };
  const header = new TextEncoder().encode(JSON.stringify({ geometries, meshes, layout,
    palette: { leather: palette.leather, pocket: palette.pocket, second: palette.second } }));
  const start = align(8 + header.length), result = new Uint8Array(start + bytes);
  const view = new DataView(result.buffer);
  view.setUint32(0, MAGIC, true); view.setUint32(4, header.length, true);
  result.set(header, 8);
  for (const chunk of chunks) { result.set(chunk.data, start + chunk.offset); }
  return result;
}

export function decodeModel(THREE, buffer, materials, decoder, palette) {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== MAGIC) { throw new Error('Invalid editor model'); }
  const length = view.getUint32(4, true), start = align(8 + length);
  const data = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, length)));
  function attribute(a, instanced = false) {
    const Type = arrays[a.type];
    if (!Type) { throw new Error('Invalid model array'); }
    const unpacked = new Uint8Array(a.length * Type.BYTES_PER_ELEMENT);
    decoder.decodeGltfBuffer(unpacked, a.count, a.stride, new Uint8Array(buffer, start + a.offset, a.packedLength), a.mode);
    const Attribute = instanced ? THREE.InstancedBufferAttribute : THREE.BufferAttribute;
    return new Attribute(new Type(unpacked.buffer), a.itemSize, a.normalized);
  }
  const sphere = s => new THREE.Sphere(new THREE.Vector3().fromArray(s[0]), s[1]);
  const geometries = data.geometries.map(info => {
    const g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(info.attributes)) { g.setAttribute(name, attribute(a)); }
    // Edge dye is affine in the chosen leather plus a fixed natural core.
    // Recover those two weights from the original RGB; retain every position,
    // normal, glue line and stitch unchanged when recolouring prepared models.
    const slot = info.palette, colour = g.attributes.color;
    if (colour && palette && data.palette[slot] !== palette[slot]) {
      const base = new THREE.Color(data.palette[slot]), chosen = new THREE.Color(palette[slot]), core = new THREE.Color('#d6b08a');
      const det = base.r * core.g - base.g * core.r;
      for (let i = 0; i < colour.count; i++) {
        const r = colour.getX(i), green = colour.getY(i);
        const a = (r * core.g - green * core.r) / det, b = (base.r * green - base.g * r) / det;
        colour.setXYZ(i, a * chosen.r + b * core.r, a * chosen.g + b * core.g, a * chosen.b + b * core.b);
      }
    }
    if (info.index) { g.setIndex(attribute(info.index)); }
    for (const group of info.groups) { g.addGroup(group.start, group.count, group.materialIndex); }
    g.boundingSphere = sphere(info.sphere);
    g.boundingBox = new THREE.Box3(new THREE.Vector3().fromArray(info.box[0]), new THREE.Vector3().fromArray(info.box[1]));
    return g;
  });
  const children = data.meshes.map(info => {
    const mats = info.materials.map(name => {
      if (!materials[name]) { throw new Error('Missing editor material'); }
      return materials[name];
    });
    const mat = info.multi ? mats : mats[0];
    const mesh = info.instances ? new THREE.InstancedMesh(geometries[info.geometry], mat, info.instances.length / 16) : new THREE.Mesh(geometries[info.geometry], mat);
    if (info.instances) { mesh.instanceMatrix = attribute(info.instances, true); mesh.count = info.count; }
    if (info.sphere) { mesh.boundingSphere = sphere(info.sphere); }
    new THREE.Matrix4().fromArray(info.matrix).decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.renderOrder = info.renderOrder; mesh.userData = info.userData;
    return mesh;
  });
  const c = data.layout;
  c.holes = c.holes.map(v => new THREE.Vector2().fromArray(v));
  c.chords = c.chords.map(v => new THREE.Vector2().fromArray(v));
  c.spine = c.spine.map(h => Object.fromEntries(Object.entries(h).map(([key, v]) => [key, new THREE.Vector2().fromArray(v)])));
  c.chordIn = function (k) {
    return c.open && c.runs.some(r => r[0] === k) ? c.chords[k] : c.chords[(k + c.chords.length - 1) % c.chords.length];
  };
  return { children, current: c, bytes: buffer.byteLength };
}
