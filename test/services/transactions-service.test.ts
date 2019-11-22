import { KnexTransactionsService, TransactionRequest } from '../../src/services/transactions-service'
import Axios, { AxiosInstance } from 'axios'
import Knex from 'knex'

describe('Transactions Service', function () {
  let knex: Knex
  let transactionsService: KnexTransactionsService
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

    transactionsService = new KnexTransactionsService(knex, fakeHttpClient)
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

    const data: TransactionRequest = {
      id: 'aef-123',
      transactionRequestId: 'abs-321',
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '2626756253248953583652695656'
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: 'c0aziflj',
          partySubIdOrType: '3omrp6uaiz5xqio'
        }
      },
      amount: {
        amount: '10000',
        currency: 'USD'
      },
      transactionType: {
        initiator: 'PAYEE',
        initiatorType: 'DEVICE',
        scenario: 'WITHDRAWAL'
      },
      authenticationType: 'OTP',
      expiration: '1118045717'

    }

    const transaction = await transactionsService.create(data)

    const dbTransaction = await knex('transactions').where('id', data.id).first()
    const dbPayer = await knex('transactionParties').where('transactionPK', data.id).where('type', 'payer').first()
    const dbPayee = await knex('transactionParties').where('transactionPK', data.id).where('type', 'payee').first()

    expect(dbTransaction).toBeDefined()
    expect(dbTransaction).toMatchObject({
      id: 'aef-123',
      transactionRequestId: 'abs-321',
      amount: '10000',
      currency: 'USD',
      expiration: '1118045717'
    })
    expect(dbPayer).toMatchObject({
      transactionPK: 'aef-123',
      type: 'payer',
      identifierType: 'MSISDN',
      identifierValue: '2626756253248953583652695656'
    })
    expect(dbPayee).toMatchObject({
      transactionPK: 'aef-123',
      type: 'payee',
      identifierType: 'DEVICE',
      identifierValue: 'c0aziflj',
      subIdorType: '3omrp6uaiz5xqio'
    })
    expect(transaction).toMatchObject(data)
  })

  test('can fetch transaction by id (unique PK)', async () => {
    const data: TransactionRequest = {
      id: 'aef-123',
      transactionRequestId: 'abc-321',
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '9605968739',
        fspId: 'BankNrone'
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
    await transactionsService.create(data)

    const transaction = await transactionsService.get(data.id, 'id')

    expect(transaction).toMatchObject(data)
  })

  test('can update transactionId', async () => {
    const data: TransactionRequest = {
      id: 'aef-123',
      transactionRequestId: 'abc-321',
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '9605968739',
        fspId: 'BankNrone'
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
    const transaction = await transactionsService.create(data)
    expect(transaction.transactionId).toBeNull()

    await transactionsService.updateTransactionId(data.transactionRequestId, 'transactionRequestId', '1234')

    const freshTransaction = await transactionsService.get('aef-123', 'id')
    expect(freshTransaction.transactionId).toBe('1234')
  })

  test('can update Payer FspId', async () => {
    const data: TransactionRequest = {
      id: 'aef-123',
      transactionRequestId: 'abc-321',
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '9605968739'
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: 'c0aziflj',
          partySubIdOrType: '3omrp6uaiz5xqio'
        }
      },
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
      expiration: '20180328'
    }
    const transaction = await transactionsService.create(data)
    expect(transaction.payer.fspId).toBeNull()
    const fspId = 'New_bank'

    const freshTransaction = await transactionsService.updatePayerFspId(transaction.id, 'id', fspId)

    expect(freshTransaction.payer.fspId).toBe('New_bank')
  })
})
