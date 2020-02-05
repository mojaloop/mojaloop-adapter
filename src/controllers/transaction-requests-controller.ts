import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { TransactionRequestsIDPutResponse } from 'types/mojaloop'

export async function update (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Transaction Requests Controller: Received transaction request response. TransactionRequestId: ' + request.params.ID + ' payload: ' + JSON.stringify(request.payload))

    const transactionObject = {
      transactionRequestResponse: request.payload as TransactionRequestsIDPutResponse,
      ID: request.params.ID
    }

    await request.server.app.queueService.addToQueue('TransactionRequests', transactionObject)

    return h.response().code(200)
  } catch (error) {
    return h.response().code(500)
  }
}
