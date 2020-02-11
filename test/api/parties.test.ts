import { createApp } from '../../src/adaptor'
import { PartiesPutResponseFactory } from '../factories/mojaloop-messages'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import Knex from 'knex'

describe('Parties API', function () {

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

  test('returns a 202 if message is added to queue successfully', async () => {
    const partiesResponse = PartiesPutResponseFactory.build()
    services.queueService.addToQueue = jest.fn().mockResolvedValueOnce(undefined)

    const response = await adaptor.inject({
      method: 'PUT',
      url: '/parties/MSISDN/0821234567',
      payload: partiesResponse
    })

    expect(response.statusCode).toBe(202)
    expect(services.queueService.addToQueue).toHaveBeenCalledWith('PartiesResponse', { partiesResponse, partyIdValue: '0821234567' })
  })

  test('returns a 500 if message fails to be added to the queue', async () => {
    const partiesResponse = PartiesPutResponseFactory.build()
    services.queueService.addToQueue = jest.fn().mockRejectedValueOnce({ message: 'failed to add to queue' })

    const response = await adaptor.inject({
      method: 'PUT',
      url: '/parties/MSISDN/0821234567',
      payload: partiesResponse
    })

    expect(response.statusCode).toBe(500)
  })
})
