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

  return { payload: m[1], year: year, month: month - 1, day: day };   // month 0-based
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
    if (target !== 'PagesController.orders' && target !== 'PagesController.statistics') { return; }
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
    var url = field(entry.payload, 'url');
    if (admin.indexOf(url) >= 0) { return; }   // don't count looking at the numbers

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
