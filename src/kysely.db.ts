import {Generated, Kysely, PostgresDialect} from 'kysely';
import { Pool } from 'pg';
import 'dotenv/config';

interface Database {
    nemi_user: {
        nid: Generated<string>;
        created_at: Generated<Date>;
        username: string;
        firstname: string;
        middlename?: string;
        lastname: string;
        gender: string;
        email: string;
        password: string;
        designation?: string;
        active?: boolean;
    };

    nemi_table: {
        nid: Generated<string>;
        name: string;
        created_at: Generated<Date>;
        scope: string; // Foreign key to nemi_scope
        label: string;
        created_by?: string; // Foreign key to nemi_user
    };

    nemi_column: {
        nid: Generated<string>;
        created_at: Generated<Date>;
        table: string; // Foreign key to nemi_table
        scope: string; // Foreign key to nemi_scope
        name: string;
        type: string;
        label: string;
        created_by?: string; // Foreign key to nemi_user
    };

    nemi_scope: {
        nid: Generated<string>;
        created_at: Generated<Date>;
        name: string;
        label: string;
        version: string;
    };

    nemi_business_rule: {
        nid: Generated<string>;
        created_at: Generated<Date>;
        name: string;
        table: string; // Foreign key to nemi_table
        scope: string; // Foreign key to nemi_scope
        script: string;
        when: string; // before or after
        operation: string; // insert, update, etc.
        order: number;
        created_by?: string; // Foreign key to nemi_user
        active?: boolean;
    };

    nemi_script_module: {
        nid: Generated<string>;
        created_at: Generated<Date>;
        scope: string; // Foreign key to nemi_scope
        name: string;
        script: string;
        created_by?: string; // Foreign key to nemi_user
    };

    nemi_role: {
        nid: Generated<string>;
        created_at: Generated<Date>;
        scope: string; // Foreign key to nemi_scope
        name: string;
        description: string;
        label: string;
        contains?: string; // Foreign key to nemi_role (self-reference)
        active?: boolean;
        created_by?: string; // Foreign key to nemi_user
    };

    n_user_role: {
        nid: Generated<string>;
        created_at: Generated<Date>;
        scope: string; // Foreign key to nemi_scope
        user: string; // Foreign key to nemi_user
        role: string; // Foreign key to nemi_role
    };

    nemi_access_policy: {
        nid: Generated<string>;
        created_at: Generated<Date>;
        scope: string; // Foreign key to nemi_scope
        table: string; // Foreign key to nemi_table
        column: string; // Foreign key to nemi_column
        script: string;
        active?: boolean;
        created_by?: string; // Foreign key to nemi_user
    };

    n_acp_role: {
        nid: Generated<string>;
        created_at: Generated<Date>;
        scope: string; // Foreign key to nemi_scope
        access_policy: string; // Foreign key to nemi_access_policy
        role: string; // Foreign key to nemi_role
    };

    [key: string]: Record<string, any>;
}

// Initialize Kysely with PostgreSQL
export const db = new Kysely<Database>({
    dialect: new PostgresDialect({
        pool: new Pool({
            connectionString: "postgresql://surya:nemi@localhost:5432/nemi",
        }),
    }),
});

const pool = new Pool({
    connectionString: "postgresql://surya:nemi@localhost:5432/nemi",
});