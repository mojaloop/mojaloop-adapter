import { Request, ResponseObject, ResponseToolkit } from 'hapi'

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Authorization Errors Controller: Received autorization error. transactionRequestId: ' + request.params.ID + ' payload: ' + JSON.stringify(request.payload))
    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error(`Authorization Errors Controller: Error handling authorization error. ${error.message}`)
    return h.response().code(500)
  }

}
