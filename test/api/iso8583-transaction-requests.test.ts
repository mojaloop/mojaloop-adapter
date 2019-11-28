// import Knex from 'knex'
// import { ISO0100Factory } from '../factories/iso-messages'
// import { createApp } from '../../src/adaptor'
// import { Server } from 'hapi'
// import { AdaptorServicesFactory } from '../factories/adaptor-services'
// import { KnexTransactionsService } from '../../src/services/transactions-service'
// import Axios from 'axios'
// import { KnexIsoMessageService } from '../../src/services/iso-message-service'

// jest.mock('uuid/v4', () => () => '123')

// const LPS_KEY = 'postillion'

// describe('Transaction Requests API', function () {

//   let knex: Knex
//   let adaptor: Server
//   const services = AdaptorServicesFactory.build()

//   beforeAll(async () => {
//     knex = Knex({
//       client: 'sqlite3',
//       connection: {
//         filename: ':memory:',
//         supportBigNumbers: true
//       },
//       useNullAsDefault: true
//     })
//     const httpClient = Axios.create()
//     services.transactionsService = new KnexTransactionsService(knex, httpClient)
//     services.transactionsService.sendToMojaHub = jest.fn().mockResolvedValue(undefined)
//     services.isoMessagesService = new KnexIsoMessageService(knex)
//     adaptor = await createApp(services)
//   })

//   beforeEach(async () => {
//     await knex.migrate.latest()
//   })

//   afterEach(async () => {
//     await knex.migrate.rollback()
//   })

//   afterAll(async () => {
//     await knex.destroy()
//   })

//   test('stores the ISO0100 message', async () => {
//     const iso0100 = ISO0100Factory.build()

//     const response = await adaptor.inject({
//       method: 'POST',
//       url: '/iso8583/transactionRequests',
//       payload: { lpsKey: LPS_KEY, switchKey: iso0100['127.2'], ...iso0100 }
//     })

//     expect(response.statusCode).toBe(200)
//     const storedIso0100 = await knex('isoMessages').first()
//     expect(storedIso0100.switchKey).toBe(iso0100['127.2'])
//     expect(storedIso0100.lpsKey).toBe(LPS_KEY)
//     expect(JSON.parse(storedIso0100.content)).toMatchObject(iso0100)
//   })

//   test('creates a transaction request from the ISO0100 message', async () => {
//     const iso0100 = ISO0100Factory.build()

//     const response = await adaptor.inject({
//       method: 'POST',
//       url: '/iso8583/transactionRequests',
//       payload: { lpsKey: LPS_KEY, switchKey: iso0100['127.2'], ...iso0100 }
//     })

//     expect(response.statusCode).toEqual(200)
//     const transactionRequest = await services.transactionsService.get('postillion:000319562', 'id')
//     expect(transactionRequest).toMatchObject({
//       id: 'postillion:000319562',
//       transactionRequestId: '123',
//       payer: {
//         partyIdType: 'MSISDN',
//         partyIdentifier: iso0100[102]
//       },
//       payee: {
//         partyIdInfo: {
//           partyIdType: 'DEVICE',
//           partyIdentifier: iso0100[41],
//           partySubIdOrType: iso0100[42]
//         }
//       },
//       amount: {
//         amount: iso0100[4],
//         currency: iso0100[49]
//       },
//       transactionType: {
//         initiator: 'PAYEE',
//         initiatorType: 'DEVICE',
//         scenario: 'WITHDRAWAL'
//       },
//       authenticationType: 'OTP',
//       expiration: iso0100[7]
//     })
//   })

//   test('Requests an account lookup and uses the transactionRequestId as the traceId', async () => {
//     const iso0100 = ISO0100Factory.build()

//     const response = await adaptor.inject({
//       method: 'POST',
//       url: '/iso8583/transactionRequests',
//       payload: { lpsKey: LPS_KEY, switchKey: iso0100['127.2'], ...iso0100 }
//     })

//     expect(response.statusCode).toEqual(200)
//     expect(services.accountLookupService.requestFspIdFromMsisdn).toHaveBeenCalledWith('123', iso0100[102])
//   })

// })
import { ISO0100Factory } from '../factories/iso-messages'
import { KnexIsoMessageService } from '../../src/services/iso-message-service'
import Knex = require('knex')

describe('IsoMessageService', function () {
  let knex: Knex
  let isoMessageService: KnexIsoMessageService

  beforeAll(async () => {
    knex = Knex({
      client: 'sqlite3',
      useNullAsDefault: true,
      connection: {
        filename: ':memory:',
        supportBigNumbers: true
      }
    })

    isoMessageService = new KnexIsoMessageService(knex)
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

  test('can create an isoMessage', async () => {
    const data = ISO0100Factory.build()
    const transactionPK = 'aef-123'
    const switchKey = data['127.2']
    const lpsKey = 'postillion'

    const isoMessage = await isoMessageService.create(transactionPK, lpsKey, switchKey!, data)

    const dbMessage = await knex('isoMessages').where({ id: isoMessage.id }).first()

    expect(isoMessage).toMatchObject(data)
    expect(isoMessage.id).toEqual(1)
    expect(isoMessage.lpsKey).toBe('postillion')
    expect(isoMessage.switchKey).toBe(data['127.2'])
    expect(isoMessage.transactionPK).toBe(transactionPK)
    expect(JSON.parse(dbMessage.content)).toMatchObject(data)

    expect(dbMessage.lpsKey).toBe('postillion')
    expect(dbMessage.transactionPK).toBe(transactionPK)
    expect(dbMessage.switchKey).toBe(data['127.2'])
    expect(JSON.parse(dbMessage.content)).toMatchObject(data)
  })

  test('can get an isoMessage', async () => {
    const data = ISO0100Factory.build()
    const transactionPK = 'aef-123'
    const switchKey = data['127.2']
    const lpsKey = 'postillion'
    const isoMessage = await isoMessageService.create(transactionPK, lpsKey, switchKey!, data)
    const dbMessage = await knex('isoMessages').where({ id: isoMessage.id }).first()
    const mti='0100'

    const isoMessage100 = await isoMessageService.get(transactionPK, lpsKey, mti)

    expect(isoMessage100).toMatchObject(data)
    expect(isoMessage100.id).toEqual(1)
    expect(isoMessage100.lpsKey).toBe('postillion')
    expect(isoMessage100.switchKey).toBe(data['127.2'])
    expect(isoMessage100.transactionPK).toBe(transactionPK)
    expect(JSON.parse(dbMessage.content)).toMatchObject(data)

    expect(dbMessage.lpsKey).toBe('postillion')
    expect(dbMessage.transactionPK).toBe(transactionPK)
    expect(dbMessage.switchKey).toBe(data['127.2'])
    expect(JSON.parse(dbMessage.content)).toMatchObject(data)
  })

})
