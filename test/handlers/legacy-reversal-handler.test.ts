import Knex, { Transaction as KnexTransaction } from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { TransactionState, Transaction, LpsMessage, LegacyMessageType, Quote, Transfers, TransferState, TransactionParty } from '../../src/models'
import { Model } from 'objection'
import { ISO0100Factory } from '../factories/iso-messages'
import { legacyReversalHandler } from '../../src/handlers/legacy-reversals-handler'
import { assertExists } from '../../src/utils/util'
import { QuotesPostRequest } from '../../src/types/mojaloop'
import { ResponseType } from '../../src/types/adaptor-relay-messages'
const knexConfig = require('../../knexfile')
const uuid = require('uuid/v4')

describe('Legacy Reversal Handler', () => {
  const dbConfig = process.env.DB_CONFIG || 'sqlite'
  const knex = Knex(knexConfig[dbConfig])
  let trx: KnexTransaction
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

  test('maps the lpsFinancialRequestMessage and lpsReversalRequestMessage to the original transaction', async () => {
    const originalTransaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
    const lpsMessage = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.financialRequest, content: iso0100 })
    const lpsMessage2 = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
    await originalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsMessage)

    await legacyReversalHandler(services, {
      lpsFinancialRequestMessageId: lpsMessage.id,
      lpsId: 'lps1',
      lpsKey: 'lps1-001-abc',
      lpsReversalRequestMessageId: lpsMessage2.id
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
      lpsFinancialRequestMessageId: lpsMessage.id,
      lpsId: 'lps1',
      lpsKey: 'lps1-001-abc',
      lpsReversalRequestMessageId: lpsMessage2.id
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
      lpsFinancialRequestMessageId: lpsMessage.id,
      lpsId: 'lps1',
      lpsKey: 'lps1-001-abc',
      lpsReversalRequestMessageId: lpsMessage2.id
    })

    expect((await quote.$query()).expiration).toBe(new Date(Date.now()).toUTCString())
  })

  test('does not create a refund transaction if there is no transfer for the original transaction', async () => {
    const originalTransaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
    const lpsMessage = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.financialRequest, content: iso0100 })
    const lpsMessage2 = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
    await originalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsMessage)

    await legacyReversalHandler(services, {
      lpsFinancialRequestMessageId: lpsMessage.id,
      lpsId: 'lps1',
      lpsKey: 'lps1-001-abc',
      lpsReversalRequestMessageId: lpsMessage2.id
    })

    expect(await Transaction.query().where({ scenario: 'REFUND' })).toHaveLength(0)
    expect(services.mojaClient.postTransactionRequests).not.toHaveBeenCalled()
  })

  test('does not create a refund transaction if the transfer was not committed', async () => {
    const originalTransaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
    const lpsMessage = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.financialRequest, content: iso0100 })
    const lpsMessage2 = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
    await originalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsMessage)
    await originalTransaction.$relatedQuery<Transfers>('transfer').insert({ id: 'transfer123', amount: transactionInfo.amount, currency: transactionInfo.currency, quoteId: transactionInfo.quote.id, state: TransferState.aborted, fulfillment: 'fulfillment' })

    await legacyReversalHandler(services, {
      lpsFinancialRequestMessageId: lpsMessage.id,
      lpsId: 'lps1',
      lpsKey: 'lps1-001-abc',
      lpsReversalRequestMessageId: lpsMessage2.id
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
        lpsFinancialRequestMessageId: lpsMessage.id,
        lpsId: 'lps1',
        lpsKey: 'lps1-001-abc',
        lpsReversalRequestMessageId: lpsMessage2.id
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
        lpsFinancialRequestMessageId: lpsMessage.id,
        lpsId: 'lps1',
        lpsKey: 'lps1-001-abc',
        lpsReversalRequestMessageId: lpsMessage2.id
      })

      expect((await quote.$query()).expiration).toBe(new Date(Date.now()).toUTCString())
    })

    test('requests quote for refund', async () => {
      const originalTransaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
      const lpsMessage = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.financialRequest, content: iso0100 })
      const lpsMessage2 = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
      await originalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsMessage)
      const quote = await originalTransaction.$relatedQuery<Quote>('quote').insertAndFetch({ id: 'quote123', transactionId: transactionInfo.transactionId, amount: transactionInfo.amount, amountCurrency: transactionInfo.currency, transferAmount: '101', transferAmountCurrency: 'USD', ilpPacket: 'ilppacket', condition: 'condition', expiration: new Date(Date.now() + 10000).toUTCString() })
      await originalTransaction.$relatedQuery<Transfers>('transfer').insert({ id: 'transfer123', amount: transactionInfo.amount, currency: transactionInfo.currency, quoteId: quote.id, state: TransferState.committed, fulfillment: 'fulfillment' })

      await legacyReversalHandler(services, {
        lpsFinancialRequestMessageId: lpsMessage.id,
        lpsId: 'lps1',
        lpsKey: 'lps1-001-abc',
        lpsReversalRequestMessageId: lpsMessage2.id
      })

      const transaction = await Transaction.query().where('originalTransactionId', transactionInfo.transactionId).withGraphFetched('[lpsMessages, quote]').first()
      const quoteRequest: QuotesPostRequest = {
        quoteId: assertExists<Quote>(transaction.quote, 'Transaction does not have a quote').id,
        amount: {
          amount: originalTransaction.amount,
          currency: originalTransaction.currency
        },
        amountType: 'RECEIVE',
        payee: assertExists<TransactionParty>(originalTransaction.payer, 'Transaction does not have payer').toMojaloopParty(),
        payer: assertExists<TransactionParty>(originalTransaction.payee, 'Transaction does not have payee').toMojaloopParty(),
        transactionId: assertExists<string>(transaction.transactionId, 'Transaction does not have transactionId'),
        transactionType: {
          initiator: 'PAYER',
          initiatorType: originalTransaction.initiatorType,
          scenario: 'REFUND',
          refundInfo: {
            originalTransactionId: assertExists<string>(originalTransaction.transactionId, 'Transaction does not have transactionId')
          }
        }
      }
      expect(services.mojaClient.postQuotes).toHaveBeenCalledWith(quoteRequest, assertExists<TransactionParty>(originalTransaction.payer, 'Transaction does not have payer').fspId)
    })

    test('prevents replay of reversal advice message and queues approved legacy reversal response', async () => {
      const originalTransaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
      const lpsMessage = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.financialRequest, content: iso0100 })
      const lpsMessage2 = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
      await originalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsMessage)
      await originalTransaction.$relatedQuery<Transfers>('transfer').insert({ id: 'transfer123', amount: transactionInfo.amount, currency: transactionInfo.currency, quoteId: transactionInfo.quote.id, state: TransferState.committed, fulfillment: 'fulfillment' })
      await legacyReversalHandler(services, {
        lpsFinancialRequestMessageId: lpsMessage.id,
        lpsId: 'lps1',
        lpsKey: 'lps1-001-abc',
        lpsReversalRequestMessageId: lpsMessage2.id
      })
      expect(await Transaction.query().resultSize()).toBe(2)
      expect(services.mojaClient.postQuotes).toHaveBeenCalledTimes(1)

      await legacyReversalHandler(services, {
        lpsFinancialRequestMessageId: lpsMessage.id,
        lpsId: 'lps1',
        lpsKey: 'lps1-001-abc',
        lpsReversalRequestMessageId: lpsMessage2.id
      })

      expect(await Transaction.query().resultSize()).toBe(2)
      expect(services.mojaClient.postQuotes).toHaveBeenCalledTimes(1)
      expect(services.queueService.addToQueue).not.toHaveBeenCalled()
    })

    test('queues failed legacy reversal response if refund process fails', async () => {
      const originalTransaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
      const lpsMessage = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.financialRequest, content: iso0100 })
      const lpsMessage2 = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
      await originalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsMessage)
      const quote = await originalTransaction.$relatedQuery<Quote>('quote').insertAndFetch({ id: 'quote123', transactionId: transactionInfo.transactionId, amount: transactionInfo.amount, amountCurrency: transactionInfo.currency, transferAmount: '101', transferAmountCurrency: 'USD', ilpPacket: 'ilppacket', condition: 'condition', expiration: new Date(Date.now() + 10000).toUTCString() })
      await originalTransaction.$relatedQuery<Transfers>('transfer').insert({ id: 'transfer123', amount: transactionInfo.amount, currency: transactionInfo.currency, quoteId: quote.id, state: TransferState.committed, fulfillment: 'fulfillment' })
      services.mojaClient.postQuotes = jest.fn().mockRejectedValue({ message: 'Failed to post quote' })

      await legacyReversalHandler(services, {
        lpsFinancialRequestMessageId: lpsMessage.id,
        lpsId: 'lps1',
        lpsKey: 'lps1-001-abc',
        lpsReversalRequestMessageId: lpsMessage2.id
      })

      expect(services.queueService.addToQueue).toHaveBeenCalledTimes(1)
      expect(services.queueService.addToQueue).toHaveBeenCalledWith('lps1ReversalResponses', { lpsReversalRequestMessageId: lpsMessage2.id, response: ResponseType.invalid })
    })
  })
})
