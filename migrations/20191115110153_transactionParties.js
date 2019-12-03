exports.up = function (knex) {
  return knex.schema
    .createTable('transactionParties', function (table) {
      table.increments('id').unsigned().primary()
      table.string('transactionRequestId')
      table.foreign('transactionRequestId').references('transactionRequestId').inTable('transactions')
      table.string('type')
      table.string('identifierType')
      table.string('identifierValue')
      table.string('fspId').nullable()
      table.string('subIdorType').nullable()
      table.timestamps(true, true)
    })
}
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('transactionParties')
}
