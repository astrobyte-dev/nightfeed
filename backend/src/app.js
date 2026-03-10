import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import subredditRouter from './routes/subreddit.js';
import nsfwRouter from './routes/nsfw.js';
import instagramRouter from './routes/instagram.js';
import userRouter from './routes/user.js';
import simpcityRouter from './routes/simpcity.js';
import redditRouter from './routes/reddit.js';
import mediaRouter from './routes/media.js';
import externalRouter from './routes/external.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'subreddit-media-viewer-api' });
});

app.use('/api/subreddit', subredditRouter);
app.use('/api/user', userRouter);
app.use('/api/nsfw', nsfwRouter);
app.use('/api/instagram', instagramRouter);
app.use('/api/simpcity', simpcityRouter);
app.use('/api/reddit', redditRouter);
app.use('/api/media', mediaRouter);
app.use('/api/external', externalRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

export default app;
