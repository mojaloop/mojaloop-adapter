WIP: Adaptor that accepts messages from legacy payment systems (ISO8583) over TCP and converts it to Mojaloop Open API requests.

## Components
### TCP Relay
This accepts ISO8583 messages using a TCP connection and converts this into a JSON representation of the ISO8583 message. It then injects this into the Adaptor.

### Adaptor
This is an http server that exposes endpoints that accept a JSON representation of ISO8583 messages. It then maps this to appropriate Mojaloop messages and forwards them to the Mojaloop Hub. It also accepts Mojaloop Open API messages which it maps to ISO8583 messages and forwards it to the legacy payment system.

### Configuration
Some environment variables are required:
ML_API_ADAPTOR
INTEROP_SWITCH
TCP_PORT
HTTP_PORT
KNEX_CLIENT

### Running
Run `npm start`

### DB Schema
<img src="./media/Adaptor-database-schema.png" style="background: white"/>

### Flow
<img src="./media/flow-diagram-1.svg" style="background: white"/>
<img src="./media/flow-diagram-2.svg" style="background: white"/>
The below flow is not final. It is going to be changed so that the ATM is told to dispense the money after the mojaloop transfer is successfully completed.
<img src="./media/flow-diagram-3.svg" style="background: white"/>