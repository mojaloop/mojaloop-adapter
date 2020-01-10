import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { ISO0100 } from 'types/iso-messages'
import { Money, TransactionType, Party } from 'types/mojaloop'
const uuid = require('uuid/v4')
const MLNumber = require('@mojaloop/ml-number')

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('iso8583 Transaction Requests Controller: Received create transactionsRequest request. payload:' + JSON.stringify(request.payload))
    const isoMessage = request.payload as ISO0100
    const { lpsKey, lpsId } = isoMessage
    const transactionRequestId = uuid()

    await request.server.app.isoMessagesService.create(transactionRequestId, lpsKey, lpsId, isoMessage)

    const payer: Party = {
      partyIdInfo: {
        partyIdType: 'MSISDN',
        partyIdentifier: isoMessage[102]
      }
    }
    const payee: Party = {
      partyIdInfo: {
        partyIdType: 'DEVICE',
        partyIdentifier: isoMessage[41],
        partySubIdOrType: isoMessage[42],
        fspId: 'adaptor' //TODO: pull from env variable
      }
    }
    const amount: Money = {
      amount: new MLNumber(isoMessage[4]).toString(),
      currency: 'USD' // TODO: hard-coded to USD for now. Should look up isoMessage[49] to convert to mojaloop currency format
    }
    const transactionType: TransactionType = {
      initiator: 'PAYEE',
      initiatorType: 'DEVICE',
      scenario: 'WITHDRAWAL'
    }
    const expiration: string = isoMessage[7]
    const lpsFee: Money = {
      amount: '1',
      currency: 'USD'
    }

    const transaction = await request.server.app.transactionsService.create({ transactionRequestId, lpsId, lpsKey, payer: payer.partyIdInfo, payee, amount, lpsFee, transactionType, expiration, authenticationType: 'OTP' })

    await request.server.app.accountLookupService.requestFspIdFromMsisdn(transaction.transactionRequestId, isoMessage[102])
    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error(`iso8583 Transaction Requests Controller: Error creating transaction request. ${error.message}`)

    return h.response().code(500)
  }
}
