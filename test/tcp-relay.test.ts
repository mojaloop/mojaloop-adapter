import Knex from 'knex'
import { createApp } from '../src/adaptor'
import { handleIsoMessage } from '../src/tcp-relay'
import { iso0100BinaryMessage, ISO0200 } from './factories/iso-messages'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from './factories/adaptor-services'
import Axios from 'axios'
import { KnexTransactionsService } from '../src/services/transactions-service'
jest.mock('uuid/v4', () => () => '123') // used to geneate uuid for transaction request id
const IsoParser = require('iso_8583')

describe('TCP relay', function () {

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
    const httpClient = Axios.create()
    services.transactionsService = new KnexTransactionsService(knex, httpClient)
    services.transactionsService.sendToMojaHub = jest.fn().mockResolvedValue(undefined)
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

  test('maps 0100 message to the transactionRequests endpoint', async () => {
    const iso0100 = iso0100BinaryMessage
    const isoMessage = new IsoParser().getIsoJSON(iso0100)
    const injectSpy = jest.spyOn(adaptor, 'inject')
    const lpsKey = 'postillion' + "-" + isoMessage[41] + "-" + isoMessage[42]

    await handleIsoMessage('postillion', iso0100, adaptor)

    expect(injectSpy).toHaveBeenCalledWith({
      method: 'POST',
      url: '/iso8583/transactionRequests',
      payload: { lpsId: 'postillion', lpsKey, ...isoMessage }
    })
  })
  test('maps 0200 message to the authorizations endpoint', async () => {
    let isopack = new IsoParser(ISO0200)
    let bufferMessage = isopack.getBufferMessage()
    const isoMessage = ISO0200
    const injectSpy = jest.spyOn(adaptor, 'inject')
    const lpsKey = 'postillion' + "-" + isoMessage[41] + "-" + isoMessage[42]

    await handleIsoMessage('postillion', bufferMessage, adaptor)

    expect(injectSpy).toHaveBeenCalledWith({
      method: 'PUT',
      url: `/iso8583/authorizations/${lpsKey}`,
      payload: { lpsId: 'postillion', lpsKey, ...isoMessage }
    })
  })
})