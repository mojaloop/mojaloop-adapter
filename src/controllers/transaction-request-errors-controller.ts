import { Request, ResponseObject, ResponseToolkit } from 'hapi'

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Transaction Request Errors Controller: Received transaction request error. transactionRequestId: ' + request.params.ID + ' payload: ' + JSON.stringify(request.payload))
    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error(`Transaction Request Errors Controller: Error handling transaction request error. ${error.message}`)
    return h.response().code(500)
  }

}
