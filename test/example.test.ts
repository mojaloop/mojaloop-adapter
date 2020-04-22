import Knex, { Transaction as KnexTransaction } from 'knex'
import { Model } from 'objection'
import { Transaction } from '../src/models'
const knexConfig = require('../knexfile')

describe('Example test', function () {
  const dbConfig = process.env.DB_CONFIG || 'sqlite'
  const knex = Knex(knexConfig[dbConfig])
  let trx: KnexTransaction

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

  test('creating a model', async () => {
    const transaction = await Transaction.query().insertAndFetch({ state: '01', transactionRequestId: '123', lpsId: 'lps1', lpsKey: 'lps1-001-abc', scenario: 'WITHDRAWAL', initiator: 'PAYEE', initiatorType: 'DEVICE', amount: '100', currency: 'USD', expiration: new Date(Date.now()).toUTCString(), authenticationType: 'OTP' })

    expect(transaction.amount).toBe('100')
  })

})
