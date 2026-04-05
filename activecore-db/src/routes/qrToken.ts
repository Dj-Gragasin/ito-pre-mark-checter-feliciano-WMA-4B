import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.config';

const router = Router();

interface AuthRequest extends Request {
  user?: any;
}

interface QRTokenResponse {
  success: boolean;
  token?: string;
  tokenId?: number;
  expiresAt?: string;
  message?: string;
}

// Inline auth middleware for this route
const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(403).json({ 
      success: false,
      message: 'Invalid or expired token' 
    });
  }
};

/**
 * Generate QR token for attendance
 * POST /api/admin/qr-token/generate
 */
router.post('/generate', authenticateToken, async (req: AuthRequest, res: Response<QRTokenResponse>) => {
  try {
    // Validate user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - no user context'
      });
    }

    const role = String(req.user.role || '').toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const now = new Date();
    const expiresInHoursRaw = (req.body?.expiresInHours ?? 24) as any;
    const parsedHours = Number(expiresInHoursRaw);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 168) {
      return res.status(400).json({
        success: false,
        message: 'expiresInHours must be a number between 1 and 168'
      });
    }

    const expiresInHours = parsedHours;

    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

    // Generate token (human-readable prefix helps debugging; validation is DB-backed)
    const token = `ACTIVECORE_GYM_QR_${now.getTime()}_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // Deactivate any previous active tokens so only the latest QR works
    await pool.query('UPDATE qr_attendance_tokens SET is_active = FALSE WHERE is_active = TRUE');

    // Store token in DB
    const [rows] = await pool.query<any>(
      'INSERT INTO qr_attendance_tokens (token, expires_at, is_active, created_by) VALUES (?, ?, TRUE, ?) RETURNING id, token, expires_at',
      [token, expiresAt.toISOString(), req.user.id]
    );

    const created = rows?.[0];

    return res.json({
      success: true,
      token: created?.token ?? token,
      tokenId: created?.id,
      expiresAt: created?.expires_at ? new Date(created.expires_at).toISOString() : expiresAt.toISOString(),
    });

  } catch (error: any) {
    console.error('QR Token generation error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate QR token'
    });
  }
});

export default router;
