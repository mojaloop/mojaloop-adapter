import { AdaptorServices } from '../adaptor'
import { LegacyAuthorizationRequest, ResponseType } from '../types/adaptor-relay-messages'
import { Transaction, TransactionState, LpsMessage } from '../models'
const uuid = require('uuid/v4')

export async function legacyAuthorizationRequestHandler ({ logger, mojaClient, queueService }: AdaptorServices, legacyAuthorizationRequest: LegacyAuthorizationRequest): Promise<void> {
  try {

    await Transaction.query().modify('incomplete', legacyAuthorizationRequest.lpsKey).modify('updateState', TransactionState.transactionCancelled)

    const fees = legacyAuthorizationRequest.lpsFee ? [{ type: 'lps', amount: legacyAuthorizationRequest.lpsFee.amount, currency: legacyAuthorizationRequest.lpsFee.currency }] : []
    const transaction = await Transaction.query().insertGraph({
      transactionRequestId: uuid(),
      lpsId: legacyAuthorizationRequest.lpsId,
      lpsKey: legacyAuthorizationRequest.lpsKey,
      amount: legacyAuthorizationRequest.amount.amount,
      currency: legacyAuthorizationRequest.amount.currency,
      expiration: legacyAuthorizationRequest.expiration,
      initiator: 'PAYEE',
      initiatorType: legacyAuthorizationRequest.transactionType.initiatorType,
      scenario: legacyAuthorizationRequest.transactionType.scenario,
      state: TransactionState.transactionReceived,
      authenticationType: 'OTP',
      fees,
      payer: {
        type: 'payer',
        identifierType: legacyAuthorizationRequest.payer.partyIdType,
        identifierValue: legacyAuthorizationRequest.payer.partyIdentifier
      },
      payee: {
        type: 'payee',
        identifierType: legacyAuthorizationRequest.payee.partyIdType,
        identifierValue: legacyAuthorizationRequest.payee.partyIdentifier,
        subIdOrType: legacyAuthorizationRequest.payee.partySubIdOrType,
        fspId: process.env.ADAPTOR_FSP_ID || 'adaptor'
      }
    })
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyAuthorizationRequest.lpsAuthorizationRequestMessageId)

    await mojaClient.getParties(legacyAuthorizationRequest.payer.partyIdType, legacyAuthorizationRequest.payer.partyIdentifier, null)

  } catch (error) {
    logger.error(`Legacy Authorization Request Handler: Failed to process authorization request. ${error.message}`)
    await queueService.addToQueue(`${legacyAuthorizationRequest.lpsId}AuthorizationResponses`, { lpsAuthorizationRequestMessageId: legacyAuthorizationRequest.lpsAuthorizationRequestMessageId, response: ResponseType.invalid })
  }
}
