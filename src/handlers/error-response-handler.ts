import { AdaptorServices } from '../adaptor'
import { MojaloopErrorQueueMessage, MojaloopError } from '../types/queueMessages'
import { Quote, LpsMessage, LegacyMessageType, Transaction, TransactionState, Transfers } from '../models'
import { LegacyAuthorizationResponse, ResponseType, LegacyFinancialResponse, LegacyReversalResponse } from '../types/adaptor-relay-messages'

async function findTransaction (type: MojaloopError, typeId: string): Promise<Transaction> {
  switch (type) {
    case MojaloopError.quote:
      const quote = await Quote.query().where({ id: typeId }).first().throwIfNotFound()
      return Transaction.query().where({ transactionRequestId: quote.transactionRequestId }).first().throwIfNotFound()
    case MojaloopError.transfer:
      const transfer = await Transfers.query().where({ id: typeId }).first().throwIfNotFound()
      return Transaction.query().where({ transactionRequestId: transfer.transactionRequestId }).first().throwIfNotFound()
    default:
      throw new Error('Error response handler: Could not find transaction.')
  }
}

export async function errorResponseHandler ({ logger, queueService }: AdaptorServices, { type, typeId }: MojaloopErrorQueueMessage): Promise<void> {
  try {
    const transaction = await findTransaction(type, typeId)

    if (transaction.isValid()) await transaction.$query().modify('updateState', TransactionState.transactionCancelled)

    if (!transaction.isRefund() && type === MojaloopError.quote) {
      const legacyAuthorizationRequest = await transaction.$relatedQuery<LpsMessage>('lpsMessages').where({ type: LegacyMessageType.authorizationRequest }).first().throwIfNotFound()
      const response: LegacyAuthorizationResponse = {
        lpsAuthorizationRequestMessageId: legacyAuthorizationRequest.id,
        response: ResponseType.invalid
      }
      await queueService.addToQueue(`${transaction.lpsId}AuthorizationResponses`, response)
    }

    if (!transaction.isRefund() && type === MojaloopError.transfer) {
      const legacyFinancialRequest = await transaction.$relatedQuery<LpsMessage>('lpsMessages').where({ type: LegacyMessageType.financialRequest }).first().throwIfNotFound()
      const response: LegacyFinancialResponse = {
        lpsFinancialRequestMessageId: legacyFinancialRequest.id,
        response: ResponseType.invalid
      }
      await queueService.addToQueue(`${transaction.lpsId}FinancialResponses`, response)
    }

    if (transaction.isRefund()) {
      logger.error('Mojaloop Error Handler: Failed to process refund transaction ' + transaction.transactionRequestId)
      // TODO: add to some alerting system?
      const legacyReversalRequest = await transaction.$relatedQuery<LpsMessage>('lpsMessages').where({ type: LegacyMessageType.reversalRequest }).first().throwIfNotFound()
      const response: LegacyReversalResponse = {
        lpsReversalRequestMessageId: legacyReversalRequest.id,
        response: ResponseType.invalid
      }
      await queueService.addToQueue(`${transaction.lpsId}ReversalResponses`, response)
    }

  } catch (error) {
    logger.error('Mojaloop Error Handler: Failed to process error message.' + error.toString())
  }
}
