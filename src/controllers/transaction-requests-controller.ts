import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { TransactionRequestsIDPutResponse } from 'types/mojaloop'

export async function update (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Transaction Requests Controller: Received transaction request response. TransactionRequestId: ' + request.params.ID + ' payload: ' + JSON.stringify(request.payload))
    const transactionRequestResponse = request.payload as TransactionRequestsIDPutResponse

    if (transactionRequestResponse.transactionId) {
      await request.server.app.transactionsService.updateTransactionId(request.params.ID, 'transactionRequestId', transactionRequestResponse.transactionId)
    }

    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error('Transaction Requests Controller: Could not process transaction request response. TransactionRequestId: ' + request.params.ID)
    return h.response().code(500)
  }
}
