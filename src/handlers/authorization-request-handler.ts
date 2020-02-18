import { AdaptorServices } from '../adaptor'
import { LegacyAuthorizationResponse } from '../types/adaptor-relay-messages'
import { ErrorInformation } from '../types/mojaloop'
import { TransactionState, Transaction, LpsMessage, LegacyMessageType } from '../models'

export async function authorizationRequestHandler ({ queueService, logger, authorizationsService }: AdaptorServices, transactionRequestId: string, headers: { [k: string]: any }): Promise<void> {
  try {
    const transaction = await Transaction.query().where({ transactionRequestId }).withGraphFetched('quote').first().throwIfNotFound()
    const legacyAuthorizationRequest = await transaction.$relatedQuery<LpsMessage>('lpsMessages').where({ type: LegacyMessageType.authorizationRequest }).first().throwIfNotFound()

    if (!transaction.quote) {
      throw new Error('Transaction does not have a quote.')
    }

    const authorizationRequest: LegacyAuthorizationResponse = {
      lpsAuthorizationRequestMessageId: legacyAuthorizationRequest.id,
      fees: {
        amount: transaction.quote.feeAmount,
        currency: transaction.quote.feeCurrency
      },
      transferAmount: {
        amount: transaction.quote.transferAmount,
        currency: transaction.quote.transferAmountCurrency
      }
    }

    await queueService.addToQueue(`${transaction.lpsId}AuthorizationResponses`, authorizationRequest)

    await transaction.$query().update({ state: TransactionState.authSent, previousState: transaction.state })
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
