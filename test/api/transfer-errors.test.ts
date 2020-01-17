import { Server } from 'hapi'
import Knex from 'knex'
import { createApp } from '../../src/adaptor'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { Transfer } from '../../src/services/transfers-service'
import { TransferFactory } from '../factories/transfer'

describe('Authorization Errors Controller', function () {
  let knex: Knex
  const services = AdaptorServicesFactory.build()
  let adaptor: Server
  let transfer: Transfer

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
    transfer = TransferFactory.build()
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('returns response code 200', async () => {
    // add to request object as payload && send to create function
    const response = await adaptor.inject({
      method: 'PUT',
      url: `/transfers/${transfer.transferId}/error`,
      payload: {
        errorInformation: {
          errorCode: 'this is an error code',
          errorDescription: 'this is an error description'
        }
      }
    })

    // verify the response code is 200
    expect(response.statusCode).toEqual(200)

  })

})
