/**
 * Port
 * (sails.config.port)
 *
 * 1437 is slou's slot on this box, in every environment — the pm2 process,
 * a plain `node app.js`, and a fresh clone all land on the same number. The
 * neighbours: 1337 chess, 1339 chessarena, 1429 gridess, 4005/4006 matchess.
 *
 * This is the ONE place the default lives. It used to sit in config/local.js,
 * which is gitignored: the number was invisible to the repo, so a clone fell
 * back to Sails' own 1337 and development ran on 3000 while production ran on
 * 1437. Anything that needs a different port sets the PORT environment
 * variable (which is what ecosystem.config.js does) rather than editing this.
 */

module.exports.port = process.env.PORT || 1437;
