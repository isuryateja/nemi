
import knex from 'knex';
//postgresql://surya:nemi@localhost:5432/nemi
// Initialize Knex with your database connection (example for PostgreSQL)
const db = knex({
    client: 'pg', // PostgreSQL client
    connection: 'postgresql://surya:nemi@localhost:5432/nemi', // Your full connection string
  });

export default db;