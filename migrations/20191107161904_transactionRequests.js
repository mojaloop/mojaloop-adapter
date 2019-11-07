
exports.up = function(knex) {
    return knex.schema
           .createTable('transactionRequests', function (table) {
            table.string('id',10).unsigned().primary()
            table.string('transactionId',10)
            table.string('stan',10)
            table.string('amount',10)
            table.string('currency',3)
            table.integer('expiration')
            table.integer('createdAt')
            table.integer('updatedAt')
           })
        };

exports.down = function(knex) {
    return knex.schema.dropTableIfExists('transactionRequests')                             
  
};


      
      