import express, {Request, Response} from "express";
import * as TE from 'fp-ts/TaskEither';
import {TaskEither, tryCatch, chainFirstIOK} from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {Either, fold} from 'fp-ts/Either';
import {db} from '../kysely.db';
import * as N from "../utils/globalutils";
import BusinessRules, {BRFetchRecord, getBRs, getBRsFP} from "./businessRules";
import vm from 'node:vm';
import {Dict} from "../constants/dictionary";
import {IMMUTABLE_NEMI_PROPERTIES} from "../constants/records";
import * as A from 'fp-ts/Array';
import * as O from 'fp-ts/Option';
import {AuthenticatedRequest, UserPayload, AuthRequest} from "../types/globalTypes";

const router = express.Router();


const trace = <T>(message: string) => (value: T): TE.TaskEither<Error, T> =>
    pipe(
        TE.of(value as T), // Explicitly typing the value to T
        chainFirstIOK(() => () => console.log(`${message}:`, value))
    );


const traceD = <T>(message: string, val: any) => (value: T): TE.TaskEither<Error, T> =>
    pipe(
        TE.of(val as T), // Explicitly typing the value to T
        chainFirstIOK(() => () => console.log(`${message}:`, value))
    );

export type RecordCreationInput = {
    "tableName": string,
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

//TODO
const validateColumns = (values: Object) : Either<N.Error, any> => {
    return E.right(values)
}

//TODO
const validateRecordInput = (input: RecordCreationInput): Either<N.Error, RecordCreationInput> =>
     input.values && input.tableName ? E.right(input) : E.left("Input type wrong");


export const insertIntoTable = (input: RecordCreationInput) : TaskEither<N.Error, any> => {
    const {tableName,values} = input;
    return tryCatch(
        async () => {
            let res = await db.insertInto(tableName).values(values).execute();
            return input
        },
        (e) => JSON.stringify(e)
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

const getRecord = (table: string, nid: string): TaskEither<Error, any> => {
    return pipe(
        tryCatch(
            () => db.selectFrom(table)
                .where('nid', '=', nid)
                .selectAll()
                .executeTakeFirst(),
            (e) => new Error(JSON.stringify(e))
        ),
        TE.chain((record) =>
            record
                ? TE.right(record)
                : TE.left(new Error(`Record not found for nid: ${nid}`))
        )
    );
};

const getTableIdFromNemiTables = (table: string): TaskEither<Error, any> => {
    return tryCatch(
        () => db.selectFrom(Dict.NEMI_TABLES)
                .where('name', '=', table)
                .select("nid")
                .executeTakeFirst()
                .then((res) =>
                    pipe(
                        O.fromNullable(res?.nid),
                        O.fold(
                            () => { throw new Error("No table id found"); },
                            (nid) => nid
                        )
                    )
                ),
        () => new Error("Error fetching table id")
    );
};

const updateNemiRecord = (tableName: string) => (newScriptContext: ScriptContext): TaskEither<Error, any> => {
    return tryCatch(
        () => db.updateTable(tableName)
            .where("nid", "=", newScriptContext.current.nid)
            .set(newScriptContext.current)
            .returningAll()
            .executeTakeFirst()
            .then(
                (res) => {
                    console.log("updated record: ", res);
                    return res;
                }
            ),
        (e) => new Error(JSON.stringify(e))
    )
}

const createScriptContext = (user: UserPayload, table: string, nid: string): TaskEither<Error, ScriptContext> => {
    return pipe(
        TE.Do,
        TE.bind('userData', () => getRecord(Dict.NEMI_USER ,user.id)),
        TE.bind('current', () => getRecord(table, nid)),
        TE.bind('safeCurrent', ({ current }) => TE.of(makeNemiRecordMutableSafe(current))),
        TE.bind('scriptContext', ({ safeCurrent, userData }) => TE.of(
            { ...CONTEXT, current: safeCurrent, user: userData, })
        ),
        TE.map(({ scriptContext }) => scriptContext)
    )
}

const executeBusinessRules = (scriptContext: ScriptContext, brs: BusinessRule[], table: string) : TaskEither<Error, ScriptContext> => {
    return pipe(
        TE.Do,
        TE.bind('updatedContext', () => {
            const beforeBrs = filterAndSortBrs("before")(brs);
            return applyBusinessRules(scriptContext)(beforeBrs);
        }),
        TE.chainFirst(({ updatedContext  }) => updateNemiRecord(table)(updatedContext)),
        TE.bind('finalContext', ({ updatedContext }) => {
            const afterBrs = filterAndSortBrs("after")(brs);
            return applyBusinessRules(updatedContext)(afterBrs);
        }),
        TE.map(({ finalContext }) => ( {finalContext} ))
    );
}


const processGetRecord = (user: UserPayload, table: string, nid: string): TaskEither<Error, any> => {
    return pipe(
        TE.Do,
        TE.bind('scriptContext', () => createScriptContext(user, table, nid)),
        TE.bind('tableId', () => getTableIdFromNemiTables(table)),
        TE.bind('brs', ({tableId}) => getBRsFP('query')(tableId)),
        TE.bind('updatedContext', ({ scriptContext, brs }) => {
            const beforeBrs = filterAndSortBrs("before")(brs);
            return applyBusinessRules(scriptContext)(beforeBrs);
        }),
        TE.chainFirst(({ updatedContext  }) => updateNemiRecord(table)(updatedContext)),
        TE.bind('finalContext', ({ updatedContext, brs }) => {
            const afterBrs = filterAndSortBrs("after")(brs);
            return applyBusinessRules(updatedContext)(afterBrs);
        }),
        TE.map(({ finalContext, tableId }) => (
            {...finalContext.current, tableId: tableId, user: finalContext.user}
        ))
    );
};

const processUpdateRecord = (user: UserPayload, table: string, nid: string, values: any): TaskEither<Error, any> => {
    return pipe(
        // processGetRecord(table, nid),
        TE.Do,
        TE.bind('currentContext', () => processGetRecord(user, table, nid)),

        TE.bind('brs', ({currentContext}) =>  getBRsFP('update')(currentContext.tableId)),


    )
}

router.post("/create", async (req:Request, res: Response) => {
    const {tableName,values} = req.body as RecordCreationInput;

    const program = pipe(
        validateRecordInput({tableName, values}),
        TE.fromEither,
        TE.chain(insertIntoTable)
    )

    const result = await program();

    pipe(
        result,
        fold(
            (e) => res.status(500).send(JSON.stringify(e)),
            () => res.status(200).send(`Inserted a row in ${tableName}`)
        )
    )

})

router.post("/update/", async (req:Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const {table, nid, values} = req.body;


    const result = await processUpdateRecord(user, table, nid, values)();

    pipe(
        result,
        E.fold(
            (error) => res.status(500).send(error.message),
            (updatedCurrent) => res.status(200).send(updatedCurrent)
        )
    );

})

router.get("/:table/:nid", async (req: Request, res: Response) => {
    const { table, nid } = req.params;
    const user =(req as AuthRequest).user;

    const result = await processGetRecord(user, table, nid)();

    pipe(
        result,
        E.fold(
            (error) => res.status(500).send(error.message),
            (updatedCurrent) => res.status(200).send(updatedCurrent)
        )
    );
});

// router.get("/test", async (req:AuthRequest, res:Response) => {
//     // send back the whole request object
//     // get user from request object
//     console.log("Request object: ", req.user);
//     res.status(200).send("Hello from records");
//
// })


export default router;
