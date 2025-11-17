import { CreateUser ,getUserDetails,LoginUser} from "../controller/user.controller";
import { Router } from "express";

const router = Router(); 



router.route("/signup").post(CreateUser);
router.route("/login").post(LoginUser);
router.route("/:id").get(getUserDetails);




export default router;










