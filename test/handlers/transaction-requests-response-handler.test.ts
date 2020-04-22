import Knex, { Transaction as KnexTransaction } from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { transactionRequestResponseHandler } from '../../src/handlers/transaction-request-response-handler'
import { ErrorInformation } from '../../src/types/mojaloop'
import { TransactionState, Transaction, Quote } from '../../src/models'
import { Model } from 'objection'
const knexConfig = require('../../knexfile')
const uuid = require('uuid/v4')

describe('Transaction Requests Response Handler', function () {

  const dbConfig = process.env.DB_CONFIG || 'sqlite'
  const knex = Knex(knexConfig[dbConfig])
  let trx: KnexTransaction
  const services = AdaptorServicesFactory.build()
  const headers = {
    'fspiop-source': 'payer',
    'fspiop-destination': 'payee'
  }
  const transactionInfo = {
    lpsId: 'lps1',
    lpsKey: 'lps1-001-abc',
    transactionRequestId: uuid(),
    initiator: 'PAYEE',
    initiatorType: 'DEVICE',
    scenario: 'WITHDRAWAL',
    amount: '100',
    currency: 'USD',
    state: TransactionState.transactionReceived,
    expiration: new Date(Date.now()).toUTCString(),
    authenticationType: 'OTP'
  }
  const transactionRefundInfo = {
    lpsId: 'lps1',
    lpsKey: 'lps1-001-abc',
    transactionRequestId: uuid(),
    initiator: 'PAYEE',
    initiatorType: 'DEVICE',
    scenario: 'REFUND',
    amount: '100',
    currency: 'USD',
    state: TransactionState.transactionReceived,
    expiration: new Date(Date.now()).toUTCString(),
    authenticationType: 'OTP'
  }

  beforeAll(async () => {
    if (dbConfig === 'sqlite') {      
      await knex.migrate.latest()
    }
  })

  beforeEach(async () => {
    trx = await knex.transaction()
    Model.knex(trx)
  })

  afterEach(async () => {
    await trx.rollback()
    await trx.destroy()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('updates transactionId if it is present in payload', async () => {
    const transaction = await Transaction.query().insertAndFetch({ ...transactionInfo, expiration: new Date(Date.now() + 10000).toUTCString() })

    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, headers, transactionInfo.transactionRequestId)

    expect((await transaction.$query()).transactionId).toBe('456')
  })

  test('updates transaction state to transactionResponded', async () => {
    const transaction = await Transaction.query().insertAndFetch({ ...transactionInfo, expiration: new Date(Date.now() + 10000).toUTCString() })

    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, headers, transactionInfo.transactionRequestId)

    expect((await transaction.$query()).state).toBe(TransactionState.transactionResponded)
  })

  test('updates transaction state to transactionCancelled if transactionRequestState is \'REJECTED\'', async () => {
    const transaction = await Transaction.query().insertAndFetch(transactionInfo)

    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'REJECTED' }, headers, transactionInfo.transactionRequestId)

    expect((await transaction.$query()).state).toBe(TransactionState.transactionCancelled)
  })

  test('initiates quote request if transaction scenario is \'REFUND\' and it is valid', async () => {
    const transaction = await Transaction.query().insertAndFetch({ ...transactionRefundInfo, expiration: new Date(Date.now() + 10000).toUTCString() })

    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, headers, transactionRefundInfo.transactionRequestId)
    const quote = await Quote.query().where('transactionId', '456').first().throwIfNotFound()
    expect(quote).toBeDefined()

    const expected = {
      quoteId: quote.id,
      transactionId: '456',
      transactionRequestId: transaction.transactionRequestId,
      payee: transaction.payer,
      payer: transaction.payee,
      amountType: 'RECEIVE',
      amount: {
        amount: '100',
        currency: 'USD'
      },
      transactionType: {
        scenario: transaction.scenario,
        initiator: transaction.initiator,
        initiatorType: transaction.initiatorType,
        refundInfo: {
          originalTransactionId: transaction.originalTransactionId
        }
      }
    }

    expect(services.mojaClient.postQuotes).toBeCalledWith(expected, headers['fspiop-source'])
  })

  test('doesn\'t initiate quote request for a \'REFUND\' transaction if it is invalid', async () => {
    const transaction = await Transaction.query().insertAndFetch({ ...transactionRefundInfo, state: TransactionState.transactionCancelled })

    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, headers, transactionRefundInfo.transactionRequestId)

    expect((await transaction.$relatedQuery<Quote>('quote').first())).toBeUndefined()
    expect(services.mojaClient.postQuotes).toBeCalledTimes(0)
  })

  test('doesn\'t initiates quote request if transaction scenario is not \'REFUND\'', async () => {
    await Transaction.query().insertAndFetch({ ...transactionInfo, expiration: new Date(Date.now() + 10000).toUTCString() })
    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, headers, transactionInfo.transactionRequestId)
    const quote = await Quote.query().where('transactionId', '456').first()
    expect(quote).toBeUndefined()
    expect(services.mojaClient.postQuotes).toBeCalledTimes(0)
  })

  test('sends error response if it fails to process the message', async () => {
    Transaction.query = jest.fn().mockReturnValue({ update: jest.fn().mockRejectedValue({ message: 'Failed to update transactionId' }) })

    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, headers, transactionInfo.transactionRequestId)

    const errorInformation: ErrorInformation = {
      errorCode: '2001',
      errorDescription: 'Failed to update transactionId'
    }
    expect(services.mojaClient.putTransactionRequestsError).toHaveBeenCalledWith(transactionInfo.transactionRequestId, errorInformation, headers['fspiop-source'])
  })

})
