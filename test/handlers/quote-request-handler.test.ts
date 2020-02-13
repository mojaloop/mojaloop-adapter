import Knex from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'
import { KnexQuotesService } from '../../src/services/quotes-service'
import { Money } from '../../src/types/mojaloop'
import { quotesRequestHandler } from '../../src/handlers/quote-request-handler'
import { TransactionState, Transaction } from '../../src/models'
import { Model } from 'objection'
const uuid = require('uuid/v4')
const Logger = require('@mojaloop/central-services-logger')
Logger.log = Logger.info

describe('Quote Requests Handler', function () {
  let knex: Knex
  const services = AdaptorServicesFactory.build()
  const logger = Logger
  const calculateAdaptorFees = async (amount: Money) => ({ amount: '2', currency: 'USD' })
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
    },
    fees: [{
      type: 'lps',
      amount: '1',
      currency: 'USD'
    }]
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
    services.quotesService = new KnexQuotesService({ knex, ilpSecret: 'secret', logger, calculateAdaptorFees })
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

    const quote = await services.quotesService.get(quoteRequest.quoteId, 'id')
    expect(quote.id).toBe(quoteRequest.quoteId)
    expect(quote.transactionRequestId).toBe(transaction.transactionRequestId)
    expect(quote.transactionId).toBe(transactionInfo.transactionId)
    expect(quote.condition).toBeDefined()
    expect(quote.ilpPacket).toBeDefined()
    expect(quote.amount).toMatchObject({ amount: '100', currency: 'USD' })
    expect(quote.fees).toMatchObject({ amount: '1', currency: 'USD' })
    expect(quote.transferAmount).toMatchObject({ amount: '103', currency: 'USD' })
  })

  test.todo('creates payerFsp and adaptor fees')

  test.todo('quoted fee is sum of adaptor, lps and payerFsp fees')

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
