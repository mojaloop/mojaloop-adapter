const Knex = require('knex')
const knexConfig = require('../knexfile')

module.exports = async () => {
  const knex = Knex(knexConfig.testing)
  await knex.migrate.rollback()
  await knex.migrate.latest()

  global.__KNEX__ = knex
}
