import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { query } from '../../config/db.js';
import { toPublicUser } from '../auth/auth.service.js';
import { AppError } from '../../utils/AppError.js';

const router = Router();

router.get('/me', authenticate, async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) throw new AppError(404, 'USER_NOT_FOUND', 'User no longer exists');
  res.json({ user: toPublicUser(rows[0]) });
});

export default router;
