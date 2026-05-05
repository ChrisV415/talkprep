import { Router, type IRouter } from "express";
import healthRouter from "./health";
import talkprepRouter from "./talkprep";
import sessionsRouter from "./sessions";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(talkprepRouter);
router.use(sessionsRouter);
router.use(stripeRouter);

export default router;
