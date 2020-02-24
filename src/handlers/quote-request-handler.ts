import { Request } from 'hapi'
import { QuotesIDPutResponse, QuotesPostRequest, ErrorInformation } from '../types/mojaloop'
import { TransactionState, Transaction, Quote, TransactionFee } from '../models'
import { AdaptorServices } from '../adaptor'
const MlNumber = require('@mojaloop/ml-number')
const QUOTE_EXPIRATION_WINDOW = process.env.QUOTE_EXPIRATION_WINDOW || 10

export async function quotesRequestHandler ({ calculateAdaptorFees, mojaClient, ilpService, logger }: AdaptorServices, quoteRequest: QuotesPostRequest, headers: Request['headers']): Promise<void> {
  try {
    const transaction = await Transaction.query().where('transactionId', quoteRequest.transactionId).withGraphFetched('fees').first().throwIfNotFound()
    const adaptorFees = await calculateAdaptorFees(transaction)
    await transaction.$relatedQuery<TransactionFee>('fees').insert({ type: 'adaptor', ...adaptorFees })

    // TODO: consider different currencies?
    const otherFees = transaction.fees?.map(fee => fee.amount).reduce((total, current) => new MlNumber(total).add(current).toString(), '0')
    const totalFeeAmount = otherFees ? new MlNumber(otherFees).add(adaptorFees.amount).toString() : adaptorFees.amount
    const transferAmount = new MlNumber(totalFeeAmount).add(quoteRequest.amount.amount).toString()
    const expiration = new Date(Date.now() + Number(QUOTE_EXPIRATION_WINDOW) * 1000).toUTCString()
    const { ilpPacket, condition } = await ilpService.getQuoteResponseIlp(quoteRequest, { transferAmount: { amount: transferAmount, currency: transaction.currency } })

    await transaction.$relatedQuery<Quote>('quote').insertAndFetch({
      id: quoteRequest.quoteId,
      amount: quoteRequest.amount.amount,
      amountCurrency: quoteRequest.amount.currency,
      transactionId: quoteRequest.transactionId,
      feeAmount: totalFeeAmount,
      feeCurrency: transaction.currency,
      transferAmount,
      transferAmountCurrency: transaction.currency,
      expiration,
      condition,
      ilpPacket
    })

    const quoteResponse: QuotesIDPutResponse = {
      condition,
      ilpPacket,
      expiration: expiration,
      transferAmount: {
        amount: transferAmount,
        currency: transaction.currency
      }
    }
    await mojaClient.putQuotes(quoteRequest.quoteId, quoteResponse, headers['fspiop-source'])

    await transaction.$query().update({ state: TransactionState.quoteResponded, previousState: transaction.state })

  } catch (error) {
    logger.error(`Quote Request Handler: Failed to process quote request: ${quoteRequest.quoteId} from ${headers['fspiop-source']}. ${error.message}`)
    const errorInformation: ErrorInformation = {
      errorCode: '2001',
      errorDescription: `${error.message}`
    }
    mojaClient.putQuotesError(quoteRequest.quoteId, errorInformation, headers['fspiop-source'])
  }
}
