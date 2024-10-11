import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

// Define your database schema
interface Database {
    nemiTables: {
        nid?: string;
        name: string;
        created_at?: Date;
        scope: string;
        label: string;
    };
    nemiColumns: {
        nid?: string;
        created_at?: Date;
        table: string;
        scope: string;
        name: string;
        label: string;
        type:string;
    };
    nemiScope: {
        nid?: string;
        created_at?: Date;
        name: string;
        label: string;
        version: string;
    };
    businessRules: {
        nid?: string;
        created_at?: Date;
        name: string;
        table: string;
        scope: string;
        script: string;
        when: string;
        operation: string;
    };
    scriptModules: {
        nid?: string;
        created_at?: Date;
        scope: string;
        name: string;
        script: string;
    };
}

// Initialize Kysely with PostgreSQL
export const db = new Kysely<Database>({
    dialect: new PostgresDialect({
        pool: new Pool({
            connectionString: 'postgresql://surya:nemi@localhost:5432/nemi',
        }),
    }),
});

const pool = new Pool({
    connectionString: 'postgresql://surya:nemi@localhost:5432/nemi',
});