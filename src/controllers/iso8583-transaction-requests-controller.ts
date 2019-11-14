import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { ISO0100 } from 'types/iso-messages'
import { Money, TransactionType, Party } from 'types/mojaloop'

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Received create transactionsRequest request. payload:' + JSON.stringify(request.payload))
    const isoMessage = request.payload as ISO0100 // TODO: find out how to type hint hapi payload per route

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
        partySubIdOrType: isoMessage[42]
      }
    }
    const amount: Money = {
      amount: isoMessage[4],
      currency: isoMessage[49]
    }
    const transactionType: TransactionType = {
      initiator: 'PAYEE',
      initiatorType: 'DEVICE',
      scenario: 'WITHDRAWAL'
    }
    const expiration: string = isoMessage[7]

    const transactionRequest = await request.server.app.transactionRequestService.create({ payer: payer.partyIdInfo, payee, amount, transactionType, expiration, authenticationType: 'OTP' })
    await request.server.app.isoMessagesService.create({ transactionRequestId: '123', ...isoMessage })

    await request.server.app.accountLookupService.requestFspIdFromMsisdn(transactionRequest.id, isoMessage[102])

    return h.response().code(200)
  } catch (error) {
    request.server.app.logger.error(`Error creating transaction request. ${error.message}`)

    return h.response().code(500)
  }
}
