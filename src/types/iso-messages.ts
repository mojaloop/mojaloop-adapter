export type ISO0100 = {
  id: number;
  0: string; // MTI
  3: string; // Processing code Transaction type – 01
  4: string; // Amount
  7: string; // Transmission date & time
  11: string; // STAN
  28: string; // Amount transaction fee
  37: string; // RRN
  41: string; // Card acceptor terminal identification
  42: string; // Card acceptor identification code
  49: string; // Currency code
  102: string; // Mobile number/Account Number
  103: string; // Account identification 2
}

export type ISO0110 = {
  id: number;
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
}

export type ISOMessage = ISO0100 | ISO0110
