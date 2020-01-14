import Knex from 'knex'
import { Server } from 'hapi'
import Axios, { AxiosInstance } from 'axios'
import { Socket } from 'net'
import { KnexTransactionsService, TransactionState } from '../../src/services/transactions-service'
import { createApp } from '../../src/adaptor'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { ISO0100Factory, ISO0200Factory } from '../factories/iso-messages'
import { TcpIsoMessagingClient } from '../../src/services/iso-messaging-client'
import { KnexIsoMessageService } from '../../src/services/iso-message-service'
import { QuotesPostRequestFactory, PartiesPutResponseFactory } from '../factories/mojaloop-messages'
import { AuthorizationsIDPutResponse, Money } from '../../src/types/mojaloop'
import { KnexQuotesService } from '../../src/services/quotes-service'

jest.mock('uuid/v4', () => () => '123')
const lpsKey = 'postillion:0100'
const lpsId = 'postillion'

describe('Authorizations api', function () {
  let knex: Knex
  let adaptor: Server
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()
  const tcpIsoMessagingClient = new TcpIsoMessagingClient(new Socket())
  tcpIsoMessagingClient.sendAuthorizationRequest = jest.fn()
  const iso0100 = ISO0100Factory.build({
    102: '0821234567'
  })
  const services = AdaptorServicesFactory.build()
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
    const fakeLogger = { log: jest.fn() }
    services.transactionsService = new KnexTransactionsService(knex, fakeHttpClient)
    services.transactionsService.sendToMojaHub = jest.fn().mockResolvedValue(undefined)
    services.isoMessagesService = new KnexIsoMessageService(knex)
    services.quotesService = new KnexQuotesService(knex, fakeHttpClient, 'secret', fakeLogger, 10000, calculateAdaptorFees)
    adaptor = await createApp(services)

    beforeEach(async () => {
      await knex.migrate.latest()
      adaptor.app.isoMessagingClients.set('postillion', tcpIsoMessagingClient)

      let response = await adaptor.inject({
        method: 'POST',
        url: '/iso8583/transactionRequests',
        payload: { lpsKey: lpsKey, lpsId: lpsId, ...iso0100 }
      })
      expect(response.statusCode).toBe(202)

      const putPartiesResponse = PartiesPutResponseFactory.build({
        party: {
          partyIdInfo: {
            partyIdType: 'MSISDN',
            partyIdentifier: '0821234567',
            fspId: 'mojawallet'
          }
        }
      })
      response = await adaptor.inject({
        method: 'PUT',
        payload: putPartiesResponse,
        url: `/parties/MSISDN/${putPartiesResponse.party.partyIdInfo.partyIdentifier}`
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

      const quoteRequest = QuotesPostRequestFactory.build({
        transactionId: '456'
      })
      response = await adaptor.inject({
        method: 'POST',
        url: '/quotes',
        payload: quoteRequest,
        headers: {
          'fspiop-destination': 'fspiop-source',
          'fspiop-source': 'fspiop-destination'
        }
      })
      expect(response.statusCode).toBe(202)
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
    expect(response1.statusCode).toEqual(202)
  })

  describe('GET', () => {
    test('gives iso messaging client json 0110 and lpsKey to send', async () => {
      const response = await adaptor.inject({
        method: 'GET',
        url: `/authorizations/${123}`
      })

      const iso0110JsonMessage = await adaptor.app.isoMessagesService.get('123', lpsKey, '0110')
      expect(response.statusCode).toBe(202)
      expect(iso0110JsonMessage[0]).toBe('0110')
      expect(iso0110JsonMessage[39]).toBe('00')
      expect(iso0110JsonMessage[127.2]).toBe(iso0100[127.2])
      expect(iso0110JsonMessage.transactionRequestId).toBe('123')
      expect(iso0110JsonMessage.lpsKey).toBe(lpsKey)
      expect(iso0110JsonMessage.lpsId).toBe(lpsId)
      expect(tcpIsoMessagingClient.sendAuthorizationRequest).toHaveBeenCalledWith({
        0: '0110',
        39: '00',
        127.2: iso0110JsonMessage[127.2]
      })
    })
  })

  describe('PUT', () => {
    test('sends authorization response and updates state to financialRequestSent', async () => {
      const iso0200 = ISO0200Factory.build()

      const response = await adaptor.inject({
        method: 'PUT',
        url: `/iso8583/authorizations/${lpsKey}`,
        payload: { lpsKey: lpsKey, lpsId, ...iso0200 }
      })

      const isoMessageService = adaptor.app.isoMessagesService
      const iso0200JsonMessage = await isoMessageService.get('123', lpsKey, '0200')
      const authorizationsResponse: AuthorizationsIDPutResponse = {
        authenticationInfo: {
          authentication: 'OTP',
          authenticationValue: iso0200JsonMessage[103]
        },
        responseType: 'ENTERED'
      }
      const headers = {
        'fspiop-destination': 'mojawallet',
        'fspiop-source': 'adaptor',
        date: new Date().toUTCString(),
        'content-type': 'application/vnd.interoperability.authorizations+json;version=1.0'
      }
      expect(response.statusCode).toEqual(200)
      expect(services.authorizationsService.sendAuthorizationsResponse).toHaveBeenCalledWith('123', authorizationsResponse, headers)
      const transaction = await services.transactionsService.get('123', 'transactionRequestId')
      expect(transaction.state).toEqual(TransactionState.financialRequestSent)
    })
  })
})
