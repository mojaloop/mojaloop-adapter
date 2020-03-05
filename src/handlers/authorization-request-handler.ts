import { AdaptorServices } from '../adaptor'
import { LegacyAuthorizationResponse, ResponseType } from '../types/adaptor-relay-messages'
import { ErrorInformation } from '../types/mojaloop'
import { TransactionState, Transaction, LpsMessage, LegacyMessageType } from '../models'

const validate = async (transaction: Transaction): Promise<ErrorInformation | undefined> => {
  if (!transaction.isValid()) {
    return { errorCode: '3300', errorDescription: 'Transaction is no longer valid.' }
  }

  if (!transaction.quote) {
    return { errorCode: '3305', errorDescription: 'Quote not found.' }
  }

  if (transaction.quote.isExpired()) {
    return { errorCode: '3302', errorDescription: 'Quote has expired.' }
  }

  return undefined
}

export async function authorizationRequestHandler ({ queueService, logger, authorizationsService }: AdaptorServices, transactionRequestId: string, headers: { [k: string]: any }): Promise<void> {
  try {
    const transaction = await Transaction.query().where({ transactionRequestId }).withGraphFetched('quote').first().throwIfNotFound()

    const error = await validate(transaction)

    const legacyAuthorizationRequest = await transaction.$relatedQuery<LpsMessage>('lpsMessages').where({ type: LegacyMessageType.authorizationRequest }).first().throwIfNotFound()

    if (error) {
      // TODO: add authorizations to mojaloop sdk
      const sendHeaders = {
        'fspiop-destination': headers['fspiop-source'],
        'fspiop-source': process.env.ADAPTOR_FSP_ID || 'adaptor',
        date: new Date().toUTCString(),
        'content-type': 'application/vnd.interoperability.authorizations+json;version=1.0'
      }
      await authorizationsService.sendAuthorizationsErrorResponse(transactionRequestId, error, sendHeaders)
      const authorizationFailure: LegacyAuthorizationResponse = {
        lpsAuthorizationRequestMessageId: legacyAuthorizationRequest.id,
        response: ResponseType.invalid
      }
      await queueService.addToQueue(`${transaction.lpsId}AuthorizationResponses`, authorizationFailure)
      return
    }

    const authorizationRequest: LegacyAuthorizationResponse = {
      lpsAuthorizationRequestMessageId: legacyAuthorizationRequest.id,
      response: ResponseType.approved,
      fees: {
        amount: transaction.quote!.feeAmount, // eslint-disable-line @typescript-eslint/no-non-null-assertion
        currency: transaction.quote!.feeCurrency // eslint-disable-line @typescript-eslint/no-non-null-assertion
      },
      transferAmount: {
        amount: transaction.quote!.transferAmount, // eslint-disable-line @typescript-eslint/no-non-null-assertion
        currency: transaction.quote!.transferAmountCurrency // eslint-disable-line @typescript-eslint/no-non-null-assertion
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
      'fspiop-destination': headers['fspiop-source'],
      'fspiop-source': process.env.ADAPTOR_FSP_ID || 'adaptor',
      date: new Date().toUTCString(),
      'content-type': 'application/vnd.interoperability.authorizations+json;version=1.0'
    }

    await authorizationsService.sendAuthorizationsErrorResponse(transactionRequestId, errorInformation, sendHeaders)
  }
}
