import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { ISO0100 } from '../types/iso-messages'
import { Money, TransactionType, Party } from '../types/mojaloop'
import { TransactionState } from '../services/transactions-service'
const uuid = require('uuid/v4')
const MLNumber = require('@mojaloop/ml-number')

export function generateTransactionType (code: string): TransactionType {
  const POS_PROCESSING_CODE = process.env.POS_PROCESSING_CODE || '01'
  const ATM_PROCESSING_CODE = process.env.ATM_PROCESSING_CODE || '02'
  switch (code) {
    case POS_PROCESSING_CODE: {
      const transactionType = {
        initiator: 'PAYEE',
        initiatorType: 'AGENT',
        scenario: 'WITHDRAWAL'
      }
      return transactionType
    }
    case ATM_PROCESSING_CODE: {
      const transactionType = {
        initiator: 'PAYEE',
        initiatorType: 'DEVICE',
        scenario: 'WITHDRAWAL'
      }
      return transactionType
    }
    default: {
      throw new Error('ISO0100 processing code not valid')
    }
  }
}

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
        fspId: process.env.ADAPTOR_FSP_ID || 'adaptor'
      }
    }
    const amount: Money = {
      amount: new MLNumber(isoMessage[4]).divide(100).toString(), // TODO: take into account asset scale properly
      currency: 'USD' // TODO: hard-coded to USD for now. Should look up isoMessage[49] to convert to mojaloop currency format
    }
    const transactionType: TransactionType = generateTransactionType(isoMessage[123].slice(-2))
    const expiration: string = isoMessage[7]
    const lpsFee: Money = {
      amount: new MLNumber(isoMessage[28].slice(1)).divide(100).toString(),
      currency: 'USD'
    }

    const transaction = await request.server.app.transactionsService.findIncompleteTransactions(lpsKey)
    if (transaction != null) {
      await request.server.app.transactionsService.updateState(transaction.transactionRequestId, 'transactionRequestId', TransactionState.transactionCancelled)
    }
    await request.server.app.transactionsService.create({ transactionRequestId, lpsId, lpsKey, payer: payer.partyIdInfo, payee, amount, lpsFee, transactionType, expiration, authenticationType: 'OTP' })
    await request.server.app.mojaClient.getParties(payer.partyIdInfo.partyIdType, payer.partyIdInfo.partyIdentifier, null)
    return h.response().code(202)
  } catch (error) {
    request.server.app.logger.error(`iso8583 Transaction Requests Controller: Error creating transaction request. ${error.message}`)

    return h.response().code(500)
  }
}
