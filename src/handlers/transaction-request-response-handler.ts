import { TransactionRequestsIDPutResponse, ErrorInformation } from 'types/mojaloop'
import { TransactionState, Transaction, Quote } from '../models'
import { AdaptorServices } from '../adaptor'
import { Request } from 'hapi'
const uuid = require('uuid/v4')

export async function transactionRequestResponseHandler ({ mojaClient, logger }: AdaptorServices, transactionRequestResponse: TransactionRequestsIDPutResponse, headers: Request['headers'], transactionRequestId: string): Promise<void> {
  try {
    logger.debug(`Transaction Request Response Handler: Received response ${JSON.stringify(transactionRequestResponse)} for transactionRequest ${transactionRequestId}`)
    const transaction = await Transaction.query().where('transactionRequestId', transactionRequestId).first().throwIfNotFound()

    if (transactionRequestResponse.transactionId) {
      logger.debug('Transaction Request Response Handler: Updating transaction id.')
      const state = transaction.state === TransactionState.transactionCancelled ? transaction.state : TransactionState.transactionResponded
      const previousState = transaction.state === TransactionState.transactionCancelled ? transaction.previousState : transaction.state
      await transaction.$query().update({ transactionId: transactionRequestResponse.transactionId, previousState, state })
    }

    if (transactionRequestResponse.transactionRequestState === 'REJECTED') {
      await transaction.$query().modify('updateState', TransactionState.transactionCancelled)
    }

    if (transaction.scenario === 'REFUND' && transaction.isValid()) {
      logger.debug('Transaction Request Response Handler: Initiating quote request for refund.')
      const quote = await Quote.query().insertGraphAndFetch({
        id: uuid(),
        transactionRequestId: transaction.transactionRequestId,
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        amountCurrency: transaction.currency
      })

      mojaClient.postQuotes({
        quoteId: quote.id,
        transactionId: transaction.transactionId,
        transactionRequestId: transaction.transactionRequestId,
        payee: transaction.payer,
        payer: transaction.payee,
        amountType: 'RECEIVE',
        amount: {
          amount: transaction.amount,
          currency: transaction.currency
        },
        transactionType: {
          scenario: transaction.scenario,
          initiator: transaction.initiator,
          initiatorType: transaction.initiatorType,
          refundInfo: {
            originalTransactionId: transaction.originalTransactionId
          }
        }
      }, headers['fspiop-source'])
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
