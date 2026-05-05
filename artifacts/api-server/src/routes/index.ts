import { Router, type IRouter } from "express";
import healthRouter from "./health";
import talkprepRouter from "./talkprep";
import sessionsRouter from "./sessions";
import stripeRouter from "./stripe";
import userRouter from "./user";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(talkprepRouter);
router.use(sessionsRouter);
router.use(stripeRouter);
router.use(userRouter);
router.use(adminRouter);

export default router;
