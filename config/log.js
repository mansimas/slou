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

  // The normal Sails startup output — "Server lifted", Environment, Port —
  // but without the ASCII ship, the same as matchess. The level is left at
  // Sails' default, so a lift says clearly that it worked and where.
  //
  // It used to be 'warn', which hid "Server lifted" too and left a bare
  // "Starting app..." that looked exactly like a hang.
  //
  // The app's own output ([ORDER], [MESSAGE] and friends) is console.log in
  // the controller, not sails.log, so it prints whatever this is set to.
  noShip: true,

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
