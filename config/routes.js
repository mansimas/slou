/**
 * Route Mappings
 * (sails.config.routes)
 *
 * Your routes tell Sails what to do each time it receives a request.
 *
 * For more information on configuring custom routes, check out:
 * https://sailsjs.com/anatomy/config/routes-js
 */

module.exports.routes = {

  /***************************************************************************
  *                                                                          *
  * Make the view located at `views/homepage.ejs` your home page.            *
  *                                                                          *
  * (Alternatively, remove this and add an `index.html` file in your         *
  * `assets` directory)                                                      *
  *                                                                          *
  ***************************************************************************/

  //
  // Deliberately only two pages are reachable: the homepage and the unlisted
  // orders list. The other two entries are not pages — they are the homepage's
  // own mechanics (the form it posts to, and the flag links in its header), so
  // taking them out would break the page that is meant to stay up.
  //
  // The product, shipping/returns, privacy and cookie pages are switched off:
  // their actions in PagesController and their views under views/pages/ are
  // left in place, so re-enabling one is a matter of putting its line back.
  //
  '/':                     'PagesController.home',
  'GET /language/:locale': 'PagesController.setLang',
  'POST /order':           'PagesController.createOrder',

  // The orders page is deliberately NOT declared here. This file is committed
  // to a public repository, so any path written in it is published along with
  // it — which would make an unlisted URL guarding customer names and email
  // addresses pointless. It is declared in config/local.js instead, which
  // .gitignore keeps out of the repo.
  //
  // Sails deep-merges config/local.js over this file, so a `routes` block
  // there ADDS to these entries rather than replacing them.
  //
  // Consequence worth knowing: config/local.js is not in the repo, so a fresh
  // clone has no orders page until that file is put on the server.


  /***************************************************************************
  *                                                                          *
  * More custom routes here...                                               *
  * (See https://sailsjs.com/config/routes for examples.)                    *
  *                                                                          *
  * If a request to a URL doesn't match any of the routes in this file, it   *
  * is matched against "shadow routes" (e.g. blueprint routes).  If it does  *
  * not match any of those, it is matched against static assets.             *
  *                                                                          *
  ***************************************************************************/


};
