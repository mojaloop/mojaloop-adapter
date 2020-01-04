import Knex from 'knex'
import { createApp } from '../src/adaptor'
import { handleIsoMessage } from '../src/tcp-relay'
import { iso0100BinaryMessage, ISO0200Json,iso0200BinaryMessage } from './factories/iso-messages'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from './factories/adaptor-services'
import Axios from 'axios'
import { KnexTransactionsService } from '../src/services/transactions-service'
import { KnexIsoMessageService } from '../src/services/iso-message-service'
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
    services.isoMessagesService = new KnexIsoMessageService(knex)
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

  test ('checks whether previous 0100  transaction is incomplete and send cancel to switch', async () => {
    // Sending 0100 binary message to create transaction request
    const iso0100 = iso0100BinaryMessage
    const isoMessage1 = new IsoParser().getIsoJSON(iso0100)
    const injectSp1y = jest.spyOn(adaptor, 'inject')
    const lpsKey = 'postillion' + '-' + isoMessage1[41] + '-' + isoMessage1[42]

    await handleIsoMessage('postillion', iso0100, adaptor)

    expect(injectSp1y).toHaveBeenCalledWith({
      method: 'POST',
      url: '/iso8583/transactionRequests',
      payload: { lpsId: 'postillion', lpsKey, ...isoMessage1 }
    })

    // Changing its state to Quote responded

    const response = await adaptor.inject({
      method: 'PUT',
      url: '/transactionRequests/123',
      payload: { transactionId: '456', transactionRequestState: 'RECEIVED' }
    })

    expect (response.statusCode).toEqual(200)
    const transaction = await services.transactionsService.updatePayerFspId('123', 'transactionRequestId', '1234')
    expect (transaction.state).toBe('05')

    // sending another transaction0100 for checking previous request has been cancelled

    await handleIsoMessage('postillion', iso0100, adaptor)

     expect (injectSp1y).toHaveBeenCalledWith({
      method: 'POST',
      url: '/iso8583/transactionRequests',
      payload: { lpsId: 'postillion', lpsKey, ...isoMessage1 }
     })

  })

  test('maps 0200 message to the authorizations endpoint', async () => {

    // Sending 0100 binary message to create transaction request

    const iso0100 = iso0100BinaryMessage
    const isoMessage1 = new IsoParser().getIsoJSON(iso0100)
    const injectSp1y = jest.spyOn(adaptor, 'inject')
    let lpsKey = 'postillion' + "-" + isoMessage1[41] + "-" + isoMessage1[42]

    await handleIsoMessage('postillion', iso0100, adaptor)

    expect(injectSp1y).toHaveBeenCalledWith({
      method: 'POST',
      url: '/iso8583/transactionRequests',
      payload: { lpsId: 'postillion', lpsKey, ...isoMessage1 }
    })

    // Changing its state to Quote responded

    const response = await adaptor.inject({
      method:'PUT',
      url: '/transactionRequests/123',
      payload: { transactionId: '456', transactionRequestState: 'RECEIVED' }
    })

    expect(response.statusCode).toEqual(200)
    const transaction = await services.transactionsService.updatePayerFspId('123', 'transactionRequestId', '1234')
    expect(transaction.state).toBe('05')

    // Sending 0200 binary message

    const iso0200 = iso0200BinaryMessage
    const isoMessage = new IsoParser().getIsoJSON(iso0200)
    const injectSpy = jest.spyOn(adaptor, 'inject')
    lpsKey = 'postillion' + "-" + isoMessage[41] + "-" + isoMessage[42]

    await handleIsoMessage('postillion', iso0200BinaryMessage, adaptor)

    expect(injectSpy).toHaveBeenCalledWith({
      method: 'PUT',
      url: `/iso8583/authorizations/${lpsKey}`,
      payload: { lpsId: 'postillion', lpsKey, ...isoMessage }
    })
  })
})
