import Knex from 'knex'
import Axios from 'axios'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { KnexTransactionsService, TransactionState } from '../../src/services/transactions-service'
import { TransactionRequestFactory } from '../factories/transaction-requests'
import { transactionRequestHandler } from '../../src/handlers/transaction-requests-handler'

jest.mock('uuid/v4', () => () => '123')

describe('Transaction Requests API', function () {

  let knex: Knex
  const services = AdaptorServicesFactory.build()
  const logger = console

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
    await transactionRequestHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, '123')
    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(transaction.transactionId).toBe('456')
  })

  test('updates transaction state to transactionResponded', async () => {
    await transactionRequestHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, '123')
    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(transaction.state).toBe(TransactionState.transactionResponded)
  })

  test('updates transaction state to transactionCancelled if transactionRequestState is \'REJECTED\'', async () => {
    await transactionRequestHandler(services, { transactionId: '456', transactionRequestState: 'REJECTED' }, '123')
    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(transaction.state).toBe(TransactionState.transactionCancelled)
  })

})
