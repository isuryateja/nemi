import express, {Request, Response} from "express";
import * as TE from 'fp-ts/TaskEither';
import {TaskEither, tryCatch, chainFirstIOK} from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {Either} from 'fp-ts/Either';
import {db} from '../kysely.db';
import {BRFetchRecord, getBRs} from "./businessRules";
import vm from 'node:vm';
import {Dict} from "../constants/dictionary";
import {IMMUTABLE_NEMI_PROPERTIES} from "../constants/records";
import * as A from 'fp-ts/Array';
import * as O from 'fp-ts/Option';
import {UserPayload, AuthRequest} from "../types/globalTypes";
const router = express.Router();

const trace = <T>(message: string) => (value: T): TE.TaskEither<Error, T> =>
    pipe(
        TE.of(value as T), // Explicitly typing the value to T
        chainFirstIOK(() => () => console.log(`${message}:`, value))
    );

export type RecordCreationInput = {
    "table": string,
    "values": Object
}

type ScriptContext = {
    [key: string]: any;
};

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

let exampleInput = {
    tableName : "string",
    values: {
        name: "value",
        scope: "value",
        description: "value"
    }
}

export const insertIntoTable = (input: RecordCreationInput) : TaskEither<Error, any> => {
    const {table,values} = input;
    return tryCatch(
        async () => {
            let res = await db.insertInto(table).values(values).execute();
            return input
        },
        (e) => new Error(JSON.stringify(e))
    )
}

export const insertIntoTableFP =(tableName: string) => (newScriptContext: ScriptContext) : TaskEither<Error, any> => {
    return tryCatch(
        async () => {
            let res =await db.insertInto(tableName)
                .values(newScriptContext.current)
                .returning('nid')
                .execute();
            newScriptContext.current.nid = res[0].nid
            return {...newScriptContext}
        },
        (e) => new Error("Could not insert into table" + JSON.stringify(e))
    )
}

const updateNemiRecord = (tableName: string) => (newScriptContext: ScriptContext): TaskEither<Error, any> => {
    return tryCatch(
        async () => {
            await db.updateTable(tableName)
                .where("nid", "=", newScriptContext.current.nid)
                .set(newScriptContext.current)
                .executeTakeFirst();

            return newScriptContext;
        },
        (e) => new Error(`Could not update the record for ${tableName}` + JSON.stringify(e))
    )
}

const filterAndSortBrs =  (when: string) => (brs: BRFetchRecord[]) : BRFetchRecord[] =>
    brs.filter(br => br.when === when )
        .sort((a,b) => (a.order - b.order));

const cloneContext = (context: object): object => ({ ...context });

const executeScript = (script: string) => (clonedContext: object)  => {
    const runnable = new vm.Script(script);
    runnable.runInNewContext(clonedContext);
    return Promise.resolve(clonedContext);
};

const runScriptWithContext = (script: string) => (context: any) : TaskEither<Error, any> => {
    const executable = executeScript(script);
    return pipe(
        cloneContext(context),
        (clonedContext) =>
            tryCatch(
                () => executable(clonedContext),
                (error) => new Error(`Script execution failed: ${(error as Error).message}`)
            )
    )
}

