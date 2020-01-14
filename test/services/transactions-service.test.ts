import { KnexTransactionsService, TransactionRequest, TransactionState } from '../../src/services/transactions-service'
import Axios, { AxiosInstance } from 'axios'
import Knex from 'knex'
import { TransactionRequestFactory } from '../factories/transaction-requests'

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
      lpsId: 'postillion',
      lpsKey: 'postillion:aef-123',
      lpsFee: {
        amount: '1',
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

    const dbTransaction = await knex('transactions').where('transactionRequestId', data.transactionRequestId).first()
    const dbPayer = await knex('transactionParties').where('transactionRequestId', data.transactionRequestId).where('type', 'payer').first()
    const dbPayee = await knex('transactionParties').where('transactionRequestId', data.transactionRequestId).where('type', 'payee').first()

    expect(dbTransaction).toBeDefined()
    expect(dbTransaction).toMatchObject({
      transactionRequestId: 'abs-321',
      lpsFeeAmount: '1',
      lpsFeeCurrency: 'USD',
      lpsId: 'postillion',
      lpsKey: 'postillion:aef-123',
      state: TransactionState.transactionReceived,
      previousState: null,
      amount: '10000',
      currency: 'USD',
      expiration: '1118045717',
      initiator: 'PAYEE',
      initiatorType: 'DEVICE',
      scenario: 'WITHDRAWAL',
      originalTransactionId: null,
      refundReason: null
    })
    expect(dbPayer).toMatchObject({
      transactionRequestId: 'abs-321',
      type: 'payer',
      identifierType: 'MSISDN',
      identifierValue: '2626756253248953583652695656'
    })
    expect(dbPayee).toMatchObject({
      transactionRequestId: 'abs-321',
      type: 'payee',
      identifierType: 'DEVICE',
      identifierValue: 'c0aziflj',
      subIdorType: '3omrp6uaiz5xqio'
    })
    expect(transaction).toMatchObject(data)
  })

  test('can fetch transaction by transactionRequestId', async () => {
    const data: TransactionRequest = {
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
        initiator: 'PAYER',
        initiatorType: 'DEVICE',
        scenario: 'REFUND',
        refundInfo: {
          originalTransactionId: '123'
        }
      },
      lpsId: 'postillion',
      lpsKey: 'postillion:aef-123',
      lpsFee: {
        amount: '1',
        currency: 'USD'
      },
      authenticationType: 'OTP',
      expiration: '20180328'
    }
    await transactionsService.create(data)

    const transaction = await transactionsService.get(data.transactionRequestId, 'transactionRequestId')

    expect(transaction).toMatchObject({
      ...data,
      state: TransactionState.transactionReceived,
      previousState: null
    })
  })

  test('can update transactionId', async () => {
    const transactionRequest = TransactionRequestFactory.build()
    const transaction = await transactionsService.create(transactionRequest)
    expect(transaction.transactionId).toBeNull()

    await transactionsService.updateTransactionId(transactionRequest.transactionRequestId, 'transactionRequestId', '1234')

    const freshTransaction = await transactionsService.get(transactionRequest.transactionRequestId, 'transactionRequestId')
    expect(freshTransaction.transactionId).toBe('1234')
  })

  test('can update Payer FspId', async () => {
    const transactionRequest = TransactionRequestFactory.build()
    const transaction = await transactionsService.create(transactionRequest)
    expect(transaction.payer.fspId).toBeNull()
    const fspId = 'New_bank'

    await transactionsService.updatePayerFspId(transactionRequest.transactionRequestId, 'transactionRequestId', fspId)

    const freshTransaction = await transactionsService.get(transactionRequest.transactionRequestId, 'transactionRequestId')
    expect(freshTransaction.payer.fspId).toBe('New_bank')
  })

  test('can update transaction state', async () => {
    const transaction = await transactionsService.create(TransactionRequestFactory.build())
    expect(transaction.state).toBe(TransactionState.transactionReceived)
    expect(transaction.previousState).toBeNull()

    const updatedTransaction = await transactionsService.updateState(transaction.transactionRequestId, 'transactionRequestId', TransactionState.authSent)

    expect(updatedTransaction.state).toBe(TransactionState.authSent)
    expect(updatedTransaction.previousState).toBe(TransactionState.transactionReceived)
  })

  describe('getByLpsKeyAndState', () => {
    test('can get by lpsKey and state', async () => {
      const transactionRequest = TransactionRequestFactory.build()
      const transaction = await transactionsService.create(transactionRequest)

      const transactiondb = await transactionsService.getByLpsKeyAndState(transaction.lpsKey, transaction.state)

      expect(transaction).toStrictEqual(transactiondb)
    })

    test('throws error if no transaction is found', async () => {
      await expect(transactionsService.getByLpsKeyAndState('somekey', TransactionState.authRecieved)).rejects.toThrow()
    })
  })

  describe('getByPayerMsisdn', () => {
    test('can get most recent transaction with transactionReceived state by MSISDN', async () => {
      const transactionRequest1 = TransactionRequestFactory.build({
        payer: {
          partyIdType: 'MSISDN',
          partyIdentifier: '987654321'
        }
      })
      const transaction1 = await transactionsService.create(transactionRequest1)
      await transactionsService.updateState(transaction1.transactionRequestId, 'transactionRequestId', TransactionState.transactionReceived)
      await knex('transactions').where('transactionRequestId', transaction1.transactionRequestId).first().update('created_at', '2020-01-09 14:41:02')
      const transactionRequest2 = TransactionRequestFactory.build({
        payer: {
          partyIdType: 'MSISDN',
          partyIdentifier: '987654321'
        }
      })
      await transactionsService.create(transactionRequest2)
      const transaction2 = await transactionsService.updateState(transactionRequest2.transactionRequestId, 'transactionRequestId', TransactionState.transactionReceived)
      await knex('transactions').where('transactionRequestId', transaction2.transactionRequestId).first().update('created_at', '2020-01-09 14:41:10')

      const transaction = await transactionsService.getByPayerMsisdn('987654321')

      expect(transaction).toMatchObject(transaction2)
    })

    test('throws error if no transaction is found', async () => {
      const transactionRequest = TransactionRequestFactory.build({
        payer: {
          partyIdType: 'MSISDN',
          partyIdentifier: '987654321'
        }
      })
      const transaction = await transactionsService.create(transactionRequest)
      await transactionsService.updateState(transaction.transactionRequestId, 'transactionRequestId', TransactionState.transactionSent)
      await expect(transactionsService.getByPayerMsisdn('987654321')).rejects.toThrow()

    })

    test('test for find incomplete transactions', async () => {

      const transaction = await transactionsService.create(TransactionRequestFactory.build())
      const incompleteTransaction = await transactionsService.findIncompleteTransactions(transaction.lpsKey)
      if (incompleteTransaction != null) {
        expect(incompleteTransaction.state).not.toBe(TransactionState.transactionCancelled)
        expect(incompleteTransaction.state).not.toBe(TransactionState.transactionDeclined)
        expect(incompleteTransaction.state).not.toBe(TransactionState.transactionResponded)

      }
    })
  })
})
