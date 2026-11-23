// Generic catalogue geometry only. Customer choices, initials and calibration
// are never written here. One background worker warms files after a deployment.
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var Worker = require('worker_threads').Worker;
var root = path.resolve(__dirname, '../..');
var version;
var worker;

function getVersion() {
  if (!version) {
    var hash = crypto.createHash('sha256');
    ['views/pages/editor.ejs', 'assets/js/editor-model-codec.mjs', 'scripts/editor-models.cjs', 'api/services/EditorModelService.js', 'package.json'].forEach((name) => {
      hash.update(fs.readFileSync(path.join(root, name)));
    });
    version = hash.digest('hex').slice(0, 16);
  }
  return version;
}

function variants() {
  var list = [];
  function add(product, shape, slot, flat) {
    list.push({ product: product, shape: shape || 'arch', slot: slot || 'curved', card3Slot: product === 'card3' ? slot : 'curved', flat: !!flat,
      key: product === 'card3' && slot === 'u' ? 'card3-u-fold-hole-open' :
        product + '-' + (product === 'keyfob' ? shape : product.indexOf('wallet') === 0 || product === 'card3' ? slot : 'default') + '-' + (flat ? 'flat' : 'open') });
  }
  // The heaviest default first, then every shape and open/flat wallet variant.
  add('wallet2', null, 'curved');
  ['keyfob', 'keyfob2', 'card', 'card2', 'card3', 'wallet', 'wallet2'].forEach((product) => {
    if (product === 'keyfob') { ['arch', 'rect', 'point'].forEach((shape) => { add(product, shape); }); }
    else if (product === 'card3') { ['curved', 'straight', 'u', 'v', 'diagonal'].forEach((slot) => { add(product, null, slot); }); }
    else if (product.indexOf('wallet') === 0) {
      ['curved', 'straight', 'slanted', 'sloped'].forEach((slot) => {
        if (product !== 'wallet2' || slot !== 'curved') { add(product, null, slot); }
        add(product, null, slot, true);
      });
    } else { add(product); }
  });
  return list;
}

function directory() { return path.join(root, 'data/editor-models', getVersion()); }
function ensureWarm() {
  if (worker || fs.existsSync(path.join(directory(), 'ready'))) { return; }
  worker = new Worker(path.join(root, 'scripts/editor-models.cjs'), { workerData: { directory: directory() } });
  worker.on('error', (err) => { console.error('Editor model warmup:', err.message); });
  worker.on('exit', () => { worker = null; });
  worker.unref();
}

module.exports = { version: getVersion, variants: variants, directory: directory, ensureWarm: ensureWarm };
