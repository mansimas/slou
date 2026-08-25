/**
 * User.js
 *
 * A sample model to confirm the MongoDB datastore is wired up correctly.
 * @docs https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {

  datastore: 'default',

  attributes: {

    name: {
      type: 'string',
      required: true,
    },

    email: {
      type: 'string',
      required: true,
      unique: true,
      isEmail: true,
    },

  },

};
