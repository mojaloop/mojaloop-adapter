import { Model } from 'objection'
import { Transaction } from '../src/models'
import Knex = require('knex')

describe('Example test', function () {
  let knex: Knex

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

  test('creating a model', async () => {
    const transaction = await Transaction.query().insertAndFetch({ state: '01', transactionRequestId: '123', lpsId: 'lps1', lpsKey: 'lps1-001-abc', scenario: 'WITHDRAWAL', initiator: 'PAYEE', initiatorType: 'DEVICE', amount: '100', currency: 'USD', expiration: new Date(Date.now()).toUTCString() })

    expect(transaction.amount).toBe('100')
  })

})
