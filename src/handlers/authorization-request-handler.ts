import { AdaptorServices } from '../adaptor'
import { LegacyAuthorizationResponse } from '../types/adaptor-relay-messages'
import { ErrorInformation } from '../types/mojaloop'
import { TransactionState } from '../services/transactions-service'

export async function authorizationRequestHandler ({ transactionsService, quotesService, queueService, logger, authorizationsService }: AdaptorServices, transactionRequestId: string, headers: { [k: string]: any }): Promise<void> {
  try {
    const transaction = await transactionsService.get(transactionRequestId, 'transactionRequestId')
    const quote = await quotesService.get(transactionRequestId, 'transactionRequestId')

    const authorizationRequest: LegacyAuthorizationResponse = {
      lpsAuthorizationRequestMessageId: 'lpsMessageId', // TODO: refactor DB
      fees: quote.fees,
      transferAmount: quote.transferAmount
    }

    await queueService.addToQueue(`${transaction.lpsId}AuthorizationResponses`, authorizationRequest)

    await transactionsService.updateState(transactionRequestId, 'transactionRequestId', TransactionState.authSent)
  } catch (error) {
    logger.error(`Authorization Request Handler: Failed to handle authorization request. ${error.message}`)
    const errorInformation: ErrorInformation = {
      errorCode: '2001',
      errorDescription: 'Failed to handle authorization request.'
    }

    // TODO: add authorizations to mojaloop sdk
    const sendHeaders = {
      'fspiop-destination': headers['fspiop-'],
      'fspiop-source': process.env.ADAPTOR_FSP_ID || 'adaptor',
      date: new Date().toUTCString(),
      'content-type': 'application/vnd.interoperability.authorizations+json;version=1.0'
    }

    await authorizationsService.sendAuthorizationsErrorResponse(transactionRequestId, errorInformation, sendHeaders)
  }
}
