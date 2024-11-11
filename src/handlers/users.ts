import express, {Request, Response} from "express";
import {createJWT, hashPassword, comparePasswords} from "../modules/auth";
import {db} from '../kysely.db';
import {Dict} from "../constants/dictionary";

const router = express.Router();

type newUser = {
    username: string;
    firstname: string;
    middlename?: string;
    lastname: string;
    gender: string;
    email: string;
    password: string;
    designation?: string;
}
export const createNewUser = async (req: Request, res: Response) => {

    const userData = req.body as newUser;
    userData.password = await hashPassword(userData.password);

    try {
        const user_nid = await db.insertInto(Dict.NEMI_USER)
            .values(userData)
            .returning('nid')
            .execute();

        console.log(user_nid)
        const token = createJWT({
            id: user_nid,
            username: userData.username
        });
        res.json({ token });

    } catch (e) {
        console.error(e);
        res.status(500).send(JSON.stringify(e))
    }

};


const signIn = async (req: Request, res: Response) => {
    const { username, password } = req.body;

    const user = await db.selectFrom(Dict.NEMI_USER)
        .where("username", "=", username)
        .selectAll()
        .executeTakeFirst();

    if (!user) {
        res.status(401).send("Invalid username or password");
        return;
    }

    if (user.length === 0) {
        res.status(401).send("Invalid username or password");
        return;
    }

    const match = await comparePasswords(password, user.password);

    if (!match) {
        res.status(401).send("Invalid username or password");
        return;
    }

    const token = createJWT({
        id: user.nid,
        username
    });

    res.json({ token });
}


router.post("/signup", createNewUser);

router.post("/signin", signIn);


export default router;