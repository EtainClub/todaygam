/* global firebase */
importScripts("/firebase-config.js");

const CACHE = "oneulgam-v1";
const SHELL = ["/", "/stats/", "/settings/", "/onboarding/", "/manifest.webmanifest", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((hit) => hit || caches.match("/offline.html"))),
    );
    return;
  }
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
});

if (self.__FB_CONFIG__ && self.__FB_CONFIG__.apiKey) {
  importScripts("https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js");
  firebase.initializeApp(self.__FB_CONFIG__);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const evening = data.kind === "evening";
    return self.registration.showNotification(
      evening ? "오늘의 감을 확인할 시간이에요" : "오늘 어떤 일이 일어날 것 같나요?",
      {
        body: evening ? (data.preview || "아침에 남긴 감의 결과를 확인해 주세요.") : "떠오르는 감을 남겨보세요.",
        tag: `${data.kind || "oneulgam"}-${data.date || ""}`,
        data,
        actions: evening
          ? [
              { action: "occurred", title: "일어났어요" },
              { action: "not_occurred", title: "아니에요" },
            ]
          : [],
      },
    );
  });
}

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  if (event.action === "occurred" || event.action === "not_occurred") {
    event.waitUntil(
      queueResolution({
        entryId: data.entryId,
        outcome: event.action,
        uid: data.uid,
        date: data.date,
        at: Date.now(),
      }).then(() => self.clients.openWindow("/?notification=queued")),
    );
    return;
  }
  event.waitUntil(self.clients.openWindow(data.deepLink || "/"));
});

function openQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("oneulgam-sw", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("pending")) {
        request.result.createObjectStore("pending", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function queueResolution(value) {
  const database = await openQueue();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction("pending", "readwrite");
    transaction.objectStore("pending").add(value);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}
