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
 */

var fs = require('fs');
var path = require('path');

var MAX_ROTATED = 5;   // matches LOG_MAXFILES in Log.js

// How much history each table shows, newest first.
var DAYS = 60;
var WEEKS = 26;
var MONTHS = 24;

module.exports = {

  // -> { days: [row], weeks: [row], months: [row], totals: {...} }
  // row = { label, from, visits, unique, bots, orders }
  dashboard: function () {
    return dashboard();
  },

  // The most recent visits, newest first, at most `limit`. Everything is
  // included — admin pages too, since a hit on one of those from an address
  // that is not yours is the single most useful thing this list can show you.
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

var ADMIN_ACTIONS = [
  'PagesController.orders',
  'PagesController.statistics',
  'PagesController.visits',
];

// What counts as a visit: a request for a real page.
//
// Excluded, and why:
//   - the admin pages, or opening the statistics inflates the number it is
//     about to show
//   - /language/*, which is not a page at all. It is a 301 straight back to
//     where you came from, and because the header offers seven of them, a
//     crawler that follows every link turned ONE visit into EIGHT log lines.
//     That is what filled the list with duplicates.
//
// Today that leaves the homepage alone, which is the only public page there
// is. Adding a page later makes it count with no change here.
function counts_as_visit(url, admin) {
  if (!url || url === '-') { return false; }
  if (admin.indexOf(url) >= 0) { return false; }
  if (url.indexOf('/language/') === 0) { return false; }
  return true;
}

// The admin pages must not count as visits — otherwise opening the statistics
// page inflates the number it is about to show. Their paths are read from the
// live route table rather than hardcoded, so renaming a route in
// config/local.js keeps the exclusion correct with no change here.
function admin_paths() {
  var out = [];
  var routes = (typeof sails !== 'undefined' && sails.config && sails.config.routes) || {};
  Object.keys(routes).forEach(function (address) {
    var target = routes[address];
    if (typeof target !== 'string') { return; }
    if (ADMIN_ACTIONS.indexOf(target) < 0) { return; }
    // "GET /eglei" -> "/eglei"
    var parts = address.split(' ');
    out.push(parts[parts.length - 1]);
  });
  return out;
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
  var admin = admin_paths();

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

  requests.forEach(function (entry) {
    if (!counts_as_visit(field(entry.payload, 'url'), admin)) { return; }

    var is_bot = field(entry.payload, 'bot') === 'yes';
    // The visitor cookie identifies a person far better than an address does.
    // Lines older than that cookie carry no vid, so they fall back to the ip —
    // which is what the whole history was counted by before.
    var vid = field(entry.payload, 'vid');
    var who = (vid && vid !== '-') ? vid : field(entry.payload, 'ip');

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

function recent_visits(limit) {
  limit = parseInt(limit, 10) || 50;
  if (limit < 1) { limit = 1; }

  var admin = admin_paths();

  // Read more lines than are wanted, because most of them will be filtered
  // out: admin pages and /language/* redirects are the bulk of the file.
  var entries = [];
  read_recent_lines('requests.log', limit * 10).forEach(function (line) {
    var parsed = parse_line(line);
    if (!parsed) { return; }
    if (!counts_as_visit(field(parsed.payload, 'url'), admin)) { return; }
    entries.push(parsed);
  });
  assign_years(entries);

  var rows = entries.map(visit_row);
  rows.reverse();                 // newest first
  return rows.slice(0, limit);
}
