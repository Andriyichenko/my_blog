// src/utils/getUserIP.ts

/**
 * 从响应头中获取用户真实IP
 * 支持多种代理环境
 */
export function getUserIPFromHeaders(headers: any): string {
    const forwardedFor = headers.get('cf-connecting-ip') || 
                        headers.get('x-forwarded-for') || 
                        headers.get('x-real-ip');
    
    if (forwardedFor) {
        // x-forwarded-for 可能包含多个IP，取第一个
        return forwardedFor.split(',')[0].trim();
    }
    
    return 'unknown';
}

/**
 * 在浏览器中获取用户IP（通过后端API）
 */
export async function fetchUserIP(): Promise<string> {
    try {
        // 方案1：使用自己的后端API
        const res = await fetch('/api/get-user-ip');
        if (res.ok) {
            const data = await res.json();
            return data.ip || 'unknown';
        }
    } catch (error) {
        console.error('Failed to fetch user IP:', error);
    }
    
    return 'unknown';
}

/**
 * 生成设备指纹（备用方案）
 * 如果无法获取IP，使用本地指纹
 */
export function generateDeviceFingerprint(): string {
    const ua = navigator.userAgent;
    const screen = `${window.screen.width}x${window.screen.height}`;
    const tz = new Date().getTimezoneOffset();
    
    const fingerprint = `${ua}|${screen}|${tz}`;
    
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    return `fp_${Math.abs(hash)}`;
}