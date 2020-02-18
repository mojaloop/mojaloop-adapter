exports.up = function (knex) {
  return knex.schema
    .createTable('transactionParties', function (table) {
      table.increments('id').unsigned().primary()
      table.string('transactionRequestId', 36)
      table.foreign('transactionRequestId').references('transactionRequestId').inTable('transactions')
      table.string('type').notNullable()
      table.string('identifierType').notNullable()
      table.string('identifierValue').notNullable()
      table.string('fspId').nullable()
      table.string('subIdOrType').nullable()
      table.timestamps(true, true)
    })
}
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('transactionParties')
}
