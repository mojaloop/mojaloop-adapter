import { Request, ResponseObject, ResponseToolkit } from 'hapi'
import { MojaloopErrorQueueMessage, MojaloopError } from '../types/queueMessages'
import { ErrorInformationObject } from '../types/mojaloop'

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Authorization Errors Controller: Received autorization error. transactionRequestId: ' + request.params.ID + ' payload: ' + JSON.stringify(request.payload))

    const message: MojaloopErrorQueueMessage = {
      type: MojaloopError.authorization,
      typeId: request.params.ID,
      errorInformation: (request.payload as ErrorInformationObject).errorInformation
    }

    await request.server.app.queueService.addToQueue('ErrorResponses', message)

    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error(`Authorization Errors Controller: Error handling authorization error. ${error.message}`)
    return h.response({
      errorInformation: {
        errorCode: '2001',
        errorDescription: 'An internal error occurred.'
      }
    }).code(500)
  }

}
