exports.up = function (knex) {
  return knex.schema
    .createTable('transactionFees', function (table) {
      table.increments('id').unsigned().primary()
      table.string('transactionRequestId', 36)
      table.foreign('transactionRequestId').references('transactionRequestId').inTable('transactions')
      table.string('type').notNullable()
      table.string('amount').notNullable()
      table.string('currency', 3).notNullable()
      table.timestamps(true, true)
    })
}
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('transactionFees')
}
