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
    const data = ISO0100Factory.build({ lpsKey: 'postillion' })
    const transactionPK = 'aef-123'

    const isoMessage = await isoMessageService.create({ transactionPK, ...data })

    const dbMessage = await knex('isoMessages').where({ id: isoMessage.id }).first()

    expect(isoMessage).toMatchObject(data)
    expect(isoMessage.id).toEqual(1)
    expect(isoMessage.lpsKey).toBe('postillion')
    expect(isoMessage.transactionPK).toBe(transactionPK)
    expect(JSON.parse(dbMessage.content)).toMatchObject(data)
  })

})
