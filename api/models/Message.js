/**
 * Message.js
 *
 * A message submitted through the site: either the popup contact form or the
 * order box on the homepage (see `kind`).
 * Stored in MongoDB (no email is sent — wire up SMTP later if needed).
 */

module.exports = {

  datastore: 'default',

  attributes: {

    name: { type: 'string', required: true, maxLength: 120 },

    // Email rule kept IN SYNC with the front-end `pattern` in the contact
    // modal (views/layouts/slou.ejs) so FE and BE validation match exactly.
    email: {
      type: 'string',
      required: true,
      custom: function (value) {
        return /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(value);
      },
    },

    message: { type: 'string', required: true, maxLength: 4000 },

    // Which site language the visitor used when writing.
    locale: { type: 'string', defaultsTo: 'lt' },

    // 'contact' = popup contact form, 'order' = homepage order box.
    kind: { type: 'string', isIn: ['contact', 'order'], defaultsTo: 'contact' },

  },

};
