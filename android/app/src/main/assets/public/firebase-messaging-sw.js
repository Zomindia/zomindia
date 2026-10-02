importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCzLPxWtZ2ARI2VhoEvfNVb17RSZZMx-4Y",
  authDomain: "zomindia-807ce.firebaseapp.com",
  projectId: "zomindia-807ce",
  storageBucket: "zomindia-807ce.firebasestorage.app",
  messagingSenderId: "165132689371",
  appId: "1:165132689371:web:a14bfc51c08886901ad1fe"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Zomindia Update';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new update from Zomindia.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
