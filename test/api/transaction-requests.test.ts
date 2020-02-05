import { Server } from 'hapi'
import { createApp } from '../../src/adaptor'
import { AdaptorServicesFactory } from '../factories/adaptor-services'

describe('Transaction Requests API', function () {

  let adaptor: Server
  const services = AdaptorServicesFactory.build()

  beforeAll(async () => {
    adaptor = await createApp(services)
  })
  describe('PUT', function () {
    test('returns response code 200', async () => {
      const response = await adaptor.inject({
        method: 'PUT',
        url: '/transactionRequests/123',
        payload: { transactionId: '456', transactionRequestState: 'RECEIVED' }
      })

      expect(response.statusCode).toBe(200)
    })

    test('returns response code 500 upon failure to add to a queue', async () => {

      adaptor.app.queueService.addToQueue = jest.fn().mockImplementationOnce(() => {
        throw Error
      })
      const response = await adaptor.inject({
        method: 'PUT',
        url: '/transactionRequests/123',
        payload: { transactionId: '456', transactionRequestState: 'RECEIVED' }
      })

      expect(response.statusCode).toBe(500)
    })
  })
})
