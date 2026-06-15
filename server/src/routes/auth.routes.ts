import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { postRequestCode, postVerifyCode, postLogout } from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/request-code", postRequestCode);
authRouter.post("/verify-code", postVerifyCode);
authRouter.post("/logout", requireAuth, postLogout);
