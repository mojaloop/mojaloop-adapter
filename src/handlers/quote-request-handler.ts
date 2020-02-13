import { Request } from 'hapi'
import { QuotesIDPutResponse, QuotesPostRequest, ErrorInformation } from '../types/mojaloop'
import { TransactionState, Transaction } from '../models'
import { AdaptorServices } from '../adaptor'

export async function quotesRequestHandler ({ quotesService, mojaClient }: AdaptorServices, payload: QuotesPostRequest, headers: Request['headers']): Promise<void> {
  try {
    const transaction = await Transaction.query().where('transactionId', payload.transactionId).withGraphFetched('fees').first().throwIfNotFound()
    const quoteRequest = { transactionRequestId: transaction.transactionRequestId, ...payload }
    const lpsFees = transaction.fees ? transaction.fees.filter(fee => fee.type === 'lps').map(fee => ({ amount: fee.amount, currency: transaction.currency })) : []
    const adaptorFees = await quotesService.calculateAdaptorFees({ amount: transaction.amount, currency: transaction.currency }) // TODO: should it be calculated on transaction amount + lpsFee?

    // TODO: deprecate out quotes service
    const quote = await quotesService.create(quoteRequest, lpsFees.length > 0 ? lpsFees[0] : { amount: '0', currency: transaction.currency }, adaptorFees)

    const quoteResponse: QuotesIDPutResponse = {
      condition: quote.condition,
      ilpPacket: quote.ilpPacket,
      expiration: quote.expiration,
      transferAmount: quote.transferAmount
    }
    await mojaClient.putQuotes(quote.id, quoteResponse, headers['fspiop-source'])

    await transaction.$query().update({ state: TransactionState.quoteResponded, previousState: transaction.state })

  } catch (error) {
    const errorInformation: ErrorInformation = {
      errorCode: '2001',
      errorDescription: `${error.message}`
    }
    mojaClient.putQuotesError(payload.quoteId, errorInformation, headers['fspiop-source'])
  }
}
