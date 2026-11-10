import { seoDiscoveryOS } from "./seoDiscoveryOs";

export function injectSeoMetaDataIntoHtml(html: string, urlPath: string, sos?: any): string {
  const snapshotStore = sos?.snapshotStore || (sos && typeof sos === "object" ? sos : undefined);
  return seoDiscoveryOS.injectServerSeo(html, urlPath, snapshotStore);
}
