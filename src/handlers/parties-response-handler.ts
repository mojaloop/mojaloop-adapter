import { PartiesTypeIDPutResponse, TransactionRequestsPostRequest } from 'types/mojaloop'
import { AdaptorServices } from 'adaptor'

export async function partiesResponseHandler ({ transactionsService, mojaClient, logger }: AdaptorServices, partiesResponse: PartiesTypeIDPutResponse, partyIdValue: string): Promise<void> {
  try {
    const fspId = partiesResponse.party.partyIdInfo.fspId
    if (!fspId) {
      throw new Error('No fspId.')
    }

    const { transactionRequestId } = await transactionsService.getByPayerMsisdn(partyIdValue)
    const transaction = await transactionsService.updatePayerFspId(transactionRequestId, 'transactionRequestId', fspId)

    const transactionRequest: TransactionRequestsPostRequest = {
      amount: transaction.amount,
      payee: transaction.payee,
      payer: transaction.payer,
      transactionRequestId: transaction.transactionRequestId,
      transactionType: transaction.transactionType
    }

    await mojaClient.postTransactionRequests(transactionRequest, fspId)

  } catch (error) {
    logger.error(`Parties response handler: Could not process party response. ${error.message}`)
  }
}
