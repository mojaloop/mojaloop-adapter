import { Server } from 'hapi'
import { createApp } from '../../src/adaptor'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { MojaloopError } from '../../src/types/queueMessages'

describe('Authorization Errors Controller', function () {
  const services = AdaptorServicesFactory.build()
  let adaptor: Server

  beforeAll(async () => {
    adaptor = await createApp(services)
  })

  test('returns response code 200', async () => {
    const payload = {
      errorInformation: {
        errorCode: '2001',
        errorDescription: 'this is an error description'
      }
    }

    const response = await adaptor.inject({
      method: 'PUT',
      url: '/transactionRequests/123/error',
      payload
    })

    expect(response.statusCode).toEqual(200)
    expect(services.queueService.addToQueue).toHaveBeenCalledWith('ErrorResponses', { type: MojaloopError.transactionRequest, typeId: '123', errorInformation: payload.errorInformation })
  })

  test('returns 500 if it fails to add message to the error queue', async () => {
    services.queueService.addToQueue = jest.fn().mockRejectedValue({})
    const payload = {
      errorInformation: {
        errorCode: '2001',
        errorDescription: 'this is an error description'
      }
    }

    const response = await adaptor.inject({
      method: 'PUT',
      url: '/transactionRequests/123/error',
      payload
    })

    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.payload)).toMatchObject({
      errorInformation: {
        errorCode: '2001',
        errorDescription: 'An internal error occurred.'
      }
    })
  })
})
