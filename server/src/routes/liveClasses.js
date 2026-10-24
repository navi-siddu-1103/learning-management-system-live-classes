import { Router } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import {
  requireAuth,
  allowRoles
} from '../middleware/auth.js';

const router = Router();

router.post(
  '/token',
  requireAuth,
  allowRoles('student', 'instructor', 'admin'),
  async (req, res) => {
    try {
      const { roomName } = req.body;

      if (
        typeof roomName !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(roomName)
      ) {
        return res.status(400).json({
          message: 'A valid room name is required'
        });
      }

      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const serverUrl = process.env.LIVEKIT_URL;

      if (!apiKey || !apiSecret || !serverUrl) {
        return res.status(500).json({
          message: 'LiveKit environment variables are missing'
        });
      }

      const token = new AccessToken(apiKey, apiSecret, {
        identity: String(req.user.id),
        name: req.user.name
      });

      token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true
      });

      res.json({
        token: await token.toJwt(),
        serverUrl,
        roomName
      });
    } catch (error) {
      console.error('LiveKit token error:', error);

      res.status(500).json({
        message: 'Failed to generate LiveKit token'
      });
    }
  }
);

export default router;