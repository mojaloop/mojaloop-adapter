import Axios, { AxiosInstance } from 'axios'
import { Server } from 'hapi'
import Knex from 'knex'
import { createApp } from '../../src/adaptor'
import { KnexTransactionsService, TransactionRequest, TransactionState, Transaction } from '../../src/services/transactions-service'
import { DBTransfer, KnexTransfersService, TransferState, Transfer } from '../../src/services/transfers-service'
import { TransfersPostRequest } from '../../src/types/mojaloop'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { TransactionRequestFactory } from '../factories/transaction-requests'
import { TransferPostRequestFactory } from '../factories/transfer-post-request'
import { KnexIsoMessageService } from '../../src/services/iso-message-service'
import { ISO0200Factory } from '../factories/iso-messages'
import { TcpIsoMessagingClient } from '../../src/services/iso-messaging-client'
import { Socket } from 'net'

describe('Transfers Controller', function () {
  let knex: Knex
  const services = AdaptorServicesFactory.build()
  let adaptor: Server
  let transactionRequestId: string
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()
  const tcpIsoMessagingClient = new TcpIsoMessagingClient(new Socket())
  tcpIsoMessagingClient.sendFinancialResponse = jest.fn()

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
    services.transfersService = new KnexTransfersService(knex, 'secret')
    services.isoMessagesService = new KnexIsoMessageService(knex)
    adaptor = await createApp(services)
  })

  beforeEach(async () => {
    await knex.migrate.latest()
    const request: TransactionRequest = TransactionRequestFactory.build()
    const transaction: Transaction = await services.transactionsService.create(request)
    await services.transactionsService.updateTransactionId(request.transactionRequestId, 'transactionRequestId', '20508186-1458-4ac0-a824-d4b07e37d7b3')
    await services.transactionsService.updateState(request.transactionRequestId, 'transactionRequestId', TransactionState.financialRequestSent)
    transactionRequestId = request.transactionRequestId
    const iso0200 = ISO0200Factory.build()
    await services.isoMessagesService.create(transactionRequestId, transaction.lpsKey, transaction.lpsId, iso0200)
    adaptor.app.isoMessagingClients.set(transaction.lpsId, tcpIsoMessagingClient)
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  describe('POST', () => {
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
      const data: DBTransfer = {
        transferId: payload.transferId,
        quoteId: '20508493-1458-4ac0-a824-d4b07e37d7b3',
        transactionRequestId: transactionRequestId,
        fulfilment: services.transfersService.calculateFulfilment(payload.ilpPacket),
        transferState: TransferState.COMMITTED.toString(),
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

      // expect putTransfers to have been called once
      expect(services.MojaClient.putTransfers).toHaveBeenCalledWith(transfer.transferId, { fulfilment: transfer.fulfilment }, payload.payerFsp)
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

  describe('PUT', () => {
    test('creates new Iso0210 message', async () => {
      // create transfer post request
      const payload: TransfersPostRequest = TransferPostRequestFactory.build()

      // send request to POST route function
      await adaptor.inject({
        method: 'POST',
        url: '/transfers',
        payload: payload
      })

      // get transfer and transaction
      const transfer: Transfer = await services.transfersService.get(payload.transferId)
      const transaction: Transaction = await services.transactionsService.get(transfer.transactionRequestId, 'transactionRequestId')

      // put transfer
      const response = await adaptor.inject({
        method: 'PUT',
        url: `/transfers/${payload.transferId}`,
        payload: { transferState: '2dec0941-1345-44f4-b56d-ac5a448eb0c5' } // transfer.transactionRequestId
      })

      // verify the response code is 200
      expect(response.statusCode).toEqual(200)

      // must create new iso0210 message
      expect(await services.isoMessagesService.get(transfer.transactionRequestId, transaction.lpsKey, '0210')).toEqual({
        0: '0210',
        39: '00',
        id: 2,
        transactionRequestId: transactionRequestId,
        lpsKey: 'postillion:aef-123',
        lpsId: 'postillion',
        127.2: '000319562'
      })
    })

    test('sends Financial Response to TCP relay', async () => {
      // create transfer post request
      const payload: TransfersPostRequest = TransferPostRequestFactory.build()

      // send request to POST route function
      await adaptor.inject({
        method: 'POST',
        url: '/transfers',
        payload: payload
      })

      // put transfer
      const response = await adaptor.inject({
        method: 'PUT',
        url: `/transfers/${payload.transferId}`,
        payload: { transferState: '2dec0941-1345-44f4-b56d-ac5a448eb0c5' } // transfer.transactionRequestId
      })

      // verify the response code is 200
      expect(response.statusCode).toEqual(200)

      // must create new iso0210 message
      expect(tcpIsoMessagingClient.sendFinancialResponse).toHaveBeenCalledWith({
        0: '0210',
        39: '00',
        127.2: '000319562'
      })
    })

    test('update Transaction State to Financial Response', async () => {
      // create transfer post request
      const payload: TransfersPostRequest = TransferPostRequestFactory.build()

      // send request to POST route function
      await adaptor.inject({
        method: 'POST',
        url: '/transfers',
        payload: payload
      })

      // get transfer and transaction
      const transfer: Transfer = await services.transfersService.get(payload.transferId)

      // put transfer
      const response = await adaptor.inject({
        method: 'PUT',
        url: `/transfers/${payload.transferId}`,
        payload: { transferState: '2dec0941-1345-44f4-b56d-ac5a448eb0c5' } // transfer.transactionRequestId
      })

      // verify the response code is 200
      expect(response.statusCode).toEqual(200)

      // must create new iso0210 message
      const transaction: Transaction = await services.transactionsService.get(transfer.transactionRequestId, 'transactionRequestId')
      expect(transaction.state).toEqual(TransactionState.financialResponse.toString())
    })
  })
})
