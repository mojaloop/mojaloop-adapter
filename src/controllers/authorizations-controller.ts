import { Request, ResponseToolkit, ResponseObject } from 'hapi'
import { ISO0100 } from 'types/iso-messages'
import Axios, { AxiosInstance } from 'axios'
import Knex = require('knex')
import { KnexIsoMessageService } from '../../src/services/iso-message-service'
import { serverUnavailable } from '../../node_modules/@types/boom';
import { Socket } from 'net'
import { TcpIsoMessagingClient } from '../../src/services/iso-messaging-client'
const isopack = require('iso_8583')

export async function show (request: Request, h: ResponseToolkit): Promise <ResponseObject> {
  try {

    //  const transactionRequestID = request.params.ID
    //  const transactionsService = request.server.app.transactionsService
    //  const transaction = await transactionsService.get(transactionRequestID, 'transactionRequestId')
    //  const isoMessageService = request.server.app.isoMessagesService
    //  const isoMessageClients = request.server.app.isoMessagingClients
    //  const lpsKey = 'postillion'
    //  const iso0100 = await  isoMessageService.get(transaction.id,lpsKey,'0100')

    //  const sock = new Socket()
    //  sock.write = jest.fn()
    //  const tcpIsoMessagingClient = new TcpIsoMessagingClient(sock)
     
    //  iso0100[0] = '0110';                           // Changing  message type to reponse 
    //  iso0100[39] = '00';                            // Resposne for successfull transaction

    //  const iso0110 = iso0100
    //  const iso110db= await isoMessageService.create(transaction.id,lpsKey,iso0100[127.2],iso0110)
    //  if(!iso110db){

    //   throw new Error ('Cannot insert 0110 message into database')
      
    //  }
    //  request.server.app.isoMessagingClients.set(lpsKey,tcpIsoMessagingClient)
    //  const client = request.server.app.isoMessagingClients.get(lpsKey)
    //  if(!client)
    //   {
    //     throw new Error ('Client is not set')
    //  }
    // client.sendAuthorizationRequest(iso0110)

     return h.response().code(200)
  }
  catch(error){

    // request.server.app.logger.error(`Error creating transaction request. ${error.message}`)
    // return h.response().code(500)
  }

}
