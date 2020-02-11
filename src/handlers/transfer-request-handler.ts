import { AdaptorServices } from '../adaptor'
import { TransfersPostRequest, TransfersIDPutResponse, ErrorInformation } from '../types/mojaloop'
import { Transfer, TransferState } from '../services/transfers-service'
import { TransactionState } from '../services/transactions-service'
const IlpPacket = require('ilp-packet')

export async function transferRequestHandler ({ transfersService, transactionsService, mojaClient, logger }: AdaptorServices, transferRequest: TransfersPostRequest, headers: { [k: string]: any }): Promise<void> {
  try {
    const binaryPacket = Buffer.from(transferRequest.ilpPacket, 'base64')
    const jsonPacket = IlpPacket.deserializeIlpPacket(binaryPacket)
    const dataElement = JSON.parse(Buffer.from(jsonPacket.data.data.toString(), 'base64').toString('utf8'))
    const transaction = await transactionsService.get(dataElement.transactionId, 'transactionId')
    const transactionRequestId = transaction.transactionRequestId

    const transfer: Transfer = {
      transferId: transferRequest.transferId,
      quoteId: dataElement.quoteId,
      transactionRequestId: transactionRequestId,
      fulfilment: transfersService.calculateFulfilment(transferRequest.ilpPacket),
      transferState: TransferState.received,
      amount: transferRequest.amount
    }

    await transfersService.create(transfer)

    const transferResponse: TransfersIDPutResponse = {
      fulfilment: transfer.fulfilment,
      transferState: TransferState.committed,
      completedTimestamp: (new Date(Date.now())).toISOString()
    }
    await mojaClient.putTransfers(transfer.transferId, transferResponse, transferRequest.payerFsp)

    await transactionsService.updateState(dataElement.transactionId, 'transactionId', TransactionState.fulfillmentSent)

    transfer.transferState = TransferState.reserved
    await transfersService.updateTransferState(transfer)
  } catch (error) {
    logger.error(`Transfer Request Handler: Failed to process transfer request ${transferRequest.transferId} from ${headers['fspiop-source']}. ${error.message}`)
    const errorInfo: ErrorInformation = {
      errorCode: '2001',
      errorDescription: 'Failed to process transfer request.'
    }

    await mojaClient.putTransfersError(transferRequest.transferId, errorInfo, headers['fspiop-source'])
  }
}
