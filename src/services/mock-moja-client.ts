import { MojaloopRequests, PostTransferBody, BulkParticipantsRequest } from "@mojaloop/sdk-standard-components";
import { QueueService } from './queue-service'
import { PartiesResponseQueueMessage, AuthorizationRequestQueueMessage } from 'types/queueMessages';
import { QuotesPostRequest } from 'types/mojaloop';
const uuid = require('uuid/v4')

export class MockMojaClient extends MojaloopRequests {

  private queueService: QueueService

  constructor(queueService: QueueService) {
    super({
      logger: console,
      dfspId: 'adaptor',
      quotesEndpoint: '',
      alsEndpoint: '',
      transfersEndpoint: '',
      transactionRequestsEndpoint: '',
      jwsSign: false,
      tls: { outbound: { mutualTLS: { enabled: false } } },
      wso2Auth: {
        getToken: () => null
      },
      jwsSigningKey: 'string',
      peerEndpoint: 'string'
    })
    this.queueService = queueService
  }

  async getParties(idType: string, idValue: string, idSubValue: string | null): Promise<object> {
    const msisdn = '278212312' + idSubValue?.slice(-2)

    this.queueService.addToQueue('PartiesResponse', { partyIdValue: msisdn, partiesResponse: { party: { partyIdInfo: { fspId: 'test-fsp' } } } } as PartiesResponseQueueMessage)
    return {}
  }
  async putParties(idType: string, idValue: string, idSubValue: string | null, body: object, destFspId: string): Promise<object> {
    return {}
  }
  async putPartiesError(idType: string, idValue: string, idSubValue: string | null, error: object, destFspId: string): Promise<object> {
    return {}
  }

  async postParticipants(request: BulkParticipantsRequest, destFspId?: string): Promise<object> {
    return {}
  }
  async putParticipants(idType: string, idValue: string, idSubValue: string | null, body: object, destFspId: string): Promise<object> {
    return {}
  }
  async putParticipantsError(idType: string, idValue: string, idSubValue: string | null, error: object, destFspId: string): Promise<object> {
    return {}
  }

  async postQuotes(quoteRequest: object, destFspId: string): Promise<object> {
    return {}
  }
  async putQuotes(quoteId: string, quoteResponse: { [k: string]: any }, destFspId: string): Promise<object> {
    this.queueService.addToQueue('AuthorizationRequests', { headers: {
      'fspiop-source': 'test-fsp',
      'fspiop-destination': 'adapter'
    }, transactionRequestId: quoteResponse.transactionRequestId } as AuthorizationRequestQueueMessage)
    return {}
  }
  async putQuotesError(quoteId: string, error: object, destFspId: string): Promise<object> {
    return {}
  }

  async postTransfers(prepare: PostTransferBody, destFspId: string): Promise<object> {
    return {}
  }
  async putTransfers(transferId: string, fulfilment: object, destFspId: string): Promise<object> {
    return {}
  }
  async putTransfersError(transferId: string, error: object, destFspId: string): Promise<object> {
    return {}
  }

  async postTransactionRequests(transactionRequest: { [k: string]: any }, destFspId: string): Promise<object> {
    this.queueService.addToQueue('QuoteRequests', {
      payload: {
        quoteId: uuid(),
        transactionId: uuid(),
        transactionRequestId: transactionRequest.transactionRequestId,
        amount: transactionRequest.amount,
        amountType: transactionRequest.amountType,
        payee: transactionRequest.payee,
        payer: transactionRequest.payer,
        transactionType: transactionRequest.transactionType
      } as QuotesPostRequest,
      headers: {
        'fspiop-source': 'test-fsp',
        'fspiop-destination': 'adapter'
      }
    })

    return {}
  }
  async putTransactionRequests(transactionRequestId: string, transactionRequestResponse: object, destFspId: string): Promise<object> {
    return {}
  }
  async putTransactionRequestsError(transactionRequestId: string, error: object, destFspId: string): Promise<object> {
    return {}
  }
}