import { createApp } from '../../src/adaptor'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'

describe('Quotes endpoint', function () {

  const mockServices = AdaptorServicesFactory.build()

  let adaptor: Server
  beforeAll(async () => {
    adaptor = await createApp(mockServices)
  })

  describe('POST', function () {
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
      expect(mockServices.quotesService.sendQuoteResponse).toHaveBeenCalled()
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
      expect(mockServices.quotesService.sendQuoteResponse).toHaveBeenCalledWith(quoteRequest.quoteId, {
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
