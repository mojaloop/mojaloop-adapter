
exports.up = function (knex, Promise) {
  return knex.schema
    .createTable('lpsMessages', function (table) {
      table.increments('id').unsigned().primary()
      table.string('type').notNullable()
      table.string('lpsKey').notNullable()
      table.string('lpsId').notNullable()
      table.jsonb('content').notNullable()
      table.timestamps(true, true)
    })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('lpsMessages')
}
