import { AdaptorServices } from '../adaptor'
import { TransfersIDPutResponse } from '../types/mojaloop'
import { LegacyFinancialResponse } from '../types/adaptor-relay-messages'
import { TransactionState, Transaction, TransferState, Transfers } from '../models'

export async function transferResponseHandler ({ queueService, logger }: AdaptorServices, transferResponse: TransfersIDPutResponse, headers: { [k: string]: any }, transferId: string): Promise<void> {
  try {
    if (transferResponse.transferState === TransferState.committed) {
      const transfer = await Transfers.query().where({ id: transferId }).first().throwIfNotFound()
      // TODO: refactor once transfer service is deprecated
      const transaction = await Transaction.query().where({ transactionRequestId: transfer.transactionRequestId }).first().throwIfNotFound()
      const legacyFinancialResponse: LegacyFinancialResponse = {
        lpsFinancialRequestMessageId: 'lpsMessageId' // TODO: pull from transaction once DB and services are refactored.
      }

      await queueService.addToQueue(`${transaction.lpsId}FinancialResponses`, legacyFinancialResponse)

      await transaction.$query().update({ state: TransactionState.financialResponse, previousState: transaction.state })
    }
  } catch (error) {
    logger.error(`Transfer Response Handler: Could not process transfer response for transferId=${transferId} from ${headers['fspiop-source']}. ${error.message}`)
    // TODO: what should the adaptor do here? Start refund process?
  }
}
