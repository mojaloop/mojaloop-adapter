import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { QuotesIDPutResponse, QuotesPostRequest } from 'types/mojaloop'
import { TransactionState } from '../services/transactions-service'

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Received POST quote request. headers: ' + JSON.stringify(request.headers) + ' payload: ' + JSON.stringify(request.payload))
    const quoteRequest = request.payload as QuotesPostRequest

    const transaction = await request.server.app.transactionsService.get(quoteRequest.transactionId, 'transactionId')
    const lpsFees = transaction.lpsFee
    const adaptorFees = await request.server.app.quotesService.calculateAdaptorFees(transaction.amount) // TODO: should it be calculated on transaction amount + lpsFee?

    const quote = await request.server.app.quotesService.create(quoteRequest, lpsFees, adaptorFees)

    const quoteResponse: QuotesIDPutResponse = {
      condition: quote.condition,
      ilpPacket: quote.ilpPacket,
      expiration: quote.expiration,
      transferAmount: quote.transferAmount
    }
    await request.server.app.MojaClient.putQuotes(quote.id, quoteResponse, request.headers['fspiop-source'])
    await request.server.app.transactionsService.updateState(transaction.transactionRequestId, 'transactionRequestId', TransactionState.quoteResponded)

    return h.response().code(202)
  } catch (error) {
    const quoteRequest = request.payload as QuotesPostRequest
    request.server.app.logger.error(`Quotes Controller: Failed to give quote response for quoteId: ${quoteRequest.quoteId}. ${error.toString()}`)
    return h.response().code(500)
  }
}
