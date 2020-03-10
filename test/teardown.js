module.exports = async function () {
  await global.__KNEX__.migrate.rollback()
  await global.__KNEX__.destroy()
}
