module.exports = async function () {
  const dbConfig = process.env.DB_CONFIG || 'sqlite'
  if (dbConfig !== 'sqlite') {
    await global.__KNEX__.migrate.rollback()
    await global.__KNEX__.destroy()
  }
}
