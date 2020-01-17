import { Request, ResponseObject, ResponseToolkit } from 'hapi'

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Transfer Errors Controller: Received transfer error. transferId: ' + request.params.ID + ' payload: ' + JSON.stringify(request.payload))
    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error(`Transfer Errors Controller: Error handling transfer error. ${error.message}`)
    return h.response().code(500)
  }

}
