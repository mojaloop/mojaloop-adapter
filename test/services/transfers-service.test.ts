import { KnexTransfersService, Transfer } from '../../src/services/transfers-service'
import Axios, { AxiosInstance } from 'axios'
import Knex from 'knex'
import { TransferFactory } from '../factories/transfer'

describe('Transfers Service', function () {
  let knex: Knex
  let transfersService: KnexTransfersService
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()

  beforeAll(async () => {
    knex = Knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
        supportBigNumbers: true
      },
      useNullAsDefault: true
    })

    transfersService = new KnexTransfersService(knex, fakeHttpClient)
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

  test('can create a transfer request', async () => {
    const data: Transfer = TransferFactory.build();
    const transfer = await transfersService.create(data)
    const dbTransfer = await knex('transfers').where('id', data.id).first()
    expect(dbTransfer).toBeDefined()
    expect(dbTransfer).toMatchObject({
      transactionRequestId: data.transactionRequestId,
      amount: data.amount.amount,
      currency: data.amount.currency,
      id: data.id,
      quoteId: data.quoteId,
      fulfilment: data.fulfilment,
      transferState: data.transferState,
    })
    expect(transfer).toMatchObject(data)
  })

  test('can fetch transfer by id', async () => {
    const data: Transfer = TransferFactory.build();
    await transfersService.create(data)
    const transfer = await transfersService.get(data.id)
    expect(transfer).toMatchObject(data)
  })


  test('can update the transfer state', async () => {
    const data: Transfer = TransferFactory.build()
    await transfersService.create(data)
    const transfer = await transfersService.get(data.id)
    expect(transfer).toMatchObject(data)
    data.transferState = 'must be modified'
    const updatedTransfer = await transfersService.updateTransferState(data)
    expect(updatedTransfer).toMatchObject(data)
  })

})
