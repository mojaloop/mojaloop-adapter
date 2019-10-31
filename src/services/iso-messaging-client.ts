import { Socket } from 'net'
const IsoParser = require('iso_8583')
export interface IsoMessagingClient {
  sendAuthorizationRequest: (data: { [k: string]: any }) => Promise<void>;
}

export class TcpIsoMessagingClient implements IsoMessagingClient {
  constructor (private _sock: Socket) {
    // assumes the socket is already connected to the TCP server
  }

  async sendAuthorizationRequest (data: { [k: string]: any }): Promise<void> {
    const buffer: Buffer = new IsoParser(data).getBufferMessage()
    this._sock.write(buffer)
  }
}
