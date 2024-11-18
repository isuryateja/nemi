import express, {Request, Response} from "express";
import * as TE from 'fp-ts/TaskEither';
import {TaskEither, tryCatch} from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {Either, fold} from 'fp-ts/Either';
import {db} from '../kysely.db';
import * as N from "../utils/globalutils";
import {BRFetchRecord, getBRs} from "./businessRules";
import vm from 'node:vm';
import {Dict} from "../constants/dictionary";
import {AuthRequest} from "../modules/auth";
import {IMMUTABLE_NEMI_PROPERTIES} from "../constants/records";

const router = express.Router();

export type RecordCreationInput = {
    "tableName": string,
    "values": Object
}


const context = {
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

const filterBrs =  (when: string, operation:string) => (brs: BRFetchRecord[]) : BRFetchRecord[] =>
    brs.filter(br => br.when === when && br.operation === operation)
        .sort((a,b) => (a.order - b.order));



const cloneContext = (context: object): object => ({ ...context });

const executeScript = (script: string) => (clonedContext: object)  => {
    const runnable = new vm.Script(script);
    runnable.runInNewContext(clonedContext);
    return Promise.resolve(clonedContext);
};

const runScriptWithContext = (context: any) => (script: string): TaskEither<Error, any> => {
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

export const getRecord = async (table: string, nid:string) => {
    return await db.selectFrom(table)
              .where('nid', '=', nid)
              .selectAll()
              .executeTakeFirst();
}

const getTableIdFromNemiTables = async (table:string) => {
    return await db.selectFrom(Dict.NEMI_TABLES)
        .where('name', '=', table)
        .select("nid")
        .executeTakeFirst()
}

const updateNemiRecord = async (table: string, nid: string, values: any) => {
    let rec = await db.updateTable(table )
        .where("nid", "=", nid)
        .set(values)
        .executeTakeFirst()
    console.log("updated record: ", rec)
}

router.get("/:table/:nid", async (req:Request, res:Response) => {
    let table = req.params.table as string;
    let nid = req.params.nid as string;

    let nemiTableRecord  = await getTableIdFromNemiTables(table)
    let tableId = nemiTableRecord?.nid;

    if (!tableId) {
        res.status(400).send( `No table with name ${table} found`);
        return;
    }

    let current = await getRecord(table, nid);
    makeNemiRecordMutableSafe(current);

    let scriptContext = {...context, current}

    let brs = await getBRs(tableId);
    const beforeQueryBrs = filterBrs("before", "query")(brs);
    const afterQueryBrs = filterBrs("after", "query")(brs);

    console.log("current Record before : ", JSON.stringify(current, null, 2))

    beforeQueryBrs.forEach(br => runScriptWithContext(scriptContext)(br.script)
    );

    console.log("current Record: ", JSON.stringify(current, null, 2))

    afterQueryBrs.forEach(br => runScriptWithContext(scriptContext)(br.script) )

    await updateNemiRecord(table, nid, current);

    res.status(200).send(current)
})

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

router.get("/test", async (req:AuthRequest, res:Response) => {
    // send back the whole request object
    // get user from request object
    console.log("Request object: ", req.user);
    res.status(200).send("Hello from records");

})


export default router;
