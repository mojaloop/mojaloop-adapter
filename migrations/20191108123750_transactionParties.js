
exports.up = function(knex) {

    return knex.schema
           .createTable('transactionParties', function (table) {
            table.string('id',36).primary()
            table.string('transactionRequestId')
            table.string('type')
            table.string('identifierType')
            table.string('identifier')
            table.string('fspid')
            table.string('subIdorType')
            table.integer('createdAt')
            table.integer('updatedAt')
            table.foreign('transactionRequestId').references('id').inTable('transactionRequests')
            
           })
  
};

exports.down = function(knex) {

    return knex.schema.dropTableIfExists('transactionParties')

};
