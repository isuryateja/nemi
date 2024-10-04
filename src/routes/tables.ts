import { PrismaClient as PostgresPrismaClient } from '@prisma/client';
import express, { Request, Response } from "express";

interface ColumnDefinition {
    name: string;
    type: string;
}

function validateIdentifier(name: string): boolean {
    // PostgreSQL identifiers must start with a letter or underscore
    // and contain only letters, digits, and underscores
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function validateColumnType(type: string): boolean {
    const validTypes = [
        'INT',
        'SERIAL',
        'VARCHAR',
        'TEXT',
        'BOOLEAN',
        'TIMESTAMP',
        // Add other allowed types here
    ];

    // Extract the base type (e.g., 'VARCHAR' from 'VARCHAR(255)')
    const baseType = type.split('(')[0].toUpperCase();

    return validTypes.includes(baseType);
}

const postgresClient : PostgresPrismaClient = new PostgresPrismaClient({
    datasources: { db: { url: "postgresql://surya:nemi@localhost:5432/nemi" } },
});

const router = express.Router();
router.post("/create", async (req: Request, res: Response) => {
    const { tableName, columns } = req.body as {
        tableName: string;
        columns: ColumnDefinition[];
    };

    const columnsDefinition = columns
        .map(column => {
            // Validate column names and types
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column.name)) {
                throw new Error('Invalid column name.');
            }
            // You might want to have a whitelist of allowed types
            // const validTypes = ['INT', 'VARCHAR(255)', 'TEXT', 'BOOLEAN'];
            // if (!validTypes.includes(column.type.toUpperCase())) {
            //     throw new Error('Invalid column type.');
            // }
            return `${column.name} ${column.type}`;
        })
        .join(', ');

    const sql = `CREATE TABLE "${tableName}" (${columnsDefinition});`;
    try {
        await postgresClient.$executeRawUnsafe(sql);
        res.status(200).send(`Table ${tableName} created successfully.`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating table.');
    }
})



export default router;
