/**
 * Vercel Speed Insights initialization
 * 
 * Tracks web vitals and performance metrics for the website.
 * See: https://vercel.com/docs/speed-insights
 */

(async function initSpeedInsights() {
  try {
    // Dynamically import the Speed Insights module from CDN
    const { injectSpeedInsights } = await import('https://cdn.jsdelivr.net/npm/@vercel/speed-insights@2.0.0/dist/index.mjs');
    
    // Initialize Speed Insights
    // This will automatically track Core Web Vitals (LCP, FID, CLS, etc.)
    injectSpeedInsights();
  } catch (error) {
    console.error('[Speed Insights] Failed to load:', error);
  }
})();
