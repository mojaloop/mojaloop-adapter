import { Server } from 'hapi'
import { createApp } from '../../src/adaptor'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesIDPutResponse } from '../../src/types/mojaloop'

describe('Quotes Response API', function () {

  let adaptor: Server
  const services = AdaptorServicesFactory.build()

  beforeAll(async () => {
    adaptor = await createApp(services)
  })

  describe('PUT', function () {
    const quoteResponse: QuotesIDPutResponse = {
      transferAmount: {
        amount: '108',
        currency: 'USD'
      },
      expiration: new Date(Date.now() + 10000).toUTCString(),
      ilpPacket: 'test-packet-returned',
      condition: 'test-condition-returned'
    }
    test('returns 200 and adds quotesResponse onto QuoteResponses queue', async () => {
      const response = await adaptor.inject({
        headers: { 'fspiop-source': 'payerFSP', 'fspiop-destination': 'adapter' },
        method: 'PUT',
        url: '/quotes/123',
        payload: quoteResponse
      })
      expect(response.statusCode).toBe(200)
      expect(services.queueService.addToQueue).toHaveBeenCalledWith('QuoteResponses', {
        quoteId: '123',
        quoteResponse: quoteResponse,
        headers: response.request.headers
      })
    })

    test('returns response code 500 upon failure to add to a queue', async () => {
      adaptor.app.queueService.addToQueue = jest.fn().mockImplementationOnce(() => {
        throw new Error('failed')
      })

      const response = await adaptor.inject({
        method: 'PUT',
        url: '/quotes/123',
        payload: quoteResponse
      })

      expect(response.statusCode).toBe(500)
    })
  })
})
