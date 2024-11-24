import express, {Request, Response} from "express";
import * as TE from 'fp-ts/TaskEither';
import {TaskEither, tryCatch} from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as N from '../utils/globalutils';
import {Either, fold} from 'fp-ts/Either';
import {db} from '../kysely.db';
import {insertIntoTable} from "./records";
import {Dict} from "../constants/dictionary";

const router = express.Router();

export type BRFetchRecord = {
    script: string,
    when: string,
    operation: string,
    order: number
}

export type BRCreationRecord = {
    name: string,
    table: string,
    scope: string,
    script: string,
    when: string,
    operation: string,
    order: number
}

export type BR_bulk_input = BRCreationRecord[]
export const getBRs = async (table:string ): Promise< BRFetchRecord[] > => {
    return await db.selectFrom(Dict.NEMI_BUSINESS_RULE)
        .select(['script', 'when', 'operation', 'order'])
        .where('table', '=', table)
        .execute()
}

export const getBRsFP = (operation: string) => (table:string ): TaskEither<Error, BRFetchRecord[]> => {
    return tryCatch (
         async () =>  await db.selectFrom(Dict.NEMI_BUSINESS_RULE)
            .select(['script', 'when', 'operation', 'order'])
            .where('table', '=', table)
            .where('operation', '=', operation)
            .execute(),
        (e) => new Error("Could not get business rules" + JSON.stringify(e))
    )
}

const createBrs = async (brs: BR_bulk_input) => {
    await db.insertInto(Dict.NEMI_BUSINESS_RULE)
        .values(brs)
        .execute();
}

router.get("/:table", async (req:Request, res:Response) => {
    let table = req.params.table as string;
    let brs = await getBRs(table);

    console.log(JSON.stringify(brs))

    res.status(200).send(JSON.stringify(brs))
})

router.post("/bulk-create/:table", async (req:Request, res: Response) => {
    let brs = req.body as BR_bulk_input;
    await createBrs(brs);

    res.status(200).send("br created")

})
export default router
