/**
 * ConversationService
 *
 * The thread between a customer and the shop, kept so the customer can come
 * back to the site and read the reply there instead of needing an email.
 *
 * There is no database and no login. When someone places an order the server
 * mints a conversation and hands back { id, key }; the browser keeps both in
 * localStorage and that pair IS the account. Anyone holding the key can read
 * and write the thread, nobody else can — so the key is long and random, and
 * it never appears in a URL (every customer call is a POST with a JSON body),
 * which keeps it out of logs/requests.log and out of any Referer header.
 *
 * On disk: one JSON file per conversation, data/conversations/<id>.json.
 * The id is random hex and the only thing a filename is ever built from, and
 * it is checked against ID before it gets near the filesystem. Unlike the
 * winston logs, these are plain readFileSync/writeFileSync calls that hold no
 * fd open afterwards, so a file per thread costs nothing to keep.
 *
 * Writes go to a temp file and are renamed over the original, so a crash
 * mid-write leaves the old thread intact rather than a half-written one.
 *
 * data/ holds customer names, emails and messages. It is in .gitignore for the
 * same reason logs/*.log is.
 */

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var DIR = path.join(process.cwd(), 'data', 'conversations');

var ID = /^[a-f0-9]{16}$/;
var KEY = /^[a-f0-9]{48}$/;

var MAX_TEXT = 4000;       // same cap as the order form's textarea
var MAX_MESSAGES = 300;    // a thread longer than this is somebody scripting it

function ensure_dir() {
  fs.mkdirSync(DIR, { recursive: true });
}

function file_of(id) {
  return path.join(DIR, id + '.json');
}

function load(id) {
  if (!ID.test(String(id || ''))) { return null; }
  try {
    return JSON.parse(fs.readFileSync(file_of(id), 'utf8'));
  } catch (unusedErr) {
    return null;
  }
}

function save(conv) {
  ensure_dir();
  var target = file_of(conv.id);
  var tmp = target + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(conv));
  fs.renameSync(tmp, target);
}

// Constant-time, so the key cannot be guessed a character at a time from how
// long a refusal takes.
function key_matches(conv, key) {
  key = String(key || '');
  if (!conv || !KEY.test(key)) { return false; }
  var a = Buffer.from(conv.key, 'utf8');
  var b = Buffer.from(key, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function clean_text(text) {
  return String(text || '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_TEXT);
}

// What the customer's browser is allowed to see: never the key back, never
// the email (they typed it, they know it), never internal flags.
function public_view(conv) {
  return {
    id: conv.id,
    name: conv.name,
    messages: conv.messages.map(function (m) {
      return { from: m.from, text: m.text, at: m.at };
    }),
  };
}

module.exports = {

  // A new thread opened by an order. Returns the stored conversation, key and
  // all — the caller passes { id, key } to the browser exactly once.
  create: function (opts) {
    var now = new Date().toISOString();
    var conv = {
      id: crypto.randomBytes(8).toString('hex'),
      key: crypto.randomBytes(24).toString('hex'),
      name: String(opts.name || '').slice(0, 120),
      email: String(opts.email || '').slice(0, 200),
      locale: opts.locale || '',
      // Where and on what the order was placed, resolved at that moment (the
      // geoip database changes over time; the recorded answer is the true one).
      visitor: opts.visitor || null,
      // Every `vid` cookie this customer has written from. Usually one; more
      // when they cleared cookies or came back on another browser that still
      // had the key. The conversations page finds their visits by these.
      vids: opts.vid ? [opts.vid] : [],
      created: now,
      updated: now,
      messages: [{ from: 'customer', text: clean_text(opts.message), at: now }],
    };
    save(conv);
    return conv;
  },

  // The thread for a customer holding { id, key }, or null if the pair does
  // not match a thread (deleted, mistyped, or someone guessing).
  read: function (id, key) {
    var conv = load(id);
    return (key_matches(conv, key) && !conv.deleted) ? public_view(conv) : null;
  },

  // Append a message. `from` is 'customer' (must present the key) or 'shop'
  // (the admin reply, key not needed). `vid` is the customer's visitor cookie,
  // remembered so their visits can be found. Returns the public view, or null
  // when the thread is missing, the key is wrong, or the thread is full.
  add: function (id, from, text, key, vid) {
    var conv = load(id);
    if (!conv) { return null; }
    // A deleted thread takes no more customer messages: an order placed after
    // deleting starts a fresh conversation instead of reviving the old one.
    if (from === 'customer' && (!key_matches(conv, key) || conv.deleted)) { return null; }
    if (conv.messages.length >= MAX_MESSAGES) { return null; }

    text = clean_text(text);
    if (!text) { return null; }

    var now = new Date().toISOString();
    conv.messages.push({ from: from, text: text, at: now });
    conv.updated = now;
    if (from === 'customer' && vid) {
      conv.vids = conv.vids || [];
      if (conv.vids.indexOf(vid) < 0 && conv.vids.length < 20) { conv.vids.push(vid); }
    }
    save(conv);
    return public_view(conv);
  },

  // The customer deleting their own thread. Not removed from disk: it is
  // marked `deleted`, which hides it from the customer (read() and add()
  // treat it as absent) while the conversations page still shows it, marked,
  // with a button to restore it. The customer's browser keeps the key, so a
  // restored thread reappears for them on their next visit.
  // Returns true when the key matched.
  remove: function (id, key) {
    var conv = load(id);
    if (!key_matches(conv, key)) { return false; }
    if (!conv.deleted) {
      conv.deleted = new Date().toISOString();
      save(conv);
    }
    return true;
  },

  // Is the thread for this { id, key } one the customer deleted? Lets the
  // homepage tell "deleted, keep the key in case it is restored" apart from
  // "gone for good, forget the key".
  isDeleted: function (id, key) {
    var conv = load(id);
    return key_matches(conv, key) && !!conv.deleted;
  },

  // The shop undoing a customer's delete, from the conversations page.
  restore: function (id) {
    var conv = load(id);
    if (!conv || !conv.deleted) { return false; }
    delete conv.deleted;
    save(conv);
    return true;
  },

  // Every thread, most recently active first, for the admin page. `waiting`
  // is true when the customer spoke last — those are the ones to answer.
  list: function () {
    var names = [];
    try {
      names = fs.readdirSync(DIR);
    } catch (unusedErr) {
      return [];   // no directory yet: nobody has ordered since this shipped
    }

    var out = [];
    names.forEach(function (n) {
      if (!/\.json$/.test(n)) { return; }
      var conv = load(n.slice(0, -5));
      if (!conv || !conv.messages || !conv.messages.length) { return; }
      out.push({
        id: conv.id,
        name: conv.name,
        email: conv.email,
        locale: conv.locale,
        visitor: conv.visitor || null,
        vids: conv.vids || [],
        created: conv.created,
        updated: conv.updated,
        deleted: conv.deleted || null,
        waiting: !conv.deleted && conv.messages[conv.messages.length - 1].from === 'customer',
        messages: conv.messages,
      });
    });

    out.sort(function (a, b) { return a.updated < b.updated ? 1 : -1; });
    return out;
  },

  MAX_TEXT: MAX_TEXT,
};
