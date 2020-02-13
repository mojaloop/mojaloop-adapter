import Knex from 'knex'
import Axios from 'axios'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { KnexTransactionsService } from '../../src/services/transactions-service'
import { TransactionRequestFactory } from '../factories/transaction-requests'
import { transactionRequestResponseHandler } from '../../src/handlers/transaction-request-response-handler'
import { ErrorInformation } from '../../src/types/mojaloop'
import { TransactionState } from '../../src/models'
const Logger = require('@mojaloop/central-services-logger')

jest.mock('uuid/v4', () => () => '123')

describe('Transaction Requests Response Handler', function () {

  let knex: Knex
  const services = AdaptorServicesFactory.build()
  const logger = Logger
  const headers = {
    'fspiop-source': 'payer',
    'fspiop-destination': 'payee'
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
    const httpClient = Axios.create()
    services.transactionsService = new KnexTransactionsService({ knex, client: httpClient, logger })
    services.transactionsService.sendToMojaHub = jest.fn().mockResolvedValue(undefined)
  })

  beforeEach(async () => {
    await knex.migrate.latest()

    const transactionRequest = TransactionRequestFactory.build({ transactionRequestId: '123' })
    await services.transactionsService.create(transactionRequest)
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('updates transactionId if it is present in payload', async () => {
    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, headers, '123')
    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(transaction.transactionId).toBe('456')
  })

  test('updates transaction state to transactionResponded', async () => {
    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, headers, '123')
    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(transaction.state).toBe(TransactionState.transactionResponded)
  })

  test('updates transaction state to transactionCancelled if transactionRequestState is \'REJECTED\'', async () => {
    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'REJECTED' }, headers, '123')
    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(transaction.state).toBe(TransactionState.transactionCancelled)
  })

  test('sends error response if it fails to process the message', async () => {
    services.transactionsService.updateTransactionId = jest.fn().mockImplementationOnce(() => { throw new Error('Failed to update transactionId') })

    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, headers, '123')

    const errorInformation: ErrorInformation = {
      errorCode: '2001',
      errorDescription: 'Failed to update transactionId'
    }
    expect(services.mojaClient.putTransactionRequestsError).toHaveBeenCalledWith('123', errorInformation, headers['fspiop-source'])
  })

})
