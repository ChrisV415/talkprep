import { Router, type IRouter } from "express";
import healthRouter from "./health";
import talkprepRouter from "./talkprep";
import sessionsRouter from "./sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(talkprepRouter);
router.use(sessionsRouter);

export default router;
