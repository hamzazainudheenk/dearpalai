import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { ChatController } from '@controllers/chat.controller';
import { authenticateChatIdentity } from '@middleware/auth.middleware';
import { container } from '../container';

const router = Router();
const controller = new ChatController(container.chatBridgeService);

/** Development-safe: generous enough for normal back-and-forth
 *  conversation, tight enough to stop an accidental request loop or
 *  message-spam from burning GPT-4o/Sarvam usage. Separate from both the
 *  global app limiter and the Phase 1 OTP limiters. */
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many messages, please slow down.' },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB — a voice note, not a file upload
});

router.use(authenticateChatIdentity);

/** GET /api/chat/history — returns scoped conversation messages */
router.get('/history', controller.history);

/** POST /api/chat/message — { message, conversationScope } */
router.post('/message', chatLimiter, controller.message);

/** POST /api/chat/voice — multipart/form-data: `audio` file + conversationScope */
router.post('/voice', chatLimiter, upload.single('audio'), controller.voice);

export default router;
