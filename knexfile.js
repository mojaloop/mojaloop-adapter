module.exports = {
  integration: {
    client: 'mysql',
    connection: {
      host: 'mysql',
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
