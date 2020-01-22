import Knex from 'knex'
import { QuotesPostRequest, Money } from '../types/mojaloop'
import { Logger } from 'adaptor'
const MlNumber = require('@mojaloop/ml-number')
const MojaloopSDK = require('@mojaloop/sdk-standard-components')

export type DBQuote = {
  id: string;
  transactionRequestId: string;
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
  transactionRequestId: string;
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
  getQuoteResponseIlp(quoteRequest: any, quoteResponse: any): QuoteIlpResponse;
}

export interface QuotesService {
  create(request: QuotesPostRequest, fees: Money, commission: Money): Promise<Quote>;
  get(id: string, idType: 'id' | 'transactionRequestId'): Promise<Quote>;
  calculateAdaptorFees(amount: Money): Promise<Money>;
}

export type QuotesServiceOptions = {
  knex: Knex;
  ilpSecret: string;
  logger: Logger;
  expirationWindow?: number;
  calculateAdaptorFees?: (amount: Money) => Promise<Money>;
}

async function defaultCalculateAdaptorFees (amount: Money): Promise<Money> {
  const fee: Money = { amount: '0', currency: amount.currency }
  return fee
}

export class KnexQuotesService implements QuotesService {
  private _knex: Knex
  private _logger: Logger
  private _expirationWindow: number
  private _calculateAdaptorFees: (amount: Money) => Promise<Money>
  private _ilp: IlpService
  constructor (options: QuotesServiceOptions) {
    this._knex = options.knex
    this._logger = options.logger || console
    this._expirationWindow = options.expirationWindow || 10000
    this._calculateAdaptorFees = options.calculateAdaptorFees || defaultCalculateAdaptorFees
    this._ilp = new MojaloopSDK.Ilp({ secret: options.ilpSecret, logger: this._logger })
  }

  async create (request: QuotesPostRequest, fees: Money, commission: Money): Promise<Quote> {
    this._logger.debug('Quotes Service: creating Quote: ' + request.quoteId)
    const transferAmount: Money = {
      // TODO: support different currencies ??
      amount: new MlNumber(request.amount.amount).add(fees.amount).add(commission.amount).toString(),
      currency: request.amount.currency
    }

    const quoteIlpResponse: QuoteIlpResponse = this._ilp.getQuoteResponseIlp(request, { transferAmount })

    await this._knex<DBQuote>('quotes').insert({
      id: request.quoteId,
      transactionRequestId: request.transactionRequestId,
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

  async get (id: string, idType: 'id' | 'transactionRequestId'): Promise<Quote> {
    this._logger.debug('Quotes Service: getting Quote by ' + idType + id)
    const dbQuote = await this._knex<DBQuote>('quotes').where(idType, id).first()

    if (!dbQuote) {
      throw new Error(`Cannot find quote with ${idType}: ${id}`)
    }

    const quote: Quote = {
      id: dbQuote.id,
      transactionRequestId: dbQuote.transactionRequestId,
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

  async calculateAdaptorFees (amount: Money): Promise<Money> {
    this._logger.debug('Quotes Service: calculating Adaptor Fees ' + amount)
    return this._calculateAdaptorFees(amount)
  }
}
