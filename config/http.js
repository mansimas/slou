/**
 * HTTP Server Settings
 * (sails.config.http)
 *
 * Configuration for the underlying HTTP server in Sails.
 * (for additional recommended settings, see `config/env/production.js`)
 *
 * For more information on configuration, check out:
 * https://sailsjs.com/config/http
 */

module.exports.http = {

  /****************************************************************************
  *                                                                           *
  * Sails/Express middleware to run for every HTTP request.                   *
  * (Only applies to HTTP requests -- not virtual WebSocket requests.)        *
  *                                                                           *
  * https://sailsjs.com/documentation/concepts/middleware                     *
  *                                                                           *
  ****************************************************************************/

  middleware: {

    /***************************************************************************
    *                                                                          *
    * Serve the `videos/` folder (project root) at /videos.                    *
    *                                                                          *
    * The clips are committed to the repo and ship with a deploy, but they are *
    * kept out of `assets/` so Sails' asset pipeline does not copy ~63 MB into *
    * .tmp on every lift. `serve-static` is used directly because it handles   *
    * HTTP Range requests, which browsers need in order to stream and seek     *
    * within a video instead of downloading the whole file first.              *
    *                                                                          *
    ***************************************************************************/

    videos: (function _serveVideos() {
      var serveStatic = require('serve-static');
      var path = require('path');
      var PREFIX = '/videos/';
      var serve = serveStatic(path.resolve(__dirname, '..', 'videos'), {
        maxAge: '7d',
        fallthrough: true,
        index: false,
      });

      // Sails runs this for EVERY request rather than mounting it on a path,
      // so serve-static would otherwise look for `videos/videos/<file>`.
      // Strip the prefix before handing over, and restore it on the way out so
      // an unknown file still reaches the Sails router (and its 404 page).
      return function _videosMiddleware(req, res, next) {
        if (req.url.slice(0, PREFIX.length) !== PREFIX) { return next(); }
        var original = req.url;
        req.url = original.slice(PREFIX.length - 1);
        return serve(req, res, function () {
          req.url = original;
          return next();
        });
      };
    })(),

    /***************************************************************************
    *                                                                          *
    * The order in which middleware should be run for HTTP requests.           *
    * (This Sails app's routes are handled by the "router" middleware below.)  *
    *                                                                          *
    ***************************************************************************/

    // Refuse scanners and generic HTTP clients before anything else runs — no
    // session, no body parsing, and crucially no `videos`, so a scanner can
    // never pull down 22MB of MP4. See api/services/VisitService.js for what
    // counts as blockable; search crawlers are deliberately exempt.
    botGuard: (function _botGuard() {
      var VisitService = require('../api/services/VisitService');
      var Log = require('../api/services/Log');

      return function _botGuardMiddleware(req, res, next) {
        // A scanner probe: logged, because these are rare and worth seeing.
        if (VisitService.hostileRequest(req)) {
          Log.blocked('PROBE | ' + VisitService.line(req));
          return res.status(403).send('Forbidden');
        }
        // A no-UA or generic-client fetch: refused silently. These arrive
        // every second or two, and a log line each would just relocate the
        // noise into a file nobody can read.
        if (VisitService.blockedBot(req)) {
          return res.status(403).send('Forbidden');
        }
        return next();
      };
    })(),

    // Every request that gets served, written to logs/requests.log — the
    // homepage, the unlisted orders page, and any URL someone tries that does
    // not exist.
    //
    // This is middleware rather than a policy on purpose: a policy only runs
    // for a request that MATCHED a route, so every probe for a URL this app
    // does not have — the interesting half — would never be seen.
    visitLogger: (function _visitLogger() {
      var VisitService = require('../api/services/VisitService');
      var Log = require('../api/services/Log');

      // Static files are served by the hundred per page view and say nothing
      // about who is visiting; the page request next to them already did.
      var ASSETS = /^\/(videos|images|styles|fonts|js|dependencies)\/|^\/favicon\.ico/;

      return function _visitLoggerMiddleware(req, res, next) {
        var url = req.originalUrl || req.url || '';
        if (!ASSETS.test(url)) {
          try {
            // The visitor id is minted here rather than in a controller so it
            // is assigned on the FIRST request of a visit, whatever that
            // request happened to be.
            var visitor = VisitService.visitorId(req);
            if (visitor.isNew) {
              var cookie = sails.config.custom.visitorCookie;
              res.cookie(cookie.name, visitor.id, cookie.options);
            }
            Log.req(VisitService.line(req, visitor.id));
          } catch (unusedErr) {
            // Logging must never be the reason a page fails to render.
          }
        }
        return next();
      };
    })(),

    order: [
      'botGuard',
      // cookieParser comes BEFORE visitLogger: the logger reads the visitor id
      // off req.cookies, which does not exist until this has run.
      // 'session' is gone — the hook is off in .sailsrc, so naming it here
      // would be a reference to middleware that no longer exists.
      'cookieParser',
      'visitLogger',
      'bodyParser',
      'compress',
      'poweredBy',
      'videos',
      'router',
      'www',
      'favicon',
    ],


    /***************************************************************************
    *                                                                          *
    * The body parser that will handle incoming multipart HTTP requests.       *
    *                                                                          *
    * https://sailsjs.com/config/http#?customizing-the-body-parser             *
    *                                                                          *
    ***************************************************************************/

    // bodyParser: (function _configureBodyParser(){
    //   var skipper = require('skipper');
    //   var middlewareFn = skipper({ strict: true });
    //   return middlewareFn;
    // })(),

  },

};
