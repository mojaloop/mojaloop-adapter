import { Request, ResponseObject, ResponseToolkit } from 'hapi'
import { TransfersPostRequest } from 'types/mojaloop'
import { Transfer, TransferState } from '../services/transfers-service'
import { TransactionState } from '../services/transactions-service'

const IlpPacket = require('ilp-packet')
const sdk = require('@mojaloop/sdk-standard-components')

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    let transactionRequestId = ''
    const payload: TransfersPostRequest = request.payload as TransfersPostRequest

    // unpack ilpPacket
    const binaryPacket = Buffer.from(payload.ilpPacket, 'base64')
    const jsonPacket = IlpPacket.deserializeIlpPacket(binaryPacket)
    const dataElement = JSON.parse(Buffer.from(jsonPacket.data.data.toString(), 'base64').toString('utf8'))

    // get transactionRequestId
    const transaction = await request.server.app.transactionsService.get(dataElement.transactionId, 'transactionId')
    transactionRequestId = transaction.transactionRequestId

    // create fulfilment
    const ilp = new sdk.Ilp({ secret: test })
    const fulfilment = ilp.caluclateFulfil(payload.ilpPacket).replace('"', '')

    // create transfer
    const transfer: Transfer = {
      transferId: payload.transferId,
      quoteId: dataElement.quoteId,
      transactionRequestId: transactionRequestId,
      fulfilment: fulfilment,
      transferState: TransferState.RECEIVED.toString(),
      amount: payload.amount
    }

    // persist transfer
    const transfersService = request.server.app.transfersService
    await transfersService.create(transfer)

    // return fulfilment
    await transfersService.sendFulfilment(transfer, payload.payerFsp)

    // update trxState -> enum.fulfilmentSent
    await request.server.app.transactionsService.updateState(dataElement.transactionId, 'transactionId', TransactionState.fulfillmentSent.toString())

    return h.response().code(200)

  } catch (e) {
    console.log(e)
    return h.response().code(500)
  }

}
