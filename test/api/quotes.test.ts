import { createApp } from '../../src/adaptor'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'

describe('Quotes endpoint', function () {
  let adaptor: Server
  const services = AdaptorServicesFactory.build()
  const quoteRequest = QuotesPostRequestFactory.build()

  beforeAll(async () => {
    adaptor = await createApp(services)
  })

  describe('POST', function () {
    test('returns response code 202', async () => {
      const response = await adaptor.inject({
        method: 'POST',
        url: '/quotes',
        payload: quoteRequest
      })

      expect(response.statusCode).toBe(202)
    })

    test('returns response code 500 upon failure to add to a queue', async () => {

      adaptor.app.queueService.addToQueue = jest.fn().mockImplementationOnce(() => {
        throw Error
      })
      const response = await adaptor.inject({
        method: 'POST',
        url: '/quotes',
        payload: quoteRequest
      })

      expect(response.statusCode).toBe(500)
    })
  })

})
