/**
 * PagesController
 *
 * Renders the localized SLOU storefront pages. Product data comes from
 * `sails.config.catalog.products` and UI copy from `sails.config.content`.
 * The active locale is set by the `locale` policy (res.locals.locale / .t).
 *
 * There is no database. Orders submitted through the homepage box are appended
 * to logs/orders.log by the Log service, and the orders page reads that same
 * file back — see api/services/Log.js for both ends of that format. Each order
 * also opens a conversation the customer can come back to on the site; those
 * live in data/conversations/ — see api/services/ConversationService.js.
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
  // A fixed sale price wins over a percentage; see `sale` in config/catalog.js.
  if (product.sale !== null && product.sale !== undefined && Number(product.sale) < Number(product.price)) {
    var saleCents = Math.round(Number(product.sale) * 100);
    return {
      now: money(saleCents),
      was: money(cents),
      off: '\u2212' + Math.round((cents - saleCents) * 100 / cents) + '%',
    };
  }
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
// directly, and without this an address of "asdf" would land in orders.log as
// if it were a way to reach the customer. The email itself is optional (the
// on-site conversation is enough); this only applies when one is given.
//
// Deliberately loose. The only test that proves an address works is mail
// arriving at it; a stricter regex mostly rejects valid addresses rather than
// catching typos.
var EMAIL = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

// Someone opened one of the unlisted admin pages.
//
// These DO go to the console, unlike ordinary visits. An ordinary visit is one
// of many and belongs in a file; a hit on a page that nothing links to is rare
// and is the one thing on this site worth seeing the moment it happens — if it
// is not you, the URL has leaked.
//
// The console line is the compact version. The full one, user agent and all,
// goes to logs/visits.log.
function adminVisit(req, page) {
  var c = VisitService.context(req);
  var from = req.headers.referer || req.headers.referrer || '-';

  var where = c.country;
  if (c.city && c.city !== '-') { where += '/' + c.city; }

  console.log('[ADMIN]', new Date().toISOString(), page,
    '| ip=' + c.ip +
    ' | ' + where +
    ' | ' + c.browser + ' ' + c.browser_version +
    ' | ' + c.device +
    ' | from=' + from);

  Log.visit(page + ' | ' + VisitService.line(req));
}

// Country for an address, or '-' for a private/unresolvable one. Kept here
// rather than in describeVisitor() so the per-request visitor line stays free
// of a geoip lookup it does not need.
function countryOf(ip) {
  try {
    var geo = require('geoip-lite').lookup(ip);
    return (geo && geo.country) || '-';
  } catch (unusedErr) {
    return '-';
  }
}

// The visitor cookie this request came with, or null. Only an id the browser
// SENT counts: one minted on this very request was never stored anywhere and
// would match no visit in the log.
function sentVid(req) {
  var v = VisitService.visitorId(req);
  return v.isNew ? null : v.id;
}

// Who placed an order, as far as the request can tell — kept on the
// conversation so the conversations page can show it next to the messages.
function posterInfo(req) {
  var c = VisitService.context(req);
  return {
    ip: c.ip,
    country: c.country,
    city: c.city,
    region: c.region,
    tz: c.tz,
    device: c.device,
    os: (c.os + ' ' + c.os_version).trim(),
    browser: (c.browser + ' ' + c.browser_version).trim(),
    // First entry of Accept-Language: the language the browser is set to,
    // as opposed to the site language they picked.
    lang: String(req.headers['accept-language'] || '-').split(',')[0],
  };
}

// The Christmas offer for the homepage, or null when it is switched off.
// Prices are formatted here with money() so the offer and the video row can
// never print the same amount two different ways.
function christmasOffer(t) {
  var x = sails.config.catalog.christmas;
  if (!x || !x.enabled) { return null; }
  return {
    bulkFrom: x.bulkFrom,
    items: x.items.map(function (i) {
      var price = Math.round(i.price * 100);
      var sale = Math.round(i.sale * 100);
      return {
        key: i.key,
        name: t.xmas[i.name],
        desc: t.xmas[i.desc],
        was: money(price),
        now: money(sale),
        bulk: money(Math.round(i.bulk * 100)),
        off: '\u2212' + Math.round((price - sale) * 100 / price) + '%',
        video: '/videos/' + i.video,
        poster: '/videos/' + i.poster,
        photos: (i.photos || []).map(function (ph) {
          return { full: '/videos/' + ph.full, thumb: '/videos/' + ph.thumb };
        }),
        prefill: t.xmas.prefill.replace('{name}', t.xmas[i.name]),
      };
    }),
  };
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
      xmas: christmasOffer(res.locals.t),
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
  // logs/orders.log — that file is the only record of the order — and the
  // message opens (or continues) the customer's conversation, which is how
  // they read the reply on the site. See api/services/ConversationService.js.
  //
  // Email is optional: the conversation on the site is enough to answer. When
  // it IS given it still has to look like an address, or a typo would leave a
  // reply channel that silently goes nowhere.
  //
  // A browser that already holds a conversation sends { conv: { id, key } };
  // the new order joins that thread instead of starting a second one, so one
  // visitor keeps one conversation.
  //
  // winston writes asynchronously, so the catch below only sees a synchronous
  // failure; a transport-level one (full disk, bad permissions) surfaces
  // through the logger's own error handler in api/services/Log.js.
  //
  // The four fields are joined with ' | ' because that is what
  // Log.read_orders() splits on. Newlines in the customer's message are
  // flattened for the same reason: one order must stay one line, or the reader
  // sees the tail of a message as a truncated order of its own. A missing
  // email is written as '-' so the line keeps its four fields.
  createOrder: function (req, res) {
    var name = (req.param('name') || '').trim();
    var email = (req.param('email') || '').trim();
    var message = (req.param('message') || '').trim();
    var conv = req.param('conv') || {};
    var who = describeVisitor(req);

    if (!name || !message) {
      // Worth seeing too: a rejected submission is either a broken form or
      // somebody poking the endpoint, and both are invisible otherwise.
      console.log('[ORDER-REJECTED]', new Date().toISOString(),
        'ip=' + who.ip + ' | missing fields | ua=' + who.ua);
      return res.badRequest({ error: 'missing_fields' });
    }

    if (email && !EMAIL.test(email)) {
      console.log('[ORDER-REJECTED]', new Date().toISOString(),
        'ip=' + who.ip + ' | bad email "' + email + '" | ua=' + who.ua);
      return res.badRequest({ error: 'invalid_email' });
    }

    var line = [
      name.replace(/\s+/g, ' '),
      email ? email.replace(/\s+/g, '') : '-',
      res.locals.locale,
      message.replace(/\s*\n\s*/g, '  ↵  '),
    ].join(' | ');

    try {
      // The thread first: if it cannot be written the customer has nowhere to
      // read a reply, and must be told the order did not go through.
      var vid = sentVid(req);
      var thread = ConversationService.add(conv.id, 'customer', message, conv.key, vid);
      var access = { id: conv.id, key: conv.key };
      if (!thread) {
        var created = ConversationService.create({
          name: name, email: email, locale: res.locals.locale, message: message,
          vid: vid, visitor: posterInfo(req),
        });
        access = { id: created.id, key: created.key };
        thread = ConversationService.read(created.id, created.key);
      }

      Log.order(line);
      // Live on stdout as well as on disk, so a sale shows up in `pm2 logs`
      // the moment it lands rather than only when someone opens the file.
      // The same flattened `line` is printed, so what is on screen and what is
      // in orders.log cannot drift apart.
      console.log('[ORDER]', new Date().toISOString(), line +
        ' | conv=' + access.id +
        ' | ip=' + who.ip + ' | country=' + countryOf(who.ip) + ' | ua=' + who.ua);
      return res.json({ ok: true, conv: access, thread: thread });
    } catch (err) {
      Log.err('Order failed to write', err && (err.message || err));
      console.error('[ORDER-FAILED]', new Date().toISOString(),
        line + ' | ' + (err && (err.message || err)));
      return res.status(500).json({ error: 'not_saved' });
    }
  },

  // The customer's own thread, for the box at the top of the homepage. POST
  // rather than GET so the key travels in the body and never lands in a URL,
  // a log line or a Referer header. 404 tells the browser its stored key is
  // dead (thread deleted on the server) so it can forget it.
  conversation: function (req, res) {
    var thread = ConversationService.read(req.param('id'), req.param('key'));
    if (!thread) { return res.status(404).json({ error: 'not_found' }); }
    return res.json({ ok: true, thread: thread });
  },

  // A follow-up from the customer inside their thread.
  conversationMessage: function (req, res) {
    var id = req.param('id');
    var text = (req.param('message') || '').trim();
    if (!text) { return res.badRequest({ error: 'missing_fields' }); }

    try {
      var thread = ConversationService.add(id, 'customer', text, req.param('key'), sentVid(req));
      if (!thread) { return res.status(404).json({ error: 'not_found' }); }
      console.log('[MESSAGE]', new Date().toISOString(), 'conv=' + id + ' | ' +
        text.replace(/\s*\n\s*/g, '  ↵  '));
      return res.json({ ok: true, thread: thread });
    } catch (err) {
      Log.err('Message failed to write', err && (err.message || err));
      return res.status(500).json({ error: 'not_saved' });
    }
  },

  // The customer deleting their conversation from the homepage box. Hidden
  // from them, kept for the shop — see ConversationService.remove().
  conversationDelete: function (req, res) {
    var id = req.param('id');
    try {
      if (!ConversationService.remove(id, req.param('key'))) {
        return res.status(404).json({ error: 'not_found' });
      }
      console.log('[CONV-DELETED]', new Date().toISOString(), 'conv=' + id);
      return res.json({ ok: true });
    } catch (err) {
      Log.err('Conversation delete failed', err && (err.message || err));
      return res.status(500).json({ error: 'not_deleted' });
    }
  },

  // Undo a customer's delete, from the conversations page. Same shape as
  // reply(): a plain form POST that goes back to the thread.
  restore: function (req, res) {
    var id = req.param('id');
    adminVisit(req, 'RESTORE ' + id);
    try {
      ConversationService.restore(id);
    } catch (err) {
      Log.err('Restore failed', err && (err.message || err));
    }
    return res.redirect('/eposts#c-' + id);
  },

  // How long a visitor kept a page open, sent by the layout's beacon when the
  // tab is hidden or closed. Only the time the tab was actually VISIBLE is
  // counted, so a tab left open in the background overnight adds nothing.
  // Answers 204 like /vplay; values outside a plausible range are dropped
  // rather than logged, since anyone can post to this.
  visitTime: function (req, res) {
    var vid = sentVid(req);
    var secs = Math.round((parseInt(req.param('ms'), 10) || 0) / 1000);
    if (vid && secs >= 1 && secs <= 6 * 3600) {
      var page = String(req.param('path') || '/').slice(0, 100).replace(/[\s|]/g, '');
      Log.time(vid + ' | ' + secs + ' | ' + page);
    }
    return res.status(204).send();
  },

  // Every customer conversation, with a reply form under each. Unlisted like
  // the orders page; its route is in config/local.js. Opening it is logged
  // and printed as [ADMIN] ... POSTS, same as the other admin pages.
  // Next to each one: where the poster was, the languages, and their visits
  // and time on the site, found in the logs by their visitor cookie(s).
  posts: function (req, res) {
    adminVisit(req, 'POSTS');
    var conversations = ConversationService.list();
    var vids = [];
    conversations.forEach(function (c) { vids = vids.concat(c.vids); });
    var activity = StatsService.visitorActivity(vids);
    conversations.forEach(function (c) {
      c.activity = StatsService.mergeActivity(c.vids.map(function (v) { return activity[v]; }));
    });
    return res.view('pages/posts', {
      layout: 'layouts/slou',
      active: 'posts',
      pageTitle: 'Pokalbiai — SLOU',
      noindex: true,
      conversations: conversations,
    });
  },

  // The shop's answer, posted from the conversations page. A plain form POST that
  // redirects back, so it works without any script on the admin side. Route in
  // config/local.js next to the page it belongs to — unlisted like it, and
  // likewise not password-protected: what stops a stranger replying as the
  // shop is that they would need both this path and a thread id, and ids are
  // random and only ever shown on the conversations page.
  reply: function (req, res) {
    var id = req.param('id');
    adminVisit(req, 'REPLY ' + id);
    try {
      ConversationService.add(id, 'shop', req.param('message'));
    } catch (err) {
      Log.err('Reply failed to write', err && (err.message || err));
    }
    return res.redirect('/eposts#c-' + id);
  },

  // A clip was played. Called by the beacon in the video player, not by a
  // person navigating, so it answers with 204 and no body.
  //
  // The slug is checked against the catalogue rather than trusted: this is a
  // public endpoint, and without that check anyone could post arbitrary text
  // and it would end up in logs/videos.log and on the statistics page.
  videoPlay: function (req, res) {
    var slug = String(req.param('slug') || '').trim();
    var known = sails.config.catalog.products.some(function (p) {
      return p.slug === slug && p.video;
    });
    if (!known) {
      return res.status(400).json({ error: 'unknown_slug' });
    }

    var c = VisitService.context(req);
    Log.video(slug + ' | ' + c.country + ' | ' + c.device + ' | ip=' + c.ip);
    return res.status(204).send();
  },

  // The unlisted order list. Renders straight from logs/orders.log, newest
  // first. Its route is declared in config/local.js. Unlisted, not protected:
  // nothing on the site links to it and `noindex` keeps it out of search
  // results, but there is no password on it.
  orders: function (req, res) {
    adminVisit(req, 'ORDERS');

    var orders = Log.read_orders(req.param('page'), 200);
    return res.view('pages/orders', {
      layout: 'layouts/slou',
      active: 'orders',
      pageTitle: 'Užsakymai — SLOU',
      noindex: true,
      orders: orders,
    });
  },

  // Visits and orders by day, week and month, read out of the logs. Route in
  // config/local.js. Unlisted like the orders page, and excluded from its own
  // numbers — see admin_paths() in StatsService.
  statistics: function (req, res) {
    adminVisit(req, 'STATS');
    return res.view('pages/statistics', {
      layout: 'layouts/slou',
      active: 'statistics',
      pageTitle: 'Statistika — SLOU',
      noindex: true,
      stats: StatsService.dashboard(),
      videos: StatsService.videoPlays(),
    });
  },

  // The last 50 requests, newest first. Route in config/local.js.
  visits: function (req, res) {
    adminVisit(req, 'LIST');
    return res.view('pages/visits', {
      layout: 'layouts/slou',
      active: 'visits',
      pageTitle: 'Lankytojai — SLOU',
      noindex: true,
      visits: StatsService.recentVisits(50),
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
