import { Request } from 'hapi'
import { QuotesIDPutResponse, QuotesPostRequest, ErrorInformationResponse } from '../types/mojaloop'
import { TransactionState, Transaction, Quote, TransactionFee, LpsMessage, LegacyMessageType } from '../models'
import { AdaptorServices } from '../adaptor'
import { buildMojaloopErrorResponse } from '../utils/util'
import { ResponseType } from '../types/adaptor-relay-messages'
const MlNumber = require('@mojaloop/ml-number')
const QUOTE_EXPIRATION_WINDOW = process.env.QUOTE_EXPIRATION_WINDOW || 10

const validate = async (transaction: Transaction): Promise<ErrorInformationResponse | undefined> => {

  if (!transaction.isValid()) {
    return buildMojaloopErrorResponse('3301', 'Transaction is no longer valid.')
  }

  return undefined
}

export async function quotesRequestHandler ({ calculateAdaptorFees, mojaClient, ilpService, logger, queueService }: AdaptorServices, quoteRequest: QuotesPostRequest, headers: Request['headers']): Promise<void> {
  try {
    if (!quoteRequest.transactionRequestId) {
      throw new Error('No transactionRequestId given for quoteRequest.')
    }
    const transaction = await Transaction.query().where('transactionRequestId', quoteRequest.transactionRequestId).withGraphFetched('fees').first().throwIfNotFound()

    const error = await validate(transaction)

    if (error) {
      await mojaClient.putQuotesError(quoteRequest.quoteId, error, headers['fspiop-source'])
      const legacyAuthorizationRequest = await transaction.$relatedQuery<LpsMessage>('lpsMessages').where({ type: LegacyMessageType.authorizationRequest }).first().throwIfNotFound()
      await queueService.addToQueue(`${transaction.lpsId}AuthorizationResponses`, { lpsAuthorizationRequestMessageId: legacyAuthorizationRequest.id, response: ResponseType.invalid })
      return
    }

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
    mojaClient.putQuotesError(quoteRequest.quoteId, buildMojaloopErrorResponse('2001', 'Failed to process quote request'), headers['fspiop-source'])
  }
}
