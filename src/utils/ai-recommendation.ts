import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';

// Cache file path
const DATA_DIR = path.join(process.cwd(), 'src/data');
const CACHE_FILE = path.join(DATA_DIR, 'embeddings.json');

// Initialize OpenAI (Build time only)
const apiKey = import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

// Helper: Cosine Similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Helper: Load Cache
function loadCache(): Record<string, number[]> {
    if (!fs.existsSync(CACHE_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (e) {
        return {};
    }
}

// Helper: Save Cache
function saveCache(cache: Record<string, number[]>) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export async function getSmartRecommendations(currentPost: any, allPosts: any[], limit = 3) {
    if (!openai) {
        console.warn("OpenAI API Key missing. Falling back to basic tag matching.");
        return getBasicRecommendations(currentPost, allPosts, limit);
    }

    const cache = loadCache();
    let cacheUpdated = false;

    // 1. Ensure we have embeddings for ALL posts (or at least the current one and candidates)
    // In a real build, we might want to pre-generate. Here we do it lazily.
    
    // Check Current Post
    if (!cache[currentPost.id]) {
        console.log(`Generating embedding for: ${currentPost.id}`);
        const text = `${currentPost.data.title} ${currentPost.data.description} ${currentPost.data.tags?.join(' ') || ''} ${currentPost.body.substring(0, 500)}`;
        try {
            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
            });
            cache[currentPost.id] = response.data[0].embedding;
            cacheUpdated = true;
        } catch (e) {
            console.error(`Failed to generate embedding for ${currentPost.id}`, e);
        }
    }

    // Check Candidate Posts (Optional: Only check if missing? Or rely on pre-build script?)
    // For performance, we'll assume the cache is mostly populated by the script, but we can generate current if missing.
    // Generating ALL missing posts here might timeout the build if cache is empty.
    // We will only compare against posts that HAVE an embedding in cache.
    
    const currentVector = cache[currentPost.id];
    if (!currentVector) return getBasicRecommendations(currentPost, allPosts, limit);

    // 2. Calculate Similarity
    const scores = allPosts
        .filter(p => p.id !== currentPost.id && cache[p.id]) // Only compare if cached
        .map(p => ({
            post: p,
            score: cosineSimilarity(currentVector, cache[p.id])
        }));

    // Save cache if we generated new ones
    if (cacheUpdated) saveCache(cache);

    // 3. Sort & Return
    const results = scores.sort((a, b) => b.score - a.score).slice(0, limit).map(i => i.post);
    
    // Fallback if AI found nothing (e.g. empty cache for others)
    if (results.length < limit) {
        const fallback = getBasicRecommendations(currentPost, allPosts, limit - results.length, results.map(r => r.id));
        return [...results, ...fallback];
    }

    return results;
}

function getBasicRecommendations(currentPost: any, allPosts: any[], limit: number, excludeIds: string[] = []) {
    return allPosts
        .filter(p => p.id !== currentPost.id && !excludeIds.includes(p.id))
        .map(p => {
            let score = 0;
            if (p.data.subcategory === currentPost.data.subcategory) score += 3;
            if (p.data.tags && currentPost.data.tags) {
                const intersection = p.data.tags.filter((t: string) => currentPost.data.tags!.includes(t));
                score += intersection.length;
            }
            return { post: p, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.post);
}
