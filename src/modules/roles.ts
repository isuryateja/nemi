import * as TE from 'fp-ts/TaskEither';
import {db} from '../kysely.db';
import {Dict} from "../constants/dictionary";

export const userHasRoles = (userId: string) => (roles: string[]): TE.TaskEither<Error, any> => {
    console.log("userId: ", userId)
    console.log("roles: ", roles)
   return TE.tryCatch(
        async () => {
            let DBRoles = await db.selectFrom(Dict.N_USER_ROLE_M2M)
                .where('user', '=', userId)
                .select('role')
                .execute()
            const dbRoleSet = new Set(DBRoles.map(dbRole => dbRole.role));
            return roles.some(role => dbRoleSet.has(role))
        },
        (e) => new Error(JSON.stringify(e))
    )
}

/*
    getAccessPolicies(context.table.id),
    validateAccessPolicies(context.user.id),




   // userHasRoles("1e20142e-b83c-4dd7-0000-c535c20dd390") (['1e20142e-b83c-4dd7-0000-c535c20dd398','1e20142e-b83c-4dd7-0000-c535c20dd397'])()
   //     .then(console.log)




 */
