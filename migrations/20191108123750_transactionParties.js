
exports.up = function(knex) {

    return knex.schema
        .createTable('transactionParties', function (table) {
        table.increments('id').unsigned().primary()
        table.string('transactionRequestId')
        table.string('type')
        table.string('identifierType')
        table.string('identifier')
        table.string('fspid')
        table.string('subIdorType')
        table.timestamps(true, true)
        table.foreign('transactionRequestId').references('id').inTable('transactionRequests')
        
        })
  
};

exports.down = function(knex) {

    return knex.schema.dropTableIfExists('transactionParties')

};
