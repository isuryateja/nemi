import {tryCatch, TaskEither} from 'fp-ts/TaskEither';
import {db} from '../kysely.db';
import { Option, fromNullable, fold } from 'fp-ts/Option';
import {NemiJson} from "../types/tables";
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';


export const getNemiRecord = (table: string, nid:string) : TaskEither<string, NemiJson> => {
    return tryCatch(
        async () => {
            let res = await db.selectFrom(table)
                .where('nid', '=', nid)
                .selectAll()
                .executeTakeFirst();

            return pipe(
                fromNullable(res),
                fold(
                    () => {throw new Error("Record not found")},
                    (record) => record
                )
            )
        },
        (e) => "Error: " + JSON.stringify(e)
    )
}