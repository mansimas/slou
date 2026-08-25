/**
 * VisitService
 *
 * Who is on the other end of a request, and whether to serve them at all.
 * Ported from the vogames project's VisitService/botGuard pair, minus the
 * acquisition tracking (this site has no impressions or platform counters).
 *
 * Two questions, deliberately kept apart:
 *
 *   isBot(req)      - is this a bot? Crawlers included. Bots ARE served; this
 *                     only marks them so the request log can tell people from
 *                     machines.
 *   blockedBot(req) - refuse this one at the door? Everything isBot() flags,
 *                     plus no-UA fetches and generic HTTP clients. Search
 *                     engines are refused too while ALLOW_CRAWLERS is off.
 */

module.exports = {

  context: function (req) {
    return context(req);
  },

  isBot: function (req) {
    var ua = req.headers['user-agent'] || '';
    return isBot(ua, parse(ua));
  },

  // Is this a request to refuse at the door? Everything the bot detector
  // recognises, plus no-UA fetches and generic HTTP clients. Refused silently
  // and before any other middleware, so a bot costs one regex and never
  // reaches a controller, a cookie or a video file.
  blockedBot: function (req) {
    return blockedBot(req);
  },

  // Is this a scanner probe rather than a request for a page that exists?
  hostileRequest: function (req) {
    return hostileRequest(req);
  },

  // Is this address going faster than a person can? See RATE_* below.
  rateLimited: function (req) {
    return rate_limited(req);
  },

  // Static files: served by the hundred per page view, so they are neither
  // logged nor rate limited. Defined here so the logger and the rate limiter
  // cannot disagree about what counts as a page request.
  isAsset: function (url) {
    return ASSETS.test(url || '');
  },

  // Reads the visitor id off the request, minting one if this is a first
  // visit. Returns { id, isNew } — isNew tells the caller it still has to be
  // sent to the browser.
  visitorId: function (req) {
    return visitor_id(req);
  },

  // One log line describing the request. Used for every page hit.
  //
  // The location fields are resolved HERE, at request time, rather than being
  // looked up from the ip when a page is rendered: the geoip database is
  // updated over time, and a visit should keep the place it was actually
  // attributed to.
  line: function (req, vid) {
    var c = context(req);
    return [
      'vid=' + (vid || '-'),
      'ip=' + c.ip,
      'country=' + c.country,
      'city=' + c.city,
      'region=' + c.region,
      'tz=' + c.tz,
      'url=' + (req.originalUrl || req.url || '-'),
      'method=' + (req.method || '-'),
      'browser=' + c.browser + ' ' + c.browser_version,
      'os=' + c.os + ' ' + c.os_version,
      'device=' + c.device,
      'bot=' + (c.is_bot ? 'yes' : 'no'),
      'from=' + (req.headers.referer || req.headers.referrer || '-'),
      'lang=' + (req.headers['accept-language'] || '-'),
      'ua=' + (req.headers['user-agent'] || '-'),
    ].join(' | ');
  },

};

// 16 random hex characters. crypto.randomBytes, not Math.random: two visitors
// arriving in the same millisecond must not be handed the same id, or they
// merge into one in the statistics.
function visitor_id(req) {
  var cookie = sails.config.custom.visitorCookie;
  var existing = req.cookies ? req.cookies[cookie.name] : null;
  if (existing && /^[0-9a-f]{16}$/.test(existing)) {
    return { id: existing, isNew: false };
  }
  return { id: require('crypto').randomBytes(8).toString('hex'), isNew: true };
}

function parse(ua) {
  var UAParser = require('ua-parser-js');
  // ua-parser-js 2.x exports the constructor both directly and as a named
  // property depending on how it is consumed; take whichever is a function so
  // a minor-version change in that shape cannot break the site.
  var Parser = typeof UAParser === 'function' ? UAParser : UAParser.UAParser;
  return new Parser(ua).getResult();
}

// x-forwarded-for is a chain when more than one proxy sits in front of us —
// "client, proxy1, proxy2" — and a geoip lookup on the whole string finds
// nothing. The client is the FIRST entry.
//
// Caveat: `trustProxy` is not enabled, so a request that reaches the app
// directly rather than through the proxy can put anything it likes in that
// header. Good enough to log; not proof of identity.
function clientIp(req) {
  var forwarded = req.headers['x-forwarded-for'] || '';
  return (String(forwarded).split(',')[0] || '').trim() ||
    req.ip ||
    (req.connection && req.connection.remoteAddress) ||
    '?';
}

