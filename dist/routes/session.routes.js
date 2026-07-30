"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const session_controller_1 = require("../controllers/session.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)({ mergeParams: true });
const controller = new session_controller_1.SessionController();
router.use(auth_middleware_1.authenticateDoctor);
router.post('/', (req, res) => controller.createSession(req, res));
router.get('/', (req, res) => controller.getSessions(req, res));
exports.default = router;
//# sourceMappingURL=session.routes.js.map