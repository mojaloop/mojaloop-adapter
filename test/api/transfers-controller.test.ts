import { Server } from 'hapi'
import { createApp } from '../../src/adaptor'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { TransfersIDPutResponse } from '../../src/types/mojaloop'
import { TransferPostRequestFactory } from '../factories/transfer-post-request'

describe('Transfers Controller', function () {
  let adaptor: Server
  const services = AdaptorServicesFactory.build()

  beforeAll(async () => {
    adaptor = await createApp(services)
  })

  describe('POST', () => {

    test('returns 202 and adds transfer response onto TransferResponses queue', async () => {
      const transferRequest = TransferPostRequestFactory.build()

      const response = await adaptor.inject({
        method: 'POST',
        url: '/transfers',
        payload: transferRequest,
        headers: {
          'fspiop-destination': 'payeeFSP',
          'fspiop-source': 'payerFSP'
        }
      })

      expect(response.statusCode).toBe(202)
      expect(services.queueService.addToQueue).toHaveBeenCalledWith('TransferRequests', { transferRequest, headers: response.request.headers })
    })

    test('returns 500 if it fails to add message to queue', async () => {
      services.queueService.addToQueue = jest.fn().mockRejectedValueOnce({ message: 'Failed to add to queue' })
      const transferRequest = TransferPostRequestFactory.build()

      const response = await adaptor.inject({
        method: 'POST',
        url: '/transfers',
        payload: transferRequest,
        headers: {
          'fspiop-destination': 'payeeFSP',
          'fspiop-source': 'payerFSP'
        }
      })

      expect(response.statusCode).toBe(500)
    })
  })

  describe('PUT', () => {

    test('returns 200 and adds transfer response onto TransferResponses queue', async () => {
      const transferResponse: TransfersIDPutResponse = {
        transferState: 'COMMITTED'
      }

      const response = await adaptor.inject({
        method: 'PUT',
        url: '/transfers/123',
        payload: transferResponse,
        headers: {
          'fspiop-destination': 'payeeFSP',
          'fspiop-source': 'payerFSP'
        }
      })

      expect(response.statusCode).toBe(200)
      expect(services.queueService.addToQueue).toHaveBeenCalledWith('TransferResponses', { transferId: '123', transferResponse, headers: response.request.headers })
    })

    test('returns 500 if it fails to add message to queue', async () => {
      services.queueService.addToQueue = jest.fn().mockRejectedValueOnce({ message: 'Failed to add to queue' })
      const transferResponse: TransfersIDPutResponse = {
        transferState: 'COMMITTED'
      }
      const response = await adaptor.inject({
        method: 'PUT',
        url: '/transfers/123',
        payload: transferResponse,
        headers: {
          'fspiop-destination': 'payeeFSP',
          'fspiop-source': 'payerFSP'
        }
      })

      expect(response.statusCode).toBe(500)
    })
  })
})
