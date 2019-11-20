exports.up = function (knex) {
  return knex.schema
    .createTable('transactionRequests', function (table) {
      table.string('id', 36).primary()
      table.string('transactionId')
      table.string('stan')
      table.string('amount')
      table.string('currency', 3)
      table.integer('expiration')
      table.timestamps(true, true)
    })
}
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('transactionRequests')
}
