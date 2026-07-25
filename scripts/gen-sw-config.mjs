import { writeFileSync } from "node:fs";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FB_MSG_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FB_APP_ID ?? "",
};

writeFileSync("public/firebase-config.js", `self.__FB_CONFIG__=${JSON.stringify(config)};\n`);
