import { Request, ResponseObject, ResponseToolkit } from 'hapi';
import IlpPacket from 'ilp-packet';
import { TransfersPostRequest } from 'types/mojaloop';
import { Transfer, KnexTransfersService } from 'services/transfers-service';
import { TransferTimedOutError } from 'ilp-packet/dist/src/errors';
import * as util from 'util'

const sdk = require('@mojaloop/sdk-standard-components')

export async function create(request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  
  const payload: TransfersPostRequest = request.payload as TransfersPostRequest
  
  // unpack ilpPacket
  
  const binaryPacket = Buffer.from(payload.ilpPacket, 'base64');
  const jsonPacket = IlpPacket.deserializeIlpPacket(binaryPacket);

  console.log(`Decoded ILP packet: ${util.inspect(jsonPacket)}`);

  const dataElement = JSON.parse(Buffer.from(jsonPacket.data.toString(), 'base64').toString('utf8'));

  console.log('222222222222222222222222222222222');
  console.log(`Decoded ILP packet data element: ${util.inspect(dataElement)}`);

  // get quoteId from ilpPacket
  
  const quoteId = dataElement.quoteId
  
  // get trxId

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

  // update trxState -> enum.fulfilmentSent

  return h.response().code(200)

}

// post/transfer.payload: TransfersPostRequest
  // transferId
  // payeeFsp
  // payerFsp
  // amount
  // condition
  // expiration
  // extensionList
  // ilpPacket -- encrypted as all hell
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

// export type Transfer = {
//   id: string;
//   quoteId: string;
//   transactionRequestId: string;
//   fulfilment: string;
//   transferState: string; // field suspended, remove if depricated
//   amount: Money;
// }
