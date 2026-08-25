/**
 * Datastores
 * (sails.config.datastores)
 *
 * A set of datastore configurations which tell Sails where to fetch or save
 * data when you execute built-in model methods like `.find()` and `.create()`.
 *
 * This app uses MongoDB via the `sails-mongo` adapter.
 *
 * For more information on configuring datastores, check out:
 * https://sailsjs.com/config/datastores
 */

module.exports.datastores = {

  /***************************************************************************
  *                                                                          *
  * Default MongoDB datastore. Override the connection string per            *
  * environment in config/env/*.js or via the MONGO_URL env variable.        *
  *                                                                          *
  ***************************************************************************/
  default: {
    adapter: 'sails-mongo',
    url: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/slou',
  },

  /***************************************************************************
  *                                                                          *
  * Separate datastore used when NODE_ENV=test so the test suite never       *
  * touches development/production data.                                      *
  *                                                                          *
  ***************************************************************************/
  test: {
    adapter: 'sails-mongo',
    url: process.env.MONGO_TEST_URL || 'mongodb://127.0.0.1:27017/slou-test',
  },

};
