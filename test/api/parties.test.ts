import Axios from 'axios'
import { createApp } from '../../src/adaptor'
import { PartiesPutResponseFactory } from '../factories/mojaloop-messages'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import Knex from 'knex'
import { KnexTransactionsService } from '../../src/services/transactions-service'
import { ISO0100Factory } from '../factories/iso-messages'

jest.mock('uuid/v4', () => () => '123')
const LPS_KEY = 'postillion:0100'
const LPS_ID = 'postillion'

describe('Parties API', function () {

  let knex: Knex
  let adaptor: Server
  const services = AdaptorServicesFactory.build()
  const logger = console

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
    services.transactionsService = new KnexTransactionsService({ knex, client: httpClient, logger })
    services.transactionsService.sendToMojaHub = jest.fn().mockResolvedValue(undefined)
    adaptor = await createApp(services)
  })

  beforeEach(async () => {
    await knex.migrate.latest()
    // this is the iso0100 message first being sent
    const iso0100 = ISO0100Factory.build({
      102: '0821234567'
    })
    const response = await adaptor.inject({
      method: 'POST',
      url: '/iso8583/transactionRequests',
      payload: { lpsKey: LPS_KEY, lpsId: LPS_ID, ...iso0100 }
    })
    expect(response.statusCode).toBe(202)
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('updates the fspId of the payer in the transaction request', async () => {
    const putPartiesResponse = PartiesPutResponseFactory.build({
      party: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '0821234567',
          fspId: 'mojawallet'
        }
      }
    })

    const response = await adaptor.inject({
      method: 'PUT',
      payload: putPartiesResponse,
      url: `/parties/MSISDN/${putPartiesResponse.party.partyIdInfo.partyIdentifier}`
    })

    expect(response.statusCode).toBe(200)
    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(transaction.payer.fspId).toBe('mojawallet')
  })

  test('makes a transaction request to the Moja switch', async () => {
    const putPartiesResponse = PartiesPutResponseFactory.build({
      party: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '0821234567',
          fspId: 'mojawallet'
        }
      }
    })

    const response = await adaptor.inject({
      method: 'PUT',
      payload: putPartiesResponse,
      url: `/parties/MSISDN/${putPartiesResponse.party.partyIdInfo.partyIdentifier}`
    })

    expect(response.statusCode).toBe(200)
    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(services.transactionsService.sendToMojaHub).toHaveBeenCalledWith(transaction)
  })
})
