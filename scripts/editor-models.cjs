// Run with `npm run editor:warm` or in the startup worker. No Sails server,
// browser or WebGL is needed: execute the editor's exact geometry functions
// with a no-op canvas/renderer, then transport their real three.js buffers.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { workerData } = require('worker_threads');
const models = require('../api/services/EditorModelService');
const root = path.resolve(__dirname, '..');

async function createBuilder(template) {
  const THREE = { ...await import('three') };
  const noop = () => {};
  const ctx = new Proxy({
    measureText: text => ({ width: text.length * 12 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }),
  }, { get: (obj, key) => key in obj ? obj[key] : noop });
  const el = () => ({
    textContent: '{}', style: {}, dataset: {}, classList: { contains: () => false, toggle: noop },
    getContext: () => ctx, addEventListener: noop, appendChild: noop, insertBefore: noop,
    querySelectorAll: () => [], setAttribute: noop, clientWidth: 900, clientHeight: 700,
    value: '', getBoundingClientRect: () => ({ width: 900, height: 700 }),
  });
  // These stubs only suppress visual setup; all geometry/math is real THREE.
  const document = { createElement: el, getElementById: el, querySelectorAll: () => [], addEventListener: noop };
  const window = { devicePixelRatio: 1, addEventListener: noop };
  const localStorage = { getItem: () => null, setItem: noop };
  THREE.WebGLRenderer = class {
    constructor() { this.domElement = el(); this.capabilities = { getMaxAnisotropy: () => 1 }; }
    setSize() {} setPixelRatio() {} setAnimationLoop() {} render() {}
  };
  class OrbitControls { constructor() { this.target = new THREE.Vector3(); this.mouseButtons = {}; } addEventListener() {} update() {} }
  class CSS2DRenderer { constructor() { this.domElement = el(); } setSize() {} render() {} }
  class CSS2DObject extends THREE.Object3D { constructor(element) { super(); this.element = element; } }
  const source = require('ejs').render(template || fs.readFileSync(path.join(root, 'views/pages/editor.ejs'), 'utf8'), { t: require('../config/content').content.lt });
  const match = source.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!match || !match[1].includes('  var KEY_W = W, KEY_H = H;')) { throw new Error('Editor geometry boundary changed'); }
  let script = match[1].split('  var KEY_W = W, KEY_H = H;')[0]
    .replace(/^  import .*;\r?\n/gm, '')
    .replace(/scene.environment = .*;/, 'scene.environment = null;')
    .replace(/<%[\s\S]*?%>/g, '{}');
  const names = [...new Set(script.match(/\b\w+Mat\b/g))].filter(name => !['byMat', 'faceMat'].includes(name));
  script += '\nreturn { state, measures, fob, build, getLiveMaterials: typeof editorMaterials === "undefined" ? null : editorMaterials, getCurrent: () => current, cacheStats: () => ({size: typeof modelCache === "undefined" ? 0 : modelCache.size, bytes: typeof modelCacheBytes === "undefined" ? 0 : modelCacheBytes}), materials: {' +
    names.map(name => name + ': typeof ' + name + ' === "undefined" ? null : ' + name).join(',') + '} };';
  const builder = new Function('THREE', 'OrbitControls', 'CSS2DRenderer', 'CSS2DObject', 'document', 'window', 'localStorage', script)(
    THREE, OrbitControls, CSS2DRenderer, CSS2DObject, document, window, localStorage);
  builder.materials = Object.fromEntries(Object.entries(builder.materials).filter(([, value]) => value && value.isMaterial));
  return { THREE, builder };
}

async function warm() {
  const directory = workerData ? workerData.directory : models.directory();
  fs.mkdirSync(directory, { recursive: true });
  const { THREE, builder } = await createBuilder();
  const { encodeModel } = await import('../assets/js/editor-model-codec.mjs');
  const { MeshoptEncoder } = require('meshoptimizer');
  await MeshoptEncoder.ready;
  for (const variant of models.variants()) {
    const target = path.join(directory, variant.key + '.bin.gz');
    if (fs.existsSync(target)) { continue; }
    Object.assign(builder.state, { product: variant.product, shape: variant.shape, slot: variant.slot, card3Slot: variant.card3Slot });
    builder.measures.visible = variant.flat;
    builder.build();
    const packed = encodeModel(THREE, builder.fob, builder.getCurrent(), builder.materials, MeshoptEncoder, builder.state);
    const compressed = zlib.gzipSync(packed, { level: 6 });
    const temporary = target + '.' + process.pid + '.part';
    fs.writeFileSync(temporary, compressed);
    fs.renameSync(temporary, target);
    console.log('Editor model:', variant.key, (packed.length / 1048576).toFixed(1) + ' MB ->', (compressed.length / 1048576).toFixed(1) + ' MB');
  }
  fs.writeFileSync(path.join(directory, 'ready'), 'ready\n');
  // Only remove our own completed generated versions; keep the current and
  // previous deployment. Never traverse outside the dedicated model cache.
  const cacheRoot = path.resolve(directory, '..');
  const old = fs.readdirSync(cacheRoot).filter(name => /^[a-f0-9]{16}$/.test(name))
    .map(name => path.resolve(cacheRoot, name))
    .filter(dir => dir !== directory && fs.existsSync(path.join(dir, 'ready')))
    .sort((a, b) => fs.statSync(path.join(b, 'ready')).mtimeMs - fs.statSync(path.join(a, 'ready')).mtimeMs);
  for (const dir of old.slice(1)) {
    if (path.dirname(dir) !== cacheRoot) { throw new Error('Invalid model cache cleanup path'); }
    fs.rmSync(dir, { recursive: true });
  }
}

module.exports = { createBuilder };
if (require.main === module) { warm().catch(err => { console.error(err); process.exitCode = 1; }); }