function context(req) {
  // geoip-lite rather than geoip-country: it resolves city, region and
  // timezone as well, which the visit list shows. It costs ~157MB on disk for
  // its database — the reason to know that is `npm install` on a new server,
  // not runtime, where lookups are in-memory and fast.
  var geoip = require('geoip-lite');
  var ua = req.headers['user-agent'] || '';
  var parsed = parse(ua);
  var ip = clientIp(req);

  var geo = null;
  try {
    geo = geoip.lookup(ip);
  } catch (unusedErr) {
    geo = null;   // a malformed or private address just has no location
  }

  return {
    ip: ip,
    country: (geo && geo.country) || '-',
    // Frequently blank even when the country is known — the database only
    // places some ranges to a city. '-' rather than an empty field so the log
    // line keeps its shape.
    city: (geo && geo.city) || '-',
    region: (geo && geo.region) || '-',
    tz: (geo && geo.timezone) || '-',
    os: parsed.os.name || 'Unknown',
    os_version: parsed.os.version || '',
    browser: parsed.browser.name || 'Unknown',
    browser_version: parsed.browser.version || '',
    device: parsed.device.type || 'desktop',
    device_model: parsed.device.model || '',
    is_bot: isBot(ua, parsed),
  };
}

// Real crawlers identify themselves in the UA. Scanners leave no UA at all, or
// one the parser cannot make sense of — the all-"Unknown" bursts in the log are
// exactly that — so empty and unparseable UAs count as bots too.
function isBot(ua, parsed) {
  if (!ua) { return true; }
  if (/bot|crawler|spider|slurp|bingbot|bingpreview|yandex|duckduckbot|baiduspider|facebookexternalhit|headless|curl|wget|python|go-http-client|scrapy|nuclei|nessus|sqlmap|nikto|nmap|masscan|zgrab|censys|semrush|mj12|ahrefs|petalbot|applebot|ia_archiver|archive\.org/i.test(ua)) { return true; }
  return !parsed.browser.name;
}

// ---------------------------------------------------------------------------
// Refusing traffic
// ---------------------------------------------------------------------------

// Bot traffic is REFUSED. Not throttled, not merely uncounted — refused.
//
// ALLOW_CRAWLERS re-opens the door to the search engines in SEARCH_ENGINES
// below, and nothing else. It is off: the shop is not indexed while it is off,
// which is the trade being made deliberately. Flip this one constant to true
// to be findable in Google and Bing again.
var ALLOW_CRAWLERS = false;

// If ALLOW_CRAWLERS is ever turned back on, ONLY these get through: search
// engines a shop actually gains customers from.
//
// This list used to be far longer and included a bare `spider|crawler`
// alternative. That is what let meta-externalagent hammer the site — its user
// agent ends with `.../webmasters/crawler)`, so the word "crawler" appearing
// anywhere in the string, a URL included, exempted it. Never put a generic
// word in here: match the agent's NAME, and keep the list short. Ad-tech
// scrapers, SEO tools and AI training crawlers are not on it on purpose —
// they cost bandwidth and bring nobody.
var SEARCH_ENGINES = /googlebot|googleinspectiontool|bingbot|bingpreview|duckduckbot|yandex(bot|images)|baiduspider|applebot/i;

// Generic HTTP clients and scanner toolkits. A browser never sends these, and
// they never render the page — they just hammer it.
var BAD_TOOLS = /curl|wget|python|go-http-client|java|okhttp|libwww|perl|scrapy|nuclei|sqlmap|nikto|nmap|masscan|zgrab|censys|httpclient|urllib|postman|insomnia|httpie|axios|node-fetch|powershell|headless/i;

function blockedBot(req) {
  var ua = req.headers['user-agent'] || '';

  // Only page fetches are judged this way. The order form POSTs from a real
  // browser, but keeping POST out of this rule means a UA check can never be
  // the reason an order fails to reach the log.
  if (req.method !== 'GET' && req.method !== 'HEAD') { return false; }

  // No user agent at all: a monitor or a scanner. A browser always sends one.
  if (!ua) { return true; }

  if (ALLOW_CRAWLERS && SEARCH_ENGINES.test(ua)) { return false; }

  // A generic HTTP client or scanner toolkit — a browser never sends these.
  if (BAD_TOOLS.test(ua)) { return true; }

  // Anything the bot detector recognises. This line is the one that matters:
  // without it, blockedBot only ever caught empty UAs and the BAD_TOOLS list,
  // so a self-identifying crawler like facebookexternalhit or
  // meta-externalagent sailed straight through while being logged as bot=yes.
  return isBot(ua, parse(ua));
}

