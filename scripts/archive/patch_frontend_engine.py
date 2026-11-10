import re

with open("src/services/snapshotEngine.ts", "r") as f:
    content = f.read()

manifest_old = """export interface Manifest {
  snapshotVersion: string;
  generatedAt: string;
  modules: {
    homepage: string;
    articles: string;
    knowledge: string;
    nepalhub: string;
    comments: string;
    chautari: string;
    search: string;
  };
}"""

manifest_new = """export interface Manifest {
  snapshotVersion: string;
  generatedAt: string;
  modules: Record<string, { version: string; sha256: string }>;
}"""

content = content.replace(manifest_old, manifest_new)

# Now fix the syncManifest logic
sync_old = """            const staleModules = Object.keys(remoteManifest.modules).filter(
              key => remoteManifest.modules[key as keyof typeof remoteManifest.modules] !== 
                     this.localManifest?.modules[key as keyof typeof this.localManifest.modules]
            );"""

sync_new = """            const staleModules = Object.keys(remoteManifest.modules).filter(
              key => remoteManifest.modules[key]?.sha256 !== 
                     this.localManifest?.modules[key]?.sha256
            );"""

content = content.replace(sync_old, sync_new)

with open("src/services/snapshotEngine.ts", "w") as f:
    f.write(content)

print("Frontend engine patched")
