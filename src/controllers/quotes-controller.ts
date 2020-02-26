import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { QuotesPostRequest, QuotesIDPutResponse } from '../types/mojaloop'
import { QuoteResponseQueueMessage } from 'types/queueMessages'

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

export async function update (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Received PUT quote response. headers: ' + JSON.stringify(request.headers) + ' payload: ' + JSON.stringify(request.payload))

    const message: QuoteResponseQueueMessage = {
      quoteResponse: request.payload as QuotesIDPutResponse,
      quoteId: request.params.ID,
      headers: request.headers
    }

    await request.server.app.queueService.addToQueue('QuoteResponses', message)

    return h.response().code(200)
  } catch (error) {
    return h.response().code(500)
  }
}
