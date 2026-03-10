import { RateLimiter } from "limiter";
import { NextRequest } from "next/server";

// メモリベースのレート制限（本番環境ではRedis推奨）
const limiters = new Map<string, RateLimiter>();

interface RateLimitOptions {
  tokensPerInterval: number;
  interval: number | "second" | "minute" | "hour" | "day";
  fireImmediately?: boolean;
}

/**
 * IPアドレスベースのレート制限
 */
export function getRateLimiter(
  key: string,
  options: RateLimitOptions = {
    tokensPerInterval: 10,
    interval: "minute",
    fireImmediately: true,
  }
): RateLimiter {
  if (!limiters.has(key)) {
    limiters.set(key, new RateLimiter(options));
  }
  return limiters.get(key)!;
}

/**
 * APIエンドポイント用のレート制限チェック
 */
export async function checkRateLimit(
  request: NextRequest,
  endpoint: string,
  maxRequests: number = 10,
  windowMs: number | "minute" = "minute"
): Promise<{ success: boolean; remaining: number }> {
  const ip = request.headers.get("x-forwarded-for") || 
             request.headers.get("x-real-ip") || 
             "unknown";
  
  const key = `${endpoint}:${ip}`;
  const limiter = getRateLimiter(key, {
    tokensPerInterval: maxRequests,
    interval: windowMs,
    fireImmediately: true,
  });

  const remaining = await limiter.removeTokens(1);
  
  return {
    success: remaining >= 0,
    remaining: Math.max(0, remaining),
  };
}

/**
 * グローバルレート制限（全APIエンドポイント共通）
 */
export async function checkGlobalRateLimit(
  request: NextRequest,
  maxRequests: number = 100,
  windowMs: number | "minute" = "minute"
): Promise<{ success: boolean; remaining: number }> {
  const ip = request.headers.get("x-forwarded-for") || 
             request.headers.get("x-real-ip") || 
             "unknown";
  
  const key = `global:${ip}`;
  const limiter = getRateLimiter(key, {
    tokensPerInterval: maxRequests,
    interval: windowMs,
    fireImmediately: true,
  });

  const remaining = await limiter.removeTokens(1);
  
  return {
    success: remaining >= 0,
    remaining: Math.max(0, remaining),
  };
}

// 定期的なクリーンアップ（メモリリーク防止）
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1時間
  
  for (const [key, limiter] of limiters.entries()) {
    // @ts-ignore - private propertyへのアクセス
    if (now - limiter.lastRequest > maxAge) {
      limiters.delete(key);
    }
  }
}, 60 * 60 * 1000); // 1時間ごと