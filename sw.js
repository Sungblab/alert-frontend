const CACHE_NAME = "수행평가-알리미-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/login.html",
  "/register.html",
  "/profile.html",
  "/alerts.html",
  "/admin.html",
  "/find-password.html",
  "/manifest.json",
  "/icons/android-chrome-192x192.png",
  "/icons/android-chrome-512x512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-16x16.png",
  "/icons/favicon-32x32.png",
  "/icons/favicon.ico",
  // CDN 리소스는 CORS 문제로 제외
  // 'https://cdn.tailwindcss.com',
  // 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard-dynamic-subset.css',
  // 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 지속적인 알림 관련 변수
let persistentNotificationId = "persistent-deadline-notification";
let checkDeadlineInterval;

// IndexedDB 설정
const DB_NAME = "수행평가알리미DB";
const DB_VERSION = 1;
const ALERTS_STORE = "alerts";

// IndexedDB 열기
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB 열기 실패:", event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 알림 저장소 생성
      if (!db.objectStoreNames.contains(ALERTS_STORE)) {
        const store = db.createObjectStore(ALERTS_STORE, { keyPath: "_id" });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("school", "school", { unique: false });
        store.createIndex("grade", "grade", { unique: false });
        store.createIndex("class", "class", { unique: false });
      }
    };
  });
}

// 알림 데이터 가져오기
async function getAlerts() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(ALERTS_STORE, "readonly");
      const store = transaction.objectStore(ALERTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error("알림 데이터 가져오기 실패:", event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error("알림 데이터 가져오기 오류:", error);
    return [];
  }
}

// 가장 가까운 수행평가 마감일 계산 및 알림 표시 함수 수정
async function showPersistentDeadlineNotification() {
  try {
    // IndexedDB에서 알림 데이터 가져오기
    const alerts = await getAlerts();

    // 알림이 없는 경우
    if (!alerts || alerts.length === 0) {
      return;
    }

    // 가장 가까운 마감일 찾기
    const now = new Date();
    let closestAlert = null;
    let minDiffDays = Number.MAX_SAFE_INTEGER;

    alerts.forEach((alert) => {
      const alertDate = new Date(alert.date);
      alertDate.setHours(0, 0, 0, 0); // 날짜만 비교하기 위해 시간 초기화

      const diffTime = alertDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // 아직 마감되지 않은 알림 중 가장 가까운 것 선택
      if (diffDays >= 0 && diffDays < minDiffDays) {
        minDiffDays = diffDays;
        closestAlert = alert;
      }
    });

    // 가장 가까운 마감일이 있는 경우 알림 표시
    if (closestAlert) {
      const options = {
        body: `${closestAlert.title} - ${minDiffDays}일 남음`,
        icon: "/icons/android-chrome-192x192.png",
        badge: "/icons/favicon-32x32.png",
        tag: persistentNotificationId, // 같은 태그를 사용하여 기존 알림 대체
        renotify: false, // 알림이 업데이트되어도 다시 알리지 않음
        silent: true, // 소리 없음
        requireInteraction: true, // 사용자가 명시적으로 닫을 때까지 유지
        actions: [
          {
            action: "view",
            title: "자세히 보기",
          },
        ],
        data: {
          url: `/alerts.html?view=${closestAlert._id}`,
          alertId: closestAlert._id,
        },
      };

      await self.registration.showNotification(`학업 알리미`, options);
    }
  } catch (error) {
    console.error("지속적인 알림 표시 오류:", error);
  }
}

// 지속적인 알림 시작
function startPersistentNotification() {
  // 즉시 한 번 실행
  showPersistentDeadlineNotification();

  // 4시간마다 알림 업데이트 (밀리초 단위)
  const fourHours = 4 * 60 * 60 * 1000;
  checkDeadlineInterval = setInterval(
    showPersistentDeadlineNotification,
    fourHours
  );
}

// 지속적인 알림 중지
function stopPersistentNotification() {
  if (checkDeadlineInterval) {
    clearInterval(checkDeadlineInterval);
    checkDeadlineInterval = null;
  }
}

