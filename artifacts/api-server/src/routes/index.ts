import { Router, type IRouter } from "express";
import healthRouter from "./health";
import talkprepRouter from "./talkprep";

const router: IRouter = Router();

router.use(healthRouter);
router.use(talkprepRouter);

export default router;
