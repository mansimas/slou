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

    order: [
      'cookieParser',
      'session',
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
