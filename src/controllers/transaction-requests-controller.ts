import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { TransactionRequestsIDPutResponse } from 'types/mojaloop'
import { TransactionRequestResponseQueueMessage } from 'types/queueMessages'

export async function update (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Transaction Requests Controller: Received transaction request response. TransactionRequestId: ' + request.params.ID + ' payload: ' + JSON.stringify(request.payload))

    const message: TransactionRequestResponseQueueMessage = {
      transactionRequestResponse: request.payload as TransactionRequestsIDPutResponse,
      transactionRequestId: request.params.ID,
      headers: request.headers
    }

    await request.server.app.queueService.addToQueue('TransactionRequestResponses', message)

    return h.response().code(200)
  } catch (error) {
    return h.response().code(500)
  }
}
