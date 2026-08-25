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

// The products shown in the homepage video row, in catalog order.
function featuredVideoProducts(locale) {
  return localizedProducts(locale).filter(function (p) {
    return !!p.video;
  });
}

module.exports = {

  // Switch language and return to the previous page.
  setLang: function (req, res) {
    var supported = Object.keys(sails.config.content);
    var requested = req.param('locale');
    var locale = supported.indexOf(requested) >= 0 ? requested : 'lt';
    if (!req.session) { req.session = {}; }
    req.session.lang = locale;
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

    if (!name || !email || !message) {
      return res.badRequest({ error: 'missing_fields' });
    }

    try {
      Log.order([
        name.replace(/\s+/g, ' '),
        email.replace(/\s+/g, ''),
        res.locals.locale,
        message.replace(/\s*\n\s*/g, '  ↵  '),
      ].join(' | '));
      return res.json({ ok: true });
    } catch (err) {
      Log.err('Order failed to write', err && (err.message || err));
      return res.status(500).json({ error: 'not_saved' });
    }
  },

  // The unlisted order list. Renders straight from logs/orders.log, newest
  // first. Its path is not written here or in config/routes.js — it is
  // declared in the gitignored config/local.js, so the public repo does not
  // publish it. `noindex` keeps it out of search results.
  orders: function (req, res) {
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
