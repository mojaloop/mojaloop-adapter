import { Request, ResponseObject, ResponseToolkit } from 'hapi'
import { TransfersPostRequest } from 'types/mojaloop'
import { Transfer, TransferState } from '../services/transfers-service'
import { TransactionState, Transaction } from '../services/transactions-service'

const IlpPacket = require('ilp-packet')

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    const payload: TransfersPostRequest = request.payload as TransfersPostRequest

    // unpack ilpPacket
    const binaryPacket = Buffer.from(payload.ilpPacket, 'base64')
    const jsonPacket = IlpPacket.deserializeIlpPacket(binaryPacket)
    const dataElement = JSON.parse(Buffer.from(jsonPacket.data.data.toString(), 'base64').toString('utf8'))

    // get transactionRequestId
    const transaction = await request.server.app.transactionsService.get(dataElement.transactionId, 'transactionId')
    const transactionRequestId = transaction.transactionRequestId

    // create transfer
    const transfer: Transfer = {
      transferId: payload.transferId,
      quoteId: dataElement.quoteId,
      transactionRequestId: transactionRequestId,
      fulfilment: request.server.app.transfersService.calculateFulfilment(payload.ilpPacket),
      transferState: TransferState.RECEIVED.toString(),
      amount: payload.amount
    }

    // persist transfer
    await request.server.app.transfersService.create(transfer)

    // return fulfilment
    await request.server.app.transfersService.sendFulfilment(transfer, payload.payerFsp)

    // update trxState -> enum.fulfilmentSent
    await request.server.app.transactionsService.updateState(dataElement.transactionId, 'transactionId', TransactionState.fulfillmentSent.toString())

    return h.response().code(200)

  } catch (e) {
    console.log(e)
    return h.response().code(500)
  }

}

export async function update (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    // find transaction
    const transferId = request.params.ID
    const transfer: Transfer = await request.server.app.transfersService.get(transferId)
    const transaction: Transaction = await request.server.app.transactionsService.get(transfer.transactionRequestId, 'transactionRequestId')

    // find 0200 by transaction id
    const iso0200 = await request.server.app.isoMessagesService.get(transfer.transactionRequestId, transaction.lpsKey, '0200')

    // create 0210
    const iso0210 = {
      0: '0210',
      // 3: iso0200[3],
      // 4: iso0200[4],
      // 7: iso0200[7],
      // 11: iso0200[11],
      // 28: iso0200[28],
      // 37: iso0200[37],
      39: '00',
      // 41: iso0200[41],
      // 42: iso0200[42],
      // 49: iso0200[49],
      // 102: iso0200[102],
      // 103: iso0200[103],
      127.2: iso0200[127.2]
    }
    const iso210db = await request.server.app.isoMessagesService.create(transfer.transactionRequestId, transaction.lpsKey, transaction.lpsId, iso0210)
    if (!iso210db) {
      throw new Error('Error creating transfer.')
    }

    // use lspId to find correct tcp relay
    const client = request.server.app.isoMessagingClients.get(transaction.lpsId)
    if (!client) {
      request.server.app.logger.error('cant get any client here !')
      throw new Error('Client not registered')
    }

    // send financial response to tcp relay
    await client.sendFinancialResponse(iso210db)

    // update transaction state to COMPLETED, ie. financialResponse
    await request.server.app.transactionsService.updateState(transfer.transactionRequestId, 'transactionRequestId', TransactionState.financialResponse.toString())

    return h.response().code(200)

  } catch (error) {
    request.server.app.logger.error(`Error creating financial response. ${error.message}`)
    return h.response().code(500)
  }

}
