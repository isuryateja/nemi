import express, {Request, Response} from "express";
import {TableColumn, TableCreationInput} from "../types/tables";
import {trace, validateIdentifier, typeMap, GLOBAL_SCOPE} from "../utils/globalutils";
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {TaskEither, tryCatch} from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import * as A from 'fp-ts/Array';
import * as E from 'fp-ts/Either';
import {chain, Either, fold, left, map, right} from 'fp-ts/Either';
import {db} from '../kysely.db';
import {CreateTableBuilder, sql} from 'kysely';

const router = express.Router();

type TableBuilder = CreateTableBuilder<any, never>;
type ColumnBuilder = (A: TableBuilder) => TableBuilder;

type tableInsertReturn = {
    nid : string | undefined
}

type ERROR = string
const VALID_COLUMN_TYPES: string[] = ['integer', 'string', 'text', 'boolean', 'reference'];


const validateColumnType = (type: string): Either<string, string> =>
    VALID_COLUMN_TYPES.includes(type)
        ? right(type)
        : left(`Invalid column type: ${type}`);

const validateColumn = (column: TableColumn): Either<ERROR, TableColumn> =>
    pipe(
        validateIdentifier(column.name),
        chain(() => validateColumnType(column.type)),
        map(() => column)
    );

const mapColumnType = ( column: TableColumn ):
    Either<string, (schemaBuilder: TableBuilder) => TableBuilder> => {
        const typeFun = typeMap[column.type];
        return typeFun
            ? right(typeFun(column))
            : left(`Unknown column type: ${column.type}`);
};

const mapInpColumnsToSchemaBuilders = ( columns: TableColumn[] )
    : Either<ERROR, ((schemaBuilder: TableBuilder) => TableBuilder)[]> =>
        pipe(
            columns,
            A.traverse(E.Applicative)(validateColumn),
            chain(A.traverse(E.Applicative)(mapColumnType))
        );

const addNemiIdToSchema = (schemaBuilder: TableBuilder): TableBuilder =>
    schemaBuilder.addColumn('nid', 'uuid', (col: any) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    );

const addScopeToSchema = (schemaBuilder: TableBuilder): TableBuilder =>
    schemaBuilder.addColumn('scope', 'uuid', (col: any) =>
        col.references('nemiScope.nid')
    );

const addCreatedAtToSchema = (schemaBuilder: TableBuilder): TableBuilder =>
    schemaBuilder.addColumn('createdAt', 'timestamptz', (col: any) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`)
    );


const addDefaultColumns = (schemaBuilder: TableBuilder): TableBuilder => pipe(
        schemaBuilder,
        addCreatedAtToSchema,
        addNemiIdToSchema,
        addScopeToSchema
    )

const addColumnsToSchema = (colBuilders: Either<ERROR, ColumnBuilder[]>) => (schemaBuilder: TableBuilder)
    : Either<string, TableBuilder> => {
    return pipe(
        colBuilders,
        E.map((colFns) =>
            colFns.reduce((schema, colFn) => colFn(schema), schemaBuilder)
        )
    );
};

const getTableBuilder = ( tableName: string, columns: TableColumn[]): Either<ERROR, TableBuilder> => {
    const columnBuilders: Either<string, ColumnBuilder[]> = mapInpColumnsToSchemaBuilders(columns);
    return pipe(
        db.schema.createTable(tableName),
        addDefaultColumns,
        addColumnsToSchema(columnBuilders)
    )
}

const createTable = (tableBuilder: TableBuilder):  TaskEither<ERROR, void> =>
    tryCatch(
        async () => tableBuilder.execute(),
        (e) => "Error creating table: " + String(e)
    )

/*
	•	TE.fromNullable: Converts a nullable value into a TaskEither, producing a Left if the value is null or undefined.
	•	res?.nid: Safely accesses nid, even if res is undefined.
 */
const addTableToNemiTables = ( tableName: string ): TaskEither<ERROR, string> => {
    return pipe(
        tryCatch(
        async () =>  await db.insertInto('nemiTables')
                .values({
                    name: tableName,
                    label: tableName,
                    scope: GLOBAL_SCOPE
                })
                .returning('nid')
                .executeTakeFirst(),
        (error) => String(error)
        ),
        TE.chain(res =>
            TE.fromNullable("No Table Id returned after adding table to nemiTables")(res?.nid)
        )
    )

};

const addColumnToNemiColumns = (tableId: string) => (column: TableColumn): TaskEither<ERROR, void> => {
    return tryCatch(
        async () => {
            const result = await db.insertInto('nemiColumns')
                .values({
                    name: column.name,
                    label: column.label,
                    type: column.type,
                    scope: GLOBAL_SCOPE,
                    table: tableId
                }).execute();
        },
        (error) => String(error)
    )
}

const addColumnsToNemiColumns = (tableId: string, columns: TableColumn[]): TaskEither<ERROR, void> => {
    console.log("columns ", JSON.stringify(columns));
    return pipe(
        columns,
        A.traverse(TE.ApplicativeSeq)((column) => addColumnToNemiColumns(tableId)(column)),
        TE.map(() => undefined)
    );
};

const checkTableExists = (tableName: string): TaskEither<ERROR, any> => {
    return pipe(
        tryCatch(
        async () =>  await db
                .selectFrom('nemiTables')
                .select('nid')
                .where('name', '=', tableName)
                .executeTakeFirst(),
        (error) => String(error)
        ),
        TE.chain(record =>
            record
                ? TE.left(`Table by the name ${tableName} already exists`)
                : TE.right(record)
        )
    )
};

router.post("/create", async (req: Request, res: Response) => {
    const { tableName, columns } = req.body as TableCreationInput;
    const program = pipe(
        validateIdentifier(tableName),
        E.chain(() => getTableBuilder(tableName, columns)),
        TE.fromEither,
        TE.chainFirst(() => checkTableExists(tableName)),
        TE.chain(createTable),
        TE.chain(() => addTableToNemiTables(tableName)),
        TE.chain((tableId) => addColumnsToNemiColumns(tableId, columns))
    );

    const result = await program();
    pipe(
        result,
        fold(
            (error) => res.status(500).send("Error: " + error),
            () => res.status(200).send("Table created: " + tableName)
        )
    );
});


export default router;