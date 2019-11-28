import { KnexTransactionsService } from '../../src/services/transactions-service'
import Axios, { AxiosInstance } from 'axios'
import Knex from 'knex'
import { createApp } from '../../src/adaptor'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { ISO0100Factory } from '../factories/iso-messages' 
import { ISO0110Factory } from '../factories/iso-messages' 

import { Socket } from 'net'
import { TcpIsoMessagingClient } from '../../src/services/iso-messaging-client'

const IsoParser = require('iso_8583')


import { KnexIsoMessageService } from '../../src/services/iso-message-service';
import { AsyncResource } from 'async_hooks';
jest.mock('uuid/v4', () => () => '123')
const LPS_KEY = 'postillion'

describe('Transaction Request Service', function () {
  let knex: Knex 
  let adaptor: Server
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()
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
    services.isoMessagesService = new KnexIsoMessageService(knex)
    adaptor = await createApp(services)
  })

  beforeEach(async () => {
 
      await knex.migrate.latest()
      // this is the iso0100 message first being sent
      const iso0100 = ISO0100Factory.build()
      const response = await adaptor.inject({
        method: 'POST',
        url: '/iso8583/transactionRequests',
        payload: { lpsKey: LPS_KEY, switchKey: iso0100['127.2'], ...iso0100 }
      })
      expect(response.statusCode).toBe(200)
    })
    
  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

 
  test('can test a fetch request', async () => {
    const db0100 = await knex('isoMessages').first()
    const url = `/authorizations/${123}`
    const response1 = await adaptor.inject({
      method: 'GET',
      url: url
    })
    
  expect(response1.statusCode).toEqual(200)
  })

test('gives iso messaging client json 0110 and lpsKey to send',async () => {
      const sock = new Socket()
      sock.write = jest.fn()
      const tcpIsoMessagingClient = new TcpIsoMessagingClient(sock)
      const isoJsonMessage = ISO0110Factory.build()
      isoJsonMessage[0] = '0110'
      await tcpIsoMessagingClient.sendAuthorizationRequest(isoJsonMessage)
      const expectedBuffer = new IsoParser(isoJsonMessage).getBufferMessage()
      expect(expectedBuffer).toBeInstanceOf(Buffer)
      expect(sock.write).toHaveBeenCalledWith(expectedBuffer)

 })


})
