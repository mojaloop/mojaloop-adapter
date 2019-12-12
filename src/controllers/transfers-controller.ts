import { Request, ResponseObject, ResponseToolkit } from 'hapi';
import IlpPacket from 'ilp-packet';
import { TransfersPostRequest } from 'types/mojaloop';
import { Transfer, KnexTransfersService } from 'services/transfers-service';
import { TransferTimedOutError } from 'ilp-packet/dist/src/errors';

const sdk = require('@mojaloop/sdk-standard-components')

export async function create(request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  const payload: TransfersPostRequest = request.payload as TransfersPostRequest
  
  // get quoteId from ilpPacket
  
  const quoteId = payload.ilpPacket.data.quoteId
  
  // get transactionRequestId

  const transactionRequestId = get.it.from.transaction.service
  
  // create fulfilment
  
  const fulfilment = fulfilment.blahblah
  
  // create transfer

  const transfer: Transfer = {
    id: payload.transferId,
    quoteId: quoteId,
    transactionRequestId: transactionRequestId,
    fulfilment: fulfilment,
    // transferState: string, // field suspended, remove if depricated
    amount: payload.amount,
  }

  // persist transfer
  // return fulfilment





  // decode ILP packet
  // get trxId
  // update trxState -> enum.fulfilmentSent

  return h.response().code(200)

}

// post/transfer.payload: TransfersPostRequest
//   transferId
//   payeeFsp
//   payerFsp
//   amount
//   ilpPacket -- encrypted as all hell
  // amount: this._getIlpCurrencyAmount(partialResponse.transferAmount), // unsigned 64bit integer as a string
  // account: this._getIlpAddress(quoteRequest.payee), // ilp address
  // data: ilpData // base64url encoded attached data
    // transactionId: quoteRequest.transactionId,
    // quoteId: quoteRequest.quoteId,
    // payee: quoteRequest.payee,
    // payer: quoteRequest.payer,
    // amount: partialResponse.transferAmount,
    // transactionType: quoteRequest.transactionType,
    // note: quoteRequest.note,
//   condition
//   expiration
//   extensionList

// export type Transfer = {
//   id: string;
//   quoteId: string;
//   transactionRequestId: string;
//   fulfilment: string;
//   transferState: string; // field suspended, remove if depricated
//   amount: Money;
// }
