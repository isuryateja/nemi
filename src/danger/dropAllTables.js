const knex = require("knex");
require('dotenv/config');

const db = knex({
    client: 'pg',
    connection: process.env.DATABASE_URL,
});

async function dropAllTables() {
    try {
        // Disable triggers and foreign key checks
        await db.raw('SET session_replication_role = replica;');

        // Get all table names
        const tables = await db
            .select('tablename')
            .from('pg_tables')
            .where('schemaname', 'public');

        // Drop all tables using CASCADE
        await db.raw(`
            DO $$ 
            DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END $$;
        `);

        console.log('All tables have been dropped successfully.');

        // Re-enable triggers and foreign key checks
        await db.raw('SET session_replication_role = DEFAULT;');
    } catch (error) {
        console.error('Error dropping tables:', error);
    } finally {
        await db.destroy();
    }
}

dropAllTables();
