/**
 * StatsService
 *
 * Turns logs/requests.log and logs/orders.log into per-day, per-week and
 * per-month counts for the statistics page. Modelled on matchess's
 * LogStatsService, including the two things that file exists to deal with:
 *
 *   1. Rotated files. winston writes <name>.log, and rotations age out to
 *      <name>.log.1, .2 … so reading only <name>.log silently loses history the
 *      moment the first rotation happens.
 *
 *   2. The missing year. Log.do_log() used to stamp lines `M-D-H:Min:S-ms`
 *      with NO year. It writes one now, but every line logged before that
 *      change is still in the files, so those are reconstructed by walking
 *      backwards from today and decrementing whenever the date jumps forward,
 *      which can only mean the walk crossed a January 1st.
 *
 * Definitions used on the page:
 *   visits  - logged requests, excluding bots and excluding the admin pages
 *   unique  - distinct visitors, counted by the `vid` cookie, falling back to
 *             the IP address on lines older than that cookie
 *   bots    - requests whose user agent identified as a crawler. Shown rather
 *             than hidden so `visits` is never quietly inflated by them.
 *   orders  - lines in orders.log, which is one line per submitted order
 *   sources - where the visitors came from (Instagram, Facebook, TikTok,
 *             YouTube, search, direct), counted in visitors rather than
 *             requests. See traffic_source().
 */

var fs = require('fs');
var path = require('path');

var MAX_ROTATED = 5;   // matches LOG_MAXFILES in Log.js

// How much history each table shows, newest first.
var DAYS = 60;
var WEEKS = 26;
var MONTHS = 24;

module.exports = {

  // -> { days: [row], weeks: [row], months: [row], totals: {...}, sources: [row] }
  // row = { label, from, visits, unique, bots, orders }
  // sources row = { key, label, today, week, total } — see source_tally()
  dashboard: function () {
    return dashboard();
  },

  // Plays per clip, most played first: [{ slug, name, plays, today, week }]
  videoPlays: function () {
    return video_plays();
  },

  // The most recent VISITORS, newest first, at most `limit`. One row per
  // person, not per request: a visitor who opened five pages is one row,
  // stamped with the newest of them and carrying `hits: 5`. Without that the
  // list is mostly the same handful of visitors repeated, and the newest
  // genuinely different visitor can be pushed off the bottom of the page by a
  // single busy one.
  // Page views, visits and time on site for the given `vid` cookies, read
  // out of requests.log and times.log. -> { vid: activity } for each vid seen.
  // See visitor_activity().
  visitorActivity: function (vids) {
    return visitor_activity(vids);
  },

  // Several vids of the same customer -> one activity, or null if none.
  mergeActivity: function (list) {
    return merge_activity(list);
  },

  recentVisits: function (limit) {
    return recent_visits(limit);
  },

};

function log_dir() {
  var base = (typeof sails !== 'undefined' && sails.config && sails.config.appPath)
    ? sails.config.appPath
    : process.cwd();
  return path.resolve(base, 'logs');
}

// winston tailable rotation: <name>.log is newest, <name>.log.1 the next
// older. Returned oldest-first, so the year walk below sees them in order.
function read_log_lines(filename) {
  var lines = [];
  for (var a = MAX_ROTATED; a >= 0; a--) {
    var file = path.join(log_dir(), a === 0 ? filename : filename + '.' + a);
    var content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (unusedErr) {
      continue;   // a missing rotation slot is normal, not an error
    }
    var split = content.split('\n');
    for (var b = 0; b < split.length; b++) {
      if (split[b].length) { lines.push(split[b]); }
    }
  }
  return lines;
}

// Like read_log_lines but for "the last N lines": walks the rotations
// newest-first and stops as soon as it has enough, so showing 50 visits does
// not mean reading a 64MB file. Returned oldest-first, like its sibling.
function read_recent_lines(filename, needed) {
  var lines = [];
  for (var a = 0; a <= MAX_ROTATED && lines.length < needed; a++) {
    var file = path.join(log_dir(), a === 0 ? filename : filename + '.' + a);
    var content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (unusedErr) {
      continue;
    }
    var split = content.split('\n').filter(function (l) { return l.length; });
    // Newer file first, so its lines belong AFTER the ones we already have.
    lines = split.slice(Math.max(0, split.length - (needed - lines.length))).concat(lines);
  }
  return lines;
}

