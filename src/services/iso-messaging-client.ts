import { Socket } from 'net'
const IsoParser = require('iso_8583')
export interface IsoMessagingClient {
  sendAuthorizationRequest: (data: { [k: string]: any }) => Promise<void>;
}

export class TcpIsoMessagingClient implements IsoMessagingClient {

  private _socket?: Socket
  constructor (socket?: Socket) {
    // assumes the socket is already connected to the TCP server
    if (socket) {
      this._socket = socket
    }
  }

  get socket (): Socket | undefined {
    return this._socket
  }

  set socket (socket: Socket | undefined) {
    this._socket = socket
  }

  send (data: Buffer): void {
    if (!this._socket) {
      throw new Error('Cannot send ISO message. No socket registered.')
    }

    this._socket.write(data)
  }

  async sendAuthorizationRequest (data: { [k: string]: any }): Promise<void> {
    const buffer: Buffer = new IsoParser(data).getBufferMessage()
    this.send(buffer)
  }

  // PT:
  // async sendFinancialResponse (data: { [k: string]: any }): Promise<void> { call this sendFinancialResponse
  //   const buffer: Buffer = new IsoParser(data).getBufferMessage()
  //   this.send(buffer)
  // }
}
