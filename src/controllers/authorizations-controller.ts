import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { ISO0200 } from 'types/iso-messages'
import { AuthorizationsIDPutResponse } from 'types/mojaloop'
import { TransactionState } from '../services/transactions-service'

export async function show (request: Request, h: ResponseToolkit): Promise <ResponseObject> {
  try {
    request.server.app.logger.info('iso8583 Authorization Controller: Received authorization request from Mojaloop. query params:' + JSON.stringify(request.query))
    const transactionRequestID = request.params.ID
    const transactionsService = request.server.app.transactionsService
    const transaction = await transactionsService.get(transactionRequestID, 'transactionRequestId')
    const isoMessageService = request.server.app.isoMessagesService
    const iso0100 = await isoMessageService.get(transactionRequestID, transaction.lpsKey, '0100')
    const iso0110 = {
      0: '0110',
      3: iso0100[3],
      4: iso0100[4],
      7: iso0100[7],
      11: iso0100[11],
      28: iso0100[28],
      37: iso0100[37],
      39: '00',
      41: iso0100[41],
      42: iso0100[42],
      49: iso0100[49],
      102: iso0100[102],
      103: iso0100[103],
      127.2: iso0100[127.2]
    }

    await isoMessageService.create(transactionRequestID, transaction.lpsKey, transaction.lpsId, iso0110)

    const client = request.server.app.isoMessagingClients.get(transaction.lpsId)

    if (!client) {
      request.server.app.logger.error('cant get any client here !')
      throw new Error('Client not registered')
    }

    request.server.app.logger.debug('Sending authorization request to LPS: ' + JSON.stringify(iso0110))

    await client.sendAuthorizationRequest(iso0110)
    request.server.app.logger.debug('iso8583 Authorization Controller: Successfully sent authorization request to LPS.')

    return h.response().code(202)
  } catch (error) {
    request.server.app.logger.error(`Error creating Authorization transaction request. ${error.message}`)
    return h.response().code(500)
  }

}
export async function update (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('iso8583 Authorization Controller: Received authorization response from LPS. payload:' + JSON.stringify(request.payload))
    const isoMessage = request.payload as ISO0200
    const { lpsKey, lpsId } = isoMessage
    const transactionsService = request.server.app.transactionsService
    const authorizationsService = request.server.app.authorizationsService
    const isoMessageService = request.server.app.isoMessagesService
    const transaction = await transactionsService.getByLpsKeyAndState(lpsKey, TransactionState.quoteResponded)
    const db200 = await isoMessageService.create(transaction.transactionRequestId, lpsKey, lpsId, isoMessage)
    if (!db200) {
      throw new Error('Cannot Insert 0200 message')
    }

    // TODO: add authorizations to mojaloop sdk
    const headers = {
      'fspiop-destination': transaction.payer.fspId!,
      'fspiop-source': process.env.ADAPTOR_FSP_ID || 'adaptor',
      date: new Date().toUTCString(),
      'content-type': 'application/vnd.interoperability.authorizations+json;version=1.0'
    }
    const authorizationsResponse: AuthorizationsIDPutResponse = {
      authenticationInfo: {
        authentication: 'OTP',
        authenticationValue: db200[103]
      },
      responseType: 'ENTERED'
    }
    await authorizationsService.sendAuthorizationsResponse(transaction.transactionRequestId, authorizationsResponse, headers)
    await transactionsService.updateState(transaction.transactionRequestId, 'transactionRequestId', TransactionState.financialRequestSent)

    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error(`iso8583 Authorizations Requests Controller: Error handling authorization response. ${error.message}`)
    return h.response().code(500)
  }
}