// `info: "" "<payload>" <M-D-H:Min:S-ms>` -> { payload, month, day }
var LINE_RE = /^\s*\w+:\s*"[^"]*"\s+"(.*)"\s+(\S+)\s*$/;

function parse_line(line) {
  var m = line.match(LINE_RE);
  if (!m) { return null; }

  var parts = String(m[2]).split('-');
  if (parts.length < 3) { return null; }

  // Two shapes in the files: `YYYY-M-D-H:Min:S-ms` written now, and the older
  // year-less `M-D-H:Min:S-ms`. A 4-digit leading field is the year; when it is
  // there the date is exact and needs no reconstructing.
  var year = null;
  if (parts.length >= 5 && parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    parts = parts.slice(1);
  }

  var month = parseInt(parts[0], 10);
  var day = parseInt(parts[1], 10);
  if (isNaN(month) || isNaN(day)) { return null; }

  var clock = String(parts[2] || '').split(':');

  return {
    payload: m[1],
    year: year,
    month: month - 1,   // 0-based
    day: day,
    hour: parseInt(clock[0], 10) || 0,
    min: parseInt(clock[1], 10) || 0,
    sec: parseInt(clock[2], 10) || 0,
  };
}

// Stamp every entry with `t`, midnight of its own day — all the bucketing
// below needs.
//
// Lines written since the year was added to the stamp carry their own and are
// used as-is. Older, year-less lines are reconstructed the matchess way: walk
// backwards from the newest, and a date reading LATER than the one after it can
// only be from the previous year. The walk seeds itself from the nearest known
// year so a file mixing both shapes stays consistent across the boundary.
function assign_years(entries) {
  if (!entries.length) { return entries; }

  var now = new Date();
  var year = now.getFullYear();

  // A newest entry dated well ahead of today belongs to last year — this
  // happens when nothing has been logged since before New Year.
  var newest = entries[entries.length - 1];
  if (newest.year === null &&
      newest.month * 100 + newest.day > (now.getMonth() * 100 + now.getDate()) + 2) {
    year--;
  }

  var prev = null;
  for (var i = entries.length - 1; i >= 0; i--) {
    var e = entries[i];
    if (e.year !== null) {
      // Exact. Also re-seeds the walk for any year-less lines before it.
      year = e.year;
      prev = e.month * 100 + e.day;
      e.t = new Date(e.year, e.month, e.day).getTime();
      continue;
    }
    var key = e.month * 100 + e.day;
    if (prev !== null && key > prev) { year--; }
    prev = key;
    e.t = new Date(year, e.month, e.day).getTime();
  }
  return entries;
}

// Pull `key=value` out of a ' | ' separated payload.
function field(payload, key) {
  var m = payload.match(new RegExp('(?:^|\\| )' + key + '=([^|]*)'));
  return m ? m[1].trim() : '';
}

// The controller actions behind the admin pages. Paths are read from the live
// route table rather than written here, so renaming a route in
// config/local.js keeps the exclusion correct with nothing else to update.
var ADMIN_ACTIONS = [
  'PagesController.orders',
  'PagesController.statistics',
  'PagesController.visits',
  'PagesController.posts',
  'PagesController.reply',
];

// Computed once. The route table does not change while the process runs, and
// this is asked for every line of the log.
var admin_paths_cache = null;

function admin_paths() {
  if (admin_paths_cache) { return admin_paths_cache; }

  var out = [];
  var routes = (typeof sails !== 'undefined' && sails.config && sails.config.routes) || {};
  Object.keys(routes).forEach(function (address) {
    var target = routes[address];
    // A route can be a string ('PagesController.orders') or a dictionary
    // ({ action: '...' }); both shapes appear in a Sails app.
    var action = (typeof target === 'string') ? target : (target && (target.action || target.controller));
    if (!action || ADMIN_ACTIONS.indexOf(action) < 0) { return; }
    // "GET /eglei" -> "/eglei"
    var parts = String(address).split(' ');
    out.push(normalize_path(parts[parts.length - 1]));
  });

  admin_paths_cache = out;
  return out;
}

