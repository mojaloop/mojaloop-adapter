import { AdaptorServices } from 'adaptor'
import { LegacyReversalRequest } from '../types/adaptor-relay-messages'
import { TransactionType, TransactionRequestsPostRequest } from '../types/mojaloop'
import { Transaction, LpsMessage, TransactionState } from '../models'
const uuid = require('uuid/v4')

export async function legacyReversalHandler ({ mojaClient, logger }: AdaptorServices, financialRequest: LegacyReversalRequest): Promise<void> {
  try {
    const transaction = await Transaction.query().where('transactions.lpsKey', financialRequest.lpsKey).withGraphJoined('[lpsMessages, payer, payee, quote, transfer]').where('lpsMessages.id', financialRequest.lpsFinancialRequestMessageId).first().throwIfNotFound()

    const refund: TransactionType = {
      scenario: 'REFUND',
      initiator: 'PAYER',
      initiatorType: transaction.initiatorType,
      refundInfo: {
        originalTransactionId: transaction.transactionId!
      }
    }
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(financialRequest.lpsReversalRequestMessageId)
    await transaction.$query().update({ state: TransactionState.transactionCancelled, previousState: transaction.state })

    if (transaction.quote && (new Date(transaction.quote.expiration) > new Date(Date.now()))) {
      await transaction.quote.$query().update({ expiration: new Date(Date.now()).toUTCString() })
    }

    if (transaction.transfer) {
      const transactionRequest: TransactionRequestsPostRequest = {
        transactionRequestId: uuid(),
        payee: {
          partyIdInfo: {
            partyIdType: transaction.payer!.identifierType,
            partyIdentifier: transaction.payer!.identifierValue,
            partySubIdOrType: transaction.payer!.subIdOrType,
            fspId: transaction.payer?.fspId
          }
        },
        payer: {
          partyIdType: transaction.payee!.identifierType,
          partyIdentifier: transaction.payee!.identifierValue,
          partySubIdOrType: transaction.payee!.subIdOrType,
          fspId: transaction.payee?.fspId
        },
        amount: {
          currency: transaction.currency,
          amount: transaction.amount
        },
        transactionType: refund
      }

      await mojaClient.postTransactionRequests(transactionRequest, transaction.payer!.fspId!)

      const reversalTransaction = await Transaction.query().insertGraphAndFetch({
        transactionRequestId: transactionRequest.transactionRequestId,
        transactionId: uuid(),
        originalTransactionId: transaction.transactionId,
        lpsId: transaction.lpsId,
        lpsKey: transaction.lpsKey,
        amount: transaction.amount,
        currency: transaction.currency,
        expiration: transaction.expiration,
        initiator: 'PAYER',
        initiatorType: transaction.initiatorType,
        scenario: refund.scenario,
        state: TransactionState.transactionReceived,
        authenticationType: 'OTP',
        fees: [],
        payer: {
          type: 'payer',
          identifierType: transaction.payee!.identifierType,
          identifierValue: transaction.payee!.identifierValue,
          subIdOrType: transaction.payee!.subIdOrType,
          fspId: transaction.payee!.fspId!
        },
        payee: {
          type: 'payee',
          identifierType: transaction.payer!.identifierType,
          identifierValue: transaction.payer!.identifierValue,
          subIdOrType: transaction.payer!.subIdOrType,
          fspId: transaction.payer?.fspId
        }
      })
      await reversalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(financialRequest.lpsReversalRequestMessageId)
    }
  } catch (error) {
    logger.error(`Legacy Reversal Handler: Failed to process legacy reversal request. ${error.message}`)
  }
}
