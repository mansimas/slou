# SLOU

The SLOU storefront — a [Sails v1](https://sailsjs.com) app serving a
single-page shop in seven languages (LT, EN, PT, FR, DE, ES, IT).

There is **no database**. Product data is static config, and orders are
appended to a log file.


### Running it

```
npm install
npm start          # NODE_ENV=production node app.js
```

In production it runs under pm2 as a single fork-mode process on port 1437:

```
pm2 startOrReload ecosystem.config.js
```

Never `pm2 start all` / `pm2 stop all` on this box — the neighbouring apps
(chess 1337, chessarena 1339, gridess 1429, matchess 4005/4006) would go down
with it.

No `.env` and no environment variables are required. The port is 1437 in every
environment (`config/port.js`; override with `PORT`), and there is no database
to point at.

There are no sessions either — the session hook is off in `.sailsrc`. The
chosen language, the only thing this site remembered about a visitor, lives in
a `lang` cookie defined in `config/custom.js`. That keeps express-session's
MemoryStore, which never evicts, from growing with every unique visitor.


### Reachable URLs

Only two pages are served. Everything else 404s, on purpose.

| URL                 | what                                              |
|---------------------|---------------------------------------------------|
| `/`                 | the shop: product videos, order box, story band   |
| `POST /order`       | the order box posts here (not a page)             |
| `/language/:locale` | language switcher in the header (not a page)      |

There is also an unlisted page listing submitted orders, routed in
`config/local.js`. It is unlisted, not protected: nothing on the site links to
it, it is absent from the nav and footer, and it sends `noindex, nofollow` so
it stays out of search results. There is no password on it.

The product, shipping/returns, privacy and cookie pages still exist as
actions in `api/controllers/PagesController.js` and views under
`views/pages/`, but their route lines have been taken out of
`config/routes.js` — putting a line back re-enables that page.

Sails' blueprint API is fully disabled (`config/blueprints.js`), so no
routes exist beyond the ones declared in `config/routes.js`.


### Orders and logging

`api/services/Log.js` is the file logger, ported from the matchess project so
both apps share one on-disk format. Sails globalizes it, so it is `Log`
anywhere in the app.

```js
Log.order('name | email | locale | message');   // -> logs/orders.log
Log.contact(...)                                // -> logs/contacts.log
Log.req(...)                                    // -> logs/requests.log
Log.visit(...)                                  // -> logs/visits.log
Log.blocked(...)                                // -> logs/blocked.log
Log.err(...)                                    // -> logs/errors.log
```

`logs/orders.log` is the **only** record of an order — back it up. It holds
customer names and email addresses, so it is gitignored and must stay off the
repo. The unlisted orders page renders it via `Log.read_orders()`; the writing
and the parsing sit next to each other in that file, so changing one shows you
the other.

### Request logging and bot rejection

`api/services/VisitService.js` (ported from vogames) answers two separate
questions about a request: *who is this* and *should we serve them at all*.
Both are wired up as **middleware** in `config/http.js`, not as policies — a
policy only runs for a request that matched a route, so every probe for a URL
this app does not have, which is the interesting half, would never be seen.

- `botGuard` refuses scanners before any other middleware runs — no session, no
  body parsing, and no `videos`, so a scanner can never pull down 22MB of MP4.
  WordPress/PHP probes are logged to `logs/blocked.log`; no-UA and generic
  HTTP-client fetches (curl, python, scanner toolkits) get a silent 403,
  because they arrive constantly and logging each one just relocates the noise.
- `visitLogger` writes every served request to `logs/requests.log`: IP (via
  `X-Forwarded-For`, so a reverse proxy doesn't mask it), country, browser, OS,
  device, referrer, and whether the UA looks like a bot. Static assets are
  skipped. URLs that don't exist are logged too — that's the point.

Search crawlers (Google, Bing, the AI crawlers) are deliberately **not**
refused, or the shop would drop out of search results. `ALLOW_CRAWLERS` at the
top of the block list in `VisitService.js` makes the rejection absolute if that
is what you want.

A submitted order prints `[ORDER]` to stdout as it lands — the same flattened
line that goes into `orders.log`, plus IP, country and user agent — so a sale
shows up in `pm2 logs` immediately. A submission rejected for missing fields
prints `[ORDER-REJECTED]`, and a failed write prints `[ORDER-FAILED]` to
stderr.

The unlisted orders page additionally prints an `[ORDERS-VISIT]` line to stdout
on every hit — visible live in `pm2 logs` — and appends to `logs/visits.log`.
A referrer other than `-` on those lines means the link exists somewhere it
shouldn't.

Two rules when adding a channel:

- never build a filename from a variable — each distinct filename holds an
  open fd for the life of the process, so an unbounded set of names leaks fds
  until the process hits `EMFILE`. Put the varying value in the line and grep.
- add a function to `Log` rather than calling `do_log()` from a controller, so
  the set of files the app can open stays readable in one place.


### Content and catalogue

- `config/catalog.js` — products, prices, discounts, video filenames
- `config/content.js` — every string on the site, per locale
- `videos/` — 9:16 product clips plus their poster frames
