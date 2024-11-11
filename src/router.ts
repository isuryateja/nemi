import {Router} from "express";
import {routes} from "./handlers/nemiRouters";

const router = Router();

router.use("/tables", routes.tables);
router.use("/record", routes.records);
router.use("/br/", routes.br);
router.use("/user/", routes.user);

export default router;
