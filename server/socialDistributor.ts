import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Twitter Client (using env vars from secrets manager)
let twitterClient: TwitterApi | null = null;

function getTwitterClient() {
  if (!process.env.X_API_KEY || !process.env.X_API_SECRET || !process.env.X_ACCESS_TOKEN || !process.env.X_ACCESS_TOKEN_SECRET) {
    return null;
  }
  
  if (!twitterClient) {
    twitterClient = new TwitterApi({
      appKey: process.env.X_API_KEY,
      appSecret: process.env.X_API_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
    });
  }
  return twitterClient;
}

export async function initSocialDistributor(adminDb: any) {
  const client = getTwitterClient();
  if (!client) {
    // No Twitter API keys configured in environment, skip listener
    return;
  }

  if (!adminDb) {
    return;
  }
  
  console.log("Initializing Social Distributor listener...");
  
  // Watch for new article additions using quota-safe server gateway
  try {
    const { serverSafeOnSnapshot } = await import('./firestoreGateway');
    serverSafeOnSnapshot(
      adminDb.collection('articles'),
      (snapshot: any) => {
        snapshot.docChanges().forEach((change: any) => {
          if (change.type === 'added') {
            const article = change.doc.data();
            if (article.status === 'published') {
              postArticleToSocial(change.doc.id, article);
            }
          }
        });
      },
      { subsystem: 'social_distributor', operationName: 'articles_social_stream' }
    );
  } catch (e: any) {
    console.warn("Social Distributor initialization skipped:", e?.message || e);
  }
}

async function postArticleToSocial(id: string, article: any) {
  const client = getTwitterClient();
  if (!client) {
    console.warn("Twitter distribution skipped: No API credentials found in environment.");
    return;
  }

  console.log(`Posting new article to X: ${id} - ${article.title}`);
  
  try {
    const appUrl = process.env.APP_URL || "https://sanatanmarga.com";
    const tweetText = `नयाँ समाचार: ${article.title}\n\nथप विवरणको लागि पढ्नुहोस्: ${appUrl}/article/${id}`;
    
    // Perform the actual tweet
    await client.v2.tweet(tweetText);
    
    console.log("Successfully tweeted article:", id);
  } catch (error: any) {
    console.error("Error posting to X:", article.title);
    if (error.code === 401) {
      console.error("X API 401 Error: Authentication failed. Please check your X API Key, Secret, Access Token, and Token Secret. Ensure your app has 'Read and Write' permissions in the X Developer Portal.");
    } else if (error.code === 403) {
      console.error("X API 403 Error: Forbidden. This usually means your app doesn't have the required permissions or your account is restricted.");
    } else {
      console.error("X API Error details:", error.data || error.message);
    }
  }
}
