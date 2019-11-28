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
    const isoMessage1 = await isoMessageService.get(transactionPK, lpsKey,isoMessage[0])

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

})
