import IORedis, { type RedisOptions } from "ioredis"
import { REDIS_URL } from "./env.js"

export const createRedisConnection = (): IORedis => {
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      return Math.min(times * 500, 5_000)
    },
  }

  const client = new IORedis(REDIS_URL, options)

  client.on("error", (err) => {
    console.error("[worker:redis] connection error:", err.message)
  })

  return client
}

export const redisConnection = createRedisConnection()
