import Knex from 'knex'
import Axios from 'axios'
import { createApp } from '../../src/adaptor'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'
import { KnexTransactionsService, TransactionState } from '../../src/services/transactions-service'
import { KnexIsoMessageService } from '../../src/services/iso-message-service'
import { KnexQuotesService } from '../../src/services/quotes-service'
import { ISO0100Factory } from '../factories/iso-messages'
import { Money } from '../../src/types/mojaloop'
import { quotesRequestHandler } from '../../src/handlers/quotes-handler'
import { transactionRequestResponseHandler } from '../../src/handlers/transaction-request-response-handler'

jest.mock('uuid/v4', () => () => '123')

describe('Quotes Handler', function () {
  let knex: Knex
  let adaptor: Server
  const services = AdaptorServicesFactory.build()
  const LPS_ID = 'postillion'
  let LPS_KEY: string
  const logger = console

  const calculateAdaptorFees = async (amount: Money) => ({ amount: '2', currency: 'USD' })

  const headers = {
    'fspiop-source': 'payer',
    'fspiop-destination': 'payee'
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
    const httpClient = Axios.create()
    services.transactionsService = new KnexTransactionsService({ knex, client: httpClient, logger })
    services.transactionsService.sendToMojaHub = jest.fn().mockResolvedValue(undefined)
    services.isoMessagesService = new KnexIsoMessageService(knex)
    services.quotesService = new KnexQuotesService({ knex, ilpSecret: 'secret', logger, calculateAdaptorFees })
    adaptor = await createApp(services)
  })

  beforeEach(async () => {
    await knex.migrate.latest()
    // send initial transfer request
    const iso0100 = ISO0100Factory.build({
      4: '000000080000', // transaction amount
      28: 'D00000100' // lps fee
    })
    LPS_KEY = `${LPS_ID}-${iso0100[41]}-${iso0100[42]}`
    const response = await adaptor.inject({
      method: 'POST',
      url: '/iso8583/transactionRequests',
      payload: { lpsKey: LPS_KEY, lpsId: LPS_ID, ...iso0100 }
    })
    expect(response.statusCode).toBe(202)
    await transactionRequestResponseHandler(services, { transactionId: '456', transactionRequestState: 'RECEIVED' }, '123')
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  describe('POST', function () {
    test('retrieves transaction using quote requests transactionId', async () => {
      const getTransactionSpy = jest.spyOn(services.transactionsService, 'get')
      const quoteRequest = QuotesPostRequestFactory.build({
        transactionId: '456',
        amount: {
          amount: '100',
          currency: 'USD'
        }
      })

      await quotesRequestHandler(services, quoteRequest, headers)
      expect(getTransactionSpy).toHaveBeenCalledWith('456', 'transactionId')
    })

    test('creates quote with transactionRequestId, lpsFee and adaptor fee', async () => {
      const quoteRequest = QuotesPostRequestFactory.build({
        transactionId: '456',
        amount: {
          amount: '100',
          currency: 'USD'
        }
      })

      await quotesRequestHandler(services, quoteRequest, headers)
      const quote = await services.quotesService.get(quoteRequest.quoteId, 'id')
      expect(quote.id).toBe(quoteRequest.quoteId)
      expect(quote.transactionRequestId).toBe('123')
      expect(quote.transactionId).toBe('456')
      expect(quote.condition).toBeDefined()
      expect(quote.ilpPacket).toBeDefined()
      expect(quote.amount).toMatchObject({ amount: '100', currency: 'USD' })
      expect(quote.fees).toMatchObject({ amount: '1', currency: 'USD' })
      expect(quote.commission).toMatchObject({ amount: '2', currency: 'USD' })
      expect(quote.transferAmount).toMatchObject({ amount: '103', currency: 'USD' })
    })

    test('makes PUT request to mojaloop quotes endpoint', async () => {
      const quoteRequest = QuotesPostRequestFactory.build({
        transactionId: '456'
      })

      await quotesRequestHandler(services, quoteRequest, headers)
      expect(services.mojaClient.putQuotes).toHaveBeenCalled()
    })

    test('updates transaction state to quoteResponded', async () => {
      const quoteRequest = QuotesPostRequestFactory.build({
        transactionId: '456'
      })

      await quotesRequestHandler(services, quoteRequest, headers)
      const transaction = await services.transactionsService.get('456', 'transactionId')
      expect(transaction.state).toEqual(TransactionState.quoteResponded)
    })
  })

})
