import admin from "firebase-admin";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";
import * as dotenv from "dotenv";
import { SnapshotOS } from "./server/snapshotOs";

dotenv.config();

const app = initializeApp(firebaseConfig);
const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

const adminApp = (() => {
  try {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    let serviceAccount: any = null;

    if (sa && sa.startsWith("{")) {
      try {
        serviceAccount = JSON.parse(sa);
      } catch (e) {
        try {
          const fixedSa = sa.replace(/\n/g, "\\n");
          serviceAccount = JSON.parse(fixedSa);
        } catch (e2) {
          console.warn("Could not parse FIREBASE_SERVICE_ACCOUNT JSON string");
        }
      }
    } else if (sa && sa.length > 20 && !sa.startsWith("-")) {
      try {
        const decoded = Buffer.from(sa, 'base64').toString('utf8');
        if (decoded.startsWith("{")) {
          serviceAccount = JSON.parse(decoded);
        }
      } catch (e) {}
    }

    if (serviceAccount && typeof serviceAccount === 'object' && serviceAccount.project_id) {
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: firebaseConfig.projectId
      }, "admin");
    }

    try {
      return admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: firebaseConfig.projectId
      }, "admin");
    } catch (adcError) {
      return null;
    }
  } catch (error) {
    return null;
  }
})();

const adminDb = adminApp 
  ? ((firebaseConfig as any).firestoreDatabaseId ? getAdminFirestore(adminApp, (firebaseConfig as any).firestoreDatabaseId) : getAdminFirestore(adminApp))
  : null;

async function run() {
  console.log("Initializing Snapshot OS with adminDb:", !!adminDb);
  const sos = new SnapshotOS(adminDb);
  const job = {
    jobId: "debug_cli_run",
    triggerSource: "cli_debug",
    status: "queued" as const,
    queuedAt: new Date().toISOString()
  };
  try {
    console.log("Running compileSnapshotCore...");
    await (sos as any).compileSnapshotCore(job);
    console.log("Compile completed successfully.");
  } catch (e) {
    console.error("Compile failed with error:", e);
  }
  process.exit(0);
}

run();
