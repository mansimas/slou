/**
 * locale
 *
 * Resolves the request locale and exposes the localized content bundle plus the
 * list of available locales to every controller and view via `res.locals`.
 *
 * Priority:
 *   1. An explicit choice saved in the session (set via /language/:locale) — this
 *      always wins and stays the visitor's main language.
 *   2. Otherwise, auto-detect from the visitor's browser locale
 *      (`Accept-Language` header) on the first visit, and remember it in the
 *      session so it persists.
 *   3. Fallback to `lt`.
 *
 * Applied globally in config/policies.js.
 */

function detectFromHeader(req, supported) {
  var header = req.headers['accept-language'];
  if (!header) { return null; }
  // e.g. "pt-BR,pt;q=0.9,en-US;q=0.8" -> ordered ["pt", "pt", "en"]
  var ranked = header.split(',').map(function (part) {
    var tag = part.trim().split(';')[0].toLowerCase();
    return tag.split('-')[0];
  });
  for (var i = 0; i < ranked.length; i++) {
    if (supported.indexOf(ranked[i]) >= 0) { return ranked[i]; }
  }
  return null;
}

module.exports = function (req, res, next) {
  var supported = Object.keys(sails.config.content);
  var locale;

  if (req.session && supported.indexOf(req.session.lang) >= 0) {
    // Explicit / previously resolved choice — keep it.
    locale = req.session.lang;
  } else {
    // First visit: detect from the browser locale, then remember it.
    locale = detectFromHeader(req, supported) || 'lt';
    if (req.session) { req.session.lang = locale; }
  }

  res.locals.locale = locale;
  res.locals.t = sails.config.content[locale];
  res.locals.locales = supported.map(function (code) {
    return { code: code, label: sails.config.content[code].langLabel };
  });

  return next();
};
