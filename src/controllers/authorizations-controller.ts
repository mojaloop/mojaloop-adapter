import { Request, ResponseToolkit, ResponseObject } from 'hapi'
const iso8583 = require('iso_8583');

export async function show (request: Request, h: ResponseToolkit): Promise <ResponseObject> {
  try {
    const transactionRequestID = request.params.ID
    const transactionsService = request.server.app.transactionsService
    const transaction = await transactionsService.get(transactionRequestID, 'transactionRequestId')
    const isoMessageService = request.server.app.isoMessagesService
    const lpsKey = 'postillion'                    // to be fetched from transaction table for the time being its hard coded.

    const iso0100 = await isoMessageService.get(transactionRequestID, transaction.lpsKey, '0100')
    let iso0110 = {
        0	: '0110',
        3	:  iso0100[3],
        4	:  iso0100[4],
        7	:  iso0100[7],
        11	: iso0100[11],
        28	: iso0100[28],
        37	: iso0100[37],
        39  : '00',
        41	: iso0100[41],
        42	: iso0100[42],
        49	: iso0100[49],
        102	: iso0100[102],
        103	: iso0100[103],
        127.2: iso0100[127.2] 
    };

                         
    const iso110db = await isoMessageService.create(transactionRequestID, transaction.lpsKey, transaction.lpsId, iso0110)

    if (!iso110db) {
      throw new Error('Error creating Authorization transaction request.')
    }
    const client = request.server.app.isoMessagingClients.get(lpsKey) // use 'postillion' as lpsId to return client
    if (!client) {                                                    // client.sendFinancialResponse
      throw new Error('No client is set')                             // sendFinancialResponse in transfersController
    }

    await client.sendAuthorizationRequest(iso110db)

    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error(`Error creating Authorization transaction request. ${error.message}`)
    return h.response().code(500)
  }

}
