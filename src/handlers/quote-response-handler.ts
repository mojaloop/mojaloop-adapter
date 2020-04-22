import { Request } from 'hapi'
import { QuotesIDPutResponse, TransfersPostRequest } from '../types/mojaloop'
import { AdaptorServices } from '../adaptor'
import { Transfers, TransferState, Quote } from '../models'
const uuid = require('uuid/v4')

export async function quoteResponseHandler ({ mojaClient, ilpService, logger }: AdaptorServices, quoteResponse: QuotesIDPutResponse, quoteId: string, headers: Request['headers']): Promise<void> {
  try {
    const quote = await Quote.query().updateAndFetchById(quoteId, {
      transferAmount: quoteResponse.transferAmount.amount,
      condition: quoteResponse.condition,
      ilpPacket: quoteResponse.ilpPacket,
      expiration: quoteResponse.expiration
    }).first().throwIfNotFound()

    const transferId = uuid()

    const fulfillment = await ilpService.calculateFulfil(quoteResponse.ilpPacket)
    await Transfers.query().insertGraphAndFetch({
      id: transferId,
      transactionRequestId: quote.transactionRequestId,
      quoteId: quoteId,
      fulfillment: fulfillment,
      state: TransferState.reserved,
      amount: quoteResponse.transferAmount.amount,
      currency: quoteResponse.transferAmount.currency
    })
    const transfersPostRequest: TransfersPostRequest = {
      transferId: transferId,
      payeeFsp: headers['fspiop-source'],
      payerFsp: headers['fspiop-destination'],
      amount: quoteResponse.transferAmount,
      ilpPacket: quoteResponse.ilpPacket,
      condition: quoteResponse.condition,
      expiration: quoteResponse.expiration
    }
    await mojaClient.postTransfers(transfersPostRequest, headers['fspiop-source'])

  } catch (error) {
    logger.error(`Quote Response Handler: Could not process party response. ${error.message}`)
  }
}
