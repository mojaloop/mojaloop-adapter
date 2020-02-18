import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { PartiesResponseQueueMessage } from '../types/queueMessages'
import { PartiesTypeIDPutResponse } from 'types/mojaloop'

export async function update (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Received PUT parties. headers: ' + JSON.stringify(request.headers) + ' payload: ' + JSON.stringify(request.payload))

    const message: PartiesResponseQueueMessage = {
      partiesResponse: request.payload as PartiesTypeIDPutResponse,
      partyIdValue: request.params.ID
    }

    await request.server.app.queueService.addToQueue('PartiesResponse', message)

    return h.response().code(202)
  } catch (error) {
    request.server.app.logger.error(`Parties Controller: Error receiving parties PUT request. ${error.message}`)
    return h.response().code(500)
  }
}
