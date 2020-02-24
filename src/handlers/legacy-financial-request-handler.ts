import { AdaptorServices } from 'adaptor'
import { LegacyFinancialRequest } from '../types/adaptor-relay-messages'
import { AuthorizationsIDPutResponse } from '../types/mojaloop'
import { TransactionState, Transaction, LpsMessage } from '../models'

export async function legacyFinancialRequestHandler ({ authorizationsService, logger }: AdaptorServices, financialRequest: LegacyFinancialRequest): Promise<void> {
  try {
    const transaction = await Transaction.query().where('lpsKey', financialRequest.lpsKey).withGraphFetched('payer').where('state', TransactionState.authSent).orderBy('created_at', 'desc').first().throwIfNotFound()
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(financialRequest.lpsFinancialRequestMessageId)

    if (!financialRequest.authenticationInfo) {
      throw new Error('Missing authenticationInfo.')
    }

    if (!transaction.payer) {
      throw new Error('Transaction does not have payer')
    }

    // TODO: add authorizations to mojaloop sdk
    const headers = {
      'fspiop-destination': transaction.payer.fspId,
      'fspiop-source': process.env.ADAPTOR_FSP_ID || 'adaptor',
      date: new Date().toUTCString(),
      'content-type': 'application/vnd.interoperability.authorizations+json;version=1.0'
    }

    const authorizationsResponse: AuthorizationsIDPutResponse = {
      authenticationInfo: {
        authentication: 'OTP',
        authenticationValue: financialRequest.authenticationInfo.authenticationValue
      },
      responseType: 'ENTERED'
    }
    await authorizationsService.sendAuthorizationsResponse(transaction.transactionRequestId, authorizationsResponse, headers)

    await transaction.$query().update({ state: TransactionState.financialRequestSent, previousState: transaction.state })
  } catch (error) {
    logger.error(`Legacy Financial Request Handler: Failed to process legacy financial request. ${error.message}`)
    // TODO: send cancellation back to LPS switch
  }
}
