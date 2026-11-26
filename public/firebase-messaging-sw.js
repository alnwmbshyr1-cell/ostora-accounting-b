importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAvq_9pnQ1i1Uh6v5WAe0NDk6fVgf2B6aY',
  authDomain: 'mimetic-cosine-h6shk.firebaseapp.com',
  projectId: 'mimetic-cosine-h6shk',
  storageBucket: 'mimetic-cosine-h6shk.firebasestorage.app',
  messagingSenderId: '1077301894197',
  appId: '1:1077301894197:web:f0ec6118d83bb74e25a57c',
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'أسطورة المحاسبة';
  const options = {
    body: (payload.notification && payload.notification.body) || '',
    icon: '/pwa-192x192.png',
  };
  self.registration.showNotification(title, options);
});
