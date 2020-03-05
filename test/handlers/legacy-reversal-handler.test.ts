import Knex from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { TransactionState, Transaction, LpsMessage, LegacyMessageType, Quote, Transfers, TransferState } from '../../src/models'
import { Model } from 'objection'
import { ISO0100Factory } from '../factories/iso-messages'
import { legacyReversalHandler } from '../../src/handlers/legacy-reversals-handler'
const uuid = require('uuid/v4')

describe('Legacy Reversal Handler', () => {
  let knex: Knex
  const services = AdaptorServicesFactory.build()
  const iso0100 = ISO0100Factory.build()

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
    state: TransactionState.authSent,
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
    },
    quote: {
      id: uuid(),
      transferAmount: '107',
      transferAmountCurrency: 'USD',
      amount: '100',
      amountCurrency: 'USD',
      feeAmount: '7',
      feeCurrency: 'USD',
      ilpPacket: 'test-packet',
      condition: 'test-condition',
      expiration: new Date(Date.now() + 10000).toUTCString()
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

  test('maps the lpsFinancialRequestMessage and lpsReversalRequestMessage to the original transaction', async () => {
    const originalTransaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
    const lpsMessage = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.financialRequest, content: iso0100 })
    const lpsMessage2 = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
    await originalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsMessage)

    await legacyReversalHandler(services, {
      lpsFinancialRequestMessageId: '1',
      lpsId: 'lps1',
      lpsKey: 'lps1-001-abc',
      lpsReversalRequestMessageId: '2'
    })

    const transaction = await Transaction.query().where('transactionRequestId', transactionInfo.transactionRequestId).withGraphFetched('lpsMessages').first()
    expect(transaction.lpsMessages).toHaveLength(2)
    expect(transaction.lpsMessages![0]).toEqual(lpsMessage)
    expect(transaction.lpsMessages![1]).toEqual(lpsMessage2)
  })

  test('sets the original transaction state to cancelled', async () => {
    const originalTransaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
    const lpsMessage = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.financialRequest, content: iso0100 })
    const lpsMessage2 = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
    await originalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsMessage)

    await legacyReversalHandler(services, {
      lpsFinancialRequestMessageId: '1',
      lpsId: 'lps1',
      lpsKey: 'lps1-001-abc',
      lpsReversalRequestMessageId: '2'
    })

    expect((await originalTransaction.$query()).state).toBe(TransactionState.transactionCancelled)
    expect((await originalTransaction.$query()).previousState).toBe(originalTransaction.state)
  })

  test('expires quote for the original transaction', async () => {
    Date.now = jest.fn().mockReturnValue(0)
    const originalTransaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
    const lpsMessage = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.financialRequest, content: iso0100 })
    const lpsMessage2 = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
    await originalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsMessage)
    const quote = await originalTransaction.$relatedQuery<Quote>('quote').insertAndFetch({ id: 'quote123', transactionId: transactionInfo.transactionId, amount: transactionInfo.amount, amountCurrency: transactionInfo.currency, transferAmount: '101', transferAmountCurrency: 'USD', ilpPacket: 'ilppacket', condition: 'condition', expiration: new Date(Date.now() + 10000).toUTCString() })

    await legacyReversalHandler(services, {
      lpsFinancialRequestMessageId: '1',
      lpsId: 'lps1',
      lpsKey: 'lps1-001-abc',
      lpsReversalRequestMessageId: '2'
    })

    expect((await quote.$query()).expiration).toBe(new Date(Date.now()).toUTCString())
  })

  test('does not create a refund transaction if there is no transfer for the original transaction', async () => {
    const originalTransaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
    const lpsMessage = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.financialRequest, content: iso0100 })
    const lpsMessage2 = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
    await originalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsMessage)

    await legacyReversalHandler(services, {
      lpsFinancialRequestMessageId: '1',
      lpsId: 'lps1',
      lpsKey: 'lps1-001-abc',
      lpsReversalRequestMessageId: '2'
    })

    expect(await Transaction.query().where({ scenario: 'REFUND' })).toHaveLength(0)
    expect(services.mojaClient.postTransactionRequests).not.toHaveBeenCalled()
  })

  describe('creates a refund transaction if a transfer for the original transaction has occurred', () => {
    test('maps the lpsReversalRequestMessage to the new transaction', async () => {
      const originalTransaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
      const lpsMessage = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.financialRequest, content: iso0100 })
      const lpsMessage2 = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
      await originalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsMessage)
      const quote = await originalTransaction.$relatedQuery<Quote>('quote').insertAndFetch({ id: 'quote123', transactionId: transactionInfo.transactionId, amount: transactionInfo.amount, amountCurrency: transactionInfo.currency, transferAmount: '101', transferAmountCurrency: 'USD', ilpPacket: 'ilppacket', condition: 'condition', expiration: new Date(Date.now() + 10000).toUTCString() })
      await originalTransaction.$relatedQuery<Transfers>('transfer').insert({ id: 'transfer123', amount: transactionInfo.amount, currency: transactionInfo.currency, quoteId: quote.id, state: TransferState.committed, fulfillment: 'fulfillment' })

      await legacyReversalHandler(services, {
        lpsFinancialRequestMessageId: '1',
        lpsId: 'lps1',
        lpsKey: 'lps1-001-abc',
        lpsReversalRequestMessageId: '2'
      })
      const transaction = await Transaction.query().where('originalTransactionId', transactionInfo.transactionId).withGraphFetched('lpsMessages').first()

      expect(transaction.lpsMessages).toHaveLength(1)
      expect(transaction.lpsMessages![0]).toEqual(lpsMessage2)
    })

    test('expires the quote', async () => {
      Date.now = jest.fn().mockReturnValue(0)
      const originalTransaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
      const lpsMessage = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.financialRequest, content: iso0100 })
      const lpsMessage2 = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
      await originalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsMessage)
      const quote = await originalTransaction.$relatedQuery<Quote>('quote').insertAndFetch({ id: 'quote123', transactionId: transactionInfo.transactionId, amount: transactionInfo.amount, amountCurrency: transactionInfo.currency, transferAmount: '101', transferAmountCurrency: 'USD', ilpPacket: 'ilppacket', condition: 'condition', expiration: new Date(Date.now() + 10000).toUTCString() })
      await originalTransaction.$relatedQuery<Transfers>('transfer').insert({ id: 'transfer123', amount: transactionInfo.amount, currency: transactionInfo.currency, quoteId: quote.id, state: TransferState.committed, fulfillment: 'fulfillment' })

      await legacyReversalHandler(services, {
        lpsFinancialRequestMessageId: '1',
        lpsId: 'lps1',
        lpsKey: 'lps1-001-abc',
        lpsReversalRequestMessageId: '2'
      })
      const transaction = await Transaction.query().where('originalTransactionId', transactionInfo.transactionId).withGraphFetched('lpsMessages').first()

      expect((await quote.$query()).expiration).toBe(new Date(Date.now()).toUTCString())
    })
  })
})
