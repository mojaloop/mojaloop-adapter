import { Request, ResponseToolkit, ResponseObject } from 'hapi'

export async function show (request: Request, h: ResponseToolkit): Promise <ResponseObject> {
  try {
    const transactionRequestID = request.params.ID
    const transactionsService = request.server.app.transactionsService
    const transaction = await transactionsService.get(transactionRequestID, 'transactionRequestId')
    const isoMessageService = request.server.app.isoMessagesService
    const lpsKey = 'postillion'                    // to be fetched from transaction table for the time being its hard coded.
    const iso0100 = await isoMessageService.get(transactionRequestID, transaction.lpsKey, '0100')
    iso0100[0] = '0110'                           // Changing  message type to reponse
    iso0100[39] = '00'                            // Resposne for successfull transaction
    const iso0110 = iso0100

    const iso110db = await isoMessageService.create(transactionRequestID, transaction.lpsKey, transaction.lpsId, iso0110)

    if (!iso110db) {
      throw new Error('Error creating Authorization transaction request.')
    }

    const client = request.server.app.isoMessagingClients.get(lpsKey)

    if (!client) {
      throw new Error('No client is set')
    }

    await client.sendAuthorizationRequest(iso110db)

    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error(`Error creating Authorization transaction request. ${error.message}`)
    return h.response().code(500)
  }

}
