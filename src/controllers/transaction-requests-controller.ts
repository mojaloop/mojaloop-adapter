import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { TransactionRequestsIDPutResponse } from 'types/mojaloop'
import { TransactionState } from '../services/transactions-service'

export async function update (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Transaction Requests Controller: Received transaction request response. TransactionRequestId: ' + request.params.ID + ' payload: ' + JSON.stringify(request.payload))
    const transactionRequestResponse = request.payload as TransactionRequestsIDPutResponse

    if (transactionRequestResponse.transactionId) {
      // TODO: refactor update functions
      await request.server.app.transactionsService.updateTransactionId(request.params.ID, 'transactionRequestId', transactionRequestResponse.transactionId)
      await request.server.app.transactionsService.updateState(request.params.ID, 'transactionRequestId', TransactionState.transactionResponded)
    }

    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error('Transaction Requests Controller: Could not process transaction request response. TransactionRequestId: ' + request.params.ID + ' error:' + error.message)
    return h.response().code(500)
  }
}
