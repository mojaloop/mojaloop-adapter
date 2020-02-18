import { Request, ResponseObject, ResponseToolkit } from 'hapi'
import { TransfersPostRequest, TransfersIDPutResponse } from 'types/mojaloop'
import { TransferResponseQueueMessage, TransferRequestQueueMessage } from 'types/queueMessages'

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Transfers Controller: Received transfer request. payload: ' + JSON.stringify(request.payload))
    const transferRequest: TransferRequestQueueMessage = {
      transferRequest: request.payload as TransfersPostRequest,
      headers: request.headers
    }

    await request.server.app.queueService.addToQueue('TransferRequests', transferRequest)

    return h.response().code(202)

  } catch (error) {
    request.server.app.logger.error(`Transfers Controller: Error handling transfer request. ${error.message}`)
    return h.response().code(500)
  }
}

export async function update (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Transfers Controller: Received put transfer response. transferId: ' + request.params.ID + ' payload: ' + JSON.stringify(request.payload))
    const transferResponse: TransferResponseQueueMessage = {
      transferId: request.params.ID,
      transferResponse: request.payload as TransfersIDPutResponse,
      headers: request.headers
    }

    await request.server.app.queueService.addToQueue('TransferResponses', transferResponse)

    return h.response().code(200)

  } catch (error) {
    request.server.app.logger.error(`Transfers Controller: Error handling transfers put response. ${error.message}`)
    return h.response().code(500)
  }

}
