
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is not configured');
}

function parseRedisUrl() {
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username
      ? decodeURIComponent(url.username)
      : undefined,
    password: url.password
      ? decodeURIComponent(url.password)
      : undefined,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    connectTimeout: 10000,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
  };
}

// For regular Redis operations
export function createRedisConnection() {
  const redis = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  redis.on('connect', () => {
    console.log('Redis: Connecting...');
  });

  redis.on('ready', () => {
    console.log('Redis: Connection established successfully!');
  });

  redis.on('error', (error) => {
    console.error('Redis connection error:', error.message);
  });

  redis.ping()
    .then((result) => {
      console.log('Redis PING response:', result);
    })
    .catch((error) => {
      console.error('Redis PING failed:', error.message);
    });

  return redis;
}

// For BullMQ queues and workers
export function redisConnection({ worker = false } = {}) {
  return {
    ...parseRedisUrl(),
    maxRetriesPerRequest: worker ? null : 2,
  };
}
