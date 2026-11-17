var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var models = require('../services/EditorModelService');

module.exports = {
  model: async function (req, res) {
    var version = req.param('version'); var key = req.param('key');
    if (version !== models.version() || !models.variants().some((v) => { return v.key === key; })) {
      return res.status(404).end();
    }
    var file = path.join(models.directory(), key + '.bin.gz');
    try {
      var stat = await fs.promises.stat(file);
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.set('Content-Type', 'application/octet-stream');
      res.set('Vary', 'Accept-Encoding');
      var stream = fs.createReadStream(file);
      stream.on('error', () => { res.destroy(); });
      if (req.acceptsEncodings('gzip')) {
        res.set('Content-Encoding', 'gzip');
        res.set('Content-Length', String(stat.size));
        return stream.pipe(res);
      }
      var unpack = zlib.createGunzip();
      unpack.on('error', () => { res.destroy(); });
      return stream.pipe(unpack).pipe(res);
    } catch (err) {
      if (err.code !== 'ENOENT') { console.error('Editor model read:', err.message); }
      models.ensureWarm();
      res.set('Cache-Control', 'no-store');
      res.set('Retry-After', '1');
      return res.status(503).end();
    }
  },
};
