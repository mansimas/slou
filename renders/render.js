'use strict';
/* Render views/pages/editor.ejs into a standalone HTML page, with the camera
   (and optionally the strand geometry) patched, so the scene can be looked at
   without starting the server. Writes the path given in process.env.OUT.
   Scratch tooling only — nothing in the app reads this file. */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/mantassimkus/slou';
const ejs = require(path.join(ROOT, 'node_modules/ejs'));
const content = require(path.join(ROOT, 'config/content.js')).content;

const locale = process.env.LOC || 'lt';
const t = content[locale];

// VIEW_FILE lets a copy of the view (e.g. `git show HEAD:views/pages/editor.ejs`)
// be rendered for comparison, without touching the real one.
const viewPath = process.env.VIEW_FILE || path.join(ROOT, 'views/pages/editor.ejs');
let view = fs.readFileSync(viewPath, 'utf8');
let body = ejs.render(view, { t: t, locale: locale }, { filename: viewPath });

// the CSS custom properties the page expects from its layout
const layout = fs.readFileSync(path.join(ROOT, 'views/layouts/slou.ejs'), 'utf8');
const rootVars = layout.match(/:root\s*\{[\s\S]*?\n    \}/);
if (!rootVars) { throw new Error('could not find :root block in layout'); }

// CAM = "camX,camY,camZ,tgtX,tgtY,tgtZ,minDist"
if (process.env.CAM) {
  const v = process.env.CAM.split(',').map(Number);
  const sub = (from, to) => {
    if (!body.includes(from)) { throw new Error('patch target not found: ' + from); }
    body = body.replace(from, to);
  };
  sub('camera.position.set(4, 2, 19);', 'camera.position.set(' + v[0] + ', ' + v[1] + ', ' + v[2] + ');');
  sub('controls.target.set(0, 0.8, 0);', 'controls.target.set(' + v[3] + ', ' + v[4] + ', ' + v[5] + ');');
  sub('controls.minDistance = 7;', 'controls.minDistance = ' + v[6] + ';');
  sub('controls.autoRotate = true;', 'controls.autoRotate = false;');
}

// optional: replace parts of the view (e.g. a candidate strand shape) before rendering
if (process.env.PATCH_FILE) {
  const p = JSON.parse(fs.readFileSync(process.env.PATCH_FILE, 'utf8'));
  p.forEach(function (pair) {
    if (!body.includes(pair[0])) { throw new Error('patch target not found:\n' + pair[0]); }
    body = body.replace(pair[0], pair[1]);
  });
}

const html = '<!DOCTYPE html>\n<html lang="lt-LT">\n<head>\n<meta charset="UTF-8">\n<style>\n'
  + rootVars[0] + '\n</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';

fs.writeFileSync(process.env.OUT, html);
console.log('wrote ' + process.env.OUT + ' (' + html.length + ' bytes)');
