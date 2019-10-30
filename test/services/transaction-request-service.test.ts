import { KnexTransactionRequestService } from '../../src/services/transaction-request-service'
import axios, { AxiosInstance } from 'axios'
import Knex = require('knex')

describe('Example test', function () {
  let knex: Knex
  let transactionRequestService: KnexTransactionRequestService
  const fakeHttpClient: AxiosInstance = axios.create()
  fakeHttpClient.post = jest.fn()

  beforeAll(async () => {
    knex = Knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
        supportBigNumbers: true
      }
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

  test.todo('can create a transaction request')

})
