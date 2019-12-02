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
    const transactionRequestId = 'aef-123'
    const lpsKey = 'postillion:0100'
    const lpsId = 'postillion'

    const isoMessage = await isoMessageService.create(transactionRequestId, lpsKey, lpsId, data)

    const dbMessage = await knex('isoMessages').where({ id: isoMessage.id }).first()

    expect(isoMessage).toMatchObject(data)
    expect(isoMessage.id).toEqual(1)
    expect(isoMessage.lpsId).toBe('postillion')
    expect(isoMessage.lpsKey).toBe('postillion:0100')
    expect(isoMessage.transactionRequestId).toBe(transactionRequestId)
    expect(JSON.parse(dbMessage.content)).toMatchObject(data)

    expect(dbMessage.lpsKey).toBe('postillion:0100')
    expect(dbMessage.lpsId).toBe('postillion')
    expect(dbMessage.transactionRequestId).toBe(transactionRequestId)
    expect(JSON.parse(dbMessage.content)).toMatchObject(data)
  })
  test('can get an isoMessage', async () => {
    const data = ISO0100Factory.build()
    const transactionRequestId = 'aef-123'
    const lpsKey = 'postillion:0100'
    const lpsId = 'postillion'
    await isoMessageService.create(transactionRequestId, lpsKey, lpsId, data)

    const isoMessage = await isoMessageService.get(transactionRequestId, lpsKey, '0100')

    expect(isoMessage).toMatchObject(data)
    expect(isoMessage.id).toEqual(1)
    expect(isoMessage.lpsId).toBe('postillion')
    expect(isoMessage.lpsKey).toBe('postillion:0100')
    expect(isoMessage.transactionRequestId).toBe(transactionRequestId)
    expect(isoMessage).toMatchObject(data)
  })

})
