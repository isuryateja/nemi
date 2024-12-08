import express, {Request, Response} from "express";
import {TableColumn, TableCreationInput} from "../types/tables";
import {peek, validateIdentifier, typeMap, GLOBAL_SCOPE} from "../utils/globalutils";
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {TaskEither, tryCatch} from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import * as A from 'fp-ts/Array';
import * as E from 'fp-ts/Either';
import {chain, Either, fold, left, map, right} from 'fp-ts/Either';
import {db} from '../kysely.db';
import {CreateTableBuilder, sql} from 'kysely';
import {Dict} from "../constants/dictionary"

const router = express.Router();

type TableBuilder = CreateTableBuilder<any, never>;
type ColumnBuilder = (A: TableBuilder) => TableBuilder;

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
        col.references(`${Dict.NEMI_SCOPE}.nid`)
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
        async () =>  await db.insertInto(Dict.NEMI_TABLES)
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
            TE.fromNullable(`No Table Id returned after adding table to ${Dict.NEMI_TABLES}`)(res?.nid)
        )
    )

};

const addColumnToNemiColumns = (tableId: string) => (column: TableColumn): TaskEither<ERROR, void> => {
    return tryCatch(
        async () => {
            const result = await db.insertInto(Dict.NEMI_COLUMNS)
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

const addColumnsToNemiColumns = (tableId: string, columns: TableColumn[]): TaskEither<ERROR, void> =>
    pipe(
        columns,
        A.traverse(TE.ApplicativeSeq)((column) => addColumnToNemiColumns(tableId)(column)),
        TE.map(() => undefined)
    );

const checkTableExists = (tableName: string): TaskEither<ERROR, any> => {
    return pipe(
        tryCatch(
        async () =>  await db
                .selectFrom(Dict.NEMI_TABLES)
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

const validateTableName = (input: any): Either<string, TableCreationInput> =>
    typeof input.tableName === 'string' && input.tableName.length > 0
        ? right(input)
        : left('Invalid or missing tableName');

const validateColumns = (input: any): Either<string, TableCreationInput> =>{
    console.log(input)
   return     Array.isArray(input.columns) && input.columns.length > 0
       ? right(input)
       : left("Columns array is missing or empty")
}

const validateRequestBody = (input: any): Either<string, TableCreationInput> =>
    pipe(
        input,
        validateTableName,
        chain(validateColumns)
    )

router.post("/create", async (req: Request, res: Response) => {
    const { tableName, columns } = req.body as TableCreationInput;
    const program = pipe(
        validateRequestBody(req.body),
        chain(() => validateIdentifier(tableName)),
        chain(() => getTableBuilder(tableName, columns)),
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