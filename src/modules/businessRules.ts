import {TaskEither, tryCatch} from "fp-ts/TaskEither";
import {BRFetchRecord} from "../types/globalTypes";
import {db} from "../kysely.db";
import {Dict} from "../constants/dictionary";

export const getBRs = (operation: string) => (table: string): TaskEither<Error, BRFetchRecord[]> => {
    return tryCatch(
        async () => await db.selectFrom(Dict.NEMI_BUSINESS_RULE)
            .select(['script', 'when', 'operation', 'order'])
            .where('table', '=', table)
            .where('operation', '=', operation)
            .where("active", "=", true)
            .execute(),
        (e) => new Error("Could not get business rules" + JSON.stringify(e))
    )
}