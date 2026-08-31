import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { CommunicationController } from '@controllers/communication.controller';
import { authenticateCommunicationUser } from '@middleware/auth.middleware';

const router = Router();
const controller = new CommunicationController();

const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', code: 'RATE_LIMITED', message: 'Too many messages sent. Please slow down.' },
});

// Protect all communication endpoints with unified multi-role authentication
router.use(authenticateCommunicationUser);

/** GET /api/communications/threads — List authorized conversation threads */
router.get('/threads', (req, res) => controller.getThreads(req, res));

/** POST /api/communications/threads — Create or get an existing thread */
router.post('/threads', (req, res) => controller.createThread(req, res));

/** GET /api/communications/threads/:threadId — Get single thread metadata */
router.get('/threads/:threadId', (req, res) => controller.getThreadById(req, res));

/** GET /api/communications/threads/:threadId/messages — Get message history */
router.get('/threads/:threadId/messages', (req, res) => controller.getThreadMessages(req, res));

/** POST /api/communications/threads/:threadId/messages — Send direct message */
router.post('/threads/:threadId/messages', messageRateLimiter, (req, res) => controller.sendMessage(req, res));

/** POST /api/communications/threads/:threadId/read — Mark thread read */
router.post('/threads/:threadId/read', (req, res) => controller.markThreadRead(req, res));

export default router;
