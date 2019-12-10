import { Request, ResponseObject, ResponseToolkit } from 'hapi';
import IlpPacket from 'ilp-packet';
import { TransfersPostRequest } from 'types/mojaloop';
import { Transfer, KnexTransfersService } from 'services/transfers-service';

const sdk = require('@mojaloop/sdk-standard-components')

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {

  const payload: TransfersPostRequest = request.payload as TransfersPostRequest

  const binaryPacket = Buffer.from(payload.ilpPacket, 'base64');
	const jsonPacket = IlpPacket.deserializeIlpPacket(binaryPacket);
	const dataElement = JSON.parse(Buffer.from(jsonPacket.data.toString(), 'base64').toString('utf8'));
  const transactionId = dataElement.transactionId

  // use transactionId to find transaction

  const fulfilment = sdk.Ilp.caluclateFulfil(payload.ilpPacket)


  // create transfer
  
  const transfer: Transfer = {
    id: "",
    quoteId: "",
    transactionRequestId: "",
    fulfilment: "",
    transferState: "",
    amount: {
      amount: "",
      currency: "",
    }
  }

  await request.server.app.transfersService.create(transfer)
  
  // mojaloop/PUT/transfer/<Id>


  return h.response().code(500)

}


// PUT/transfer/<Id>
// find transaction
// set STATE = COMPLETED
// find 0200 by txRID
// populate 0210
// use lspId to find correct tcp relay
// TCPRelay/SEND/{transaction}
