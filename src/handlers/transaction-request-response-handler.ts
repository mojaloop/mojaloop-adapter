import { TransactionRequestsIDPutResponse, ErrorInformation } from 'types/mojaloop'
import { TransactionState } from '../models'
import { AdaptorServices } from '../adaptor'
import { Request } from 'hapi'

export async function transactionRequestResponseHandler ({ transactionsService, mojaClient }: AdaptorServices, transactionRequestResponse: TransactionRequestsIDPutResponse, headers: Request['headers'], transactionRequestId: string): Promise<void> {
  try {

    if (transactionRequestResponse.transactionId) {
      // TODO: refactor update functions
      await transactionsService.updateTransactionId(transactionRequestId, transactionRequestResponse.transactionId)
      await transactionsService.updateState(transactionRequestId, 'transactionRequestId', TransactionState.transactionResponded)
    }

    if (transactionRequestResponse.transactionRequestState === 'REJECTED') {
      await transactionsService.updateState(transactionRequestId, 'transactionRequestId', TransactionState.transactionCancelled)
    }
  } catch (error) {
    const errorInformation: ErrorInformation = {
      errorCode: '2001',
      errorDescription: 'Failed to update transactionId'
    }

    await mojaClient.putTransactionRequestsError(transactionRequestId, errorInformation, headers['fspiop-source'])
  }

}
