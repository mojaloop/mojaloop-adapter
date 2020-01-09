import Axios from 'axios'
import { Server } from 'hapi'
import Knex from 'knex'
import { createApp } from '../../src/adaptor'
import { KnexTransactionsService, TransactionRequest, TransactionState, Transaction } from '../../src/services/transactions-service'
import { DBTransfer, KnexTransfersService, TransferState, Transfer } from '../../src/services/transfers-service'
import { TransfersPostRequest } from '../../src/types/mojaloop'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { TransactionRequestFactory } from '../factories/transaction-requests'
import { TransferPostRequestFactory } from '../factories/transfer-post-request'

describe('Transfers Controller', function () {
  let knex: Knex
  const services = AdaptorServicesFactory.build()
  let adaptor: Server
  let transactionRequestId: string

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
    services.transfersService = new KnexTransfersService(knex, httpClient)
    services.transfersService.sendFulfilment = jest.fn().mockResolvedValue(undefined)
    adaptor = await createApp(services)

  })

  beforeEach(async () => {
    await knex.migrate.latest()
    const request: TransactionRequest = TransactionRequestFactory.build()
    await services.transactionsService.create(request)
    await services.transactionsService.updateTransactionId(request.transactionRequestId, 'transactionRequestId', '20508186-1458-4ac0-a824-d4b07e37d7b3')
    await services.transactionsService.updateState(request.transactionRequestId, 'transactionRequestId', TransactionState.financialRequestSent)
    transactionRequestId = request.transactionRequestId
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('can create a new transfer from Transfer Post Request', async () => {
    // create transfer post request
    const payload: TransfersPostRequest = TransferPostRequestFactory.build()

    // add to request object as payload && send to create function
    const response = await adaptor.inject({
      method: 'POST',
      url: '/transfers',
      payload: payload
    })

    // verify the response code is 200
    expect(response.statusCode).toEqual(200)

    // verify newly created transfer matches what was expected
    const dbTransfer = await knex<DBTransfer>('transfers').where('transferId', payload.transferId).first()
    const sdk = require('@mojaloop/sdk-standard-components')
    const ilp = new sdk.Ilp({ secret: test })
    const data: DBTransfer = {
      transferId: payload.transferId,
      quoteId: '20508493-1458-4ac0-a824-d4b07e37d7b3',
      transactionRequestId: transactionRequestId,
      fulfilment: ilp.caluclateFulfil(payload.ilpPacket).replace('"', ''),
      transferState: TransferState.RECEIVED.toString(),
      amount: payload.amount.amount,
      currency: payload.amount.currency
    }
    expect(dbTransfer).toMatchObject(data)
  })

  test('returns valid fulfilment', async () => {
    // create transfer post request
    const payload: TransfersPostRequest = TransferPostRequestFactory.build()

    // add to request object as payload && send to create function
    const response = await adaptor.inject({
      method: 'POST',
      url: '/transfers',
      payload: payload
    })
    const transfer = await services.transfersService.get(payload.transferId)

    // verify the response code is 200
    expect(response.statusCode).toEqual(200)

    // expect sendFulfilment to have been called once
    expect(services.transfersService.sendFulfilment).toHaveBeenCalledWith(transfer, payload.payerFsp)
  })

  test('updates transactionState by transactionId', async () => {
    // create transfer post request
    const payload: TransfersPostRequest = TransferPostRequestFactory.build()

    // add to request object as payload && send to create function
    const response = await adaptor.inject({
      method: 'POST',
      url: '/transfers',
      payload: payload
    })

    // verify the response code is 200
    expect(response.statusCode).toEqual(200)

    // transactionState must be 'fulfilment sent'
    const transfer: Transfer = await services.transfersService.get(payload.transferId)
    const transaction: Transaction = await services.transactionsService.get(transfer.transactionRequestId, 'transactionRequestId')
    expect(transaction.state).toEqual(TransactionState.fulfillmentSent.toString())
  })

})
