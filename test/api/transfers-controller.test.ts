// import { KnexTransfersService, Transfer } from '../../src/services/transfers-service'
import { KnexTransfersService } from '../../src/services/transfers-service'
// import { create } from '../../src/controllers/transfers-controller'
import Axios, { AxiosInstance } from 'axios'
import Knex from 'knex'
// import { TransferFactory } from '../factories/transfer'
import { TransfersPostRequest } from '../../src/types/mojaloop'
import { TransferPostRequestFactory } from '../factories/transfer-post-request'
import { Server } from 'hapi'
import { createApp } from '../../src/adaptor'
import { AdaptorServicesFactory } from '../factories/adaptor-services'

console.log("Blanket")

describe('Transfers Controller', function () {
  console.log("starting describe")
  let knex: Knex
  // let transfersService: KnexTransfersService
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()
  let adaptor: Server
  const services = AdaptorServicesFactory.build()

  beforeAll(async () => {
    console.log("starting before all")
    knex = Knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
        supportBigNumbers: true
      },
      useNullAsDefault: true
    })

    services.transfersService = new KnexTransfersService(knex, fakeHttpClient)
    adaptor = await createApp(services)

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

  test('can create a new transfer from Transfer Post Request and return fulfilment', async () => {
    // create transfer post request
    console.log(1)
    const payload: TransfersPostRequest = TransferPostRequestFactory.build()
    console.log(payload)

    /* // suspend this to test factory
    // add to request object as payload
    const response = await adaptor.inject({
      method: 'POST',
      url: '/transfers',
      payload: payload
    })
    // send to create function
    // verify the response code is 200
    expect(response.statusCode).toEqual(200)
    // verify newly created transfer matches what was expected
    const dbTransfer = await knex('transfers').where('id', payload.transferId).first()
    // data = getDataElement(payload)
    // const transactionRequestId =
    expect(dbTransfer).toMatchObject({
      // transactionRequestId: data.transactionRequestId, // get from payload data
      amount: payload.amount.amount,
      currency: payload.amount.currency,
      id: payload.transferId
      // quoteId: data.quoteId, // this is in the data element
      // fulfilment: data.fulfilment // this is calculated by
      // transferState: data.transferState, // field suspended, remove if depricated
    }) */
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
