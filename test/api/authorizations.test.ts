import { KnexTransactionsService } from '../../src/services/transactions-service'
import Axios, { AxiosInstance } from 'axios'
import Knex from 'knex'
import { createApp } from '../../src/adaptor'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { ISO0100Factory } from '../factories/iso-messages'
import {ISO0110Factory} from '../factories/iso-messages'
import { Socket } from 'net'
import { TcpIsoMessagingClient } from '../../src/services/iso-messaging-client'
import { KnexIsoMessageService } from '../../src/services/iso-message-service'

const IsoParser = require('iso_8583')
jest.mock('uuid/v4', () => () => '123')
const LPS_KEY = 'postillion:0100'
const LPS_ID = 'postillion'

describe('Transaction Request Service', function () {
  let knex: Knex
  let adaptor: Server
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()
  const services = AdaptorServicesFactory.build()
  let tcpIsoMessagingClient: TcpIsoMessagingClient
  let sock: Socket

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

    sock = new Socket()
    sock.write = jest.fn()
    tcpIsoMessagingClient = new TcpIsoMessagingClient(sock)
  })

  beforeEach(async () => {

    adaptor.app.isoMessagingClients.set('postillion', tcpIsoMessagingClient) // Registering Client
    await knex.migrate.latest()
    // this is the iso0100 message first being sent
    const iso0100 = ISO0100Factory.build()
    const response = await adaptor.inject({
      method: 'POST',
      url: '/iso8583/transactionRequests',
      payload: { lpsKey: LPS_KEY, lpsId: LPS_ID, ...iso0100 }
    })
    expect(response.statusCode).toBe(200)
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
    expect(response1.statusCode).toEqual(200)
  })

  test('gives iso messaging client json 0110 and lpsKey to send', async () => {
    const url = `/authorizations/${123}`
    const response1 = await adaptor.inject({
      method: 'GET',
      url: url
    })


    const iso0110 = ISO0110Factory.build()
    iso0110.id = 2
    iso0110.transactionRequestId = '123'
    iso0110.lpsKey = 'postillion:0100'
    iso0110.lpsId = 'postillion'

    const isoMessageService = adaptor.app.isoMessagesService
    const iso0110JsonMessage = await isoMessageService.get('123', LPS_KEY, '0110')
    
    expect(iso0110[0]).toBe(iso0110JsonMessage[0])
    expect(iso0110[3]).toBe(iso0110JsonMessage[3])
    expect(iso0110[4]).toBe(iso0110JsonMessage[4])
    expect(iso0110[28]).toBe(iso0110JsonMessage[28])
    expect(iso0110[39]).toBe(iso0110JsonMessage[39])
    expect(iso0110[49]).toBe(iso0110JsonMessage[49])
    expect(iso0110[127.2]).toBe(iso0110JsonMessage[127.2])
    expect(iso0110.id).toBe(iso0110JsonMessage.id)
    expect(iso0110.transactionRequestId).toBe(iso0110JsonMessage.transactionRequestId)
    expect(iso0110.lpsKey).toBe(iso0110JsonMessage.lpsKey)
    expect(iso0110.lpsId).toBe(iso0110JsonMessage.lpsId)
    

    const expectedBuffer = new IsoParser(iso0110JsonMessage).getBufferMessage()

    expect(expectedBuffer).toBeInstanceOf(Buffer)
    expect(sock.write).toHaveBeenCalledWith(expectedBuffer)

  })
})
