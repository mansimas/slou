/**
 * Custom configuration
 * (sails.config.custom)
 *
 * One-off settings specific to your application.
 *
 * For more information on custom configuration, visit:
 * https://sailsjs.com/config/custom
 */

module.exports.custom = {

  // The language cookie. This site keeps no sessions — the chosen language is
  // the only thing it ever remembered about a visitor, and a cookie holds it
  // without a server-side store, a session secret, or MemoryStore's unbounded
  // growth. Read by api/policies/locale.js, written by PagesController.setLang.
  //
  // httpOnly: nothing in the browser reads it, only the server.
  // sameSite lax: it must survive arriving from an external link.
  // No `secure` flag yet — the site is served over plain http on 1437, and a
  // secure cookie would simply never be stored. Add it the day TLS lands.
  // A first-party visitor id, set on the first request and echoed into every
  // line of logs/requests.log. It is what makes "unique visits" mean anything:
  // counting distinct IPs treats a household or an office behind one NAT as a
  // single visitor, and a phone moving between wifi and mobile data as several.
  // The value is random and holds nothing about the person.
  visitorCookie: {
    name: 'vid',
    options: {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    },
  },

  langCookie: {
    name: 'lang',
    options: {
      maxAge: 365 * 24 * 60 * 60 * 1000,   // a year
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    },
  },

  /***************************************************************************
  *                                                                          *
  * Any other custom config this Sails app should use during development.    *
  *                                                                          *
  ***************************************************************************/
  // sendgridSecret: 'SG.fake.3e0Bn0qSQVnwb1E4qNPz9JZP5vLZYqjh7sn8S93oSHU',
  // stripeSecret: 'sk_test_Zzd814nldl91104qor5911gjald',
  // …

};
