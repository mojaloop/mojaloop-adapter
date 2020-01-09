import { KnexTransactionsService, TransactionState } from '../../src/services/transactions-service'
import Axios, { AxiosInstance } from 'axios'
import Knex from 'knex'
import { createApp } from '../../src/adaptor'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { ISO0100Factory, ISO0110Factory, ISO0200Factory } from '../factories/iso-messages'
import { Socket } from 'net'
import { TcpIsoMessagingClient } from '../../src/services/iso-messaging-client'
import { KnexIsoMessageService } from '../../src/services/iso-message-service'
import { KnexAuthorizationsService } from '../../src/services/authorizations-service'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'
import { AuthorizationsIDPutResponse } from 'types/mojaloop'
import { KnexQuotesService } from '../../src/services/quotes-service'
import { Money } from '../../src/types/mojaloop'
const IsoParser = require('iso_8583')
jest.mock('uuid/v4', () => () => '123')
const lpsKey = 'postillion:0100'
const lpsId = 'postillion'

describe('Authorizations api', function () {
  let knex: Knex
  let adaptor: Server
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()
  const services = AdaptorServicesFactory.build()
  let tcpIsoMessagingClient: TcpIsoMessagingClient
  let sock: Socket
  const calculateAdaptorFees = async (amount: Money) => ({ amount: '2', currency: 'USD' })
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
    const fakeLogger = { log: jest.fn() }
    services.transactionsService = new KnexTransactionsService(knex, httpClient)
    services.transactionsService.sendToMojaHub = jest.fn().mockResolvedValue(undefined)
    services.isoMessagesService = new KnexIsoMessageService(knex)
    services.quotesService = new KnexQuotesService(knex, httpClient, 'secret', fakeLogger, 10000, calculateAdaptorFees)
    services.quotesService.sendQuoteResponse = jest.fn()
    services.authorizationsService = new KnexAuthorizationsService(knex, httpClient)
    adaptor = await createApp(services)

    sock = new Socket()
    sock.write = jest.fn()
    tcpIsoMessagingClient = new TcpIsoMessagingClient(sock)

    beforeEach(async () => {

      adaptor.app.isoMessagingClients.set('postillion', tcpIsoMessagingClient) // Registering Client
      await knex.migrate.latest()

      // this is the iso0100 message first being sent

      const iso0100 = ISO0100Factory.build()
      const response = await adaptor.inject({
        method: 'POST',
        url: '/iso8583/transactionRequests',
        payload: { lpsKey: lpsKey, lpsId: lpsId, ...iso0100 }
      })
      expect(response.statusCode).toBe(200)
      const putTransactionRequestResponse = await adaptor.inject({
        method: 'PUT',
        url: '/transactionRequests/123',
        payload: {
          transactionId: '456',
          transactionRequestState: 'RECEIVED'
        }
      })
      expect(putTransactionRequestResponse.statusCode).toBe(200)
    })
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
    const iso0110JsonMessage = await isoMessageService.get('123', lpsKey, '0110')
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
  test('put transaction request with state as  quoteResponded', async () => {

    const quoteRequest = QuotesPostRequestFactory.build({
      transactionId: '456'
    })


    const response = await adaptor.inject({
      method: 'POST',
      url: '/quotes',
      payload: quoteRequest,
      headers: {
        'fspiop-source': 'payer',
        'fspiop-destination': 'payee'
      }
    })

    expect(response.statusCode).toBe(200)

    const transaction = await services.transactionsService.updatePayerFspId('123', 'transactionRequestId', '1234')
    const iso0200 = ISO0200Factory.build()
    const response1 = await adaptor.inject({
      method: 'PUT',
      url: `/iso8583/authorizations/${lpsKey}`,
      payload: { lpsKey: lpsKey, lpsId, ...iso0200 }
    })
    expect(response1.statusCode).toEqual(200)

    const authorizationsResponse: AuthorizationsIDPutResponse = {
      authenticationInfo: {
        authentication: 'OTP',
        authenticationValue: 'null'
      },
      responseType: 'ENTERED'
    }
    const headers = {
      'fspiop-destination': 'fspiop-source',
      'fspiop-source': 'fspiop-destination'
    }
    await services.authorizationsService.sendAuthorizationsResponse(transaction.transactionRequestId, authorizationsResponse, headers)
  })
})
