exports.up = function (knex) {
  return knex.schema
    .createTable('quotes', function (table) {
      table.string('id').primary()
      table.string('transactionRequestId', 36)
      table.foreign('transactionRequestId').references('transactionRequestId').inTable('transactions')
      table.string('transactionId')
      table.string('amount').notNullable()
      table.string('amountCurrency', 3).notNullable()
      table.string('feeAmount').nullable()
      table.string('feeCurrency', 3).nullable()
      table.string('commission').nullable()
      table.string('commissionCurrency', 3).nullable()
      table.string('transferAmount').nullable()
      table.string('transferAmountCurrency', 3).nullable()
      table.string('expiration').nullable()
      table.string('condition').nullable()
      table.text('ilpPacket').nullable()
      table.timestamps(true, true)
    })
}
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('quotes')
}
