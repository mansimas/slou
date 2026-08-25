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

`.env` is not in the repo. Create one with:

| key        | what it is                                   |
|------------|----------------------------------------------|
| `NODE_ENV` | `development` or `production`                |
| `PORT`     | port to listen on                            |

(Earlier versions also needed `MONGO_URL` / `MONGO_TEST_URL`. MongoDB has
been removed — those keys are no longer read and can be deleted.)


### Reachable URLs

Only two pages are served. Everything else 404s, on purpose.

| URL                 | what                                              |
|---------------------|---------------------------------------------------|
| `/`                 | the shop: product videos, order box, story band   |
| `/orders123`        | unlisted list of submitted orders                 |
| `POST /order`       | the order box posts here (not a page)             |
| `/language/:locale` | language switcher in the header (not a page)      |

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
Log.err(...)                                    // -> logs/errors.log
```

`logs/orders.log` is the **only** record of an order — back it up. It holds
customer names and email addresses, so it is gitignored and must stay off the
repo. `/orders123` renders it via `Log.read_orders()`; the writing and the
parsing sit next to each other in that file, so changing one shows you the
other.

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
