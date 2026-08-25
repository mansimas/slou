/**
 * PagesController
 *
 * Renders the localized SLOU storefront pages. Product data comes from
 * `sails.config.catalog.products` and UI copy from `sails.config.content`.
 * The active locale is set by the `locale` policy (res.locals.locale / .t).
 * No database or plugins involved — purely view rendering.
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

  // Handle the homepage order box (AJAX). Stored as a Message with kind 'order'.
  createOrder: async function (req, res) {
    var name = (req.param('name') || '').trim();
    var email = (req.param('email') || '').trim();
    var message = (req.param('message') || '').trim();

    if (!name || !email || !message) {
      return res.badRequest({ error: 'missing_fields' });
    }

    try {
      await Message.create({
        name: name,
        email: email,
        message: message,
        locale: res.locals.locale,
        kind: 'order',
      });
      return res.json({ ok: true });
    } catch (err) {
      sails.log.warn('Order failed:', err.message || err);
      return res.status(422).json({ error: 'invalid' });
    }
  },

  // Admin-ish list of every contact/order message stored in MongoDB.
  // Reachable at GET /orders123.
  orders: async function (req, res) {
    var messages = await Message.find().sort('createdAt DESC');
    return res.view('pages/orders', {
      layout: 'layouts/slou',
      active: 'orders',
      pageTitle: 'Užsakymai — SLOU',
      messages: messages,
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
