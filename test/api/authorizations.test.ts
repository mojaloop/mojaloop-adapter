import Knex from 'knex'
import { Server } from 'hapi'
import { createApp } from '../../src/adaptor'
import { AdaptorServicesFactory } from '../factories/adaptor-services'

describe('Authorizations api', function () {
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

  test('returns a 200', async () => {
    const url = `/authorizations/${123}`
    const response1 = await adaptor.inject({
      method: 'GET',
      url: url
    })
    expect(response1.statusCode).toEqual(202)
  })

  describe('GET', () => {
    test('returns 202 and puts authorization request onto the AuthorizationRequests queue', async () => {
      const response = await adaptor.inject({
        method: 'GET',
        url: `/authorizations/${123}`,
        headers: {
          'fspiop-source': 'payerFSP',
          'fspiop-destination': 'payeeFSP'
        }
      })

      expect(response.statusCode).toBe(202)
      expect(services.queueService.addToQueue).toHaveBeenCalledWith('AuthorizationRequests', { transactionRequestId: '123', headers: response.request.headers })
    })

    test('returns 500 if it fails to add message to the AuthorizationRequests queue', async () => {
      services.queueService.addToQueue = jest.fn().mockRejectedValueOnce({ message: 'Failed to add to AuthorizationRequests queue' })

      const response = await adaptor.inject({
        method: 'GET',
        url: `/authorizations/${123}`,
        headers: {
          'fspiop-source': 'payerFSP',
          'fspiop-destination': 'payeeFSP'
        }
      })

      expect(response.statusCode).toBe(500)
    })
  })
})