// This site is not WordPress and not PHP, so a request looking for either is a
// scanner, not a customer: WP REST user enumeration (?rest_route=/wp/v2/users/),
// the phpinfo() dump (?phpinfo=1), the pp[]=env environment-exposure attempt,
// and any .php or /wp-* path.
function hostileRequest(req) {
  var url;
  var params;
  try {
    url = String(req.originalUrl || req.url || '');
    params = req.query || {};
  } catch (unusedErr) {
    return false;
  }

  // Percent-decoded first: `pp[]=env` is normally sent as `pp%5B%5D=env`, and
  // matching only the raw form would miss the encoding every real scanner uses.
  // A malformed escape sequence throws, so fall back to the raw string.
  var decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch (unusedErr) {
    decoded = url;
  }

  if (/\/wp-|\.php(\/|$|\?)/i.test(decoded)) { return true; }

  // Matched against the URL, not just req.query. This runs as the very first
  // middleware, ahead of anything that populates parsed parameters, so relying
  // on req.query alone would silently miss every query-string probe.
  if (/[?&](phpinfo|pp|rest_route)(=|\[|&|$)/i.test(decoded)) { return true; }

  // Kept as a second pass for the case where parameters did get parsed (a
  // probe sent as a form body rather than a query string).
  for (var key in params) {
    if (key === 'phpinfo' || key === 'pp' || key === 'rest_route') { return true; }
  }
  return false;
}


// ---------------------------------------------------------------------------
// Rate limiting
//
// The last line of defence, and the only one that works on a crawler wearing an
// ordinary browser's user agent — which is what the datacenter traffic hitting
// this site does. It is judged on BEHAVIOUR instead: one address asked for the
// homepage and all seven language links, twice, inside 0.66 seconds. No person
// does that.
//
// Only page requests count. A real visitor loading the homepage also pulls
// stylesheets, fonts and six poster frames in the same second; counting those
// would block people rather than bots.
// ---------------------------------------------------------------------------

// Requests that are not a person looking at a page: static files, and the
// /vplay beacon the video player fires in the background. Neither is logged as
// a visit, and neither counts toward the rate limit — someone playing five
// clips in ten seconds is engaged, not a crawler, and must not be refused for
// it.
var ASSETS = /^\/(videos|images|styles|fonts|js|dependencies)\/|^\/favicon\.ico|^\/vplay/;

var RATE_WINDOW_MS = 10000;   // sliding window
var RATE_MAX = 12;            // page requests allowed per address per window
var RATE_BLOCK_MS = 300000;   // how long a tripped address stays refused: 5 min
var RATE_MAX_IPS = 5000;      // addresses tracked before the oldest is dropped

// ip -> timestamps of its recent page requests. A Map because its insertion
// order gives the eviction order for free.
var rate_hits = new Map();
// ip -> time the refusal expires.
var rate_blocked = new Map();

// The penalty box is the part that matters.
//
// A bare cap is nearly useless here: a burst of 16 gets 12 served and 4
// refused, and the crawler that hit this site came back every three minutes
// with the window long since reset — so it would have been served, over and
// over, forever. Tripping the cap now refuses the address outright for five
// minutes, which turns a partial block into a real one and makes repeat
// visits cost the crawler everything and this server nothing.
function rate_limited(req) {
  var ip = clientIp(req);
  if (!ip || ip === '?') { return false; }

  var now = Date.now();

  // Already in the penalty box: refuse everything, assets included. A blocked
  // address has no business pulling 22MB of video either.
  var until = rate_blocked.get(ip);
  if (until !== undefined) {
    if (until > now) { return true; }
    rate_blocked.delete(ip);
  }

  // Only page requests are counted. A real visitor loading the homepage also
  // pulls stylesheets, fonts and six poster frames in the same second;
  // counting those would block people rather than bots.
  var url = req.originalUrl || req.url || '';
  if (ASSETS.test(url)) { return false; }

  var cutoff = now - RATE_WINDOW_MS;

  // Drop what has fallen out of the window. This also bounds the array: an
  // address can never accumulate more than a window's worth.
  var times = rate_hits.get(ip) || [];
  var recent = [];
  for (var i = 0; i < times.length; i++) {
    if (times[i] > cutoff) { recent.push(times[i]); }
  }
  recent.push(now);

  // Deleting before setting moves this address to the end of the Map, so the
  // eviction below always drops the least recently seen one.
  rate_hits.delete(ip);
  rate_hits.set(ip, recent);

  while (rate_hits.size > RATE_MAX_IPS) {
    var oldest = rate_hits.keys().next();
    if (oldest.done) { break; }
    rate_hits.delete(oldest.value);
  }

  if (recent.length > RATE_MAX) {
    rate_blocked.set(ip, now + RATE_BLOCK_MS);
    rate_hits.delete(ip);
    // Logged once, on the way in — not per refused request, or a crawler
    // would fill the file with the record of being ignored.
    if (typeof Log !== 'undefined' && Log.blocked) {
      Log.blocked('RATE | ' + recent.length + ' page requests in ' +
        (RATE_WINDOW_MS / 1000) + 's | blocked ' + (RATE_BLOCK_MS / 60000) + 'min | ip=' + ip +
        ' | url=' + url + ' | ua=' + (req.headers['user-agent'] || '-'));
    }
    return true;
  }

  return false;
}
