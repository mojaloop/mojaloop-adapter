import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { QuotesPostRequest, QuotesIDPutResponse } from 'types/mojaloop'

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
      'fspiop-source': request.headers['fspiop-destination']
    }
    await request.server.app.quotesService.sendQuoteResponse(quoteRequest.quoteId, quoteResponse, headers)

    return h.response().code(200)
  } catch (error) {
    const quoteRequest = request.payload as QuotesPostRequest
    request.server.app.logger.error(`Quotes Controller: Failed to give quote response for quoteId: ${quoteRequest.quoteId}. ${error.toString()}`)
    return h.response().code(500)
  }
}
