import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { QuotesPostRequest } from 'types/mojaloop'
import { handleQuotes } from '../handlers/quotes-handler'

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Received POST quote request. headers: ' + JSON.stringify(request.headers) + ' payload: ' + JSON.stringify(request.payload))

    await handleQuotes(request.server.app, request.payload as QuotesPostRequest)

    return h.response().code(202)
  } catch (error) {
    const quoteRequest = request.payload as QuotesPostRequest
    request.server.app.logger.error(`Quotes Controller: Failed to give quote response for quoteId: ${quoteRequest.quoteId}. ${error.toString()}`)
    return h.response().code(500)
  }
}
