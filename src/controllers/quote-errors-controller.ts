import { Request, ResponseObject, ResponseToolkit } from 'hapi'

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Quote Errors Controller: Received quote error. quoteId: ' + request.params.ID + ' payload: ' + JSON.stringify(request.payload))
    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error(`Quote Errors Controller: Error handling quote error. ${error.message}`)
    return h.response().code(500)
  }

}
