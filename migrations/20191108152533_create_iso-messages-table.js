
exports.up = function (knex, Promise) {
  return knex.schema
    .createTable('isoMessages', function (table) {
      table.increments('id').unsigned().primary()
      table.string('transactionRequestId')
      table.foreign('transactionRequestId').references('transactionRequestId').inTable('transactions')
      table.string('mti')
      table.string('lpsKey')
      table.string('lpsId')
      table.jsonb('content').notNullable()
      table.timestamps(true, true)
    })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('isoMessages')
}
