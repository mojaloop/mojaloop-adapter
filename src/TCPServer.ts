import net from 'net'
// const ISO = require('../iso-openapi-adapter/iso-to-openapi');
const HOST = '127.0.0.1'
// const HOST = '122.165.152.131';
const PORT = 6969

const start = async (): Promise<void> => {
  let shuttingDown = false
  process.on(
    'SIGINT',
    async (): Promise<void> => {
      try {
        if (shuttingDown) {
          console.warn(
            'received second SIGINT during graceful shutdown, exiting forcefully.'
          )
          process.exit(1)
          return
        }

        shuttingDown = true

        // Graceful shutdown
        await server.close()
        console.log('completed graceful shutdown.')
      } catch (err) {
        const errInfo =
          err && typeof err === 'object' && err.stack ? err.stack : err
        console.error('error while shutting down. error=%s', errInfo)
        process.exit(1)
      }
    }
  )

  const server = net.createServer(function (sock) {
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
  }).listen(PORT, HOST, () => {
    console.log('Server listening on ' + HOST + ':' + PORT)
  })
}

start()
