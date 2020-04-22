const Knex = require('knex')
const knexConfig = require('../knexfile')

module.exports = async () => {
  const dbConfig = process.env.DB_CONFIG || 'sqlite'

  if (dbConfig !== 'sqlite') {

    const knex = Knex(knexConfig[dbConfig])
    await knex.migrate.rollback()
    await knex.migrate.latest()

    global.__KNEX__ = knex
  }
}
