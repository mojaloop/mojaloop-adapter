import { Factory } from 'rosie'
import { AdaptorServices } from '../../src/adaptor'

export const AdaptorServicesFactory = Factory.define<AdaptorServices>('AdaptorServicesFactory').attrs({
  mojaClient: {
    getParties: jest.fn().mockResolvedValue(undefined),
    putParties: jest.fn(),
    putPartiesError: jest.fn(),

    postParticipants: jest.fn(),
    putParticipants: jest.fn(),
    putParticipantsError: jest.fn(),

    postQuotes: jest.fn(),
    putQuotes: jest.fn().mockResolvedValue(undefined),
    putQuotesError: jest.fn(),

    postTransfers: jest.fn(),
    putTransfers: jest.fn(),
    putTransfersError: jest.fn(),

    postTransactionRequests: jest.fn(),
    putTransactionRequests: jest.fn(),
    putTransactionRequestsError: jest.fn()
  },
  isoMessagesService: {
    create: jest.fn(),
    get: jest.fn()
  },
  transactionsService: {
    create: jest.fn(),
    get: jest.fn(),
    getByLpsKeyAndState: jest.fn(),
    getByPayerMsisdn: jest.fn(),
    sendToMojaHub: jest.fn().mockResolvedValue(undefined),
    updatePayerFspId: jest.fn(),
    updateState: jest.fn().mockResolvedValue(undefined),
    updateTransactionId: jest.fn(),
    findIncompleteTransactions: jest.fn()
  },
  quotesService: {
    create: jest.fn(),
    get: jest.fn(),
    calculateAdaptorFees: jest.fn()
  },
  transfersService: {
    get: jest.fn(),
    create: jest.fn(),
    updateTransferState: jest.fn(),
    calculateFulfilment: jest.fn()
  },
  authorizationsService: {
    sendAuthorizationsResponse: jest.fn().mockResolvedValue(undefined)
  },
  queueService: {
    addToQueue: jest.fn(),
    shutdown: jest.fn()
  }
})