const applyBusinessRules = (baseContext: ScriptContext) => (brs: BusinessRule[]) : TaskEither<Error, ScriptContext> =>
    pipe(
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

const createScriptContext = (user: UserPayload, table: string, nid: string): TaskEither<Error, ScriptContext> => {
    return pipe(
        TE.Do,
        TE.bind('userData', () => getNemiRecord(Dict.NEMI_USER ,user.id)), // can this be stored in redis ?
        TE.bind('current', () => getNemiRecord(table, nid)),
        TE.bind('safeCurrent', ({ current }) => TE.of(makeNemiRecordMutableSafe(current))),
        TE.bind('scriptContext', ({ safeCurrent, userData }) => TE.of(
            { ...CONTEXT, current: safeCurrent, user: userData, })
        ),
        TE.map(({ scriptContext }) => scriptContext)
    )
}

const createScriptContextForInsert = (user: UserPayload, table: string, values: any): TaskEither<Error, ScriptContext> => {
    return pipe(
        TE.Do,
        TE.bind('userData', () => getNemiRecord(Dict.NEMI_USER, user.id)),
        TE.bind('scriptContext', ({ userData }) => TE.of(
            { ...CONTEXT, current: values, user: userData }
        )),
        TE.map(({ scriptContext }) => scriptContext)
    );
}

const processGetRecord = (user: UserPayload, table: string, nid: string): TaskEither<Error, any> => {
    let getQueryBrs = getBRs('query');
    return pipe(
        TE.Do,
        TE.bind('tableId', () => getTableIdFromNemiTables(table)), // can this be stored in redis ?
        TE.bind('scriptContext', () => createScriptContext(user, table, nid)),
        TE.bind('brs', ({tableId}) => getQueryBrs(tableId)),
        TE.bind('finalContext', (
            {scriptContext, brs}) => executeBusinessRulesOnQuery(scriptContext, brs, table)
        ),
        TE.map(({ finalContext, tableId }) => ( {...finalContext, tableId}))
    );
};

const justGetRecord = (user: UserPayload, table: string, nid: string): TaskEither<Error, any> => {
    return pipe(
        TE.Do,
        TE.bind('tableId', () => getTableIdFromNemiTables(table)),
        TE.bind('scriptContext', () => createScriptContext(user, table, nid)),
        TE.map(({ scriptContext }) => scriptContext)
    );
}

const processUpdateRecord = (user: UserPayload, table: string, nid: string, values: any): TaskEither<Error, any> => {
    return pipe(
        TE.Do,
        TE.bind('currentContext', () => justGetRecord(user, table, nid)),
        TE.bind('brs', ({currentContext}) =>  getBRs('update')(currentContext.tableId)),
        TE.bind('updatedContext', (
            {currentContext, brs}) => executeBusinessRulesOnUpdate(currentContext, brs, table, values)
        ),
        TE.map(({ updatedContext }) => ( updatedContext ))
    )
}

const executeBusinessRulesOnQuery = ( scriptContext: ScriptContext, brs: BusinessRule[], table: string )
    : TaskEither<Error, ScriptContext> => {
    const beforeBrs = filterAndSortBrs("before")(brs);
    const afterBrs = filterAndSortBrs("after")(brs);

    return pipe(
        applyBusinessRules(scriptContext)(beforeBrs),
        TE.chain((updatedContext) => updateNemiRecord(table)(updatedContext)),
        TE.chain((updatedContext) => applyBusinessRules(updatedContext)(afterBrs))
    );
};

const executeBusinessRulesOnUpdate = (
    scriptContext: ScriptContext,
    brs: BusinessRule[],
    table: string,
    values: any
): TaskEither<Error, ScriptContext> => {
    const beforeBrs = filterAndSortBrs('before')(brs);
    const afterBrs = filterAndSortBrs('after')(brs);

    return pipe(
        applyBusinessRules(scriptContext)(beforeBrs),
        TE.map((updatedContext) => {
            updatedContext.current = { ...updatedContext.current, ...values };
            return updatedContext;
        }),
        TE.chain((updatedContext) => updateNemiRecord(table)(updatedContext)),
        TE.chain((updatedContext) => applyBusinessRules(updatedContext)(afterBrs))
    );
};

const executeBusinessRulesOnInsert = (
    scriptContext: ScriptContext,
    brs: BusinessRule[],
    table: string,
    values: any
): TaskEither<Error, ScriptContext> => {
    const beforeBrs = filterAndSortBrs('before')(brs);
    const afterBrs = filterAndSortBrs('after')(brs);

    return pipe(
        applyBusinessRules(scriptContext)(beforeBrs),
        TE.map((updatedContext) => {
            updatedContext.current = { ...updatedContext.current, ...values };
            return updatedContext;
        }),
        TE.chain((updatedContext) => insertIntoTableFP(table)(updatedContext)),
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

const processInsertRecord = (user: UserPayload, table: string, values: any): TaskEither<Error, any> => {
    return pipe(
        TE.Do,
        TE.bind('tableId', () => getTableIdFromNemiTables(table)),
        TE.bind('scriptContext', () => createScriptContextForInsert(user, table, values)),

        TE.bind('brs', ({tableId}) => getBRs('insert')(tableId)),
        TE.bind('finalContext', (
            {scriptContext, brs}) => executeBusinessRulesOnInsert(scriptContext, brs, table, values)
        ),
        TE.chainFirst(trace('scriptContext')),
        TE.map(({ finalContext, tableId }) => ( {...finalContext, tableId}))
    );
}

const processDeleteRecord = (user: UserPayload, table: string, nid: string): TaskEither<Error, any> => {
    return pipe(
        TE.Do,
        TE.bind('currentContext', () => justGetRecord(user, table, nid)),
        TE.bind('brs', ({currentContext}) => getBRs('delete')(currentContext.tableId)),
        TE.bind('updatedContext', (
            {currentContext, brs}) => executeBusinessRulesOnDelete(currentContext, brs, table)
        ),
        TE.map(({ updatedContext }) => ( updatedContext ))
    )
}

router.post("/create", async (req:Request, res: Response) => {
    const user = (req as AuthRequest).user;
    let {table, values} = req.body;

    const result = await processInsertRecord(user, table, values)();

    pipe(
        result,
        E.fold(
            (error) => res.status(500).send(error.message),
            (finalContext) => res.status(200).send({...finalContext.current})
        )
    );

})

router.post("/update/", async (req:Request, res: Response) => {
    const user = (req as AuthRequest).user;
    let {table, values} = req.body;

    const result = await processUpdateRecord(user, table, values.nid, values)();

    pipe(
        result,
        E.fold(
            (error) => res.status(500).send(error.message),
            (finalContext) => res.status(200).send({...finalContext.current})
        )
    );

})

router.delete("/:table/:nid", async (req: Request, res: Response) => {
    const { table, nid } = req.params;
    const user = (req as AuthRequest).user;

    const result = await processDeleteRecord(user, table, nid)();

    pipe(
        result,
        E.fold(
            (error) => res.status(500).send(error.message),
            (finalContext) => res.status(200).send({...finalContext.current})
        )
    );
});

router.get("/:table/:nid", async (req: Request, res: Response) => {
    const { table, nid } = req.params;
    const user =(req as AuthRequest).user;

    const result = await processGetRecord(user, table, nid)();

    pipe(
        result,
        E.fold(
            (error) => res.status(500).send(error.message),
            (finalContext) => res.status(200).send({...finalContext.current})
        )
    );
});

export default router;
