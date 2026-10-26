import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();

// Every route in this router requires a logged-in admin
router.use(authenticate, authorize('admin'));

// Placeholder so role-based access can be tested now; real admin routes arrive in step 1b
router.get('/ping', (req, res) => {
  res.json({ ok: true, role: req.user.role });
});

export default router;
