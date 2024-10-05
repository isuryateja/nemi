import { Either, left, right } from 'fp-ts/Either';


export const validateIdentifier= (name: string): Either<string, string> => {
    let isValid = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
    return isValid ? right(name): left(`Invalid identifier : ${name}`)
}

export const getNemiID = (): string => "nid CHAR(32) PRIMARY KEY DEFAULT REPLACE(gen_random_uuid()::text, '-', '')";