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
    test('returns 200 and adds transactionRequestResponse onto TransactionRequestResponses queue', async () => {
      const response = await adaptor.inject({
        headers: { 'fspiop-source': 'payerFSP', 'fspiop-destination': 'adapter' },
        method: 'PUT',
        url: '/transactionRequests/123',
        payload: { transactionId: '456', transactionRequestState: 'RECEIVED' }
      })

      expect(response.statusCode).toBe(200)
      expect(services.queueService.addToQueue).toHaveBeenCalledWith('TransactionRequestResponses', {
        transactionRequestId: '123',
        transactionRequestResponse: { transactionId: '456', transactionRequestState: 'RECEIVED' },
        headers: response.request.headers
      })
    })

    test('returns response code 500 upon failure to add to a queue', async () => {
      adaptor.app.queueService.addToQueue = jest.fn().mockImplementationOnce(() => {
        throw new Error('failed')
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
