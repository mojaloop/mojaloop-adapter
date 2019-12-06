import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { TransfersPostRequest } from 'types/mojaloop';

const sdk = require('@mojaloop/sdk-standard-components')
const IlpPacket = require('ilp-packet'); 


// export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {

// 	request.server.app.logger.info('Received POST transfer request. headers: ' + JSON.stringify(request.headers) + ' payload: ' + JSON.stringify(request.payload))
// 	const transferRequest = request.payload as TransfersPostRequest
// 	const ilpPacket = transferRequest.ilpPacket
// 	const binaryPacket = Buffer.from(ilpPacket, 'base64');
// 	const jsonPacket = IlpPacket.deserializeIlpPacket(binaryPacket);
	
// 	const dataElement = JSON.parse(Buffer.from(jsonPacket.data.data.toString('utf8'), 'base64').toString('utf8'));
// 	const transactionId = transferRequest.trans
	
// // extract transactionId from ilpPacket
// // use transactionId to find transaction
// // calculate fulfilment
// // create transfer
// // mojaloop/PUT/transfer/<Id>

// }

export async function playing (something: Something) {
	// gets something
	// does something
	// return something
}

// PUT/transfer/<Id>
// find transaction
// set STATE = COMPLETED
// find 0200 by txRID
// populate 0210
// use lspId to find correct tcp relay
// TCPRelay/SEND/{transaction}
