import { generateOTP } from '../src/utils/util'
import Knex = require('knex')

describe('Example test', function () {
  let knex: Knex

  beforeAll(async () => {
    knex = Knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
        supportBigNumbers: true
      },
      useNullAsDefault: true
    })
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

  test('can generate a random OTP', async () => {
    const otp = generateOTP()

    expect(otp).toBeDefined()
  })

})
