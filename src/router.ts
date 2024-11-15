import {Router} from "express";
import tables from "./handlers/tables";
import records from "./handlers/records";
import br from "./handlers/businessRules";
import user from "./handlers/users";
import metaData from "./handlers/metadata";

const router = Router();

router.use("/tables", tables);
router.use("/record", records);
router.use("/br/", br);
router.use("/user/", user);
router.use("/meta/", metaData);

export default router;
