import { Request } from 'hapi'
import { QuotesIDPutResponse, QuotesPostRequest, ErrorInformation } from '../types/mojaloop'
import { TransactionState } from '../services/transactions-service'
import { AdaptorServices } from '../adaptor'

export async function quotesRequestHandler ({ transactionsService, quotesService, mojaClient }: AdaptorServices, payload: QuotesPostRequest, headers: Request['headers']): Promise<void> {
  try {
    const transaction = await transactionsService.get(payload.transactionId, 'transactionId')
    const quoteRequest = { transactionRequestId: transaction.transactionRequestId, ...payload }
    const lpsFees = transaction.lpsFee
    const adaptorFees = await quotesService.calculateAdaptorFees(transaction.amount) // TODO: should it be calculated on transaction amount + lpsFee?

    const quote = await quotesService.create(quoteRequest, lpsFees, adaptorFees)

    const quoteResponse: QuotesIDPutResponse = {
      condition: quote.condition,
      ilpPacket: quote.ilpPacket,
      expiration: quote.expiration,
      transferAmount: quote.transferAmount
    }
    await mojaClient.putQuotes(quote.id, quoteResponse, headers['fspiop-source'])
    await transactionsService.updateState(transaction.transactionRequestId, 'transactionRequestId', TransactionState.quoteResponded)
  } catch (error) {
    const errorInformation: ErrorInformation = {
      errorCode: '2001',
      errorDescription: `${error.message}`
    }
    mojaClient.putQuotesError(payload.quoteId, errorInformation, headers['fspiop-source'])
  }
}
