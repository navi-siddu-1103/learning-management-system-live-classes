function parseRedisUrl(redisUrl) {
  const url = new URL(redisUrl);
  const connection = {
    host: url.hostname,
    port: Number(url.port || 6379),
  };

  if (url.username) connection.username = decodeURIComponent(url.username);
  if (url.password) connection.password = decodeURIComponent(url.password);
  if (url.protocol === 'rediss:') connection.tls = {};

  return connection;
}

export function redisConnection({ worker = false } = {}) {
  const connection = process.env.REDIS_URL
    ? parseRedisUrl(process.env.REDIS_URL)
    : {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT || 6379),
        ...(process.env.REDIS_USERNAME
          ? { username: process.env.REDIS_USERNAME }
          : {}),
        ...(process.env.REDIS_PASSWORD
          ? { password: process.env.REDIS_PASSWORD }
          : {}),
        ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
      };

  return {
    ...connection,
    connectTimeout: 10_000,
    maxRetriesPerRequest: worker ? null : 2,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
  };
}
