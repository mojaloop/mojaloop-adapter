exports.up = function (knex) {
  return knex.schema
    .createTable('transactionsLpsMessages', function (table) {
      table.increments('id').unsigned().primary()
      table.string('transactionRequestId', 36)
      table.integer('lpsMessageId')
      table.timestamps(true, true)
    })
}
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('transactionsLpsMessages')
}
