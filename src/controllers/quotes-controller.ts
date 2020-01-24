import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { QuotesPostRequest } from '../types/mojaloop'

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Received POST quote request. headers: ' + JSON.stringify(request.headers) + ' payload: ' + JSON.stringify(request.payload))

    const quotesObject = {
      payload: request.payload as QuotesPostRequest,
      headers: request.headers
    }

    await request.server.app.queueService.addToQueue('QuoteRequests', quotesObject)

    return h.response().code(202)
  } catch (error) {
    return h.response().code(500)
  }
}
