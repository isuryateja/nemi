import {Router} from "express";

import user from "./handlers/users";

const authRouter = Router();


authRouter.use("/user/", user);

export default authRouter;
