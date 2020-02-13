exports.up = function (knex) {
  return knex.schema
    .createTable('transactions', function (table) {
      table.string('transactionRequestId', 36).primary()
      table.string('transactionId', 36).unique().nullable()
      table.string('lpsKey').notNullable()
      table.string('lpsId').notNullable()
      table.string('state').notNullable()
      table.string('previousState').nullable()
      table.string('amount').notNullable()
      table.string('currency', 3).notNullable()
      table.string('expiration').notNullable()
      table.string('initiator').notNullable()
      table.string('initiatorType').notNullable()
      table.string('scenario').notNullable()
      table.string('originalTransactionId').nullable()
      table.string('refundReason').nullable()
      table.string('authenticationType').notNullable()
      table.timestamps(true, true)
    })
}
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('transactions')
}
