// Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('서비스 워커 등록 성공:', registration.scope);
      })
      .catch(error => {
        console.log('서비스 워커 등록 실패:', error);
      });
  });
}

// 앱 설치 프롬프트 처리
let deferredPrompt;
const installButton = document.getElementById('install-button');
const mobileInstallButton = document.getElementById('mobile-install-button');

window.addEventListener('beforeinstallprompt', (e) => {
  // 브라우저 기본 설치 프롬프트 방지
  e.preventDefault();
  // 이벤트 저장
  deferredPrompt = e;
  
  // 설치 버튼이 있으면 표시
  if (installButton) {
    installButton.style.display = 'block';
    
    installButton.addEventListener('click', () => {
      // 설치 프롬프트 표시
      deferredPrompt.prompt();
      
      // 사용자 응답 처리
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('사용자가 앱 설치를 수락했습니다.');
        } else {
          console.log('사용자가 앱 설치를 거부했습니다.');
        }
        // 프롬프트 초기화
        deferredPrompt = null;
        // 설치 버튼 숨기기
        installButton.style.display = 'none';
        if (mobileInstallButton) {
          mobileInstallButton.style.display = 'none';
        }
      });
    });
  }
  
  // 모바일 설치 버튼이 있으면 표시
  if (mobileInstallButton) {
    mobileInstallButton.style.display = 'flex';
    
    mobileInstallButton.addEventListener('click', () => {
      // 설치 프롬프트 표시
      deferredPrompt.prompt();
      
      // 사용자 응답 처리
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('사용자가 앱 설치를 수락했습니다.');
        } else {
          console.log('사용자가 앱 설치를 거부했습니다.');
        }
        // 프롬프트 초기화
        deferredPrompt = null;
        // 설치 버튼 숨기기
        if (installButton) {
          installButton.style.display = 'none';
        }
        mobileInstallButton.style.display = 'none';
      });
    });
  }
});

// 앱이 이미 설치되어 있는 경우
window.addEventListener('appinstalled', (e) => {
  console.log('앱이 설치되었습니다.');
  // 설치 버튼 숨기기
  if (installButton) {
    installButton.style.display = 'none';
  }
  if (mobileInstallButton) {
    mobileInstallButton.style.display = 'none';
  }
}); 