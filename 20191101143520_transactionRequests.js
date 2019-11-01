
exports.up = function(knex) {
    return knex.schema
           .createTable('transactionRequests', function (table) {
            table.increments('id','3').unsigned().primary()
            table.string('amount',10)
            table.string('expiration',10)
            table.string('payee',10)
            table.string('payer',10)
            table.string('transactionType',10)
           })
        };

exports.down = function(knex) {
    return knex.schema.dropTableIfExists('transactionRequests')                             
  
};


      
      