import * as TE from "fp-ts/TaskEither";
import {chainFirstIOK, TaskEither, tryCatch} from "fp-ts/TaskEither";
import {pipe} from "fp-ts/function";
import {db} from "../kysely.db";
import {BRFetchRecord, ScriptContext, UserPayload} from "../types/globalTypes";
import {getBRs} from "./businessRules";
import {Dict} from "../constants/dictionary";
import {IMMUTABLE_NEMI_PROPERTIES} from "../constants/records";
import * as O from "fp-ts/Option";
import vm from "node:vm";
import * as A from "fp-ts/Array";
import {ensurePolicyAccess} from "./accessPolicies";

const trace = <T>(message: string) => (value: T): TE.TaskEither<Error, T> =>
    pipe(
        TE.of(value as T), // Explicitly typing the value to T
        chainFirstIOK(() => () => console.log(`${message}:`, value))
    );

export type RecordCreationInput = {
    "table": string,
    "values": Object
}

type F_CRUD_Operation = (tableName: string) => (context: ScriptContext) => TaskEither<Error, ScriptContext>;

type BusinessRule = {
    script: string;
    when: string;
    operation: string;
    order: number;
};

const CONTEXT = {
    console: console,
    nemi: db
};

export const insertRecord = (input: RecordCreationInput): TaskEither<Error, any> => {
    const {table, values} = input;
    return tryCatch(
        async () => {
            let res = await db.insertInto(table).values(values).execute();
            return input
        },
        (e) => new Error(JSON.stringify(e))
    )
}

export const insertIntoTable = (tableName: string) => (newScriptContext: ScriptContext): TaskEither<Error, any> => {
    return tryCatch(
        async () => {
            let res = await db.insertInto(tableName)
                .values(newScriptContext.current)
                .returning('nid')
                .execute();
            newScriptContext.current.nid = res[0].nid
            return {...newScriptContext}
        },
        (e) => new Error("Could not insert into table" + JSON.stringify(e))
    )
}

const updateNemiRecord = (tableName: string) => (newScriptContext: ScriptContext): TaskEither<Error, any> =>
    tryCatch(
        async () => {
            await db.updateTable(tableName)
                .where("nid", "=", newScriptContext.current.nid)
                .set(newScriptContext.current)
                .executeTakeFirst();

            return newScriptContext;
        },
        (e) => new Error(`Could not update the record for ${tableName}` + JSON.stringify(e))
    )

const filterAndSortBrs = (when: string) => (brs: BRFetchRecord[]): BRFetchRecord[] =>
    brs.filter(br => br.when === when)
        .sort((a, b) => (a.order - b.order));

const cloneContext = (context: object): object => ({...context});

const executeScript = (script: string) => (clonedContext: ScriptContext): TE.TaskEither<never, ScriptContext> => {
    const backupContext = {...clonedContext};
    return pipe(
        TE.tryCatch<Error, ScriptContext>(
            () => {
                const runnable = new vm.Script(script);
                runnable.runInNewContext(clonedContext);
                return Promise.resolve(clonedContext);
            },
            (err) => err instanceof Error ? err : new Error(String(err))
        ),
        TE.orElse((error: Error): TE.TaskEither<never, ScriptContext> =>
            pipe(
                TE.fromIO(() => {
                    console.error("Script execution failed, fallback context used.", error);
                }),
                TE.map(() => backupContext)
            )
        )
    );
}

const runScriptWithContext = (script: string) => (context: any): TE.TaskEither<Error, any> => {
    const executable = executeScript(script)
    return pipe(
        TE.right(cloneContext(context)),
        TE.chain(executable)
    )
}

const applyBusinessRules = (baseContext: ScriptContext) => (brs: BusinessRule[]): TaskEither<Error, ScriptContext> =>
    pipe(
        // TODO: filter business rules based on conditions and roles.
        // map each br to a function that runs the script with the context
        brs.map(br => (ctx: ScriptContext) => runScriptWithContext(br.script)(ctx)),
        A.reduce(TE.right<Error, ScriptContext>(baseContext), (ctxTE, runBR) =>
            TE.chain(runBR)(ctxTE)
        )
    )

