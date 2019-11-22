import Axios from 'axios'
import { createApp } from '../../src/adaptor'
import { PartiesPutResponseFactory } from '../factories/mojaloop-messages'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import Knex from 'knex'
import { KnexTransactionsService } from '../../src/services/transactions-service'
import { ISO0100Factory } from '../factories/iso-messages'

jest.mock('uuid/v4', () => () => '123')
const LPS_KEY = 'postillion'

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
    const httpClient = Axios.create()
    services.transactionsService = new KnexTransactionsService(knex, httpClient)
    services.transactionsService.sendToMojaHub = jest.fn().mockResolvedValue(undefined)
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

  test('updates the fspId of the payer in the transaction request', async () => {
    const putPartiesResponse = PartiesPutResponseFactory.build()

    const response = await adaptor.inject({
      method: 'PUT',
      headers: { ID: '123' },
      payload: putPartiesResponse,
      url: `/parties/MSISDN/${putPartiesResponse.party.partyIdInfo.partyIdentifier}`
    })

    expect(response.statusCode).toBe(200)
    const transaction = await services.transactionsService.get('postillion:000319562', 'id')
    expect(transaction.payer.fspId).toBe(putPartiesResponse.party.partyIdInfo.fspId)
  })

  test('makes a transaction request to the Moja switch', async () => {
    const putPartiesResponse = PartiesPutResponseFactory.build()

    const response = await adaptor.inject({
      method: 'PUT',
      headers: { ID: '123' },
      payload: putPartiesResponse,
      url: `/parties/MSISDN/${putPartiesResponse.party.partyIdInfo.partyIdentifier}`
    })

    expect(response.statusCode).toBe(200)
    const transaction = await services.transactionsService.get('postillion:000319562', 'id')
    expect(services.transactionsService.sendToMojaHub).toHaveBeenCalledWith(transaction)
  })
})
