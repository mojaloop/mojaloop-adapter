import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { QuotesPostRequest, QuotesIDPutResponse } from 'types/mojaloop'
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
    const headers = {
      'fspiop-destination': request.headers['fspiop-source'],
      'fspiop-source': request.headers['fspiop-destination'],
      date: new Date().toUTCString(),
      'content-type': 'application/vnd.interoperability.quotes+json;version=1.0',
    }
    await request.server.app.quotesService.sendQuoteResponse(quoteRequest.quoteId, quoteResponse, headers)
    await request.server.app.transactionsService.updateState(transaction.transactionRequestId, 'transactionRequestId', TransactionState.quoteResponded)

    return h.response().code(200)
  } catch (error) {
    const quoteRequest = request.payload as QuotesPostRequest
    request.server.app.logger.error(`Quotes Controller: Failed to give quote response for quoteId: ${quoteRequest.quoteId}. ${error.toString()}`)
    return h.response().code(500)
  }
}
