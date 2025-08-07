import { createClient } from "redis";
import FabErr from "./faberr.js";

export const ErrConnect = new FabErr("ERR_CONNECT", null, "redis connect error");
export const ErrGet = new FabErr("ERR_GET", null, "redis get error");
export const ErrSet = new FabErr("ERR_SET", null, "redis set error");
export const ErrDel = new FabErr("ERR_DEL", null, "redis del error");

export default class RedisSvc {
  constructor(redisConfig, logger) {
    this.logger = logger;
    this.client = null;
    this.config = redisConfig;
  }

  async connect() {
    try {
      this.client = createClient({
        socket: {
          host: this.config.host,
          port: this.config.port
        }
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        this.logger.info('Redis Client Connected');
      });

      this.client.on('ready', () => {
        this.logger.info('Redis Client Ready');
      });

      await this.client.connect();
      return [true, null];
    } catch (error) {
      this.logger.error('Redis connection error:', error);
      return [null, ErrConnect.NewWData(error)];
    }
  }

  async get(key) {
    try {
      if (!this.client) {
        const [connected, error] = await this.connect();
        if (error) return [null, error];
      }

      const value = await this.client.get(key);
      return [value, null];
    } catch (error) {
      this.logger.error('Redis get error:', error);
      return [null, ErrGet.NewWData(error)];
    }
  }

  async set(key, value, ttl = null) {
    try {
      if (!this.client) {
        const [connected, error] = await this.connect();
        if (error) return [null, error];
      }

      let result;
      if (ttl) {
        result = await this.client.setEx(key, ttl, value);
      } else {
        result = await this.client.set(key, value);
      }

      return [result, null];
    } catch (error) {
      this.logger.error('Redis set error:', error);
      return [null, ErrSet.NewWData(error)];
    }
  }

  async del(key) {
    try {
      if (!this.client) {
        const [connected, error] = await this.connect();
        if (error) return [null, error];
      }

      const result = await this.client.del(key);
      return [result, null];
    } catch (error) {
      this.logger.error('Redis del error:', error);
      return [null, ErrDel.NewWData(error)];
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        this.client = null;
      }
      return [true, null];
    } catch (error) {
      this.logger.error('Redis disconnect error:', error);
      return [null, error];
    }
  }

  async health() {
    try {
      if (!this.client) {
        const [connected, error] = await this.connect();
        if (error) return [false, error];
      }

      await this.client.ping();
      return [true, null];
    } catch (error) {
      this.logger.error('Redis health check error:', error);
      return [false, error];
    }
  }
}