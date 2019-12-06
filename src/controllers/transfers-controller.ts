const sdk = require('@mojaloop/sdk-standard-components')
const IlpPacket = require('ilp-packet'); 



// POST/transfer
// use transactionId to find transaction
// create transfer
// calculate fulfilment
// mojaloop/PUT/transfer/<Id>

// PUT/transfer/<Id>
// find transaction
// set STATE = COMPLETED
// find 0200 by txRID
// populate 0210
// use lspId to find correct tcp relay
// TCPRelay/SEND/{transaction}
