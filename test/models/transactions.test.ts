import { Model } from 'objection'
import { Transaction, TransactionState } from '../../src/models'
import Knex = require('knex')
const uuid = require('uuid/v4')

describe('Transactions', () => {

  let knex: Knex

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

  test('updateState sets the previousState to state and then state to the specified state', async () => {
    const transaction = await Transaction.query().insertGraph(transactionInfo)

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
