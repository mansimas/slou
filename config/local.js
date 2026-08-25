/**
 * Local environment settings
 *
 * Use this file to specify configuration settings for use while developing
 * the app on your personal system.
 *
 * For more information, check out:
 * https://sailsjs.com/docs/concepts/configuration/the-local-js-file
 */

module.exports = {

  // Any configuration settings may be overridden below, whether it's built-in Sails
  // options or custom configuration specifically for your app (e.g. Stripe, Sendgrid, etc.)

  // No `port` here on purpose. It lives in config/port.js (1437) so the repo
  // itself carries the number; setting it here as well would override that
  // file invisibly, which is exactly how development ended up on 3000 while
  // production ran on 1437. Use the PORT environment variable for a one-off.

  // The orders page route. This file is tracked, so it deploys with a plain
  // `git pull` like everything else.
  //
  // What matters about it: a visitor must not be able to FIND it from the
  // site. Nothing links to it, it is absent from the nav and the footer, and
  // the page sends `noindex, nofollow` so it stays out of search results.
  //
  // Sails merges this into the routes from config/routes.js — it adds to them,
  // it does not replace them.
  //
  // Change the path by editing the line below; there is nothing else to update.
  routes: {
    'GET /eglei': 'PagesController.orders',
    'GET /estats': 'PagesController.statistics',
  },

};