// `/estats?x=1`, `/estats/` and `/estats` are one page. Comparing raw URLs
// missed the first two, which is how admin hits kept appearing in the list.
function normalize_path(url) {
  var path = String(url || '').split('?')[0].split('#')[0];
  while (path.length > 1 && path.charAt(path.length - 1) === '/') {
    path = path.slice(0, -1);
  }
  return path;
}

// What counts as a visit: a person looking at a page of the shop.
//
// A blacklist, so a page added to the site later is counted without anyone
// having to remember to come here. Only three kinds of request are dropped:
//
//   - the admin pages, or opening the statistics inflates the numbers it is
//     about to show
//   - /language/*, which is not a page. It is a 301 straight back to where you
//     came from, and with seven of them in the header a crawler following
//     every link turned ONE visit into EIGHT lines
//   - /vplay, the video player's background beacon
// A request for a path this site does not have — /login, /.env, /graphql and
// the rest of the scanner vocabulary. The judgement lives in VisitService,
// which reads it off the live route table, so the door and the statistics can
// never disagree about what this site consists of.
//
// Requests like these are refused at the door now and no longer reach
// requests.log at all; this exists for the history already in the files.
function is_probe(url) {
  try {
    return !require('./VisitService').routedPath(url);
  } catch (unusedErr) {
    return false;   // never let this be the reason a visit goes missing
  }
}

function counts_as_visit(url) {
  if (!url || url === '-') { return false; }

  var path = normalize_path(url);
  if (!path) { return false; }

  if (path.indexOf('/language/') === 0) { return false; }
  if (path === '/vplay' || path === '/vtime') { return false; }
  // Background calls from the homepage's conversation box, not page views.
  if (path.indexOf('/conversation') === 0) { return false; }
  if (admin_paths().indexOf(path) >= 0) { return false; }

  return true;
}

// ---------------------------------------------------------------------------
// Bucket keys
// ---------------------------------------------------------------------------

