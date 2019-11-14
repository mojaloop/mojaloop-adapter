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
      
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '9605968739'
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: '12345678',
          partySubIdOrType: '123450000067890'
        }
      },
      amount: {
        amount: '000000010000',
        currency: '840'
      },
      transactionType: {
        initiator: 'PAYEE',
        initiatorType: 'DEVICE',
        scenario: 'WITHDRAWAL'
      },
      authenticationType: 'OTP',
      expiration: '20180328'

    }

  const response = await transactionRequestService.create(data)
  
  expect(response).toEqual({
    payer: {
      partyIdType: 'MSISDN',
      partyIdentifier: '9605968739'
    },
    payee: {
      partyIdInfo: {
        partyIdType: 'DEVICE',
        partyIdentifier: '12345678',
        partySubIdOrType: '123450000067890'
      }
    },
    amount: {
      amount: '000000010000',
      currency: '840'
    },
    transactionType: {
      initiator: 'PAYEE',
      initiatorType: 'DEVICE',
      scenario: 'WITHDRAWAL'
    },
    authenticationType: 'OTP',
    expiration: '20180328'
})
  //**************** */

   // const response1 = await transactionRequestService.getById(1)
  //  console.log('response' + response1)
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
