import { PrismaClient as PostgresPrismaClient } from '@prisma/client';
import express, { Request, Response } from "express";
import {tableCreationInput, tableColumn} from "../types/tables";
import { validateIdentifier, getNemiID } from "../utils/globalutils"
import { TaskEither, tryCatch, fromEither } from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/lib/function';
import * as A from 'fp-ts/Array';
import { Either, left, right, chain, map, fold, Applicative } from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';

const postgresClient : PostgresPrismaClient = new PostgresPrismaClient({
    datasources: { db: { url: "postgresql://surya:nemi@localhost:5432/nemi" } },
});

type INVALID_INPUT = string
type INVALID_COLUMN_TYPE = string

type ERROR = INVALID_INPUT | INVALID_COLUMN_TYPE

const router = express.Router();

const typeMap: Record<string, (column: tableColumn) => string> = {
    string: (column) => `${column.name} VARCHAR(100)`,
    integer: (column) => `${column.name} INTEGER`,
    text: (column) => `${column.name} TEXT`,
    boolean: (column) => `${column.name} BOOLEAN`,
    reference: (column) => `${column.name} CHAR(32) REFERENCES ${column.reference}(nid)`,
};

const validateColumnType = (type: string): Either<string, string> => {
    const validTypes: string[] =[ 'integer', 'string', 'text', 'boolean', 'reference', ];
    return validTypes.includes(type as string)
        ? right(type as string)
        : left(`Invalid column type: ${type}` );
};

const mapColumnType = (column: tableColumn): Either<string, string> => {
    const typeFun = typeMap[column.type];
    return typeFun
        ? right(typeFun(column))
        : left(`Unknown column type: ${column.type}` );
};

const validateColumn = (column: tableColumn): Either<ERROR, tableColumn> =>
    pipe(
        validateIdentifier(column.name),
        chain(() => validateColumnType(column.type)),
        map(() => column)
    );

const mapInpColumnsToPostgresColumns = (columns: tableColumn[]): Either<ERROR, string[]> =>
    pipe(
        columns,
        A.traverse(Applicative)(validateColumn),
        chain(A.traverse(Applicative)(mapColumnType)),
        map(addNemiIdToColumns) // Add NemiID if all columns are valid
    );

const addNemiIdToColumns = (tableColumns: string[]): string[] =>
    [getNemiID(), ...tableColumns];

const getSQLCommand_createTable = (tableName: string) => (columns: string): string =>
    `CREATE TABLE "${tableName}" (${columns})`;

const checkTableExists = (tableName: string): TaskEither<string, boolean> => {
    return tryCatch(
        async () => {
            const record = await postgresClient.nemiTables.findFirst(({
                where: {
                    tableName: { equals: tableName }
                }
            }))
            return !!record
        },
        (error) => String(error)
    );
}

const executeSQL = (sqlQuery: string): TaskEither<string, void> => {
    return tryCatch(
        async () => {
            await postgresClient.$executeRawUnsafe(sqlQuery);
        },
        (error) => String(error)
    );
};

const addTableToNemiTables = (tableName: string, columns: [tableColumn]): TaskEither<string, string> => {
    return tryCatch(
        async () => {
            await postgresClient.nemiTables.create({
                data: {
                    tableName: tableName,
                    columns: columns
                }
            })
            return tableName
        },
        (error) => String(error)
    )
}

router.post("/create", async (req: Request, res: Response) => {
    const { tableName, columns } = req.body as tableCreationInput;

    const program: TaskEither<string, string> = pipe(
        TE.fromEither(validateIdentifier(tableName)),
        TE.chain((validTableName) =>
            pipe(
                mapInpColumnsToPostgresColumns(columns), 
                map(cols => cols.join(", ")),
                map(getSQLCommand_createTable(validTableName)), 
                TE.fromEither, 
                TE.chainFirst(() => checkTableExists(validTableName)),
                TE.chain((sqlQuery) => executeSQL(sqlQuery)), 
                TE.chain(() => addTableToNemiTables(validTableName, columns))
            )
        )
    );

    program().then(
        fold(
            (e) => res.status(400).send(e),
            () => res.status(200).send(`Table ${tableName} created successfully.`) 
        )
    );
})

export default router;


