import express from 'express';
import { fetchRedgifsGif } from '../services/redgifsClient.js';

const router = express.Router();

router.get('/redgifs/:id', async (req, res, next) => {
  try {
    const payload = await fetchRedgifsGif(req.params.id);
    res.json(payload);
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message || 'Invalid RedGIFs id' });
    }
    if (error.status === 404) {
      return res.status(404).json({ error: 'RedGIFs item not found' });
    }
    next(error);
  }
});

export default router;