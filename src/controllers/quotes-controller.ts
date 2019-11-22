import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { QuotesPostRequest, QuotesIDPutResponse } from 'types/mojaloop'

const MlNumber = require('@mojaloop/ml-number')

const PAYEE_FEE = process.env.PAYEE_FEE_PERCENTAGE || 1
const CONDTION = 'HOr22-H3AfTDHrSkPjJtVPRdKouuMkDXTR4ejlQa8Ks'
const ILP_PACKET = 'AQAAAAAAAADIEHByaXZhdGUucGF5ZWVmc3CCAiB7InRyYW5zYWN0aW9uSWQiOiIyZGY3NzRlMi1mMWRiLTRmZjctYTQ5NS0yZGRkMzdhZjdjMmMiLCJxdW90ZUlkIjoiMDNhNjA1NTAtNmYyZi00NTU2LThlMDQtMDcwM2UzOWI4N2ZmIiwicGF5ZWUiOnsicGFydHlJZEluZm8iOnsicGFydHlJZFR5cGUiOiJNU0lTRE4iLCJwYXJ0eUlkZW50aWZpZXIiOiIyNzcxMzgwMzkxMyIsImZzcElkIjoicGF5ZWVmc3AifSwicGVyc29uYWxJbmZvIjp7ImNvbXBsZXhOYW1lIjp7fX19LCJwYXllciI6eyJwYXJ0eUlkSW5mbyI6eyJwYXJ0eUlkVHlwZSI6Ik1TSVNETiIsInBhcnR5SWRlbnRpZmllciI6IjI3NzEzODAzOTExIiwiZnNwSWQiOiJwYXllcmZzcCJ9LCJwZXJzb25hbEluZm8iOnsiY29tcGxleE5hbWUiOnt9fX0sImFtb3VudCI6eyJjdXJyZW5jeSI6IlVTRCIsImFtb3VudCI6IjIwMCJ9LCJ0cmFuc2FjdGlvblR5cGUiOnsic2NlbmFyaW8iOiJERVBPU0lUIiwic3ViU2NlbmFyaW8iOiJERVBPU0lUIiwiaW5pdGlhdG9yIjoiUEFZRVIiLCJpbml0aWF0b3JUeXBlIjoiQ09OU1VNRVIiLCJyZWZ1bmRJbmZvIjp7fX19'
const EXPIRATION_WINDOW = Number(process.env.EXPIRATION_WINDOW) || 10000

export async function create (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  try {
    request.server.app.logger.info('Received POST quote request. headers: ' + JSON.stringify(request.headers) + ' payload: ' + JSON.stringify(request.payload))
    const quoteRequest = request.payload as QuotesPostRequest

    // TODO: fetch iso0100 message to get surcharge amount (Field 28)
    // const transactionId = quoteRequest.transactionId
    // const transactionRequest = await request.server.app.transactionRequestService.getByTransactionId(transactionId)
    // const iso0100 = await request.server.app.isoMessagesService.getByTransactionId('0100', transactionRequest.transactionId)
    const transferAmount = {
      amount: new MlNumber(quoteRequest.amount.amount).add(PAYEE_FEE).toString(),
      currency: quoteRequest.amount.currency
    }
    const fees = {
      amount: new MlNumber(PAYEE_FEE).toString(),
      currency: quoteRequest.amount.currency
    }

    await request.server.app.quotesService.create(quoteRequest, fees, transferAmount, CONDTION)

    const quoteResponse: QuotesIDPutResponse = {
      condition: CONDTION,
      expiration: (new Date(Date.now() + EXPIRATION_WINDOW)).toUTCString(),
      ilpPacket: ILP_PACKET,
      transferAmount
    }
    const headers = {
      'fspiop-destination': request.headers['fspiop-source'],
      'fspiop-source': request.headers['fspiop-destination']
    }
    await request.server.app.quotesService.sendQuoteResponse(quoteRequest.quoteId, quoteResponse, headers)

    return h.response().code(200)
  } catch (error) {
    // request.server.app.logger.error(`Failed to give quote response for quoteId: ${request.payload.quoteId}`)
    return h.response().code(500)
  }
}
