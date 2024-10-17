import express, {Request, Response} from "express";
import * as TE from 'fp-ts/TaskEither';
import {TaskEither, tryCatch} from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {Either, fold} from 'fp-ts/Either';
import {db} from '../kysely.db';
import {Error} from "../utils/globalutils";
import {BRFetchRecord, getBRs} from "./businessRules";
import vm from 'node:vm';
import {Dict} from "../constants/dictionary";

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
const validateColumns = (values: Object) : Either<Error, any> => {
    return E.right(values)
}

//TODO
const validateRecordInput = (input: RecordCreationInput): Either<Error, RecordCreationInput> => {

    return input.values && input.tableName ? E.right(input) : E.left(" Input type wrong");

}

export const insertIntoTable = (input: RecordCreationInput) : TaskEither<Error, void> => {
    const {tableName,values} = input;
    return tryCatch(
        async () => {
            let res = await db.insertInto(tableName).values(values).execute();
        },
        (e) => "wrong: " + JSON.stringify(e)
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


const filterBrs =  (when: string, operation:string) => (brs: BRFetchRecord[]) : BRFetchRecord[] =>
    brs.filter(br => br.when === when && br.operation === operation)
        .sort((a,b) => (a.order - b.order));

const runScriptWithContext = (context: any) => (script: string) => {
    const runnable = new vm.Script(script);
    try {
        runnable.runInNewContext(context);
    } catch (error) {
        console.error('Error executing script:', error);
    }
}

const makeNemiRecordMutableSafe = (nemiRecord: any) => {
    const immutableProperties = ['nid', 'scope', 'created_at']
    immutableProperties.forEach(property => {
        Object.defineProperty(nemiRecord, property, {
            writable: false,
            enumerable: true,
            configurable: false,
        });
    })
    return nemiRecord;
}

const getRecord = async (table: string, nid:string) => {
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


export default router;