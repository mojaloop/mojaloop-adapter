import { Server } from 'hapi'
import { createApp } from '../../src/adaptor'
import { AdaptorServicesFactory } from '../factories/adaptor-services'

describe('Authorization Errors Controller', function () {
  const services = AdaptorServicesFactory.build()
  let adaptor: Server

  beforeAll(async () => {
    adaptor = await createApp(services)
  })

  test('returns response code 200', async () => {
    const response = await adaptor.inject({
      method: 'PUT',
      url: '/authorizations/123/error',
      payload: {
        errorInformation: {
          errorCode: 'this is an error code',
          errorDescription: 'this is an error description'
        }
      }
    })

    expect(response.statusCode).toEqual(200)

  })

})
