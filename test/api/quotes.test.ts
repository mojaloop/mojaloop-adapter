import Knex from 'knex'
import Axios from 'axios'
import { createApp } from '../../src/adaptor'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'
import { KnexTransactionsService } from '../../src/services/transactions-service'
import { KnexIsoMessageService } from '../../src/services/iso-message-service'
import { KnexQuotesService } from '../../src/services/quotes-service'

describe('Quotes endpoint', function () {
  let knex: Knex
  let adaptor: Server
  const services = AdaptorServicesFactory.build()

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
    services.transactionsService = new KnexTransactionsService(knex, httpClient)
    services.transactionsService.sendToMojaHub = jest.fn().mockResolvedValue(undefined)
    services.isoMessagesService = new KnexIsoMessageService(knex)
    services.quotesService = new KnexQuotesService(knex, httpClient)
    services.quotesService.sendQuoteResponse = jest.fn()
    adaptor = await createApp(services)
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

  describe('POST', function () {

    test('stores quote', async () => {
      const quoteRequest = QuotesPostRequestFactory.build({
        amount: {
          amount: '100',
          currency: 'USD'
        }
      })

      const response = await adaptor.inject({
        method: 'POST',
        url: '/quotes',
        payload: quoteRequest,
        headers: {
          'fspiop-source': 'payer',
          'fspiop-destination': 'payee'
        }
      })

      expect(response.statusCode).toBe(200)
      const quote = await services.quotesService.get(quoteRequest.quoteId, 'id')
      expect(quote.id).toBe(quoteRequest.quoteId)
      expect(quote.condition).toBeDefined()
      expect(quote.feeAmount.amount).toBe('1')
      expect(quote.feeAmount.currency).toBe('USD')
      expect(quote.transferAmount.amount).toBe('101')
      expect(quote.transferAmount.currency).toBe('USD')
    })

    test('makes PUT request to mojaloop quotes endpoint', async () => {
      const quoteRequest = QuotesPostRequestFactory.build()

      const response = await adaptor.inject({
        method: 'POST',
        url: '/quotes',
        payload: quoteRequest,
        headers: {
          'fspiop-source': 'payer',
          'fspiop-destination': 'payee'
        }
      })

      expect(response.statusCode).toBe(200)
      expect(services.quotesService.sendQuoteResponse).toHaveBeenCalled()
    })

    test('adds surcharge', async () => {
      const quoteRequest = QuotesPostRequestFactory.build({
        amount: {
          amount: '100',
          currency: 'USD'
        }
      })
      const amountWithSurcharge = '101'
      Date.now = jest.fn().mockReturnValue(0)

      const response = await adaptor.inject({
        method: 'POST',
        url: '/quotes',
        payload: quoteRequest,
        headers: {
          'fspiop-source': 'payer',
          'fspiop-destination': 'payee'
        }
      })

      expect(response.statusCode).toBe(200)
      expect(services.quotesService.sendQuoteResponse).toHaveBeenCalledWith(quoteRequest.quoteId, {
        condition: 'HOr22-H3AfTDHrSkPjJtVPRdKouuMkDXTR4ejlQa8Ks',
        ilpPacket: 'AQAAAAAAAADIEHByaXZhdGUucGF5ZWVmc3CCAiB7InRyYW5zYWN0aW9uSWQiOiIyZGY3NzRlMi1mMWRiLTRmZjctYTQ5NS0yZGRkMzdhZjdjMmMiLCJxdW90ZUlkIjoiMDNhNjA1NTAtNmYyZi00NTU2LThlMDQtMDcwM2UzOWI4N2ZmIiwicGF5ZWUiOnsicGFydHlJZEluZm8iOnsicGFydHlJZFR5cGUiOiJNU0lTRE4iLCJwYXJ0eUlkZW50aWZpZXIiOiIyNzcxMzgwMzkxMyIsImZzcElkIjoicGF5ZWVmc3AifSwicGVyc29uYWxJbmZvIjp7ImNvbXBsZXhOYW1lIjp7fX19LCJwYXllciI6eyJwYXJ0eUlkSW5mbyI6eyJwYXJ0eUlkVHlwZSI6Ik1TSVNETiIsInBhcnR5SWRlbnRpZmllciI6IjI3NzEzODAzOTExIiwiZnNwSWQiOiJwYXllcmZzcCJ9LCJwZXJzb25hbEluZm8iOnsiY29tcGxleE5hbWUiOnt9fX0sImFtb3VudCI6eyJjdXJyZW5jeSI6IlVTRCIsImFtb3VudCI6IjIwMCJ9LCJ0cmFuc2FjdGlvblR5cGUiOnsic2NlbmFyaW8iOiJERVBPU0lUIiwic3ViU2NlbmFyaW8iOiJERVBPU0lUIiwiaW5pdGlhdG9yIjoiUEFZRVIiLCJpbml0aWF0b3JUeXBlIjoiQ09OU1VNRVIiLCJyZWZ1bmRJbmZvIjp7fX19',
        expiration: new Date(10000).toUTCString(),
        transferAmount: {
          amount: amountWithSurcharge,
          currency: 'USD'
        }
      }, {
        'fspiop-source': 'payee',
        'fspiop-destination': 'payer'
      })
    })
  })

})
