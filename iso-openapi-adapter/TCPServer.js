const net = require('net');
const ISO = require('./iso-to-openapi')
//const ISOM = require('./iso93')
//const ISOM = require('./Test')
const HOST = '127.0.0.1';
//const HOST = '122.165.152.131';
const PORT = 6969;
// Create a server instance, and chain the listen function to it
// The function passed to net.createServer() becomes the event handler for the 'connection' event
// The sock object the callback function receives UNIQUE for each connection
net.createServer(function (sock) {

    // We have a connection - a socket object is assigned to the connection automatically
    console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);

    // Add a 'data' event handler to this instance of socket
    
    sock.on('data', function (data) {

        console.log(`DATA + ${sock.remoteAddress}`);
        console.log(data);
        console.log('String data :')
        console.log(data.toString());

        ////sock.write('Data received');
        // Write the data back to the socket, the client will receive it as data from the server

     ISO.handleISO(data, sock)

        //ISOM.handleISO(data, sock)
    });
    // Add a 'close' event handler to this instance of socket
    sock.on('close', function (data) {
        console.log('CLOSED: ' + sock.remoteAddress + ' ' + sock.remotePort);
    });

}).listen(PORT, HOST);

console.log('Server listening on ' + HOST + ':' + PORT);
