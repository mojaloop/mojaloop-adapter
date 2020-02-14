import Knex from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'
import { quotesRequestHandler } from '../../src/handlers/quote-request-handler'
import { TransactionState, Transaction, Quote, TransactionFee } from '../../src/models'
import { Model } from 'objection'
const uuid = require('uuid/v4')

describe('Quote Requests Handler', function () {
  let knex: Knex
  const services = AdaptorServicesFactory.build()
  const headers = {
    'fspiop-source': 'payer',
    'fspiop-destination': 'payee'
  }
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
    state: TransactionState.transactionResponded,
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

  test('creates quote for transaction', async () => {
    const transaction = await Transaction.query().insertGraph(transactionInfo)
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionId: transactionInfo.transactionId,
      amount: {
        amount: '100',
        currency: 'USD'
      }
    })

    await quotesRequestHandler(services, quoteRequest, headers)

    const quote = await Quote.query().where({ id: quoteRequest.quoteId }).first().throwIfNotFound()
    expect(quote.id).toBe(quoteRequest.quoteId)
    expect(quote.transactionRequestId).toBe(transaction.transactionRequestId)
    expect(quote.transactionId).toBe(transactionInfo.transactionId)
    expect(quote.amount).toBe('100')
    expect(quote.amountCurrency).toBe('USD')
  })

  test('creates adaptor fee', async () => {
    services.calculateAdaptorFees = jest.fn().mockResolvedValue({ amount: '2', currency: 'USD' })
    const transaction = await Transaction.query().insertGraph(transactionInfo)
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionId: transactionInfo.transactionId,
      amount: {
        amount: '100',
        currency: 'USD'
      }
    })

    await quotesRequestHandler(services, quoteRequest, headers)

    const adaptorFee = await transaction.$relatedQuery<TransactionFee>('fees').where({ type: 'adaptor' }).first()
    expect(adaptorFee.amount).toBe('2')
    expect(adaptorFee.currency).toBe('USD')
  })

  test('quoted fee is sum of adaptor and lps fees', async () => {
    services.calculateAdaptorFees = jest.fn().mockResolvedValue({ amount: '2', currency: 'USD' })
    await Transaction.query().insertGraph(
      {
        ...transactionInfo,
        fees: [{
          type: 'lps',
          amount: '1',
          currency: 'USD'
        }]
      })
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionId: transactionInfo.transactionId,
      amount: {
        amount: '100',
        currency: 'USD'
      }
    })

    await quotesRequestHandler(services, quoteRequest, headers)

    const quote = await Quote.query().where({ id: quoteRequest.quoteId }).first().throwIfNotFound()
    expect(quote.feeAmount).toBe('3')
    expect(quote.feeCurrency).toBe('USD')
    expect(quote.transferAmount).toBe('103')
    expect(quote.transferAmountCurrency).toBe('USD')
  })

  test('uses ilpService to generate condition and ilpPacket', async () => {
    services.ilpService.getQuoteResponseIlp = jest.fn().mockResolvedValue({
      ilpPacket: 'test ilp-packet',
      condition: 'test condition'
    })
    await Transaction.query().insertGraph(transactionInfo)
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionId: transactionInfo.transactionId,
      amount: {
        amount: '100',
        currency: 'USD'
      }
    })

    await quotesRequestHandler(services, quoteRequest, headers)

    const quote = await Quote.query().where({ id: quoteRequest.quoteId }).first().throwIfNotFound()
    expect(services.ilpService.getQuoteResponseIlp).toHaveBeenCalled()
    expect(quote.condition).toBe('test condition')
    expect(quote.ilpPacket).toBe('test ilp-packet')
  })

  test('sends quote response', async () => {
    await Transaction.query().insertGraph(transactionInfo)
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionId: transactionInfo.transactionId
    })

    await quotesRequestHandler(services, quoteRequest, headers)
    expect(services.mojaClient.putQuotes).toHaveBeenCalled()
  })

  test('updates transaction state to quoteResponded', async () => {
    let transaction = await Transaction.query().insertGraph(transactionInfo)
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionId: transactionInfo.transactionId
    })

    await quotesRequestHandler(services, quoteRequest, headers)

    transaction = await transaction.$query()
    expect(transaction.state).toEqual(TransactionState.quoteResponded)
    expect(transaction.previousState).toEqual(TransactionState.transactionResponded)
  })

})
