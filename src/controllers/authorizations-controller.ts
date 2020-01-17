import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { ISO0200 } from 'types/iso-messages'
import { AuthorizationsIDPutResponse } from 'types/mojaloop'
import { TransactionState } from '../services/transactions-service'
import { pad } from '../utils/util'

const MLNumber = require('@mojaloop/ml-number')

export async function show (request: Request, h: ResponseToolkit): Promise <ResponseObject> {
  try {
    request.server.app.logger.info('iso8583 Authorization Controller: Received authorization request from Mojaloop. query params:' + JSON.stringify(request.query))
    const transactionRequestID = request.params.ID
    const { transactionsService, quotesService, isoMessagesService } = request.server.app
    const transaction = await transactionsService.get(transactionRequestID, 'transactionRequestId')
    const quote = await quotesService.get(transaction.transactionRequestId, 'transactionRequestId')
    const iso0100 = await isoMessagesService.get(transactionRequestID, transaction.lpsKey, '0100')
    // TODO: Fix creating of 0110 message
    const iso0110 = {
      ...iso0100,
      0: '0110',
      30: 'D' + pad(new MLNumber(quote.fees.amount).add(quote.commission.amount).multiply(100).toString(), 8, '0'),
      39: '00',
      48: quote.amount.amount
    }

    await isoMessagesService.create(transactionRequestID, transaction.lpsKey, transaction.lpsId, iso0110)

    const client = request.server.app.isoMessagingClients.get(transaction.lpsId)

    if (!client) {
      request.server.app.logger.error('cant get any client here !')
      throw new Error('Client not registered')
    }

    // TODO: Fix sanitizing of 0110 message
    delete iso0110.lpsId
    delete iso0110.lpsKey
    delete iso0110.id
    delete iso0110.transactionRequestId

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
