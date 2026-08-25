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
 *   blockedBot(req) - is this a probe to refuse at the door? A narrower, more
 *                     conservative set: no-UA fetches and generic HTTP clients.
 *                     Search crawlers are never in it.
 */

module.exports = {

  context: function (req) {
    return context(req);
  },

  isBot: function (req) {
    var ua = req.headers['user-agent'] || '';
    return isBot(ua, parse(ua));
  },

  blockedBot: function (req) {
    return blockedBot(req);
  },

  // Is this a scanner probe rather than a request for a page that exists?
  hostileRequest: function (req) {
    return hostileRequest(req);
  },

  // Reads the visitor id off the request, minting one if this is a first
  // visit. Returns { id, isNew } — isNew tells the caller it still has to be
  // sent to the browser.
  visitorId: function (req) {
    return visitor_id(req);
  },

  // One log line describing the request. Used for every page hit.
  line: function (req, vid) {
    var c = context(req);
    return [
      'vid=' + (vid || '-'),
      'ip=' + c.ip,
      'country=' + c.country,
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
  var geoip = require('geoip-country');
  var ua = req.headers['user-agent'] || '';
  var parsed = parse(ua);
  var ip = clientIp(req);

  var geo = null;
  try {
    geo = geoip.lookup(ip);
  } catch (unusedErr) {
    geo = null;   // a malformed or private address just has no country
  }

  return {
    ip: ip,
    country: (geo && geo.country) || '-',
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

// UAs that must be let through: the search engines and AI crawlers the shop
// wants to be found by. Checked BEFORE the block list, so a crawler is never
// caught by an overlapping generic-client pattern.
//
// This is why "reject all bots" is not literally all: refusing these would
// take the shop out of Google. Set ALLOW_CRAWLERS to false below to make the
// rejection absolute — the site then serves people only, and is not indexed.
var ALLOW_CRAWLERS = true;
var GOOD_CRAWLERS = /googlebot|googleinspectiontool|bingbot|bingpreview|duckduckbot|baiduspider|yandex|sogou|exabot|ia_archiver|archive\.org|applebot|facebookexternalhit|linkedinbot|twitterbot|slackbot|discordbot|telegrambot|whatsapp|viber|gptbot|oai-searchbot|chatgpt-user|openai|claudebot|anthropic-ai|perplexitybot|gemini|google-extended|ccbot|dotbot|rogerbot|semrushbot|ahrefsbot|mj12bot|petalbot|spider|crawler/i;

// Generic HTTP clients and scanner toolkits. A browser never sends these, and
// they never render the page — they just hammer it.
var BAD_TOOLS = /curl|wget|python|go-http-client|java|okhttp|libwww|perl|scrapy|nuclei|sqlmap|nikto|nmap|masscan|zgrab|censys|httpclient|urllib|postman|insomnia|httpie|axios|node-fetch|powershell|headless/i;

function blockedBot(req) {
  var ua = req.headers['user-agent'] || '';
  if (ALLOW_CRAWLERS && GOOD_CRAWLERS.test(ua)) { return false; }
  // Only page fetches are judged this way. The order form POSTs from a real
  // browser, but keeping POST out of this rule means a UA check can never be
  // the reason an order fails to reach the log.
  if (req.method !== 'GET' && req.method !== 'HEAD') { return false; }
  if (!ua) { return true; }
  if (BAD_TOOLS.test(ua)) { return true; }
  return false;
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
