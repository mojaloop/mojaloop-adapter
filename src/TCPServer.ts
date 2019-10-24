import net from 'net'
// const ISO = require('../iso-openapi-adapter/iso-to-openapi');
const HOST = '127.0.0.1'
// const HOST = '122.165.152.131';
const PORT = 6969
// Create a server instance, and chain the listen function to it
// The function passed to net.createServer() becomes the event handler for the 'connection' event
// The sock object the callback function receives UNIQUE for each connection
net
  .createServer(function (sock) {
    // We have a connection - a socket object is assigned to the connection automatically
    console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort)

    // Add a 'data' event handler to this instance of socket

    sock.on('data', function (data) {
      console.log(`DATA + ${sock.remoteAddress}`)
      console.log(data)
      console.log('String data :')
      console.log(data.toString())

      //  ISO.handleISO(data, sock)
    })

    // Add a 'close' event handler to this instance of socket
    sock.on('close', function () {
      console.log('CLOSED: ' + sock.remoteAddress + ' ' + sock.remotePort)
    })
  })
  .listen(PORT, HOST, () => {
    console.log('Server listening on ' + HOST + ':' + PORT)
  })
