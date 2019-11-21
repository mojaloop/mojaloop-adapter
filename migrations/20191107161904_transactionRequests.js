exports.up = function (knex) {
  return knex.schema
    .createTable('transactions', function (table) {
      table.string('id').primary()
      table.string('transactionRequestId', 36)
      table.string('transactionId').nullable()
      table.string('amount')
      table.string('currency', 3)
      table.string('expiration')
      table.timestamps(true, true)
    })
}
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('transactions')
}
