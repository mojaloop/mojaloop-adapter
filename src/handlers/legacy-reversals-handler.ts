import { AdaptorServices } from 'adaptor'
import { LegacyReversalRequest, ResponseType } from '../types/adaptor-relay-messages'
import { TransactionType, QuotesPostRequest } from '../types/mojaloop'
import { Transaction, LpsMessage, TransactionState, TransactionParty, TransferState } from '../models'
import { assertExists } from '../utils/util'
const uuid = require('uuid/v4')

export async function legacyReversalHandler ({ logger, mojaClient, queueService }: AdaptorServices, reversalRequest: LegacyReversalRequest): Promise<void> {
  try {
    const lpsMessage = await LpsMessage.query().where('lpsMessages.id', reversalRequest.lpsReversalRequestMessageId).withGraphJoined('transactions').first().throwIfNotFound()

    if (assertExists<Transaction[]>(lpsMessage.transactions, 'No transactions found for legacy message.').filter(trx => trx.scenario === 'REFUND').length !== 0) {
      logger.debug(`Legacy Reversal Handler: Refund transaction already associated with legacy reversal message id: ${reversalRequest.lpsReversalRequestMessageId} from lpsKey: ${reversalRequest.lpsKey}`)
      return
    }

    const transaction = await Transaction.query().where('transactions.lpsKey', reversalRequest.lpsKey).withGraphJoined('[lpsMessages, payer, payee, quote, transfer]').where('lpsMessages.id', reversalRequest.lpsFinancialRequestMessageId).first().throwIfNotFound()

    const refund: TransactionType = {
      scenario: 'REFUND',
      initiator: 'PAYER',
      initiatorType: transaction.initiatorType,
      refundInfo: {
        originalTransactionId: assertExists<string>(transaction.transactionId, 'Transaction does not have transactionId')
      }
    }
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(reversalRequest.lpsReversalRequestMessageId)
    await transaction.$query().modify('updateState', TransactionState.transactionCancelled)

    if (transaction.quote && (new Date(transaction.quote.expiration) > new Date(Date.now()))) {
      logger.debug(`Legacy Reversal Handler: Expiring quote for transaction request id: ${transaction.transactionRequestId}`)
      await transaction.quote.$query().update({ expiration: new Date(Date.now()).toUTCString() })
    }

    if (transaction.transfer && transaction.transfer.state === TransferState.committed) {
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
      await reversalTransaction.$relatedQuery<LpsMessage>('lpsMessages').relate(reversalRequest.lpsReversalRequestMessageId)

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
    logger.error(`Legacy Reversal Handler: Failed to process legacy reversal request. ${error.message}`)
    await queueService.addToQueue(`${reversalRequest.lpsId}ReversalResponses`, { lpsReversalRequestMessageId: reversalRequest.lpsReversalRequestMessageId, response: ResponseType.invalid })
  }
}