const makeNemiRecordMutableSafe = (nemiRecord: any) => {
    IMMUTABLE_NEMI_PROPERTIES.forEach(property => {
        Object.defineProperty(nemiRecord, property, {
            writable: false,
            enumerable: true,
            configurable: false,
        });
    })
    return nemiRecord;
}

const getNemiRecord = (table: string, nid: string): TaskEither<Error, any> => {
    return pipe(
        tryCatch(
            () => db.selectFrom(table)
                .where('nid', '=', nid)
                .selectAll()
                .executeTakeFirst(),
            (e) => new Error(`Could not get the record ` + JSON.stringify(e))
        ),
        TE.chain((record) =>
            record
                ? TE.right(record)
                : TE.left(new Error(`Record not found in ${table} with nid: ${nid}`))
        )
    );
};

const deleteNemiRecord = (table: string) => (newScriptContext: ScriptContext): TaskEither<Error, any> => {
    return tryCatch(
        async () => {
            await db.deleteFrom(table)
                .where('nid', '=', newScriptContext.current.nid)
                .execute();
            return newScriptContext;
        },
        (e) => new Error(`Could not delete the record ` + JSON.stringify(e))
    );
}

const getTableIdFromNemiTables = (table: string): TaskEither<Error, string> => {
    return pipe(
        tryCatch(
            () => db.selectFrom(Dict.NEMI_TABLES)
                .where('name', '=', table)
                .select('nid')
                .executeTakeFirst(),
            (e) => new Error(`Error fetching table id ${table}: ${JSON.stringify(e)}`)
        ),
        TE.chainOptionK(
            () => new Error(`Table ${table} not found in Nemi Tables:`)
        )((record) => O.fromNullable(record?.nid))
    );
};

const createScriptContext = (user: UserPayload, table: string, nid: string, current: any): TaskEither<Error, ScriptContext> => {
    return pipe(
        TE.Do,
        TE.bind('tableId', () => getTableIdFromNemiTables(table)),
        TE.bind('userData', () => getNemiRecord(Dict.NEMI_USER, user.id)), // can this be stored in redis ?
        TE.bind('safeCurrent', () => TE.of(makeNemiRecordMutableSafe(current))),
        TE.bind('scriptContext', ({safeCurrent, userData, tableId}) => TE.of
            ({...CONTEXT, current: safeCurrent, user: userData, table: {id: tableId, name: table}})
        ),
        TE.map(({scriptContext}) => scriptContext)
    )
}

export const justGetRecordWithContext = (user: UserPayload, table: string, nid: string): TaskEither<Error, any> => {
    return pipe(
        TE.Do,
        TE.bind('current', () => getNemiRecord(table, nid)),
        TE.bind('scriptContext', ({current}) => createScriptContext(user, table, nid, current)),
        TE.map(({scriptContext}) => scriptContext)
    );
}

const executeBusinessRulesOnQuery = (scriptContext: ScriptContext, brs: BusinessRule[], table: string)
    : TaskEither<Error, ScriptContext> => {
    const beforeBrs = filterAndSortBrs("before")(brs);
    const afterBrs = filterAndSortBrs("after")(brs);

    //TODO: this is not the ideal behaviour for query BRs, this should not update the NEMI record but only update
    // the query
    return pipe(
        applyBusinessRules(scriptContext)(beforeBrs),
        TE.chain((updatedContext) => updateNemiRecord(table)(updatedContext)),
        TE.chain((updatedContext) => applyBusinessRules(updatedContext)(afterBrs))
    );
};

