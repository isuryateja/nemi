import type { Knex } from "knex";
import 'dotenv/config';

// Update with your config settings.

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg", // PostgreSQL client
    connection: process.env.DATABASE_URL, // Connection string for development
  },

  staging: {
    client: "pg", // PostgreSQL client
    connection: process.env.DATABASE_URL, // Connection string for staging
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: "knex_migrations"
    }
  },

  production: {
    client: "pg", // PostgreSQL client
    connection: process.env.DATABASE_URL, // Connection string for production
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: "knex_migrations"
    }
  }
};

module.exports = config;