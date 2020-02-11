import { AdaptorServices } from 'adaptor'
import { LegacyFinancialRequest } from '../types/adaptor-relay-messages'
import { AuthorizationsIDPutResponse } from '../types/mojaloop'
import { TransactionState } from '../services/transactions-service'

export async function legacyFinancialRequestHandler ({ transactionsService, authorizationsService, logger }: AdaptorServices, financialRequest: LegacyFinancialRequest): Promise<void> {
  try {
    const transaction = await transactionsService.getByLpsKeyAndState(financialRequest.lpsKey, TransactionState.authSent)

    if (!financialRequest.authenticationInfo) {
      throw new Error('Missing authenticationInfo.')
    }

    // TODO: add authorizations to mojaloop sdk
    const headers = {
      'fspiop-destination': transaction.payer.fspId!,
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

    await transactionsService.updateState(transaction.transactionRequestId, 'transactionRequestId', TransactionState.financialRequestSent)
  } catch (error) {
    logger.error(`Legacy Financial Request Handler: Failed to process legacy financial request. ${error.message}`)
    // TODO: send cancellation back to LPS switch
  }
}
