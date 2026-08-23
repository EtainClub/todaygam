import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

export { deleteUserData } from "./account.js";
export { generateRecoveryKey, redeemRecoveryKey } from "./recovery.js";
export { sendEvening, sendMorning, sendUnresolved } from "./notify.js";
export { onDayCreated, onEntryWritten } from "./rollup.js";
