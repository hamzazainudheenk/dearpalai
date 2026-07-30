import { Router } from 'express';
import { ConversationController } from '@controllers/conversation.controller';
import { authenticateDoctor } from '@middleware/auth.middleware';

const router = Router({ mergeParams: true });
const controller = new ConversationController();

router.use(authenticateDoctor);

router.get('/', (req, res) => controller.getConversations(req, res));

export default router;
