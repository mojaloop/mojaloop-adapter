import { AdaptorServices } from '../adaptor'
import { TransfersPostRequest, TransfersIDPutResponse, ErrorInformation } from '../types/mojaloop'
import { TransactionState, Transaction, Transfers, TransferState } from '../models'
const IlpPacket = require('ilp-packet')

export async function transferRequestHandler ({ ilpService, mojaClient, logger }: AdaptorServices, transferRequest: TransfersPostRequest, headers: { [k: string]: any }): Promise<void> {
  try {
    const binaryPacket = Buffer.from(transferRequest.ilpPacket, 'base64')
    const jsonPacket = IlpPacket.deserializeIlpPacket(binaryPacket)
    const dataElement = JSON.parse(Buffer.from(jsonPacket.data.data.toString(), 'base64').toString('utf8'))
    const transaction = await Transaction.query().where('transactionId', dataElement.transactionId).first().throwIfNotFound()
    const transactionRequestId = transaction.transactionRequestId

    const transfer = await transaction.$relatedQuery<Transfers>('transfer').insert({
      id: transferRequest.transferId,
      quoteId: dataElement.quoteId,
      transactionRequestId: transactionRequestId,
      fulfillment: ilpService.caluclateFulfil(transferRequest.ilpPacket),
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
