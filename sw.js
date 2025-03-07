const CACHE_NAME = '수행평가-알리미-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/profile.html',
  '/alerts.html',
  '/admin.html',
  '/find-password.html',
  '/manifest.json',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/favicon.ico'
  // CDN 리소스는 CORS 문제로 제외
  // 'https://cdn.tailwindcss.com',
  // 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard-dynamic-subset.css',
  // 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 서비스 워커 설치 및 캐시 파일 저장
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('캐시 열기 성공');
        // 각 URL을 개별적으로 캐싱하여 하나의 실패가 전체를 실패시키지 않도록 함
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.error(`${url} 캐싱 실패:`, err);
            })
          )
        );
      })
  );
});

// 네트워크 요청 가로채기 및 캐시된 응답 반환
self.addEventListener('fetch', event => {
  // CORS 문제가 있는 외부 리소스는 네트워크 우선 전략 사용
  const isCorsResource = event.request.url.includes('cdn.tailwindcss.com') || 
                         event.request.url.includes('cdn.jsdelivr.net') || 
                         event.request.url.includes('cdnjs.cloudflare.com');

  if (isCorsResource) {
    // 외부 CDN 리소스는 네트워크 우선, 실패 시 캐시 사용
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 일반 리소스는 캐시 우선, 없으면 네트워크 사용
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 캐시에서 찾으면 캐시된 응답 반환
        if (response) {
          return response;
        }
        
        // 캐시에 없으면 네트워크 요청
        return fetch(event.request)
          .then(response => {
            // 유효한 응답이 아니면 그냥 반환
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 응답을 복제하여 캐시에 저장
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache)
                  .catch(err => {
                    console.error('캐시 저장 중 오류 발생:', err);
                  });
              });
            
            return response;
          })
          .catch(error => {
            console.error('네트워크 요청 실패:', error);
            // 오프라인이고 HTML 요청인 경우 오프라인 페이지 제공
            if (event.request.url.includes('.html')) {
              return caches.match('/index.html');
            }
            // 그 외의 경우 오류를 그대로 전파
            throw error;
          });
      })
      .catch(error => {
        console.error('캐시 매치 실패:', error);
        // 오프라인이고 HTML 요청인 경우 오프라인 페이지 제공
        if (event.request.url.includes('.html')) {
          return caches.match('/index.html')
            .catch(err => {
              console.error('오프라인 페이지 제공 실패:', err);
              throw err;
            });
        }
        throw error;
      })
  );
});

// 이전 캐시 정리
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 푸시 알림 처리
self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: 'icons/icon-192x192.png',
    badge: 'icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
}); 