"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const conversation_controller_1 = require("../controllers/conversation.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)({ mergeParams: true });
const controller = new conversation_controller_1.ConversationController();
router.use(auth_middleware_1.authenticateDoctor);
router.get('/', (req, res) => controller.getConversations(req, res));
exports.default = router;
//# sourceMappingURL=conversation.routes.js.map