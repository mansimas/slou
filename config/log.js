/**
 * Built-in Log Configuration
 * (sails.config.log)
 *
 * Configure the log level for your app, as well as the transport
 * (Underneath the covers, Sails uses Winston for logging, which
 * allows for some pretty neat custom transports/adapters for log messages)
 *
 * For more information on the Sails logger, check out:
 * https://sailsjs.com/docs/concepts/logging
 */

module.exports.log = {

  /***************************************************************************
  *                                                                          *
  * Valid `level` configs: i.e. the minimum log level to capture with        *
  * sails.log.*()                                                            *
  *                                                                          *
  * The order of precedence for log levels from lowest to highest is:        *
  * silly, verbose, info, debug, warn, error                                 *
  *                                                                          *
  * You may also set the level to "silent" to suppress all logs.             *
  *                                                                          *
  ***************************************************************************/

  // Only warnings and errors from Sails itself.
  //
  // Sails prints its startup banner — the ASCII ship, the rule, the timestamp,
  // Environment, Port — with bare `sails.log(...)` calls (lib/app/lift.js),
  // which is captains-log's DEBUG level. That was ~10 lines on every restart.
  //
  // 'warn' is the setting that removes them, not 'info'. captains-log ranks
  // levels npm-style, where debug (3) sits ABOVE info (2) — see logLevels in
  // captains-log/lib/defaults.js and the gate in lib/write.js — so 'info'
  // shows debug as well, and is the default in any case.
  //
  // The cost is that `Server lifted in ...` goes quiet too. What this does NOT
  // touch is the app's own output: [ORDER] and friends are console.log calls
  // in the controller, not sails.log, so orders still print. That is the point
  // — stdout becomes the order feed and nothing else.
  level: 'warn',

  // Send `debug` to stdout instead of stderr.
  //
  // captains-log's built-in logger routes crit, error AND debug to
  // console.error ("emulate winston's output stream conventions",
  // captains-log/lib/captains.js), and Sails prints its whole lift banner —
  // the rule, the timestamp, Environment, Port — at debug level. pm2 sends
  // stderr to <app>-error.log, so every restart wrote a banner into the error
  // log and made a clean start look like a failure.
  //
  // Only the stream mapping changes; levels and filtering are untouched. crit
  // and error stay on stderr, so `pm2 logs --err` shows the things that are
  // actually wrong and nothing else.
  custom: {
    // `log` is not optional: captains-log validates the override with
    // `_.isFunction(logger.log)` and throws without it, even though the error
    // it prints talks about `.debug()` (captains-log/index.js:53).
    log: console.log.bind(console),
    crit: console.error.bind(console),
    error: console.error.bind(console),
    warn: console.log.bind(console),
    debug: console.log.bind(console),
    info: console.log.bind(console),
    verbose: console.log.bind(console),
    silly: console.log.bind(console),
    blank: console.log.bind(console),
  },

};
