import Knex from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { transactionRequestResponseHandler } from '../../src/handlers/transaction-request-response-handler'
import { ErrorInformation } from '../../src/types/mojaloop'
import { TransactionState, Transaction } from '../../src/models'
import { Model } from 'objection'
const uuid = require('uuid/v4')

describe('Transaction Requests Response Handler', function () {

  let knex: Knex
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

  beforeAll(async () => {
    knex = Knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
        supportBigNumbers: true
      },
      useNullAsDefault: true
    })
    Model.knex(knex)
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

  test('updates transactionId if it is present in payload', async () => {
    const transaction = await Transaction.query().insertAndFetch(transactionInfo)

    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, headers, transactionInfo.transactionRequestId)

    expect((await transaction.$query()).transactionId).toBe('456')
  })

  test('updates transaction state to transactionResponded', async () => {
    const transaction = await Transaction.query().insertAndFetch(transactionInfo)

    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, headers, transactionInfo.transactionRequestId)

    expect((await transaction.$query()).state).toBe(TransactionState.transactionResponded)
  })

  test('updates transaction state to transactionCancelled if transactionRequestState is \'REJECTED\'', async () => {
    const transaction = await Transaction.query().insertAndFetch(transactionInfo)

    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'REJECTED' }, headers, transactionInfo.transactionRequestId)

    expect((await transaction.$query()).state).toBe(TransactionState.transactionCancelled)
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
