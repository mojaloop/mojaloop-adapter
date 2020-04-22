import { AdaptorServices } from '../adaptor'
import { TransfersPostRequest, TransfersIDPutResponse, ErrorInformation, ErrorInformationResponse } from '../types/mojaloop'
import { TransactionState, Transaction, Transfers, TransferState, Quote, LegacyMessageType, LpsMessage } from '../models'
import { buildMojaloopErrorResponse } from '../utils/util'
import { ResponseType } from '../types/adaptor-relay-messages'
const IlpPacket = require('ilp-packet')

const validate = async (transaction: Transaction): Promise<ErrorInformationResponse | undefined> => {
  if (!transaction.isValid()) {
    return buildMojaloopErrorResponse('5105', 'Transaction is no longer valid.')
  }

  const quote = transaction.quote || await transaction.$relatedQuery<Quote>('quote').first()

  if (!quote) {
    return buildMojaloopErrorResponse('3205', 'Quote not found.')
  }

  if (quote.isExpired()) {
    return buildMojaloopErrorResponse('3302', 'Quote has expired.')
  }

  return undefined
}

export async function transferRequestHandler ({ ilpService, mojaClient, logger, queueService }: AdaptorServices, transferRequest: TransfersPostRequest, headers: { [k: string]: any }): Promise<void> {
  try {
    const binaryPacket = Buffer.from(transferRequest.ilpPacket, 'base64')
    const jsonPacket = IlpPacket.deserializeIlpPacket(binaryPacket)
    const dataElement = JSON.parse(Buffer.from(jsonPacket.data.data.toString(), 'base64').toString('utf8'))
    const transaction = await Transaction.query().where('transactionId', dataElement.transactionId).withGraphFetched('quote').first().throwIfNotFound()

    const error = await validate(transaction)

    if (error) {
      await mojaClient.putTransfersError(transferRequest.transferId, error, headers['fspiop-source'])
      const financialRequest = await transaction.$relatedQuery<LpsMessage>('lpsMessages').where({ type: LegacyMessageType.financialRequest }).first().throwIfNotFound()
      await queueService.addToQueue(`${transaction.lpsId}FinancialResponses`, { lpsFinancialRequestMessageId: financialRequest.id, response: ResponseType.invalid })
      return
    }

    const transfer = await transaction.$relatedQuery<Transfers>('transfer').insert({
      id: transferRequest.transferId,
      quoteId: dataElement.quoteId,
      transactionRequestId: transaction.transactionRequestId,
      fulfillment: ilpService.calculateFulfil(transferRequest.ilpPacket),
      state: TransferState.received,
      amount: transferRequest.amount.amount,
      currency: transferRequest.amount.currency
    })

    const transferResponse: TransfersIDPutResponse = {
      fulfilment: transfer.fulfillment,
      transferState: TransferState.committed,
      completedTimestamp: (new Date(Date.now())).toISOString()
    }
    await mojaClient.putTransfers(transfer.id, transferResponse, transferRequest.payerFsp)

    await transaction.$query().update({ previousState: transaction.state, state: TransactionState.fulfillmentSent })

    await transfer.$query().update({ state: TransferState.reserved })
  } catch (error) {
    logger.error(`Transfer Request Handler: Failed to process transfer request ${transferRequest.transferId} from ${headers['fspiop-source']}. ${error.message}`)
    const errorInfo: ErrorInformation = {
      errorCode: '2001',
      errorDescription: 'Failed to process transfer request.'
    }

    await mojaClient.putTransfersError(transferRequest.transferId, errorInfo, headers['fspiop-source'])
  }
}
