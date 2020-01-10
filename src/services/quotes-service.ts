import { AxiosInstance } from 'axios'
import Knex from 'knex'
import { QuotesIDPutResponse, QuotesPostRequest, Money } from '../types/mojaloop'
const MlNumber = require('@mojaloop/ml-number')
const MojaloopSDK = require('@mojaloop/sdk-standard-components')

export type DBQuote = {
  id: string;
  transactionId: string;
  state: string;
  amount: string;
  amountCurrency: string;
  commission: string;
  commissionCurrency: string;
  transferAmount: string;
  transferAmountCurrency: string;
  feeAmount: string;
  feeCurrency: string;
  condition: string;
  ilpPacket: string;
  expiration: string;
}

export type Quote = {
  id: string;
  transactionId: string;
  state: string;
  amount: Money;
  fees: Money;
  transferAmount: Money;
  commission: Money;
  condition: string;
  ilpPacket: string;
  expiration: string;
}

type QuoteIlpResponse = {
  fulfilment: string;
  ilpPacket: string;
  condition: string;
}

interface IlpService {
  getQuoteResponseIlp (quoteRequest: any, quoteResponse: any): QuoteIlpResponse;
}

export interface QuotesService {
  create (request: QuotesPostRequest, fees: Money, commission: Money): Promise<Quote>;
  get (id: string, idType: string): Promise<Quote>;
  calculateAdaptorFees (amount: Money): Promise<Money>;
  sendQuoteResponse (quoteId: string, response: QuotesIDPutResponse, headers: { [k: string]: string | undefined }): Promise<void>;
}

export class KnexQuotesService implements QuotesService {
  private _ilp: IlpService
  constructor (private _knex: Knex, private _client: AxiosInstance, _ilpSecret: string, private _logger?: any, private _expirationWindow = 10000, private _calculateAdaptorFees?: (amount: Money) => Promise<Money>) {
    this._ilp = new MojaloopSDK.Ilp({ secret: _ilpSecret, logger: _logger })
  }

  async create (request: QuotesPostRequest, fees: Money, commission: Money): Promise<Quote> {
    const transferAmount: Money = {
      // TODO: support different currencies ??
      amount: new MlNumber(request.amount.amount).add(fees.amount).add(commission.amount).toString(),
      currency: request.amount.currency
    }

    const quoteIlpResponse: QuoteIlpResponse = this._ilp.getQuoteResponseIlp(request, { transferAmount })

    await this._knex<DBQuote>('quotes').insert({
      id: request.quoteId,
      transactionId: request.transactionId,
      amount: request.amount.amount,
      amountCurrency: request.amount.currency,
      feeAmount: fees.amount,
      feeCurrency: fees.currency,
      commission: commission.amount,
      commissionCurrency: commission.currency,
      transferAmount: transferAmount.amount,
      transferAmountCurrency: transferAmount.currency,
      expiration: (new Date(Date.now() + this._expirationWindow)).toUTCString(),
      condition: quoteIlpResponse.condition,
      ilpPacket: quoteIlpResponse.ilpPacket
    }).then(results => results[0])

    return this.get(request.quoteId, 'id')
  }

  async get (id: string, idType: string): Promise<Quote> {
    const dbQuote = await this._knex<DBQuote>('quotes').where(idType, id).first()

    if (!dbQuote) {
      throw new Error(`Cannot find quote with ${idType}: ${id}`)
    }

    const quote: Quote = {
      id: dbQuote.id,
      transactionId: dbQuote.transactionId,
      amount: {
        amount: dbQuote.amount,
        currency: dbQuote.amountCurrency
      },
      fees: {
        amount: dbQuote.feeAmount,
        currency: dbQuote.feeCurrency
      },
      commission: {
        amount: dbQuote.commission,
        currency: dbQuote.commissionCurrency
      },
      transferAmount: {
        amount: dbQuote.transferAmount,
        currency: dbQuote.transferAmountCurrency
      },
      condition: dbQuote.condition,
      state: dbQuote.state,
      expiration: dbQuote.expiration,
      ilpPacket: dbQuote.ilpPacket
    }

    return quote
  }

  async sendQuoteResponse (quoteId: string, request: QuotesIDPutResponse, headers: { [k: string]: string | undefined }): Promise<void> {
    delete this._client.defaults.headers.common.Accept
    delete this._client.defaults.headers.common.accept
    await this._client.put(`/quotes/${quoteId}`, request, { headers })
  }

  async calculateAdaptorFees (amount: Money): Promise<Money> {
    return this._calculateAdaptorFees ? this._calculateAdaptorFees(amount) : { amount: '0', currency: amount.currency }
  }
}
