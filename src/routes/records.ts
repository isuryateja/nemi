import express, {Request, Response} from "express";
import {TableColumn, TableCreationInput} from "../types/tables";
import {trace, validateIdentifier, typeMap} from "../utils/globalutils";
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {TaskEither, tryCatch} from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import * as A from 'fp-ts/Array';
import * as E from 'fp-ts/Either';
import {chain, Either, fold, left, map, right} from 'fp-ts/Either';
import {db} from '../kysely.db';
import {CreateTableBuilder, sql} from 'kysely';
import exp from "node:constants";
import {as} from "fp-ts/IO";

const router = express.Router();

export type RecordCreationInput = {
    "tableName": string,
    "values": Object
}

type Error = string

let example = {
    tableName : "string",
    values: {
        name: "value",
        scope: "value",
        description: "value"
    }
}

const validateColumns = (values: Object) : Either<Error, any> => {
    return E.right(values)
}

const validateRecordInput = (input: RecordCreationInput): Either<Error, RecordCreationInput> => {

    return input.values && input.tableName ? E.right(input) : E.left(" Input type wrong");

}

const insertIntoTable = (input: RecordCreationInput) : TaskEither<Error, void> => {
    const {tableName,values} = input;
    return tryCatch(
        async () => {
            // @ts-ignore
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


export default router;