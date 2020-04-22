import Knex, { Transaction as KnexTransaction } from 'knex'
import { Model } from 'objection'
import { Transaction, TransactionState } from '../../src/models'
const knexConfig = require('../../knexfile')
const uuid = require('uuid/v4')

describe('Transactions', () => {

  const dbConfig = process.env.DB_CONFIG || 'sqlite'
  const knex = Knex(knexConfig[dbConfig])
  let trx: KnexTransaction

  const transactionInfo = {
    lpsId: 'lps1',
    lpsKey: 'lps1-001-abc',
    transactionRequestId: uuid(),
    transactionId: uuid(),
    initiator: 'PAYEE',
    initiatorType: 'DEVICE',
    scenario: 'WITHDRAWAL',
    amount: '100',
    currency: 'USD',
    state: TransactionState.quoteResponded,
    previousState: TransactionState.quoteReceived,
    expiration: new Date(Date.now()).toUTCString(),
    authenticationType: 'OTP',
    payer: {
      type: 'payer',
      identifierType: 'MSISDN',
      identifierValue: '0821234567',
      fspId: 'mojawallet'
    },
    payee: {
      type: 'payee',
      identifierType: 'DEVICE',
      identifierValue: '1234',
      subIdOrType: 'abcd',
      fspId: 'adaptor'
    }
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

  test('updateState sets the previousState to state and then state to the specified state', async () => {
    const transaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
    await transaction.$query().modify('updateState', TransactionState.fulfillmentSent)

    const freshTransaction = await transaction.$query()
    expect(freshTransaction.previousState).toBe(transactionInfo.state)
    expect(freshTransaction.state).toBe(TransactionState.fulfillmentSent)
  })

  test('isValid returns false if state is cancelled', async () => {
    const transaction = await Transaction.query().insertGraphAndFetch({ ...transactionInfo, expiration: new Date(Date.now() + 1000).toUTCString(), state: TransactionState.transactionCancelled })

    expect(transaction.isValid()).toBe(false)
  })

  test('isValid returns false if state is declined', async () => {
    const transaction = await Transaction.query().insertGraphAndFetch({ ...transactionInfo, expiration: new Date(Date.now() + 1000).toUTCString(), state: TransactionState.transactionDeclined })

    expect(transaction.isValid()).toBe(false)
  })

  test('isValid returns false if the transaction has expired', async () => {
    const transaction = await Transaction.query().insertGraphAndFetch({ ...transactionInfo, expiration: new Date(Date.now() - 1000).toUTCString() })

    expect(transaction.isValid()).toBe(false)
  })

  test('isValid returns true if the transaction is not cancelled or declined and is not expired', async () => {
    const transaction = await Transaction.query().insertGraphAndFetch({ ...transactionInfo, state: TransactionState.transactionReceived, expiration: new Date(Date.now() + 1000).toUTCString() })

    expect(transaction.isValid()).toBe(true)
  })
})
