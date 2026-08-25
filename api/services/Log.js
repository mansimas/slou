/**
 * Log
 *
 * The file logger, ported from the matchess project so the two apps write the
 * same on-disk shape and the same greps work on both. Sails globalizes
 * everything in api/services, so this is reachable as `Log` from anywhere.
 *
 * One flat file per channel under logs/:
 *
 *   Log.order(msg, ...)   -> logs/orders.log     every submitted order form
 *   Log.contact(msg, ...) -> logs/contacts.log   non-order enquiries
 *   Log.req(msg, ...)     -> logs/requests.log   page hits
 *   Log.err(msg, ...)     -> logs/errors.log     anything that threw
 *
 * The rules that matter when adding a channel:
 *
 *   - NEVER build a filename from a variable (a user id, an email, a date).
 *     Every distinct filename holds an open fd for the life of the process, so
 *     an unbounded set of names leaks fds until the process hits EMFILE. Put
 *     the varying value in the line and let grep do the filtering.
 *   - Add a function here rather than calling do_log() from a controller, so
 *     the set of files this app can ever open stays readable in one place.
 */

var Log = {

  // One line per order placed through the homepage box. This is the record of
  // the sale — treat it as the thing you'd be sad to lose.
  order: function (msg, ...rest_params) {
    return order(msg, rest_params);
  },

  // Enquiries that aren't orders, kept apart so orders.log stays purely sales.
  contact: function (msg, ...rest_params) {
    return contact(msg, rest_params);
  },

  req: function (msg, ...rest_params) {
    return req(msg, rest_params);
  },

  err: function (msg, ...rest_params) {
    return err(msg, rest_params);
  },

  // Validated, paginated read of logs/orders.log, newest first. The orders page
  // renders straight from this — there is no database behind it.
  read_orders: function (page, per_page) {
    return read_orders(page, per_page);
  },
};

module.exports = Log;

function order(msg, rest_params) {
  do_log('logs/orders.log', msg, 'info', '', rest_params);
}

function contact(msg, rest_params) {
  do_log('logs/contacts.log', msg, 'info', '', rest_params);
}

function req(msg, rest_params) {
  do_log('logs/requests.log', msg, 'info', '', rest_params);
}

function err(msg, rest_params) {
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    console.log(msg, rest_params);
  }
  do_log('logs/errors.log', msg, 'info', '', rest_params);
}

function get_date() {
  var curr_time = new Date();
  var date1 = ' ' + (curr_time.getMonth() + 1) + '-' + curr_time.getDate() + '-';
  var date2 = curr_time.getHours() + ':' + curr_time.getMinutes() + ':' + curr_time.getSeconds() + '-';
  var date3 = curr_time.getMilliseconds();
  return date1 + date2 + date3;
}

var winston = require('winston');

// A winston File transport opens its write stream on first use and holds that fd
// until close() is called. One cached logger == one open fd for as long as the
// process lives, so the number of DISTINCT filenames ever passed to do_log() is
// the number of fds we hold. A filename built from a customer name / email / any
// other unbounded value therefore leaks fds until the process hits EMFILE.
//
// Two defences:
//   - never build a filename from a variable (put the value in the line instead)
//   - this LRU: even if someone forgets the rule, the cache evicts and closes the
//     oldest logger instead of growing without limit.
var MAX_LOGGERS = 16;
var loggerCache = {};
var loggerOrder = []; // least-recently-used first

function evict_oldest() {
  var oldest = loggerOrder.shift();
  if (oldest === undefined) { return; }

  var logger = loggerCache[oldest];
  delete loggerCache[oldest];
  if (!logger) { return; }

  try {
    logger.close();
  } catch (e) {
    console.error('[LOG] failed to close logger', oldest, e && e.message);
  }
}

function touch(filename) {
  var at = loggerOrder.indexOf(filename);
  if (at !== -1) { loggerOrder.splice(at, 1); }
  loggerOrder.push(filename);
}

// Size cap, PER LOG NAME: a log keeps maxsize * maxFiles, then winston unlinks
// the oldest rotation — so this is also how much HISTORY is kept. A shop this
// size writes kilobytes a day, so 64MB x 5 is years of orders, not days.
//
// A big file costs nothing at write time: winston tracks the size in memory (no
// stat per write) and rotation is an fs.rename, not a copy. The split into
// chunks is purely so grep/tail stay usable.
var LOG_MAXSIZE = 67108864; // 64MB
var LOG_MAXFILES = 5;       // x 5 = 320MB kept per log

