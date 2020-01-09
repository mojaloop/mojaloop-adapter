// import { KnexTransfersService, Transfer } from '../../src/services/transfers-service'
import { KnexTransfersService, DBTransfer } from '../../src/services/transfers-service'
// import { create } from '../../src/controllers/transfers-controller'
import Axios from 'axios'
import Knex from 'knex'
// import { TransferFactory } from '../factories/transfer'
import { TransfersPostRequest } from '../../src/types/mojaloop'
import { TransferPostRequestFactory } from '../factories/transfer-post-request'
import { Server } from 'hapi'
import { createApp } from '../../src/adaptor'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { TransactionRequest, KnexTransactionsService, TransactionState } from '../../src/services/transactions-service'
import { TransactionRequestFactory } from '../factories/transaction-requests'

describe('Transfers Controller', function () {
  let knex: Knex
  const services = AdaptorServicesFactory.build()
  let adaptor: Server

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
    adaptor = await createApp(services)

  })

  beforeEach(async () => {
    await knex.migrate.latest()
    const request: TransactionRequest = TransactionRequestFactory.build()
    await services.transactionsService.create(request)
    await services.transactionsService.updateTransactionId(request.transactionRequestId, 'transactionRequestId', '20508186-1458-4ac0-a824-d4b07e37d7b3')
    await services.transactionsService.updateState(request.transactionRequestId, 'transactionRequestId', TransactionState.financialRequestSent)
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('can create a new transfer from Transfer Post Request and return fulfilment', async () => {
    // create transfer post request
    const payload: TransfersPostRequest = TransferPostRequestFactory.build()
    // console.log(payload)

    // add to request object as payload &&
    // send to create function
    const response = await adaptor.inject({
      method: 'POST',
      url: '/transfers',
      payload: payload
    })

    // verify the response code is 200
    expect(response.statusCode).toEqual(200)

    // verify newly created transfer matches what was expected
    const dbTransfer = await knex<DBTransfer>('transfers').where('transferId', payload.transferId).first()
    console.log(dbTransfer)
    // const transactionRequestId =
    // expect(dbTransfer).toMatchObject({
    //   // transactionRequestId: data.transactionRequestId, // get from payload data
    //   amount: payload.amount.amount,
    //   currency: payload.amount.currency,
    //   id: payload.transferId
    //   // quoteId: data.quoteId, // this is in the data element
    //   // fulfilment: data.fulfilment // this is calculated by
    //   // transferState: data.transferState, // field suspended, remove if depricated
    // })
  })

  // test('returns valid fulfilment', async () => {

  // })

})

// export interface TransfersPostRequest {
//   transferId: string;
//   payeeFsp: string;
//   payerFsp: string;
//   amount: Money;
//   ilpPacket: string;
//   condition: string;
//   expiration: string;
//   extensionList?: ExtensionList;
// }
