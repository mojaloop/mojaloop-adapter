import { KnexTransfersService, Transfer, TransferState } from '../../src/services/transfers-service'
import Axios, { AxiosInstance } from 'axios'
import Knex from 'knex'
import { TransferFactory } from '../factories/transfer'

describe('Transfers Service', function () {
  let knex: Knex
  let transfersService: KnexTransfersService
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()
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

    transfersService = new KnexTransfersService(knex, 'secret', logger)
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
    const data: Transfer = TransferFactory.build()
    const transfer = await transfersService.create(data)
    const dbTransfer = await knex('transfers').where('transferId', data.transferId).first()
    expect(dbTransfer).toBeDefined()
    expect(dbTransfer).toMatchObject({
      transactionRequestId: data.transactionRequestId,
      amount: data.amount.amount,
      currency: data.amount.currency,
      transferId: data.transferId,
      quoteId: data.quoteId,
      fulfilment: data.fulfilment,
      transferState: data.transferState
    })
    expect(transfer).toMatchObject(data)
  })

  test('can fetch transfer by id', async () => {
    const data: Transfer = TransferFactory.build()
    await transfersService.create(data)

    const transfer = await transfersService.get(data.transferId)

    expect(transfer).toMatchObject(data)
  })

  test('can update the transfer state', async () => {
    const data: Transfer = TransferFactory.build()
    await transfersService.create(data)
    const transfer = await transfersService.get(data.transferId)
    expect(transfer).toMatchObject(data)
    data.transferState = TransferState.committed

    const updatedTransfer = await transfersService.updateTransferState(data)

    expect(updatedTransfer).toMatchObject(data)
  })

})
