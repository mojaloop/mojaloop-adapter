export type ISO0100 = { id: number } & {
  transactionRequestId: string;
  lpsId: string;
  lpsKey: string;
  0: string; // MTI
  2: string; // PAN
  3: string; // Processing code Transaction type – 01
  4: string; // Amount
  7: string; // Transmission date & time
  11: string; // STAN
  12: string; // Local transaction time
  13: string; // Local date
  18: string; // Merchant type
  22: string; // POS entry mode
  26: string; // POS PIN capture code
  28: string; // Amount transaction fee
  37: string; // RRN
  41: string; // Card acceptor terminal identification
  42: string; // Card acceptor identification code
  49: string; // Currency code
  102: string; // Mobile number/Account Number
  103: string; // Account identification 2
  [k: string]: string;
}

export type ISO0110 = { id: number } & {
  transactionRequestId: string;
  lpsId: string;
  lpsKey: string;
  0: string; // MTI
  3: string; // Processing code Transaction type – 01
  7: string; // Transmission date & time
  11: string; // STAN
  28: string; // Amount transaction fee
  30: string; // Transaction processing fee
  39: string; // Response code
  41: string; // Card acceptor terminal identification
  42: string; // Card acceptor identification code
  48: string; // Amount transaction
  49: string; // Currency code
  102: string; // Mobile number/Account Number
  [k: string]: string;
}

export type ISO0200 = { id: number } & {
  transactionRequestId: string;
  lpsId: string;
  lpsKey: string;
  0: string; // MTI
  2: string; // PAN
  3: string; // Processing code Transaction type – 01
  4: string; // Amount
  7: string; // Transmission date & time
  11: string; // STAN
  12: string; // Local transaction time
  13: string; // Local date
  18: string; // Merchant type
  22: string; // POS entry mode
  26: string; // POS PIN capture code
  28: string; // Amount transaction fee
  37: string; // RRN
  41: string; // Card acceptor terminal identification
  42: string; // Card acceptor identification code
  49: string; // Currency code
  102: string; // Mobile number/Account Number
  103: string; // Account identification 2
  [k: string]: string;
}

export type ISOMessage = ISO0100 | ISO0110 | ISO0200
