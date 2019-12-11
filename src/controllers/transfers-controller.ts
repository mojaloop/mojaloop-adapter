import { Request, ResponseObject, ResponseToolkit } from 'hapi';
import IlpPacket from 'ilp-packet';
import { TransfersPostRequest } from 'types/mojaloop';
import { Transfer, KnexTransfersService } from 'services/transfers-service';
import { TransferTimedOutError } from 'ilp-packet/dist/src/errors';

const sdk = require('@mojaloop/sdk-standard-components')

export async function create(request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  // decode ILP packet


  // get trxId
  // create fulfilment
  // create transfer
  // persist transfer
  // return fulfilment
  // update trxState -> enum.fulfilmentSent

  return h.response().code(200)

}

// post/transfer.payload: TransfersPostRequest
//   transferId
//   payeeFsp
//   payerFsp
//   amount
//   ilpPacket
//   condition
//   expiration
//   extensionList

// export type Transfer = {
//   id: string;
//   quoteId: string;
//   transactionRequestId: string;
//   fulfilment: string;
//   transferState: string;
//   amount: Money;
// }
