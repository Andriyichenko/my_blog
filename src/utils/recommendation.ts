// src/utils/recommendation.ts
import embeddingsCache from '../data/embeddings.json';

type EmbeddingMap = Record<string, number[]>;

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

export function getRelatedPostsWithAI(currentSlug: string, allPosts: any[], limit = 3) {
    const cache = embeddingsCache as EmbeddingMap;
    const currentVector = cache[currentSlug];

    if (!currentVector) {
        // Fallback to basic tag/category matching if no embedding
        return getRelatedPostsBasic(currentSlug, allPosts, limit);
    }

    const scores = allPosts
        .filter(post => post.id !== currentSlug && cache[post.id])
        .map(post => {
            const similarity = cosineSimilarity(currentVector, cache[post.id]);
            return { post, score: similarity };
        });

    return scores
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.post);
}

function getRelatedPostsBasic(currentSlug: string, allPosts: any[], limit: number) {
    const currentPost = allPosts.find(p => p.id === currentSlug);
    if (!currentPost) return [];

    return allPosts
        .filter(p => p.id !== currentSlug)
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
