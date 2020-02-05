import { TransactionRequestsIDPutResponse } from 'types/mojaloop'
import { TransactionState } from '../services/transactions-service'
import { AdaptorServices } from '../adaptor'

export async function transactionRequestHandler ({ transactionsService }: AdaptorServices, transactionRequestResponse: TransactionRequestsIDPutResponse, ID: string): Promise<void> {
  try {

    if (transactionRequestResponse.transactionId) {
      // TODO: refactor update functions
      await transactionsService.updateTransactionId(ID, transactionRequestResponse.transactionId)
      await transactionsService.updateState(ID, 'transactionRequestId', TransactionState.transactionResponded)
    }

    if (transactionRequestResponse.transactionRequestState === 'REJECTED') {
      await transactionsService.updateState(ID, 'transactionRequestId', TransactionState.transactionCancelled)
    }
  } catch (error) {
    // TODO
  }

}
