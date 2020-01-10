import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { PartiesTypeIDPutResponse } from 'types/mojaloop'

export async function update (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Received PUT parties. headers: ' + JSON.stringify(request.headers) + ' payload: ' + JSON.stringify(request.payload))
    const fspId = (request.payload as PartiesTypeIDPutResponse).party.partyIdInfo.fspId
    if (!fspId) {
      throw new Error('No fspId')
    }
    const { transactionRequestId } = await request.server.app.transactionsService.getByPayerMsisdn(request.params.ID)
    const transaction = await request.server.app.transactionsService.updatePayerFspId(transactionRequestId, 'transactionRequestId', fspId)

    await request.server.app.transactionsService.sendToMojaHub(transaction)

    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error(`Parties Controller: Error receiving parties PUT request. ${error.message}`)
    return h.response().code(500)
  }
}
