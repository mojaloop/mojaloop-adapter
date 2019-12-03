exports.up = function (knex) {
  return knex.schema
    .createTable('transactions', function (table) {
      table.string('transactionRequestId', 36).primary()
      table.string('transactionId', 36).unique().nullable()
      table.string('lpsKey')
      table.string('lpsId')
      table.string('state')
      table.string('amount')
      table.string('currency', 3)
      table.string('expiration')
      table.string('lpsFeeAmount')
      table.string('lpsFeeCurrency', 3)
      table.timestamps(true, true)
    })
}
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('transactions')
}
