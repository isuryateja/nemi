import * as TE from 'fp-ts/TaskEither';
import {db} from '../kysely.db';
import {processGetRecord} from "./nemiRecord";
import {ScriptContext, UserPayload} from "../types/globalTypes";
import * as A from 'fp-ts/Array'
import {Dict} from "../constants/dictionary";
import {pipe} from "fp-ts/function";
import { isLeft } from 'fp-ts/Either';
import {userHasRoles} from "./roles";

type AccessPolicy = {
    [key: string]: any;
};

export const evaluatePolicy = (context: ScriptContext) => (policy: AccessPolicy): TE.TaskEither<Error, Boolean> =>
    pipe(
        getPolicyRoles(policy),
        TE.chain(userHasRoles(context.user.nid))
    )

const getPolicyRoles = (policy:AccessPolicy): TE.TaskEither<Error, any> =>
     TE.tryCatch(
         async () => pipe (
                  await db.selectFrom(Dict.N_ACP_ROLE_M2M)
                    .where('access_policy', '=', policy.nid)
                    .select('role')
                    .execute(),
                 A.map(dobj => dobj.role)
         ),
        (e) => new Error(`Could not get policy roles for policy: ${policy.nid}` + JSON.stringify(e))
    )


export const getAccessPolicies = (tableId: string): TE.TaskEither<Error, AccessPolicy[]> =>
     TE.tryCatch(
         () =>
             pipe(
                 db.selectFrom(Dict.NEMI_ACCESS_POLICY)
                    .where('table', "=", tableId)
                    .where('active', '=', true)
                    .selectAll()
                    .execute(),

             ),
        (e) => new Error(`Could not get the access policies for table: ${tableId}` +  JSON.stringify(e))
    )

/*
getAccessPolicies => accessPolicies
accessPolicies.some(evaluatePolicy(context))
 */

const context = {
    user: {
        id: "1e20142e-b83c-4dd7-0000-c535c20dd394"
    },
    table: {
        id: "6ccbb5fa-ab91-498e-94dc-8888be973af4"
    }
}

let policy =   {
    nid: '68882c15-1520-414f-bc57-4c719b07e137',
    scope: '1e20142e-b83c-4dd7-0000-c535c20dd392',
    table: '6ccbb5fa-ab91-498e-94dc-8888be973af4',
    column: null,
    script: 'ok',
    active: true,
    created_by: null
}

const doesAnyPolicyTrueImp = (context: ScriptContext): TE.TaskEither<Error, boolean> =>
    TE.tryCatch(
        async () => {
            const policiesResult = await pipe(getAccessPolicies(context.table.id))();
            if (isLeft(policiesResult)) {
                throw policiesResult.left;
            }

            const policies = policiesResult.right;

            for (const policy of policies) {
                const result = await pipe(evaluatePolicy(context)(policy))();
                if (isLeft(result)) {
                    throw result.left;
                }
                if (result.right) {
                    return true; // Short-circuit on first true
                }
            }

            return false; // No policies passed
        },
        error => new Error(`Error in evaluating policies: ${String(error)}`)
    );

const doesAnyPolicyTrue = (context: ScriptContext): TE.TaskEither<Error, boolean> =>
    pipe(
        getAccessPolicies(context.table.id),
        TE.chain(policies =>
            pipe(
                policies,
                A.map(evaluatePolicy(context)), // Now we have TaskEither<Error, boolean> for each policy
                A.sequence(TE.ApplicativePar),   // Run them all
                TE.map(results => results.some(Boolean)) // Check if any is true
            )
        )
    )

export const anyPolicyAllowsAccess = (context: ScriptContext): TE.TaskEither<Error, boolean> =>
    pipe(
        getAccessPolicies(context.table.id),
        TE.chain(policies =>
            pipe(
                policies,
                A.match(
                    () => TE.of(true), // If no policies, return true
                    nonEmptyPolicies =>
                        pipe(
                            nonEmptyPolicies,
                            A.map(evaluatePolicy(context)),
                            A.sequence(TE.ApplicativePar),
                            TE.map(results => results.some(Boolean))
                        )
                )
            )
        )
    );

export const ensurePolicyAccess = (scriptContext: ScriptContext): TE.TaskEither<Error, ScriptContext> => {
    console.log('script context: ', scriptContext)
    return pipe(
        anyPolicyAllowsAccess(scriptContext),
        TE.chain(accessAllowed =>
            accessAllowed
                ? TE.of(scriptContext)
                : TE.left(new Error('Access denied: Policy check failed'))
        )
    );
}

// evaluatePolicy(context)(policy)().then(p => console.log(p))

// getAccessPolicies('6ccbb5fa-ab91-498e-94dc-8888be973af4')().then(p => console.log(p))