const executeBusinessRules = (operation: F_CRUD_Operation) => (
    scriptContext: ScriptContext,
    brs: BusinessRule[],
    values: any
): TaskEither<Error, ScriptContext> => {
    const beforeBrs = filterAndSortBrs('before')(brs);
    const afterBrs = filterAndSortBrs('after')(brs);

    return pipe(
        applyBusinessRules(scriptContext)(beforeBrs),
        TE.map((updatedContext) => {
            updatedContext.current = {...updatedContext.current, ...values};
            return updatedContext;
        }),
        TE.chain((updatedContext) => operation(scriptContext.table.name)(updatedContext)),
        TE.chain((updatedContext) => applyBusinessRules(updatedContext)(afterBrs))
    );
};

const executeBusinessRulesOnDelete = (
    scriptContext: ScriptContext,
    brs: BusinessRule[],
    table: string
): TaskEither<Error, ScriptContext> => {
    const beforeBrs = filterAndSortBrs('before')(brs);
    const afterBrs = filterAndSortBrs('after')(brs);

    return pipe(
        applyBusinessRules(scriptContext)(beforeBrs),
        TE.chain((updatedContext) => deleteNemiRecord(table)(updatedContext)),
        TE.chain((updatedContext) => applyBusinessRules(updatedContext)(afterBrs))
    );
}

const createScriptContextForInsert = (user: UserPayload, table: string, values: any): TaskEither<Error, ScriptContext> => {
    return pipe(
        TE.Do,
        TE.bind('tableId', () => getTableIdFromNemiTables(table)),
        TE.bind('userData', () => getNemiRecord(Dict.NEMI_USER, user.id)),
        TE.bind('scriptContext', ({userData, tableId}) => TE.of(
            {...CONTEXT, current: values, user: userData, table: {name: table, id: tableId}}
        )),
        TE.map(({scriptContext}) => scriptContext)
    );
};

export const processGetRecord = (
    user: UserPayload,
    table: string,
    nid: string
): TE.TaskEither<Error, ScriptContext> =>
    pipe(
        justGetRecordWithContext(user, table, nid),
        TE.chain(ensurePolicyAccess),
        TE.bindTo('scriptContext'),
        TE.bind('brs', ({ scriptContext }) => getBRs('query')(scriptContext.table.id)),
        TE.chain(({ scriptContext, brs }) => executeBusinessRulesOnQuery(scriptContext, brs, table))
    );

export const processUpdateRecord = (user: UserPayload, table: string, nid: string, values: any): TaskEither<Error, any> => {
    const executeBusinessRulesOnUpdate = executeBusinessRules(updateNemiRecord);
    return pipe(
        justGetRecordWithContext(user, table, nid),
        TE.chain(ensurePolicyAccess),
        TE.bindTo('scriptContext'),
        TE.bind('brs', ({scriptContext}) => getBRs('update')(scriptContext.table.id)),
        TE.chain(({scriptContext, brs}) =>
            executeBusinessRulesOnUpdate(scriptContext, brs, values))
    );
}

export const processInsertRecord = (user: UserPayload, table: string, values: any): TaskEither<Error, any> => {
    const executeBusinessRulesOnInsert = executeBusinessRules(insertIntoTable);
    return pipe(
        createScriptContextForInsert(user, table, values),
        TE.chain(ensurePolicyAccess),
        TE.bindTo('scriptContext'),
        TE.bind('brs', ({scriptContext}) => getBRs('insert')(scriptContext.table.id)),
        TE.chain(({scriptContext, brs}) =>
            executeBusinessRulesOnInsert(scriptContext, brs, values))
    );
}

export const processDeleteRecord = (user: UserPayload, table: string, nid: string): TaskEither<Error, any> =>
     pipe(
        justGetRecordWithContext(user, table, nid),
        TE.chain(ensurePolicyAccess),
        TE.bindTo('scriptContext'),
        TE.bind('brs', ({scriptContext}) => getBRs('delete')(scriptContext.table.id)),
        TE.chain(({scriptContext, brs}) =>
            executeBusinessRulesOnDelete(scriptContext, brs, table)),
    );

