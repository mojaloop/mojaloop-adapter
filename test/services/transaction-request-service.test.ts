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
        partyIdentifier: '2626756253248953583652695656',
        fspId:'BankNrone'
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: 'c0aziflj',
          partySubIdOrType: '3omrp6uaiz5xqio'
        }
      },
      stan : '123456',
      amount: {
        amount: '000000010000',
        currency: '820'
      },
      transactionType: {
        initiator: 'PAYEE',
        initiatorType: 'DEVICE',
        scenario: 'WITHDRAWAL'
      },
      authenticationType: 'OTP',
      expiration: '1118045717'

    }

  const response = await transactionRequestService.create(data)

  const response1 = await transactionRequestService.getById(response.id!)

  expect(response1).toMatchObject({
    payer: {
      partyIdType: 'MSISDN',
      partyIdentifier: '2626756253248953583652695656',
      fspId:'BankNrone'
    },
    payee: {
      partyIdInfo: {
        partyIdType: 'DEVICE',
        partyIdentifier: 'c0aziflj',
        partySubIdOrType: '3omrp6uaiz5xqio'
      }
    },
    stan : '123456',
    amount: {
      amount: '000000010000',
      currency: '820'
    },
    transactionType: {
      initiator: 'PAYEE',
      initiatorType: 'DEVICE',
      scenario: 'WITHDRAWAL'
    },
    authenticationType: 'OTP',
    expiration: '1118045717'

  })
})

test('can test a getById request', async () => {
  //
  const data : TransactionRequest = {
    
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '2626756253248953583652695656',
        fspId:'BankNrone'
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: 'c0aziflj',
          partySubIdOrType: '3omrp6uaiz5xqio'
        }
      },
      stan : '123456',
      amount: {
        amount: '000000010000',
        currency: '820'
      },
      transactionType: {
        initiator: 'PAYEE',
        initiatorType: 'DEVICE',
        scenario: 'WITHDRAWAL'
      },
      authenticationType: 'OTP',
      expiration: '1118045717'

    }
  //TODO: changes inserting with knex
  const response = await transactionRequestService.create(data)

  const response1 = await transactionRequestService.getById(response.id!)

  expect(response1).toMatchObject({
    payer: {
      partyIdType: 'MSISDN',
      partyIdentifier: '2626756253248953583652695656',
      fspId:'BankNrone'
    },
    payee: {
      partyIdInfo: {
        partyIdType: 'DEVICE',
        partyIdentifier: 'c0aziflj',
        partySubIdOrType: '3omrp6uaiz5xqio'
      }
    },
    stan : '123456',
    amount: {
      amount: '000000010000',
      currency: '820'
    },
    transactionType: {
      initiator: 'PAYEE',
      initiatorType: 'DEVICE',
      scenario: 'WITHDRAWAL'
    },
    authenticationType: 'OTP',
    expiration: '1118045717'

  })
  })
  test('can test a Update Payer FspId request', async () => {
    //
    const data : TransactionRequest = {
      
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '2626756253248953583652695656',
        fspId:'BankNrone'
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: 'c0aziflj',
          partySubIdOrType: '3omrp6uaiz5xqio'
        }
      },
      stan : '123456',
      amount: {
        amount: '000000010000',
        currency: '820'
      },
      transactionType: {
        initiator: 'PAYEE',
        initiatorType: 'DEVICE',
        scenario: 'WITHDRAWAL'
      },
      authenticationType: 'OTP',
      expiration: '1118045717'
  
    }
    //TODO: changes inserting with knex
    const response = await transactionRequestService.create(data)
    const fspId='New_bank';
    const response1 = await transactionRequestService.updatePayerFspId(response.id!,fspId)
  
    expect(response1).toMatchObject({
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '2626756253248953583652695656',
        fspId:'New_bank'
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: 'c0aziflj',
          partySubIdOrType: '3omrp6uaiz5xqio'
        }
      },
      stan : '123456',
      amount: {
        amount: '000000010000',
        currency: '820'
      },
      transactionType: {
        initiator: 'PAYEE',
        initiatorType: 'DEVICE',
        scenario: 'WITHDRAWAL'
      },
      authenticationType: 'OTP',
      expiration: '1118045717'
  
    })
    })
    test('can test a Update  TransactionId request', async () => {
      //
      const data : TransactionRequest = {
        
        payer: {
          partyIdType: 'MSISDN',
          partyIdentifier: '2626756253248953583652695656',
          fspId:'BankNrone'
        },
        payee: {
          partyIdInfo: {
            partyIdType: 'DEVICE',
            partyIdentifier: 'c0aziflj',
            partySubIdOrType: '3omrp6uaiz5xqio'
          }
        },
        stan : '123456',
        transactionId:'null',
        amount: {
          amount: '000000010000',
          currency: '820'
        },
        transactionType: {
          initiator: 'PAYEE',
          initiatorType: 'DEVICE',
          scenario: 'WITHDRAWAL'
        },
        authenticationType: 'OTP',
        expiration: '1118045717'
    
      }
      //TODO: changes inserting with knex
      const response = await transactionRequestService.create(data)
      const transactionId='ffc433da-6459-4e4a-a3ce-14392afef154';
      const response1 = await transactionRequestService.updateTransactionId(response.id!,transactionId)
    
      expect(response1).toMatchObject({
       
        payer: {
          partyIdType: 'MSISDN',
          partyIdentifier: '2626756253248953583652695656',
          fspId:'BankNrone'
        },
        payee: {
          partyIdInfo: {
            partyIdType: 'DEVICE',
            partyIdentifier: 'c0aziflj',
            partySubIdOrType: '3omrp6uaiz5xqio'
          }
        },
        stan : '123456',
        transactionId:'ffc433da-6459-4e4a-a3ce-14392afef154',
        amount: {
          amount: '000000010000',
          currency: '820'
        },
        transactionType: {
          initiator: 'PAYEE',
          initiatorType: 'DEVICE',
          scenario: 'WITHDRAWAL'
        },
        authenticationType: 'OTP',
        expiration: '1118045717'
    
      })
      })
})
