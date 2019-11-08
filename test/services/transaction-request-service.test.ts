import { KnexTransactionRequestService, TransactionRequest } from '../../src/services/transaction-request-service'
import Knex = require('knex')

describe('Example test', function () {
  let knex: Knex
  let transactionRequestService: KnexTransactionRequestService

  beforeAll(async () => {
    knex = Knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
        supportBigNumbers: true
      },
      useNullAsDefault: true
    })

    transactionRequestService = new KnexTransactionRequestService(knex)
  })

  beforeEach(async () => {
    await knex.migrate.latest()
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('can create a transaction request',async () => {
  
    const data : Partial<TransactionRequest> = {
      
      id: '1' ,
      transactionId: '456' ,
      stan: '123456' ,
      amount: '200' ,
      currency: 'INR' ,
      expiration: 1 ,
      createdAt: 1,
      updatedAt: 1 

    }
    
  //  const response = await transactionRequestService.create(data)
  //  expect(response).toEqual({
  //   amount:'100',
  //   expiration: 'test',
  //   id:1,
  //   payee:'payee',
  //   payer: 'payer',
  //  transactionType: '10'  
    
  //  })
  //**************** */
  const response = await transactionRequestService.create(data)
  
  expect(response).toEqual({
   id: '1' ,
   transactionId: '456' ,
   stan: '123456' ,
   amount: '200' ,
   currency: 'INR' ,
   expiration: 1 ,
   createdAt: 1 ,
   updatedAt: 1
})
  //**************** */

    const response1 = await transactionRequestService.getById(1)
    console.log('response' + response1)
  //    expect(response).toEqual({
  //     amount:'100',
  //     expiration: 'test',
  //     id:1,
  //     payee:'payee',
  //     payer: 'payer',
  //    transactionType: '10' 
  //   })

  })
})
