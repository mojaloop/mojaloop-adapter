import { createApp } from '../../src/adaptor'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'

describe('Health endpoint', function () {

  const mockServices = AdaptorServicesFactory.build()

  let adaptor: Server
  beforeAll(async () => {
    adaptor = await createApp(mockServices)
  })

  test('returns status ok', async () => {
    const response = await adaptor.inject({
      method: 'GET',
      url: '/health'
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toBe(JSON.stringify({ status: 'ok' }))
  })

})
