import IORedis from "ioredis";

let connection: IORedis | undefined;

export function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  connection ??= new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  return connection;
}
