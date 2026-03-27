/* ============================================
   GS Executive Search — Firebase Auth & Cloud Sync
   ============================================ */

(function() {
  'use strict';

  // ── Firebase Config ──
  var firebaseConfig = {
    apiKey: "AIzaSyCmjNGQ4nkUiba3zyAYTwgS8aGChQeVJ3s",
    authDomain: "gs-executive-search.firebaseapp.com",
    projectId: "gs-executive-search",
    storageBucket: "gs-executive-search.firebasestorage.app",
    messagingSenderId: "57370246505",
    appId: "1:57370246505:web:bb6fafbca15dbf221411f8"
  };

  // ── Allowed Users (Google emails) ──
  var ALLOWED_USERS = [
    'isaac.corona@gmail.com',
    'goldie.shturman@gmail.com',
    'goldieshturman@gmail.com',
    'gshturman@gmail.com'
  ];

  // ── LocalStorage keys to sync ──
  var SYNC_KEYS = [
    'gs_contacts',
    'gs_cv_text',
    'gs_cv_meta',
    'gs_cv_builder',
    'gs_cv_pages',
    'gs_pipeline',
    'gs_linkedin_import_meta',
    'gs_job_statuses',
    'gs_search_params'
  ];

  // Shared data space — all authorized users see the same data
  var SHARED_DOC_ID = 'goldie_shturman';

  var app, auth, db, currentUser = null;
  var syncDebounceTimer = null;
  var isSyncing = false;

  // ── Initialize Firebase ──
  function initFirebase() {
    try {
      app = firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      db = firebase.firestore();

      // Listen for auth state
      auth.onAuthStateChanged(function(user) {
        if (user) {
          var email = user.email.toLowerCase();
          if (isAllowed(email)) {
            currentUser = user;
            hideLoginScreen();
            loadFromCloud();
            startSyncWatcher();
            updateSyncStatus('Signed in as ' + user.email);
          } else {
            // Not authorized
            auth.signOut();
            showLoginError('Access restricted. This app is only available to authorized users.');
          }
        } else {
          currentUser = null;
          showLoginScreen();
        }
      });
    } catch(e) {
      console.error('Firebase init error:', e);
      // If Firebase fails, let the app work with localStorage only
      hideLoginScreen();
    }
  }

  function isAllowed(email) {
    // Check exact match or if email is in allowed list
    for (var i = 0; i < ALLOWED_USERS.length; i++) {
      if (email === ALLOWED_USERS[i].toLowerCase()) return true;
    }
    return false;
  }

  // ── Login Screen ──
  function showLoginScreen() {
    var screen = document.getElementById('loginScreen');
    if (screen) screen.style.display = 'flex';
  }

  function hideLoginScreen() {
    var screen = document.getElementById('loginScreen');
    if (screen) screen.style.display = 'none';
    // Trigger re-render of charts that may have initialized while hidden
    setTimeout(function() {
      window.dispatchEvent(new Event('resize'));
    }, 300);
  }

  function showLoginError(msg) {
    var el = document.getElementById('loginError');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  // ── Google Sign-In ──
  function signInWithGoogle() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    auth.signInWithPopup(provider).catch(function(error) {
      console.error('Sign-in error:', error);
      if (error.code === 'auth/popup-blocked') {
        showLoginError('Popup blocked. Please allow popups for this site.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        // User closed the popup, do nothing
      } else {
        showLoginError('Sign-in failed: ' + error.message);
      }
    });
  }

  function signOut() {
    if (auth) {
      auth.signOut().then(function() {
        currentUser = null;
        showLoginScreen();
      });
    }
  }

  // ── Cloud Sync: Load ──
  function loadFromCloud() {
    if (!currentUser || !db) return;

    var docRef = db.collection('users').doc(SHARED_DOC_ID);
    docRef.get().then(function(doc) {
      if (doc.exists) {
        var data = doc.data();
        var loaded = 0;
        SYNC_KEYS.forEach(function(key) {
          if (data[key] !== undefined && data[key] !== null) {
            localStorage.setItem(key, data[key]);
            loaded++;
          }
        });
        updateSyncStatus('Loaded ' + loaded + ' items from cloud');
        // Reload page to reflect cloud data in all components
        if (loaded > 0 && !sessionStorage.getItem('gs_cloud_loaded')) {
          sessionStorage.setItem('gs_cloud_loaded', '1');
          window.location.reload();
        }
      } else {
        // First time — upload current localStorage to cloud
        saveToCloud();
        updateSyncStatus('First sync — uploaded local data');
      }
    }).catch(function(err) {
      console.error('Cloud load error:', err);
      updateSyncStatus('Cloud load failed — using local data');
    });
  }

  // ── Cloud Sync: Save ──
  function saveToCloud() {
    if (!currentUser || !db || isSyncing) return;
    isSyncing = true;

    var data = { lastUpdated: new Date().toISOString(), email: currentUser.email };
    SYNC_KEYS.forEach(function(key) {
      var val = localStorage.getItem(key);
      data[key] = val || null;
    });

    db.collection('users').doc(SHARED_DOC_ID).set(data, { merge: true })
      .then(function() {
        isSyncing = false;
        updateSyncStatus('Saved to cloud');
      })
      .catch(function(err) {
        isSyncing = false;
        console.error('Cloud save error:', err);
        updateSyncStatus('Cloud save failed');
      });
  }

  // Debounced save — waits 2 seconds after last change before syncing
  function debouncedSave() {
    if (!currentUser) return;
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(saveToCloud, 2000);
  }

  // ── Watch for localStorage changes ──
  function startSyncWatcher() {
    // Override localStorage.setItem to detect changes
    var originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      originalSetItem(key, value);
      if (SYNC_KEYS.indexOf(key) >= 0) {
        debouncedSave();
      }
    };

    // Also listen for storage events from other tabs
    window.addEventListener('storage', function(e) {
      if (SYNC_KEYS.indexOf(e.key) >= 0) {
        debouncedSave();
      }
    });
  }

  // ── Sync Status Indicator ──
  function updateSyncStatus(msg) {
    var el = document.getElementById('syncStatus');
    if (el) {
      el.textContent = msg;
      el.style.opacity = '1';
      setTimeout(function() { el.style.opacity = '0.6'; }, 3000);
    }
  }

  // ── Expose functions globally ──
  window.gsFirebase = {
    signIn: signInWithGoogle,
    signOut: signOut,
    saveNow: saveToCloud,
    getUser: function() { return currentUser; }
  };

  // ── Auto-init when Firebase SDK is ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebase);
  } else {
    initFirebase();
  }
})();
