import { ApplicationState } from 'hapi'
import { QuotesIDPutResponse, QuotesPostRequest } from 'types/mojaloop'
import { TransactionState } from '../services/transactions-service'

export async function handleQuotes (app: ApplicationState, quoteRequest: QuotesPostRequest): Promise<void> {

  const transaction = await app.transactionsService.get(quoteRequest.transactionId, 'transactionId')
  const lpsFees = transaction.lpsFee
  const adaptorFees = await app.quotesService.calculateAdaptorFees(transaction.amount) // TODO: should it be calculated on transaction amount + lpsFee?

  const quote = await app.quotesService.create(quoteRequest, lpsFees, adaptorFees)

  const quoteResponse: QuotesIDPutResponse = {
    condition: quote.condition,
    ilpPacket: quote.ilpPacket,
    expiration: quote.expiration,
    transferAmount: quote.transferAmount
  }
  await app.MojaClient.putQuotes(quote.id, quoteResponse, 'fspiop-source')
  await app.transactionsService.updateState(transaction.transactionRequestId, 'transactionRequestId', TransactionState.quoteResponded)
}
