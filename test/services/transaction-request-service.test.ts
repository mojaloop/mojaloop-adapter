import { KnexTransactionRequestService, TransactionRequest } from '../../src/services/transaction-request-service'
import Knex = require('knex')
import Axios, { AxiosInstance } from 'axios'

describe('Example test', function () {
  let knex: Knex
  let transactionRequestService: KnexTransactionRequestService
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()

  beforeAll(async () => {
    knex = Knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
        supportBigNumbers: true
      },
      useNullAsDefault: true
    })

    transactionRequestService = new KnexTransactionRequestService(knex, fakeHttpClient)
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

  test('can create a transaction request', async () => {
  
    const data : TransactionRequest = {
      
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '9605968739',
        fspId:'BankNrone'
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: '12345678',
          partySubIdOrType: '123450000067890'
        }
      },
      stan : '123456',
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

  const response1 = await transactionRequestService.getById(response.id!)

  expect(response1).toMatchObject({
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
    stan : '123456',
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
})

test('can test a getById request', async () => {
  //
  const data : TransactionRequest = {
    
    payer: {
      partyIdType: 'MSISDN',
      partyIdentifier: '9605968739',
      fspId:'BankNrone'
    },
    payee: {
      partyIdInfo: {
        partyIdType: 'DEVICE',
        partyIdentifier: '12345678',
        partySubIdOrType: '123450000067890'
      }
    },
    stan : '123456',
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
  //TODO: changes inserting with knex
  const response = await transactionRequestService.create(data)

  const response1 = await transactionRequestService.getById(response.id!)

  expect(response1).toMatchObject({
    payer: {
      partyIdType: 'MSISDN',
      partyIdentifier: '9605968739',
      fspId:'BankNrone'
    },
    payee: {
      partyIdInfo: {
        partyIdType: 'DEVICE',
        partyIdentifier: '12345678',
        partySubIdOrType: '123450000067890'
      }
    },
    stan : '123456',
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
  })
  test('can test a Update Payer FspId request', async () => {
    //
    const data : TransactionRequest = {
      
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '9605968739',
        fspId:'BankNrone'

      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: '12345678',
          partySubIdOrType: '123450000067890'
        }
      },
      stan : '123456',
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
    //TODO: changes inserting with knex
    const response = await transactionRequestService.create(data)
    const fspId='New_bank';
    const response1 = await transactionRequestService.updatePayerFspId(response.id!,fspId)
  
    expect(response1).toMatchObject({
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '9605968739',
        fspId:'New_bank'
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: '12345678',
          partySubIdOrType: '123450000067890'
        }
      },
      stan : '123456',
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
    })
})
