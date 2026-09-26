/**
 * Seed Function
 * (sails.config.bootstrap)
 *
 * A function that runs just before your Sails app gets lifted.
 * > Need more flexibility?  You can also create a hook.
 *
 * For more information on seeding your app with fake data, check out:
 * https://sailsjs.com/config/bootstrap
 */

module.exports.bootstrap = async function() {

  // "lifted on Master", the same line matchess prints, so a start is visibly
  // a start. Printed on 'lifted' — after the port is bound, not merely when
  // bootstrap runs — so seeing it means the site really answers. console.log
  // rather than sails.log so no log level can hide it.
  sails.on('lifted', function () {
    console.log('lifted on Master  ->  http://localhost:' + sails.config.port);
  });

};
