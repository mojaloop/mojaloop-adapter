
exports.up = function(knex) {

    return knex.schema
           .createTable('transactionPartiesTable', function (table) {
            table.string('id',10).unsigned().primary()
            table.string('transactionRequestId',10).references('id').inTable('transactionRequests').notNull().onDelete('cascade')
            table.string('type',10)
            table.string('identifierType',10)
            table.string('identifier',10)
            table.string('fspid',10)
            table.string('subIdorType',10)
            table.integer('createdAt')
            table.integer('updatedAt')
           })
  
};

exports.down = function(knex) {

    return knex.schema.dropTableIfExists('transactionPartiesTable')

};
