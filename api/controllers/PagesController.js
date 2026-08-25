/**
 * PagesController
 *
 * Renders the localized SLOU storefront pages. Product data comes from
 * `sails.config.catalog.products` and UI copy from `sails.config.content`.
 * The active locale is set by the `locale` policy (res.locals.locale / .t).
 *
 * There is no database. Orders submitted through the homepage box are appended
 * to logs/orders.log by the Log service, and the orders page reads that same
 * file back — see api/services/Log.js for both ends of that format.
 */

// Money is handled in whole cents so a percentage never leaves a rounding
// artefact like 699.9999 behind.
function money(cents) {
  return '€' + (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
}

// -> { now, was, off }: `was` and `off` are null when nothing is discounted.
function pricing(product) {
  if (product.price === null || product.price === undefined) {
    return { now: '€00', was: null, off: null };   // price not set yet
  }
  var cents = Math.round(Number(product.price) * 100);
  var percent = Number(product.discount) || 0;
  if (percent <= 0) {
    return { now: money(cents), was: null, off: null };
  }
  return {
    now: money(Math.round(cents * (100 - percent) / 100)),
    was: money(cents),
    off: '\u2212' + percent + '%',
  };
}

function localizedProducts(locale) {
  return sails.config.catalog.products.map(function (p) {
    return {
      slug: p.slug,
      size: p.size[locale],
      price: pricing(p),
      video: p.video || null,
      name: p.t[locale].name,
      short: p.t[locale].short,
      long: p.t[locale].long,
      category: p.t[locale].category,
    };
  });
}

// Who is on the other end of a request, as far as HTTP can tell.
//
// req.ip is the socket address, which behind nginx/Cloudflare is the proxy
// itself (127.0.0.1) rather than the visitor — so X-Forwarded-For comes first,
// taking its LEFTMOST entry, which is the original client. Caveat worth
// knowing: `trustProxy` is not enabled, so a request arriving directly (not
// through the proxy) can put anything it likes in that header. Treat the
// address as a strong hint, not proof.
function describeVisitor(req) {
  var forwarded = req.headers['x-forwarded-for'];
  var ip = forwarded
    ? String(forwarded).split(',')[0].trim()
    : (req.ip || (req.connection && req.connection.remoteAddress) || '?');

  return {
    ip: ip,
    ua: req.get('User-Agent') || '-',
    // Where they came from. Usually '-': typing an unlisted URL leaves no
    // referrer, so anything OTHER than '-' here means the link exists
    // somewhere it shouldn't and is worth a look.
    referer: req.get('Referer') || '-',
    lang: req.get('Accept-Language') || '-',
    // Only meaningful if the proxy chain is longer than one hop.
    chain: forwarded ? String(forwarded) : '-',
  };
}

// The same rule the order form applies in the browser and the same one the
// field's `pattern` attribute carries. Repeated here because the browser check
// is a courtesy to the customer, not a guarantee: POST /order is reachable
// directly, and without this an address of "asdf" would land in orders.log and
// there would be no way to reply to the order.
//
// Deliberately loose. The only test that proves an address works is mail
// arriving at it; a stricter regex mostly rejects valid addresses rather than
// catching typos.
var EMAIL = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

// Country for an address, or '-' for a private/unresolvable one. Kept here
// rather than in describeVisitor() so the per-request visitor line stays free
// of a geoip lookup it does not need.
function countryOf(ip) {
  try {
    var geo = require('geoip-country').lookup(ip);
    return (geo && geo.country) || '-';
  } catch (unusedErr) {
    return '-';
  }
}

// The products shown in the homepage video row, in catalog order.
function featuredVideoProducts(locale) {
  return localizedProducts(locale).filter(function (p) {
    return !!p.video;
  });
}

module.exports = {

  // Switch language and return to the previous page. Stored in a cookie, not a
  // session — see config/custom.js.
  setLang: function (req, res) {
    var supported = Object.keys(sails.config.content);
    var requested = req.param('locale');
    var locale = supported.indexOf(requested) >= 0 ? requested : 'lt';
    var cookie = sails.config.custom.langCookie;
    res.cookie(cookie.name, locale, cookie.options);
    var back = req.get('Referer') || '/';
    return res.redirect(back);
  },

  home: function (req, res) {
    return res.view('pages/homepage', {
      layout: 'layouts/slou',
      active: 'home',
      pageTitle: res.locals.t.titles.home,
      featured: featuredVideoProducts(res.locals.locale),
    });
  },

  product: function (req, res) {
    var product = localizedProducts(res.locals.locale).find(function (p) {
      return p.slug === req.param('slug');
    });
    if (!product) {
      return res.notFound();
    }
    return res.view('pages/product', {
      layout: 'layouts/slou',
      pageTitle: product.name + ' — SLOU',
      product: product,
    });
  },

  // Handle the homepage order box (AJAX). One line appended to
  // logs/orders.log — that file is the only record of the order.
  //
  // winston writes asynchronously, so the catch below only sees a synchronous
  // failure; a transport-level one (full disk, bad permissions) surfaces
  // through the logger's own error handler in api/services/Log.js.
  //
  // The four fields are joined with ' | ' because that is what
  // Log.read_orders() splits on. Newlines in the customer's message are
  // flattened for the same reason: one order must stay one line, or the reader
  // sees the tail of a message as a truncated order of its own.
  createOrder: function (req, res) {
    var name = (req.param('name') || '').trim();
    var email = (req.param('email') || '').trim();
    var message = (req.param('message') || '').trim();
    var who = describeVisitor(req);

    if (!name || !email || !message) {
      // Worth seeing too: a rejected submission is either a broken form or
      // somebody poking the endpoint, and both are invisible otherwise.
      console.log('[ORDER-REJECTED]', new Date().toISOString(),
        'ip=' + who.ip + ' | missing fields | ua=' + who.ua);
      return res.badRequest({ error: 'missing_fields' });
    }

    if (!EMAIL.test(email)) {
      console.log('[ORDER-REJECTED]', new Date().toISOString(),
        'ip=' + who.ip + ' | bad email "' + email + '" | ua=' + who.ua);
      return res.badRequest({ error: 'invalid_email' });
    }

    var line = [
      name.replace(/\s+/g, ' '),
      email.replace(/\s+/g, ''),
      res.locals.locale,
      message.replace(/\s*\n\s*/g, '  ↵  '),
    ].join(' | ');

    try {
      Log.order(line);
      // Live on stdout as well as on disk, so a sale shows up in `pm2 logs`
      // the moment it lands rather than only when someone opens the file.
      // The same flattened `line` is printed, so what is on screen and what is
      // in orders.log cannot drift apart.
      console.log('[ORDER]', new Date().toISOString(), line +
        ' | ip=' + who.ip + ' | country=' + countryOf(who.ip) + ' | ua=' + who.ua);
      return res.json({ ok: true });
    } catch (err) {
      Log.err('Order failed to write', err && (err.message || err));
      console.error('[ORDER-FAILED]', new Date().toISOString(),
        line + ' | ' + (err && (err.message || err)));
      return res.status(500).json({ error: 'not_saved' });
    }
  },

  // The unlisted order list. Renders straight from logs/orders.log, newest
  // first. Its path is not written here or in config/routes.js — it is
  // declared in the gitignored config/local.js, so the public repo does not
  // publish it. `noindex` keeps it out of search results.
  orders: function (req, res) {
    var who = describeVisitor(req);
    var line = 'ip=' + who.ip +
      ' | ua=' + who.ua +
      ' | from=' + who.referer +
      ' | lang=' + who.lang +
      ' | xff=' + who.chain;

    // Straight to stdout so it shows up live in `pm2 logs` / the terminal.
    // Tagged ORDERS-VISIT rather than after the URL itself: this file is in a
    // public repo, and a tag naming the path would give away the very thing
    // keeping the path out of config/routes.js is meant to protect.
    console.log('[ORDERS-VISIT]', new Date().toISOString(), line);
    // ...and to disk, because console scrollback does not survive a restart.
    Log.visit(line);

    var orders = Log.read_orders(req.param('page'), 200);
    return res.view('pages/orders', {
      layout: 'layouts/slou',
      active: 'orders',
      pageTitle: 'Užsakymai — SLOU',
      noindex: true,
      orders: orders,
    });
  },

  returns: function (req, res) {
    return res.view('pages/returns', { layout: 'layouts/slou', pageTitle: res.locals.t.titles.returns });
  },

  privacy: function (req, res) {
    return res.view('pages/privacy', { layout: 'layouts/slou', pageTitle: res.locals.t.titles.privacy });
  },

  cookies: function (req, res) {
    return res.view('pages/cookies', { layout: 'layouts/slou', pageTitle: res.locals.t.titles.cookies });
  },

};
