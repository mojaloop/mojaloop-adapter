import { Request, ResponseObject, ResponseToolkit } from 'hapi'
import { TransfersPostRequest, TransfersIDPutResponse } from 'types/mojaloop'
import { Transfer, TransferState } from '../services/transfers-service'
import { TransactionState, Transaction } from '../services/transactions-service'

const IlpPacket = require('ilp-packet')

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Transfers Controller: Received transfer request. payload: ' + JSON.stringify(request.payload))
    const payload: TransfersPostRequest = request.payload as TransfersPostRequest
    const binaryPacket = Buffer.from(payload.ilpPacket, 'base64')
    const jsonPacket = IlpPacket.deserializeIlpPacket(binaryPacket)
    const dataElement = JSON.parse(Buffer.from(jsonPacket.data.data.toString(), 'base64').toString('utf8'))
    const transaction = await request.server.app.transactionsService.get(dataElement.transactionId, 'transactionId')
    const transactionRequestId = transaction.transactionRequestId

    const transfer: Transfer = {
      transferId: payload.transferId,
      quoteId: dataElement.quoteId,
      transactionRequestId: transactionRequestId,
      fulfilment: request.server.app.transfersService.calculateFulfilment(payload.ilpPacket),
      transferState: TransferState.received,
      amount: payload.amount
    }

    await request.server.app.transfersService.create(transfer)

    const transferResponse: TransfersIDPutResponse = {
      fulfilment: transfer.fulfilment,
      transferState: TransferState.committed,
      completedTimestamp: (new Date(Date.now())).toISOString()
    }
    await request.server.app.MojaClient.putTransfers(transfer.transferId, transferResponse, payload.payerFsp)

    await request.server.app.transactionsService.updateState(dataElement.transactionId, 'transactionId', TransactionState.fulfillmentSent)

    transfer.transferState = TransferState.reserved
    await request.server.app.transfersService.updateTransferState(transfer)

    return h.response().code(200)

  } catch (error) {
    request.server.app.logger.error(`Transfers Controller: Error handling transfer request. ${error.message}`)
    return h.response().code(500)
  }

}

export async function update (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Transfers Controller: Received put transfer response. transferId: ' + request.params.ID + ' payload: ' + JSON.stringify(request.payload))
    const transferId = request.params.ID
    const transfer: Transfer = await request.server.app.transfersService.get(transferId)
    const transaction: Transaction = await request.server.app.transactionsService.get(transfer.transactionRequestId, 'transactionRequestId')
    const iso0200 = await request.server.app.isoMessagesService.get(transfer.transactionRequestId, transaction.lpsKey, '0200')
    // TODO: Fix creating of 0210 message
    delete iso0200.id
    const iso0210 = {
      ...iso0200,
      0: '0210',
      39: '00',
      127.2: iso0200[127.2]
    }
    request.server.app.isoMessagesService.create(transfer.transactionRequestId, transaction.lpsKey, transaction.lpsId, iso0210)

    const client = request.server.app.isoMessagingClients.get(transaction.lpsId)
    if (!client) {
      request.server.app.logger.error('cant get any client here !')
      throw new Error('Client not registered')
    }

    // TODO: Fix sanitizing of 0210 message
    delete iso0210.lpsId
    delete iso0210.lpsKey
    delete iso0210.id
    delete iso0210.transactionRequestId
    request.server.app.logger.debug('Transfers Controller: Sending 0210 to LPS. ' + JSON.stringify(iso0210))
    await client.sendFinancialResponse(iso0210)

    transfer.transferState = TransferState.committed
    await request.server.app.transfersService.updateTransferState(transfer)

    await request.server.app.transactionsService.updateState(transfer.transactionRequestId, 'transactionRequestId', TransactionState.financialResponse)

    return h.response().code(200)

  } catch (error) {
    request.server.app.logger.error(`Transfers Controller: Error handling transfers put response. ${error.message}`)
    return h.response().code(500)
  }

}
