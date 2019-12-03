import { KnexTransfersService, TransferRequest } from '../../src/services/transfers-service'
import Axios, { AxiosInstance } from 'axios'
import Knex from 'knex'
import { TransferRequestFactory } from '../factories/transfer-requests'

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

    const data: TransferRequest = {
      transactionRequestId: 'abs-321',
      amount: {
        amount: '10000',
        currency: 'USD'
      },
      id: 'abs-234',
      quoteId: 'abs-543',
      fulfillment: 'fulfilled',
      transferState: 'transfered',
    }

    const transfer = await transfersService.create(data)

    const dbTransfer = await knex('transfers').where('id', data.id).first()

    expect(dbTransfer).toBeDefined()
    expect(dbTransfer).toMatchObject({
      transactionRequestId: 'abs-321',
      amount: '10000',
      currency: 'USD',
      id: 'abs-234',
      quoteId: 'abs-543',
      fulfillment: 'fulfilled',
      transferState: 'transfered',
    })
    expect(transfer).toMatchObject(data)
  })

  // test('can fetch transfer by id', async () => {
  //   const data: TransferRequest = {
  //     transactionRequestId: 'abs-836',
  //     amount: {
  //       amount: '35',
  //       currency: 'KRW'
  //     },
  //     id: 'abs-935',
  //     quoteId: 'abs-375',
  //     fulfillment: 'to be fulfilled',
  //     transferState: 'has been transfered',
  //   }
  //   await transfersService.create(data)

  //   const transfer = await transfersService.get(data.id)

  //   expect(transfer).toMatchObject(data)
  // })

})