function getLogger(filename) {
  if (!loggerCache[filename]) {
    var logger = winston.createLogger({
      format: winston.format.simple(),
      transports: [
        new (winston.transports.File)({
          filename: filename,
          maxsize: LOG_MAXSIZE,
          maxFiles: LOG_MAXFILES,
          tailable: true,
        }),
      ],
    });

    // winston re-emits transport errors on the logger, and an unhandled 'error'
    // on an EventEmitter throws. Without this, a full disk / bad permission /
    // exhausted fd table kills the process instead of dropping one log line.
    logger.on('error', function onTransportError(e) {
      console.error('[LOG] transport error on', filename, e && e.message);
    });

    loggerCache[filename] = logger;

    while (loggerOrder.length >= MAX_LOGGERS) { evict_oldest(); }
  }

  touch(filename);
  return loggerCache[filename];
}

function do_log(filename, msg, level, id, rest_params, stack) {
  if (process.env.NODE_ENV === 'test') { return false; }

  var err_log = getLogger(filename);

  var msges = JSON.stringify(id) + ' ' + JSON.stringify(msg);
  if (rest_params && rest_params.length) {
    for (var a = 0; a < rest_params.length; a++) {
      msges += JSON.stringify(rest_params[a]);
    }
  }
  if (stack) { msges += JSON.stringify(stack); }

  err_log[level](msges + get_date());
}

// ---------------------------------------------------------------------------
// Reading orders back out
//
// The orders page renders from logs/orders.log directly, so the parsing lives
// next to the writing — change one and you are looking at the other.
// ---------------------------------------------------------------------------

// One on-disk line -> { name, email, locale, message, date }, or null if the
// line doesn't parse (a half-written tail line, or something hand-edited).
//
// On-disk shape (winston simple + do_log): info: "" "<payload>" <date>
// Payload: name | email | locale | message
function parse_order_line(line) {
  var m = line.match(/^\s*\w+:\s*"[^"]*"\s+"(.*)"\s+(\S+)\s*$/);
  if (!m) { return null; }

  // do_log writes the payload through JSON.stringify, so quotes inside it
  // arrive escaped. Undo that before splitting.
  var payload = m[1].replace(/\\"/g, '"');
  var date = m[2];

  var parts = payload.split(' | ');
  if (parts.length < 4) { return null; }

  return {
    name: parts[0],
    email: parts[1],
    locale: parts[2],
    // Rejoined in case the customer's own message contained ' | '.
    message: parts.slice(3).join(' | '),
    date: date,
    when: display_date(date),
  };
}

// "8-25-15:32:2-574" (the get_date() shape) -> "08-25 15:32". No year is
// written to the log, so none is shown. Anything unparseable is passed through
// rather than hidden, so a malformed line is visible instead of silently blank.
function display_date(date) {
  var p = String(date || '').split('-');   // [month, day, "H:Min:S", ms]
  if (p.length < 3) { return date || '—'; }
  var t = p[2].split(':');
  if (t.length < 2) { return date; }
  return pad2(p[0]) + '-' + pad2(p[1]) + ' ' + pad2(t[0]) + ':' + pad2(t[1]);
}

function pad2(n) {
  n = String(n);
  return n.length < 2 ? '0' + n : n;
}

function read_orders(page, per_page) {
  var fs = require('fs');
  var path = require('path');

  per_page = parseInt(per_page) || 50;
  page = parseInt(page) || 0;
  if (page < 0) { page = 0; }

  var result = { rows: [], page: page, per_page: per_page, total: 0, has_more: false };

  var file = path.join(process.cwd(), 'logs', 'orders.log');
  var content = '';
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (unusedErr) {
    return result;   // no orders yet: the file only appears on the first write
  }

  var lines = content.split('\n');
  var matched = [];
  for (var i = 0; i < lines.length; i++) {
    if (!lines[i]) { continue; }
    var parsed = parse_order_line(lines[i]);
    if (parsed) { matched.push(parsed); }
  }

  matched.reverse();   // newest first
  result.total = matched.length;
  var start = page * per_page;
  result.rows = matched.slice(start, start + per_page);
  result.has_more = (start + per_page) < matched.length;
  return result;
}
