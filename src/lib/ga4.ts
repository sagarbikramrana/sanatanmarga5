// Initialize GA4
export const GA_MEASUREMENT_ID = process.env.VITE_GA4_MEASUREMENT_ID;

export const pageview = (url: string) => {
  if (typeof (window as any).gtag === 'function') {
    (window as any).gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};
