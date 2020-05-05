import Knex, { Transaction as KnexTransaction } from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'
import { quotesRequestHandler } from '../../src/handlers/quote-request-handler'
import { TransactionState, Transaction, Quote, TransactionFee, LpsMessage, LegacyMessageType } from '../../src/models'
import { Model } from 'objection'
import { ISO0100Factory } from '../factories/iso-messages'
import { ResponseType } from '../../src/types/adaptor-relay-messages'
const knexConfig = require('../../knexfile')
const uuid = require('uuid/v4')

describe('Quote Requests Handler', function () {
  const dbConfig = process.env.DB_CONFIG || 'sqlite'
  const knex = Knex(knexConfig[dbConfig])
  let trx: KnexTransaction
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

  test('creates quote for transaction', async () => {
    const transaction = await Transaction.query().insertGraph({ ...transactionInfo, expiration: new Date(Date.now() + 10000).toUTCString() })
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionRequestId: transactionInfo.transactionRequestId,
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
    const transaction = await Transaction.query().insertGraph({ ...transactionInfo, expiration: new Date(Date.now() + 10000).toUTCString() })
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionRequestId: transactionInfo.transactionRequestId,
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
        expiration: new Date(Date.now() + 10000).toUTCString(),
        fees: [{
          type: 'lps',
          amount: '1',
          currency: 'USD'
        }]
      })
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionRequestId: transactionInfo.transactionRequestId,
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
    await Transaction.query().insertGraph({ ...transactionInfo, expiration: new Date(Date.now() + 10000).toUTCString() })
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionRequestId: transactionInfo.transactionRequestId,
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
    await Transaction.query().insertGraph({ ...transactionInfo, expiration: new Date(Date.now() + 10000).toUTCString() })
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionRequestId: transactionInfo.transactionRequestId,
      transactionId: transactionInfo.transactionId
    })

    await quotesRequestHandler(services, quoteRequest, headers)
    expect(services.mojaClient.putQuotes).toHaveBeenCalled()
  })

  test('updates transaction state to quoteResponded', async () => {
    let transaction = await Transaction.query().insertGraph({ ...transactionInfo, expiration: new Date(Date.now() + 10000).toUTCString() })
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionRequestId: transactionInfo.transactionRequestId,
      transactionId: transactionInfo.transactionId
    })

    await quotesRequestHandler(services, quoteRequest, headers)

    transaction = await transaction.$query()
    expect(transaction.state).toEqual(TransactionState.quoteResponded)
    expect(transaction.previousState).toEqual(TransactionState.transactionResponded)
  })

  test('sends a 3301 quote error response if transaction is not valid and queues an invalid transaction message to the LPS', async () => {
    const transaction = await Transaction.query().insertGraph(transactionInfo)
    const legacyAuthRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.authorizationRequest, content: ISO0100Factory.build() })
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyAuthRequest)
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionRequestId: transactionInfo.transactionRequestId,
      transactionId: transactionInfo.transactionId
    })

    await quotesRequestHandler(services, quoteRequest, headers)

    expect(await transaction.$relatedQuery<Quote>('quote')).toBeUndefined()
    expect(services.mojaClient.putQuotes).not.toHaveBeenCalled()
    expect(services.mojaClient.putQuotesError).toHaveBeenCalledWith(quoteRequest.quoteId, { errorInformation: { errorCode: '3301', errorDescription: 'Transaction is no longer valid.' } }, headers['fspiop-source'])
    expect(services.queueService.addToQueue).toHaveBeenCalledWith(transactionInfo.lpsId + 'AuthorizationResponses', { lpsAuthorizationRequestMessageId: legacyAuthRequest.id, response: ResponseType.invalid })
  })

  test('fails if quote request does not have transactionRequestId', async () => {
    const transaction = await Transaction.query().insertGraph(transactionInfo)
    const legacyAuthRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.authorizationRequest, content: ISO0100Factory.build() })
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyAuthRequest)
    const quoteRequest = QuotesPostRequestFactory.build({
      transactionId: transactionInfo.transactionId
    })
    delete quoteRequest.transactionRequestId
    await quotesRequestHandler(services, quoteRequest, headers)

    expect(services.logger.error).toHaveBeenCalledWith(`Quote Request Handler: Failed to process quote request: ${quoteRequest.quoteId} from ${headers['fspiop-source']}. No transactionRequestId given for quoteRequest.`)
  })
})