// 메시지 이벤트 리스너 수정 (알림 데이터 동기화 추가)
self.addEventListener("message", (event) => {
  const data = event.data;

  if (data.action === "START_PERSISTENT_NOTIFICATION") {
    startPersistentNotification();
  } else if (data.action === "STOP_PERSISTENT_NOTIFICATION") {
    stopPersistentNotification();
  } else if (data.action === "UPDATE_PERSISTENT_NOTIFICATION") {
    showPersistentDeadlineNotification();
  } else if (data.action === "SYNC_ALERTS") {
    // 알림 데이터 동기화
    syncAlerts(data.alerts);
  }
});

// 알림 데이터 동기화
async function syncAlerts(alerts) {
  try {
    if (!alerts || !Array.isArray(alerts)) {
      console.error("유효하지 않은 알림 데이터:", alerts);
      return;
    }

    const db = await openDB();
    const transaction = db.transaction(ALERTS_STORE, "readwrite");
    const store = transaction.objectStore(ALERTS_STORE);

    // 기존 데이터 삭제
    store.clear();

    // 새 데이터 추가
    alerts.forEach((alert) => {
      // _id가 없는 경우 임의의 ID 생성
      if (!alert._id) {
        alert._id =
          "alert_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      }
      store.add(alert);
    });

    transaction.oncomplete = () => {
      // 지속적인 알림 업데이트
      showPersistentDeadlineNotification();
    };

    transaction.onerror = (event) => {
      console.error("알림 데이터 동기화 실패:", event.target.error);
    };
  } catch (error) {
    console.error("알림 데이터 동기화 오류:", error);
  }
}

// 서비스 워커 설치 및 캐시 파일 저장
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 각 URL을 개별적으로 캐싱하여 하나의 실패가 전체를 실패시키지 않도록 함
      return Promise.allSettled(
        urlsToCache.map((url) =>
          cache.add(url).catch((err) => {
            console.error(`${url} 캐싱 실패:`, err);
          })
        )
      );
    })
  );
});

// 네트워크 요청 가로채기 및 캐시된 응답 반환
self.addEventListener("fetch", (event) => {
  // CORS 문제가 있는 외부 리소스는 네트워크 우선 전략 사용
  const isCorsResource =
    event.request.url.includes("cdn.tailwindcss.com") ||
    event.request.url.includes("cdn.jsdelivr.net") ||
    event.request.url.includes("cdnjs.cloudflare.com");

  if (isCorsResource) {
    // 외부 CDN 리소스는 네트워크 우선, 실패 시 캐시 사용
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 일반 리소스는 캐시 우선, 없으면 네트워크 사용
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        // 캐시에서 찾으면 캐시된 응답 반환
        if (response) {
          return response;
        }

        // 캐시에 없으면 네트워크 요청
        return fetch(event.request)
          .then((response) => {
            // 유효한 응답이 아니면 그냥 반환
            if (
              !response ||
              response.status !== 200 ||
              response.type !== "basic"
            ) {
              return response;
            }

            // 응답을 복제하여 캐시에 저장
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch((err) => {
                console.error("캐시 저장 중 오류 발생:", err);
              });
            });

            return response;
          })
          .catch((error) => {
            console.error("네트워크 요청 실패:", error);
            // 오프라인이고 HTML 요청인 경우 오프라인 페이지 제공
            if (event.request.url.includes(".html")) {
              return caches.match("/index.html");
            }
            // 그 외의 경우 오류를 그대로 전파
            throw error;
          });
      })
      .catch((error) => {
        console.error("캐시 매치 실패:", error);
        // 오프라인이고 HTML 요청인 경우 오프라인 페이지 제공
        if (event.request.url.includes(".html")) {
          return caches.match("/index.html").catch((err) => {
            console.error("오프라인 페이지 제공 실패:", err);
            throw err;
          });
        }
        throw error;
      })
  );
});

// 이전 캐시 정리
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 푸시 알림 처리
self.addEventListener("push", (event) => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: "icons/icon-192x192.png",
    badge: "icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 알림 클릭 처리
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  notification.close();

  // 알림 데이터 확인
  const urlToOpen = notification.data?.url || "/alerts.html";

  // 'view' 액션 클릭 처리
  if (event.action === "view") {
    event.waitUntil(clients.openWindow(urlToOpen));
    return;
  }

  // 알림 본문 클릭 처리
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // 이미 열린 창이 있는지 확인
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      // 열린 창이 없으면 새 창 열기
      return clients.openWindow(urlToOpen);
    })
  );
});
