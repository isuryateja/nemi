import knex from 'knex';

const db = knex({
    client: 'pg',
    connection: 'postgresql://surya:nemi@localhost:5432/nemi', // Your connection string
});

async function dropAllTables() {
    const tables = await db('pg_tables')
        .select('tablename')
        .where('schemaname', 'public');

    for (const table of tables) {
        await db.schema.dropTableIfExists(table.tablename);
    }

    console.log('All tables dropped');
    await db.destroy();
}

dropAllTables().catch((err) => console.error('Error dropping tables:', err));