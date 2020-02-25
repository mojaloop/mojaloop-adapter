import { TransactionRequestsIDPutResponse, ErrorInformation } from 'types/mojaloop'
import { TransactionState, Transaction } from '../models'
import { AdaptorServices } from '../adaptor'
import { Request } from 'hapi'

export async function transactionRequestResponseHandler ({ mojaClient, logger }: AdaptorServices, transactionRequestResponse: TransactionRequestsIDPutResponse, headers: Request['headers'], transactionRequestId: string): Promise<void> {
  try {
    logger.debug(`Transaction Request Response Handler: Received response ${JSON.stringify(transactionRequestResponse)} for transactionRequest ${transactionRequestId}`)
    const transaction = await Transaction.query().where('transactionRequestId', transactionRequestId).first().throwIfNotFound()

    if (transactionRequestResponse.transactionId) {
      logger.debug('Transaction Request Response Handler: Updating transaction id.')
      await transaction.$query().update({ transactionId: transactionRequestResponse.transactionId, previousState: transaction.previousState, state: TransactionState.transactionResponded })
    }

    if (transactionRequestResponse.transactionRequestState === 'REJECTED') {
      await transaction.$query().update({ previousState: transaction.previousState, state: TransactionState.transactionCancelled })
    }
  } catch (error) {
    logger.error(`Transaction Request Response Handler: Failed to process transaction request response: ${transactionRequestId} from ${headers['fspiop-source']}. ${error.message}`)
    const errorInformation: ErrorInformation = {
      errorCode: '2001',
      errorDescription: 'Failed to update transactionId'
    }

    await mojaClient.putTransactionRequestsError(transactionRequestId, errorInformation, headers['fspiop-source'])
  }

}
