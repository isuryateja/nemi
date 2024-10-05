import { PrismaClient as PostgresPrismaClient } from '@prisma/client';
import express, { Request, Response } from "express";
import { tableCreationInput, tableColumn } from "../types/tables";

const postgresClient: PostgresPrismaClient = new PostgresPrismaClient({
    datasources: { db: { url: "postgresql://surya:nemi@localhost:5432/nemi" } },
});

const router = express.Router();

const typeMap: Record<string, (column: tableColumn) => string> = {
    string: (column) => `${column.name} VARCHAR(100)`,
    integer: (column) => `${column.name} INTEGER`,
    text: (column) => `${column.name} TEXT`,
    boolean: (column) => `${column.name} BOOLEAN`,
    reference: (column) => `${column.name} CHAR(32) REFERENCES ${column.reference}(nid)`,
};

// Validation Functions
function validateIdentifier(name: string): string | null {
    const isValid = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
    return isValid ? null : `Invalid identifier: ${name}`;
}

function validateColumnType(type: string): string | null {
    const validTypes = ['integer', 'string', 'text', 'boolean', 'reference'];
    return validTypes.includes(type) ? null : `Invalid column type: ${type}`;
}

function validateColumn(column: tableColumn): string | null {
    const identifierError = validateIdentifier(column.name);
    if (identifierError) return identifierError;

    const typeError = validateColumnType(column.type);
    if (typeError) return typeError;

    return null;
}

function mapColumnType(column: tableColumn): string | null {
    const typeFunction = typeMap[column.type];
    if (!typeFunction) return `Unknown column type: ${column.type}`;
    return typeFunction(column);
}

function getNemiID(): string {
    return "nid CHAR(32) PRIMARY KEY DEFAULT REPLACE(gen_random_uuid()::text, '-', '')";
}

function addNemiIdToColumns(tableColumns: string[]): string[] {
    return [getNemiID(), ...tableColumns];
}

function createTableSQL(tableName: string, columns: string[]): string {
    const columnsJoined = columns.join(", ");
    return `CREATE TABLE "${tableName}" (${columnsJoined})`;
}

// Main Route Handler
router.post("/create", async (req: Request, res: Response) => {
    const { tableName, columns } = req.body as tableCreationInput;

    // Validate table name
    const tableNameError = validateIdentifier(tableName);
    if (tableNameError) {
        return res.status(400).send(tableNameError);
    }

    // Validate and map columns
    const mappedColumns: string[] = [];
    for (const column of columns) {
        const columnError = validateColumn(column);
        if (columnError) {
            return res.status(400).send(columnError);
        }

        const mappedColumn = mapColumnType(column);
        if (mappedColumn === null) {
            return res.status(400).send(`Unknown column type: ${column.type}`);
        }

        mappedColumns.push(mappedColumn);
    }

    // Add NemiID to columns
    const allColumns = addNemiIdToColumns(mappedColumns);

    // Create SQL query
    const sqlQuery = createTableSQL(tableName, allColumns);

    try {
        // Check if table already exists
        const existingTable = await postgresClient.nemiTables.findFirst({
            where: {
                tableName: {
                    equals: tableName,
                },
            },
        });

        if (existingTable) {
            return res.status(400).send(`Table "${tableName}" already exists.`);
        }

        // Execute SQL to create table
        console.log(sqlQuery);
        await postgresClient.$executeRawUnsafe(sqlQuery);

        // Add table to nemiTables
        await postgresClient.nemiTables.create({
            data: {
                tableName: tableName,
                columns: columns,
            },
        });

        // Success response
        return res.status(200).send(`Table "${tableName}" created successfully.`);
    } catch (error) {
        console.error(error);
        return res.status(500).send(`Internal Server Error: ${String(error)}`);
    }
});

export default router;