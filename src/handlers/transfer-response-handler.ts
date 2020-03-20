import { AdaptorServices } from '../adaptor'
import { TransfersIDPutResponse } from '../types/mojaloop'
import { LegacyFinancialResponse, ResponseType } from '../types/adaptor-relay-messages'
import { TransactionState, Transaction, TransferState, Transfers, LpsMessage, LegacyMessageType } from '../models'

export async function transferResponseHandler ({ queueService, logger }: AdaptorServices, transferResponse: TransfersIDPutResponse, headers: { [k: string]: any }, transferId: string): Promise<void> {
  try {
    if (transferResponse.transferState === TransferState.committed) {
      const transfer = await Transfers.query().where({ id: transferId }).first().throwIfNotFound()
      const transaction = await Transaction.query().where({ transactionRequestId: transfer.transactionRequestId }).first().throwIfNotFound()
      const legacyFinancialRequest = await transaction.$relatedQuery<LpsMessage>('lpsMessages').where({ type: LegacyMessageType.financialRequest }).first().throwIfNotFound()
      const legacyFinancialResponse: LegacyFinancialResponse = {
        lpsFinancialRequestMessageId: legacyFinancialRequest.id,
        response: ResponseType.approved
      }

      await queueService.addToQueue(`${transaction.lpsId}FinancialResponses`, legacyFinancialResponse)

      await transaction.$query().update({ state: TransactionState.financialResponse, previousState: transaction.state })
      await transfer.$query().update({ state: TransferState.committed })
    }
  } catch (error) {
    logger.error(`Transfer Response Handler: Could not process transfer response for transferId=${transferId} from ${headers['fspiop-source']}. ${error.message}`)
    // TODO: what should the adaptor do here? Start refund process?
  }
}
