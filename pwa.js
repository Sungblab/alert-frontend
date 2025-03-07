// Service Worker 등록
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // 서비스 워커가 활성화되면 지속적인 알림 상태 확인
        if (registration.active) {
          checkPersistentNotificationStatus();
        }
      })
      .catch((error) => {});
  });
}

// 지속적인 알림 상태 확인 및 설정
function checkPersistentNotificationStatus() {
  const persistentNotificationEnabled =
    localStorage.getItem("persistentNotificationEnabled") === "true";

  // 알림 권한 확인
  if (Notification.permission === "granted" && persistentNotificationEnabled) {
    startPersistentNotification();
  }
}

// 지속적인 알림 시작
function startPersistentNotification() {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      action: "START_PERSISTENT_NOTIFICATION",
    });
    localStorage.setItem("persistentNotificationEnabled", "true");
    updatePersistentNotificationUI(true);
  }
}

// 지속적인 알림 중지
function stopPersistentNotification() {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      action: "STOP_PERSISTENT_NOTIFICATION",
    });
    localStorage.setItem("persistentNotificationEnabled", "false");
    updatePersistentNotificationUI(false);
  }
}

// 지속적인 알림 업데이트
function updatePersistentNotification() {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      action: "UPDATE_PERSISTENT_NOTIFICATION",
    });
  }
}

// 지속적인 알림 UI 업데이트
function updatePersistentNotificationUI(isEnabled) {
  const persistentToggle = document.getElementById(
    "persistent-notification-toggle"
  );
  if (persistentToggle) {
    persistentToggle.checked = isEnabled;
  }

  const persistentStatus = document.getElementById(
    "persistent-notification-status"
  );
  if (persistentStatus) {
    persistentStatus.textContent = isEnabled ? "활성화됨" : "비활성화됨";
    persistentStatus.className = isEnabled ? "text-green-600" : "text-gray-600";
  }
}

// 앱 설치 프롬프트 처리
let deferredPrompt;
const installButton = document.getElementById("install-button");
const mobileInstallButton = document.getElementById("mobile-install-button");

// PWA 설치 함수
const installPWA = () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === "accepted") {
      // 앱 설치 후 알림 권한 요청 및 지속적인 알림 활성화
      requestNotificationPermission().then((permission) => {
        if (permission === "granted") {
          startPersistentNotification();
        }
      });
    } else {
    }
    // 프롬프트 초기화
    deferredPrompt = null;
    // 설치 버튼 숨기기
    if (installButton) installButton.style.display = "none";
    if (mobileInstallButton) mobileInstallButton.style.display = "none";
  });
};

// 알림 권한 요청
async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission !== "denied") {
    return await Notification.requestPermission();
  }

  return Notification.permission;
}

window.addEventListener("beforeinstallprompt", (e) => {
  // 브라우저 기본 설치 프롬프트 방지
  e.preventDefault();
  // 이벤트 저장
  deferredPrompt = e;

  // 설치 버튼이 있으면 표시하고 이벤트 리스너 추가
  if (installButton) {
    installButton.style.display = "block";
    installButton.addEventListener("click", installPWA);
  }

  // 모바일 설치 버튼이 있으면 표시하고 이벤트 리스너 추가
  if (mobileInstallButton) {
    mobileInstallButton.style.display = "flex";
    mobileInstallButton.addEventListener("click", installPWA);
  }
});

// 앱이 이미 설치되어 있는 경우
window.addEventListener("appinstalled", (e) => {
  // 설치 버튼 숨기기
  if (installButton) installButton.style.display = "none";
  if (mobileInstallButton) mobileInstallButton.style.display = "none";

  // 앱 설치 후 알림 권한 요청 및 지속적인 알림 활성화
  requestNotificationPermission().then((permission) => {
    if (permission === "granted") {
      startPersistentNotification();
    }
  });
});

// 문서가 로드되면 지속적인 알림 토글 버튼 설정
document.addEventListener("DOMContentLoaded", function () {
  const persistentToggle = document.getElementById(
    "persistent-notification-toggle"
  );
  if (persistentToggle) {
    const isEnabled =
      localStorage.getItem("persistentNotificationEnabled") === "true";
    persistentToggle.checked = isEnabled;

    persistentToggle.addEventListener("change", function () {
      if (this.checked) {
        requestNotificationPermission().then((permission) => {
          if (permission === "granted") {
            startPersistentNotification();
          } else {
            this.checked = false;
            alert(
              "알림 권한이 필요합니다. 브라우저 설정에서 알림 권한을 허용해주세요."
            );
          }
        });
      } else {
        stopPersistentNotification();
      }
    });

    // UI 초기화
    updatePersistentNotificationUI(isEnabled);
  }
});
