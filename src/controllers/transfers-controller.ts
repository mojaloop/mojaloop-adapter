import { Request, ResponseObject, ResponseToolkit } from 'hapi'
import { TransfersPostRequest } from 'types/mojaloop'
import { Transfer, TransferState } from '../services/transfers-service'

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
    // console.log(`Decoded ILP packet data element: ${util.inspect(dataElement)}`)

    // get transactionRequestId
    // console.log('a1')
    // console.log(dataElement)
    const transaction = await request.server.app.transactionsService.get(dataElement.transactionId, 'transactionId')
    // console.log('a2')
    transactionRequestId = transaction.transactionRequestId
    // console.log('a3')

    // create fulfilment
    // console.log('b')
    const ilp = new sdk.Ilp({ secret: test })
    const fulfilment = ilp.caluclateFulfil(payload.ilpPacket).replace('"', '')

    // create transfer
    // console.log('c')
    const transfer: Transfer = {
      transferId: payload.transferId,
      quoteId: dataElement.quoteId,
      transactionRequestId: transactionRequestId,
      fulfilment: fulfilment,
      transferState: TransferState.RECEIVED.toString(),
      amount: payload.amount
    }

    // persist transfer
    // console.log(transfer)
    const transfersService = request.server.app.transfersService
    await transfersService.create(transfer)

    // return fulfilment
    await transfersService.sendFulfilment(transfer, payload.payerFsp)

    // update trxState -> enum.fulfilmentSent

    return h.response().code(200)

  } catch (e) {
    console.log(e)
    return h.response().code(500)
  }

}

// post/transfer.payload: TransfersPostRequest
//   transferId
//   payeeFsp
//   payerFsp
//   amount
//   condition
//   expiration
//   extensionList
//   ilpPacket -- encrypted as all hell
//     amount: this._getIlpCurrencyAmount(partialResponse.transferAmount), // unsigned 64bit integer as a string
//     account: this._getIlpAddress(quoteRequest.payee), // ilp address
//     data: ilpData // base64url encoded attached data
//       transactionId: quoteRequest.transactionId,
//       quoteId: quoteRequest.quoteId,
//       payee: quoteRequest.payee,
//       payer: quoteRequest.payer,
//       amount: partialResponse.transferAmount,
//       transactionType: quoteRequest.transactionType,
//       note: quoteRequest.note,

// export type Transfer = {
//   transferId: string;
//   quoteId: string;
//   transactionRequestId: string;
//   fulfilment: string;
//   transferState: string; // field suspended, remove if depricated
//   amount: Money;
// }
