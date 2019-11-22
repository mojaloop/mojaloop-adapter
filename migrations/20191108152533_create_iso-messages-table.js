
exports.up = function (knex, Promise) {
  return knex.schema
    .createTable('isoMessages', function (table) {
      table.increments('id').unsigned().primary()
      table.string('transactionPK')
      table.foreign('transactionPK').references('id').inTable('transactions')
      table.string('mti')
      table.string('lpsKey')
      table.string('switchKey')
      table.jsonb('content').notNullable()
      table.timestamps(true, true)
    })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('isoMessages')
}
