import Knex from 'knex'
import Axios from 'axios'
import { Server } from 'hapi'
import { createApp } from '../../src/adaptor'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { KnexTransactionsService } from '../../src/services/transactions-service'
import { TransactionRequestFactory } from '../factories/transaction-requests'

jest.mock('uuid/v4', () => () => '123')

describe('Transaction Requests API', function () {

  let knex: Knex
  let adaptor: Server
  const services = AdaptorServicesFactory.build()

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
    services.transactionsService = new KnexTransactionsService(knex, httpClient)
    services.transactionsService.sendToMojaHub = jest.fn().mockResolvedValue(undefined)
    adaptor = await createApp(services)
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
    const response = await adaptor.inject({
      method: 'PUT',
      url: '/transactionRequests/123',
      payload: { transactionId: '456', transactionRequestState: 'RECEIVED' }
    })

    expect(response.statusCode).toEqual(200)
    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(transaction.transactionId).toBe('456')
  })

})
