
exports.up = function (knex) {
  return knex.schema
    .createTable('transfers', function (table) {
      table.string('id').primary()
      table.string('quoteId')
      table.foreign('quoteId').references('id').inTable('quotes')
      table.string('transactionRequestId', 36)
      table.foreign('transactionRequestId').references('transactionRequestId').inTable('transactions')
      table.string('fulfillment').notNullable()
      table.string('state')
      table.string('amount').notNullable()
      table.string('currency', 3).notNullable()
    })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('transfers')
}