function day_start(ms) {
  var d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Monday, matching how a week is read locally (and ISO-8601).
function week_start(ms) {
  var d = new Date(day_start(ms));
  var dow = (d.getDay() + 6) % 7;   // 0 = Monday
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

function month_start(ms) {
  var d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function pad2(n) {
  n = String(n);
  return n.length < 2 ? '0' + n : n;
}

function day_label(ms) {
  var d = new Date(ms);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function week_label(ms) {
  var end = new Date(ms + 6 * 86400000);
  return day_label(ms) + ' … ' + pad2(end.getMonth() + 1) + '-' + pad2(end.getDate());
}

function month_label(ms) {
  var d = new Date(ms);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

// ---------------------------------------------------------------------------

function blank_bucket() {
  return { visits: 0, bots: 0, orders: 0, seen: {}, unique: 0 };
}

function bucket_of(map, key) {
  if (!map[key]) { map[key] = blank_bucket(); }
  return map[key];
}

function dashboard() {
  // --- requests ---
  var requests = [];
  read_log_lines('requests.log').forEach(function (line) {
    var parsed = parse_line(line);
    if (parsed) { requests.push(parsed); }
  });
  assign_years(requests);

  var days = {};
  var weeks = {};
  var months = {};
  var sources = source_tally();

  requests.forEach(function (entry) {
    var url = field(entry.payload, 'url');
    if (!counts_as_visit(url)) { return; }

    // A probe counts as a bot, not as a visit. The scanners that hit this site
    // wear an ordinary Chrome user agent, so `bot=no` on the line means
    // nothing; what gives them away is that they ask for /login, /.env or
    // /graphql, and this site has no such pages. See is_probe().
    var is_bot = field(entry.payload, 'bot') === 'yes' || is_probe(url);
    var who = visitor_key(entry.payload);

    [bucket_of(days, day_start(entry.t)),
      bucket_of(weeks, week_start(entry.t)),
      bucket_of(months, month_start(entry.t))].forEach(function (b) {
      if (is_bot) {
        b.bots++;
        return;
      }
      b.visits++;
      if (who && !b.seen[who]) {
        b.seen[who] = true;
        b.unique++;
      }
    });

    // Kur lankytojas rado nuorodą. Skaičiuojami žmonės, ne užklausos, todėl
    // tai daroma iš tos pačios eilutės kaip ir „unikalūs" — dukart to paties
    // log'o skaityti nereikia.
    if (!is_bot) { sources.add(who, entry.t, traffic_source(entry.payload)); }
  });

  // --- orders ---
  var orders = [];
  read_log_lines('orders.log').forEach(function (line) {
    var parsed = parse_line(line);
    if (parsed) { orders.push(parsed); }
  });
  assign_years(orders);

  orders.forEach(function (entry) {
    bucket_of(days, day_start(entry.t)).orders++;
    bucket_of(weeks, week_start(entry.t)).orders++;
    bucket_of(months, month_start(entry.t)).orders++;
  });

  return {
    days: rows(days, day_label, DAYS),
    weeks: rows(weeks, week_label, WEEKS),
    months: rows(months, month_label, MONTHS),
    totals: totals(months),
    sources: sources.rows(),
  };
}

// Newest first, capped, with the identity lookup dropped — the page only needs
// its size, and handing a view a map of every visitor invites it to be rendered
// by accident.
function rows(map, label, limit) {
  return Object.keys(map)
    .map(Number)
    .sort(function (a, b) { return b - a; })
    .slice(0, limit)
    .map(function (key) {
      var b = map[key];
      return {
        label: label(key),
        from: key,
        visits: b.visits,
        unique: b.unique,
        bots: b.bots,
        orders: b.orders,
      };
    });
}

// Summed from the month buckets so the figure covers everything the logs hold,
// not just the rows the tables happen to show. `unique` is deliberately absent:
// a visitor appearing in three months is one person, and monthly uniques cannot
// be added up to say how many.
function totals(months) {
  var out = { visits: 0, bots: 0, orders: 0 };
  Object.keys(months).forEach(function (key) {
    out.visits += months[key].visits;
    out.bots += months[key].bots;
    out.orders += months[key].orders;
  });
  return out;
}


// ---------------------------------------------------------------------------
// The visit list
// ---------------------------------------------------------------------------

// One parsed request line -> a row for the page. Every field the logger writes
// is carried through; the view decides what to show.
function visit_row(entry) {
  var vid = field(entry.payload, 'vid');
  var ip = field(entry.payload, 'ip') || '-';

  var city = field(entry.payload, 'city');
  var region = field(entry.payload, 'region');
  var tz = field(entry.payload, 'tz');
  var country = field(entry.payload, 'country') || '-';

  // Lines logged before city/region/tz were written carry none of them. Look
  // them up from the address on the line so old visits are not blank. Only a
  // fallback: a line that HAS the fields keeps what it was given, because the
  // geoip database changes over time and the recorded answer is the true one.
  if (!city && !region && !tz && ip !== '-') {
    try {
      var geo = require('geoip-lite').lookup(ip);
      if (geo) {
        city = geo.city || '';
        region = geo.region || '';
        tz = geo.timezone || '';
        if (country === '-') { country = geo.country || '-'; }
      }
    } catch (unusedErr) {
      // no lookup available; the row simply shows what the line held
    }
  }

  return {
    when: day_label(entry.t) + ' ' + pad2(entry.hour) + ':' + pad2(entry.min),
    t: entry.t,
    country: country,
    city: dash(city),
    // Region code where the database has one, timezone where it does not —
    // "VL" and "Europe/Vilnius" are both more use than an empty cell.
    place: dash(region) !== '-' ? region : dash(tz),
    device: dash(field(entry.payload, 'device')),
    os: dash(field(entry.payload, 'os')),
    browser: dash(field(entry.payload, 'browser')),
    // `lt-LT,lt;q=0.9,en;q=0.8` is a preference list; the first entry is the
    // language the browser is actually set to and the only part worth a column.
    lang: dash(String(field(entry.payload, 'lang')).split(',')[0]),
    from: dash(field(entry.payload, 'from')),
    url: dash(field(entry.payload, 'url')),
    is_bot: field(entry.payload, 'bot') === 'yes',
    // Kept for the title attribute rather than a column of its own.
    ua: dash(field(entry.payload, 'ua')),
    visitor: (vid && vid !== '-') ? vid.slice(0, 8) : '-',
  };
}

function dash(v) {
  v = (v === undefined || v === null) ? '' : String(v).trim();
  return v.length ? v : '-';
}

// Who this visitor is: the address plus the full user agent.
//
// NOT the `vid` cookie, which looks like the right answer and is not. The
// cookie is minted on the way IN, before the browser has had a chance to send
// one back, so a client that does not keep cookies — every scanner, and the
// in-app browsers that clear them between opens — gets a brand new vid on
// every single request. Counting those as distinct visitors is exactly how a
// burst of one scanner arrived as twenty identical-looking rows.
//
// The address alone would merge an office or a mobile carrier into one person;
// together with the user agent it is wrong far less often. It still cannot see
// through the same person moving from wifi to mobile data — that is two rows,
// and short of a login there is no fixing it.
function visitor_key(payload) {
  return (field(payload, 'ip') || '?') + ' | ' + (field(payload, 'ua') || '-');
}

// Paskutiniai `limit` LANKYTOJAI, ne apsilankymai: viena eilutė vienam
// žmogui, rodomas naujausias jo apsilankymas, o kiek kartų jis buvo per
// perskaitytą log'o gabalą — eilutės `hits` lauke.
function recent_visits(limit) {
  limit = parseInt(limit, 10) || 50;
  if (limit < 1) { limit = 1; }

  // Skaitoma gerokai daugiau eilučių, nei bus parodyta: dalis jų iškrenta
  // (admin puslapiai, /language/* peradresavimai), o likusios susitraukia,
  // kai to paties lankytojo apsilankymai suplaukia į vieną eilutę. Vienas
  // aktyvus lankytojas gali užimti dešimtis log'o eilučių, todėl ir imamas
  // toks atsargos dydis.
  var entries = [];
  read_recent_lines('requests.log', limit * 40).forEach(function (line) {
    var parsed = parse_line(line);
    if (!parsed) { return; }

    var url = field(parsed.payload, 'url');
    if (!counts_as_visit(url)) { return; }
    // People only. A self-identified crawler and a scanner probing /login are
    // both machines, and this page is for looking at customers.
    if (field(parsed.payload, 'bot') === 'yes') { return; }
    if (is_probe(url)) { return; }

    entries.push(parsed);
  });
  assign_years(entries);

  // Walked newest-first: the first line seen for a visitor is the one shown,
  // every older one only adds to the counter. The `when` comparison is there
  // because the file is only USUALLY in order — a line written while the clock
  // was adjusted, or a rotation boundary, must not leave a visitor stamped
  // with an older time than one of their own later visits.
  var seen = Object.create(null);
  var rows = [];
  for (var i = entries.length - 1; i >= 0; i--) {
    var key = visitor_key(entries[i].payload);
    var row = visit_row(entries[i]);

    if (seen[key]) {
      seen[key].hits++;
      if (row.when > seen[key].when) {
        seen[key].when = row.when;
        seen[key].t = row.t;
      }
      continue;
    }

    row.hits = 1;
    seen[key] = row;
    rows.push(row);
  }

  // `when` is `YYYY-MM-DD HH:MM`, so comparing the strings sorts by time.
  rows.sort(function (a, b) { return a.when < b.when ? 1 : (a.when > b.when ? -1 : 0); });
  return rows.slice(0, limit);
}


// ---------------------------------------------------------------------------
// Iš kur atėjo lankytojai
// ---------------------------------------------------------------------------

// The platforms worth a row of their own, in the order they are shown when the
// counts tie. `direct` and `other` are last on purpose: they are what is left
// when nothing identified the visitor's origin, not findings in themselves.
var SOURCES = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'search', label: 'Paieška' },
  { key: 'other', label: 'Kita' },
  { key: 'direct', label: 'Tiesiogiai' },
];

// Which answer wins when one visitor's requests disagree. A named platform
// beats everything: a visitor who arrived from Instagram and then reloaded the
// page with no referrer came from Instagram, and the reload must not quietly
// turn them into a direct visit.
var SOURCE_RANK = { direct: 3, other: 2, search: 1 };

function source_rank(key) {
  return SOURCE_RANK[key] || 0;
}

// This site's own addresses. A referrer pointing at one of them is one page of
// the shop linking to another, not an arrival from somewhere else. localhost is
// here so that browsing the site while developing does not pile up under
// "kita".
var OWN_HOSTS = ['slou.lt', 'localhost', '127.0.0.1'];

// `https://l.instagram.com/x?y` -> `l.instagram.com`. Blank for '-' and for
// anything that is not an absolute address.
function host_of(url) {
  var m = String(url || '').match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
  if (!m) { return ''; }
  return m[1].toLowerCase().replace(/^www\./, '').split(':')[0];
}

function host_is(host, domain) {
  return host === domain || host.slice(-(domain.length + 1)) === '.' + domain;
}

// The platform a referring HOST belongs to, or '' for a host we have no name
// for. l.instagram.com and l.facebook.com are the apps' own link wrappers —
// nearly all social traffic arrives wearing one of those rather than the bare
// domain.
function source_of_host(host) {
  if (!host) { return ''; }
  if (host_is(host, 'instagram.com') || host_is(host, 'ig.me')) { return 'instagram'; }
  if (host_is(host, 'facebook.com') || host_is(host, 'fb.com') ||
      host_is(host, 'fb.me') || host_is(host, 'fb.watch') ||
      host_is(host, 'messenger.com')) { return 'facebook'; }
  if (host_is(host, 'tiktok.com')) { return 'tiktok'; }
  if (host_is(host, 'youtube.com') || host_is(host, 'youtu.be')) { return 'youtube'; }
  if (host_is(host, 'google.com') || /(^|\.)google\.[a-z.]+$/.test(host) ||
      host_is(host, 'bing.com') || host_is(host, 'duckduckgo.com') ||
      host_is(host, 'yahoo.com') || host_is(host, 'ecosia.org') ||
      host_is(host, 'yandex.ru')) { return 'search'; }
  return '';
}

// The platform named by the campaign tags on an address. Both the landing url
// and the referrer are looked at: the link in the Instagram bio carries
// `utm_source=ig`, and the app hands it back as part of a referrer pointing at
// this site itself.
function source_of_query(url) {
  var q = String(url || '');
  if (q.indexOf('?') < 0) { return ''; }

  var utm = (q.match(/[?&]utm_source=([^&#]*)/i) || [])[1];
  utm = decodeURIComponent(String(utm || '')).toLowerCase();
  if (/^(ig|instagram)$/.test(utm)) { return 'instagram'; }
  if (/^(fb|facebook|meta)$/.test(utm)) { return 'facebook'; }
  if (/^(tt|tiktok)$/.test(utm)) { return 'tiktok'; }
  if (/^(yt|youtube)$/.test(utm)) { return 'youtube'; }
  if (/^(google|bing|search)$/.test(utm)) { return 'search'; }

  if (/[?&]igshid=/i.test(q)) { return 'instagram'; }
  if (/[?&]ttclid=/i.test(q)) { return 'tiktok'; }
  if (/[?&]gclid=/i.test(q)) { return 'search'; }
  return '';
}

// The app the page was opened INSIDE. Instagram, Facebook and TikTok all open
// links in a browser of their own that says so in the user agent, and that is
// the only evidence left when the app sends no referrer at all — which is how
// TikTok traffic arrives.
function source_of_app(browser) {
  var b = String(browser || '').toLowerCase();
  if (b.indexOf('instagram') === 0) { return 'instagram'; }
  if (b.indexOf('facebook') === 0) { return 'facebook'; }
  if (b.indexOf('tiktok') === 0) { return 'tiktok'; }
  if (b.indexOf('youtube') === 0) { return 'youtube'; }
  return '';
}

// Where one logged request came from.
//
// Read in order of how much the evidence is worth: an explicit campaign tag,
// then the referring site, then Meta's click id (which both Instagram and
// Facebook stamp, so the app the page opened in decides which of the two it
// was), then the app itself, and only then "nobody said".
function traffic_source(payload) {
  var from = field(payload, 'from');
  var url = field(payload, 'url');
  var app = source_of_app(field(payload, 'browser'));

  var tagged = source_of_query(url) || source_of_query(from);
  if (tagged) { return tagged; }

  var host = host_of(from);
  var named = source_of_host(host);
  if (named) { return named; }

  // fbclid says "a Meta app sent this" and no more. In-app browser first,
  // Facebook as the fallback — the link wrapper only stamps it on links
  // opened from Facebook or Instagram.
  if (/[?&]fbclid=/i.test(url) || /[?&]fbclid=/i.test(from)) {
    return app === 'instagram' ? 'instagram' : 'facebook';
  }

  if (app) { return app; }

  // No referrer: the address was typed, opened from a bookmark, or came from
  // an app that strips it. A referrer pointing at this site itself is a click
  // from one page of the shop to another, not an arrival.
  if (!from || from === '-') { return 'direct'; }
  if (host && OWN_HOSTS.some(function (own) { return host_is(host, own); })) { return 'direct'; }

  return 'other';
}

// Counts visitors, not requests: a visitor who opened eight pages came from
// Instagram once. Held as three sets of visitor -> source (today, the last
// seven days, everything the logs hold) rather than one, because the same
// person may well arrive from Instagram today and from a bookmark last week.
function source_tally() {
  var today = day_start(Date.now());
  var week = today - 6 * 86400000;
  var maps = { today: {}, week: {}, total: {} };

  function keep(map, who, src) {
    if (!map[who] || source_rank(src) < source_rank(map[who])) { map[who] = src; }
  }

  return {
    add: function (who, t, src) {
      if (!who) { return; }
      keep(maps.total, who, src);
      if (t >= week) { keep(maps.week, who, src); }
      if (t >= today) { keep(maps.today, who, src); }
    },

    rows: function () {
      var counts = {};
      Object.keys(maps).forEach(function (period) {
        counts[period] = {};
        Object.keys(maps[period]).forEach(function (who) {
          var src = maps[period][who];
          counts[period][src] = (counts[period][src] || 0) + 1;
        });
      });

      return SOURCES.map(function (s) {
        return {
          key: s.key,
          label: s.label,
          today: counts.today[s.key] || 0,
          week: counts.week[s.key] || 0,
          total: counts.total[s.key] || 0,
        };
      }).sort(function (a, b) {
        // Biggest first, but only among the platforms: "tiesiogiai" and "kita"
        // are kept at the bottom whatever their size, so the table always
        // reads as a ranking of the places traffic was won from.
        var ra = source_rank(a.key);
        var rb = source_rank(b.key);
        if (ra !== rb) { return ra - rb; }
        return b.total - a.total;
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Video plays
// ---------------------------------------------------------------------------

// logs/videos.log holds one line per play: `slug | country | device | ip=…`.
// Counted for all time, for today, and for the last 7 days — a total alone
// cannot tell you whether a clip is still being watched or was popular once.
function video_plays() {
  var counts = {};
  var now = Date.now();
  var today = day_start(now);
  var week = today - 6 * 86400000;

  var entries = [];
  read_log_lines('videos.log').forEach(function (line) {
    var parsed = parse_line(line);
    if (parsed) { entries.push(parsed); }
  });
  assign_years(entries);

  entries.forEach(function (entry) {
    var slug = String(entry.payload).split(' | ')[0].trim();
    if (!slug) { return; }
    if (!counts[slug]) { counts[slug] = { plays: 0, today: 0, week: 0 }; }
    counts[slug].plays++;
    if (entry.t >= today) { counts[slug].today++; }
    if (entry.t >= week) { counts[slug].week++; }
  });

  // Every clip in the catalogue is listed, including ones nobody has played —
  // a zero is a finding, and a clip missing from the table just looks like a
  // bug in the counting.
  var products = (typeof sails !== 'undefined' && sails.config && sails.config.catalog)
    ? sails.config.catalog.products
    : [];

  var rows = products.filter(function (p) {
    return !!p.video;
  }).map(function (p) {
    var c = counts[p.slug] || { plays: 0, today: 0, week: 0 };
    return {
      slug: p.slug,
      name: (p.t && p.t.lt && p.t.lt.name) ? p.t.lt.name : p.slug,
      plays: c.plays,
      today: c.today,
      week: c.week,
    };
  });

  rows.sort(function (a, b) { return b.plays - a.plays; });
  return rows;
}


// ---------------------------------------------------------------------------
// One customer's activity (the conversations page)
// ---------------------------------------------------------------------------

// A gap longer than this between two page views starts a new visit — the
// usual web-analytics session rule.
var VISIT_GAP_MS = 30 * 60 * 1000;
var MAX_VIEWS_SHOWN = 100;

function entry_ms(e) {
  return e.t + ((e.hour * 60 + e.min) * 60 + e.sec) * 1000;
}

function stamp(ms) {
  var d = new Date(ms);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

// vids -> { vid: { views: [{ ms, url, from, place, device }], seconds } }.
//
// Reads the whole of requests.log (with rotations) once for all the vids on
// the page, not once per conversation. Page views are filtered the way the
// statistics count them: no admin pages, no language redirects, no beacons.
function visitor_activity(vids) {
  var want = Object.create(null);
  (vids || []).forEach(function (v) { if (v) { want[v] = true; } });
  var out = Object.create(null);
  if (!Object.keys(want).length) { return out; }

  function slot(vid) {
    if (!out[vid]) { out[vid] = { views: [], seconds: 0 }; }
    return out[vid];
  }

  var entries = [];
  read_log_lines('requests.log').forEach(function (line) {
    var parsed = parse_line(line);
    if (!parsed) { return; }
    var vid = field(parsed.payload, 'vid');
    if (!want[vid]) { return; }
    if (!counts_as_visit(field(parsed.payload, 'url'))) { return; }
    parsed.vid = vid;
    entries.push(parsed);
  });
  assign_years(entries);

  entries.forEach(function (e) {
    var city = dash(field(e.payload, 'city'));
    var country = dash(field(e.payload, 'country'));
    slot(e.vid).views.push({
      ms: entry_ms(e),
      url: dash(field(e.payload, 'url')),
      method: dash(field(e.payload, 'method')),
      from: dash(field(e.payload, 'from')),
      place: country + (city !== '-' ? ' / ' + city : ''),
      device: dash(field(e.payload, 'device')),
    });
  });

  // times.log: `vid | seconds | path`
  read_log_lines('times.log').forEach(function (line) {
    var parsed = parse_line(line);
    if (!parsed) { return; }
    var parts = String(parsed.payload).split(' | ');
    if (!want[parts[0]]) { return; }
    var secs = parseInt(parts[1], 10);
    if (secs > 0) { slot(parts[0]).seconds += secs; }
  });

  return out;
}

// -> { pageViews, visits, seconds, first, last, views: [row] (newest first) }
function merge_activity(list) {
  var views = [];
  var seconds = 0;
  var any = false;
  (list || []).forEach(function (a) {
    if (!a) { return; }
    any = true;
    views = views.concat(a.views);
    seconds += a.seconds;
  });
  if (!any) { return null; }

  views.sort(function (a, b) { return a.ms - b.ms; });

  var visits = 0;
  var prev = null;
  views.forEach(function (v) {
    if (prev === null || v.ms - prev > VISIT_GAP_MS) { visits++; v.newVisit = true; }
    prev = v.ms;
  });

  return {
    pageViews: views.length,
    visits: visits,
    seconds: seconds,
    first: views.length ? stamp(views[0].ms) : '-',
    last: views.length ? stamp(views[views.length - 1].ms) : '-',
    views: views.slice(-MAX_VIEWS_SHOWN).reverse().map(function (v) {
      return {
        when: stamp(v.ms),
        url: v.url,
        method: v.method,
        from: v.from,
        place: v.place,
        device: v.device,
        newVisit: !!v.newVisit,
      };
    }),
  };
}
