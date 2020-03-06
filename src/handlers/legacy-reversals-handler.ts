import { AdaptorServices } from 'adaptor'
import { LegacyReversalRequest } from '../types/adaptor-relay-messages'
import { TransactionType, QuotesPostRequest } from '../types/mojaloop'
import { Transaction, LpsMessage, TransactionState, TransactionParty, Quote } from '../models'
import { assertExists } from '../utils/util'
const uuid = require('uuid/v4')

export async function legacyReversalHandler ({ logger, mojaClient }: AdaptorServices, financialRequest: LegacyReversalRequest): Promise<void> {
  try {
    const transaction = await Transaction.query().where('transactions.lpsKey', financialRequest.lpsKey).withGraphJoined('[lpsMessages, payer, payee, quote, transfer]').where('lpsMessages.id', financialRequest.lpsFinancialRequestMessageId).first().throwIfNotFound()

    const refund: TransactionType = {
      scenario: 'REFUND',
      initiator: 'PAYER',
      initiatorType: transaction.initiatorType,
      refundInfo: {
        originalTransactionId: assertExists<string>(transaction.transactionId, 'Transaction does not have transactionId')
      }
    }
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(financialRequest.lpsReversalRequestMessageId)
    await transaction.$query().update({ state: TransactionState.transactionCancelled, previousState: transaction.state })

    if (transaction.quote && (new Date(transaction.quote.expiration) > new Date(Date.now()))) {
      logger.debug(`Legacy Reversal Handler: Expiring quote for transaction request id: ${transaction.transactionRequestId}`)
      await transaction.quote.$query().update({ expiration: new Date(Date.now()).toUTCString() })
    }

    if (transaction.transfer) {
      logger.debug(`Legacy Reversal Handler: Creating refund transaction: ${transaction.transactionRequestId}`)
      const originalPayee = assertExists<TransactionParty>(transaction.payee, 'Transaction does not have a payee')
      const originalPayer = assertExists<TransactionParty>(transaction.payer, 'Transaction does not have a payer')
      const reversalTransactionId = uuid()
      const reversalTransaction = await Transaction.query().insertGraphAndFetch({
        transactionRequestId: uuid(),
        transactionId: reversalTransactionId,
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
          identifierType: originalPayee.identifierType,
          identifierValue: originalPayee.identifierValue,
          subIdOrType: originalPayee.subIdOrType,
          fspId: originalPayee.fspId
        },
        payee: {
          type: 'payee',
          identifierType: originalPayer.identifierType,
          identifierValue: originalPayer.identifierValue,
          subIdOrType: originalPayer.subIdOrType,
          fspId: originalPayer.fspId
        }
      })
      await reversalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(financialRequest.lpsReversalRequestMessageId)

      const quoteId = uuid()
      const quoteRequest: QuotesPostRequest = {
        quoteId,
        amount: {
          amount: transaction.amount,
          currency: transaction.currency
        },
        amountType: 'RECEIVE',
        payee: originalPayer.toMojaloopParty(),
        payer: originalPayee.toMojaloopParty(),
        transactionId: reversalTransactionId,
        transactionType: refund
      }
      await reversalTransaction.$relatedQuery('quote').insert({
        id: quoteId,
        transactionId: reversalTransactionId,
        amount: transaction.amount,
        amountCurrency: transaction.currency
      })
      await mojaClient.postQuotes(quoteRequest, assertExists<string>(originalPayer.fspId, 'Original payer does not have an fspId'))
    }
  } catch (error) {
    console.log('error', error)
    logger.error(`Legacy Reversal Handler: Failed to process legacy reversal request. ${error.message}`)
  }
}
