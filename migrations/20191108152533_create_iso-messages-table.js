
exports.up = function (knex, Promise) {
  return knex.schema
    .createTable('isoMessages', function (table) {
      table.increments('id').unsigned().primary()
      table.string('transactionRequest') // TODO: turn in to foreign key once transactionRequests table is finished.
      table.string('mti')
      table.string('stan')
      table.jsonb('content').notNullable()
      table.timestamps(true, true)
    })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('isoMessages')
}
