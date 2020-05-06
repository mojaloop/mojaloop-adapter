import { LegacyAuthorizationRequest, LegacyAuthorizationResponse, LegacyFinancialRequest, LegacyFinancialResponse, LegacyReversalRequest, ResponseType, LegacyReversalResponse } from './adaptor-relay-messages'
import { LegacyMessageType } from '../models'
import { Money } from '@mojaloop/sdk-standard-components'
import { Socket } from 'net'
import { ConnectionOptions } from 'bullmq'
import { QueueService } from '../services/queue-service'
import { Logger } from '../adaptor'

export type LegacyMessage = { [k: string]: any }

export type TcpRelayServices = {
  queueService: QueueService;
  logger: Logger;
  encode: (message: {
    [k: string]: any;
  }) => Buffer;
  decode: (message: Buffer) => {
    [k: string]: any;
  };
  socket: Socket;
};
export type TcpRelayConfig = {
  lpsId: string;
  transactionExpiryWindow?: number;
  redisConnection?: ConnectionOptions;
  responseCodes?: ResponseCodes;
};
export type ResponseCodes = {
  approved: string;
  invalidTransaction: string;
  noAction: string;
  noIssuer: string;
  doNotHonour: string;
};

export interface TcpRelay {
  start: () => Promise<void>;
  shutdown: () => Promise<void>;
  getMessageType: (mti: string) => LegacyMessageType;
  calculateFee: (legacyMessage: LegacyMessage) => Money;
  getTransactionType: (legacyMessage: LegacyMessage) => { initiatorType: 'DEVICE' | 'AGENT'; scenario: 'WITHDRAWAL' | 'REFUND' };
  mapFromAuthorizationRequest: (lpsMessageId: string, legacyMessage: LegacyMessage) => Promise<LegacyAuthorizationRequest>;
  mapToAuthorizationResponse: (authorizationResponse: LegacyAuthorizationResponse) => Promise<LegacyMessage>;
  mapFromFinancialRequest: (lpsMessageId: string, legacyMessage: LegacyMessage) => Promise<LegacyFinancialRequest>;
  mapToFinancialResponse: (financialResponse: LegacyFinancialResponse) => Promise<LegacyMessage>;
  mapFromReversalAdvice: (lpsMessageId: string, legacyMessage: LegacyMessage) => Promise<LegacyReversalRequest>;
  mapToReversalAdviceResponse: (reversalResponse: LegacyReversalResponse) => Promise<LegacyMessage>;
  getLpsKey: (legacyMessage: LegacyMessage) => string;
}