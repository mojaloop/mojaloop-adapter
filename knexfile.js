module.exports = {
  testing: {
    client: 'mysql',
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'root',
      database: 'testing'
    }
  },
  sqlite: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:',
      supportBigNumbers: true
    },
    useNullAsDefault: true
  }
}
