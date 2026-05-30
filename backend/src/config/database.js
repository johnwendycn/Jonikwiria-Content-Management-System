const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

let sequelize;
const isPostgresConfigured = process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER);

if (isPostgresConfigured) {
  console.log('Database Configuration: Attempting PostgreSQL connection...');
  if (process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: process.env.DB_SSL === 'true' ? {
          require: true,
          rejectUnauthorized: false
        } : false
      }
    });
  } else {
    sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASS || '',
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
          ssl: process.env.DB_SSL === 'true' ? {
            require: true,
            rejectUnauthorized: false
          } : false
        }
      }
    );
  }
} else {
  console.log('Database Configuration: PostgreSQL environment parameters missing. Falling back to SQLite local database...');
  const sqlitePath = path.join(__dirname, '..', '..', 'database.sqlite');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: sqlitePath,
    logging: false
  });
}

module.exports = {
  sequelize,
  isPostgres: sequelize.getDialect() === 'postgres'
};
