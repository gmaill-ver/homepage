// ==========================================
// Firebase設定
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyC8Syu7eWzv3MyNEjToHI26YYjO7F3tAKM",
    authDomain: "homepage-1d0de.firebaseapp.com",
    projectId: "homepage-1d0de",
    storageBucket: "homepage-1d0de.firebasestorage.app",
    messagingSenderId: "463980799643",
    appId: "1:463980799643:web:c8d65d86c1f24f409d883e",
    measurementId: "G-YM3BTEE4N9"
};

// Firebase初期化
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ==========================================
// グローバル変数
// ==========================================
let currentUser = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let calendarView = 'today';

// 月の名前
const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

// ==========================================
// 画像圧縮ユーティリティ
// ==========================================

/**
 * 画像を圧縮する
 * @param {File} file - 元の画像ファイル
 * @param {number} maxWidth - 最大幅（デフォルト: 1920px）
 * @param {number} maxHeight - 最大高さ（デフォルト: 1920px）
 * @param {number} quality - JPEG品質 0-1（デフォルト: 0.8）
 * @returns {Promise<Blob>} 圧縮された画像Blob
 */
async function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                // アスペクト比を保ったままリサイズ
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }

                // Canvas で画像をリサイズ
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Blob に変換
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            console.log(`圧縮完了: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
                            resolve(blob);
                        } else {
                            reject(new Error('画像圧縮に失敗しました'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };

            img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
            img.src = e.target.result;
        };

        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
        reader.readAsDataURL(file);
    });
}

// ==========================================
// Firebase Authentication
// ==========================================

// Googleログイン
async function login() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);

        // メールアドレスチェック
        const allowedEmails = await getAllowedEmails();

        if (allowedEmails.length > 0 && !allowedEmails.includes(result.user.email)) {
            alert('このメールアドレスはアクセスが許可されていません。');
            await auth.signOut();
            return;
        }

        currentUser = result.user;
        showMainApp();
    } catch (error) {
        console.error('ログインエラー:', error);
        alert('ログインに失敗しました: ' + error.message);
    }
}

// ログアウト
async function logout() {
    if (confirm('ログアウトしますか?')) {
        try {
            await auth.signOut();
            currentUser = null;
            showLoginScreen();
        } catch (error) {
            console.error('ログアウトエラー:', error);
        }
    }
}

// 認証状態の監視
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // メールアドレスチェック
        const allowedEmails = await getAllowedEmails();

        if (allowedEmails.length > 0 && !allowedEmails.includes(user.email)) {
            await auth.signOut();
            showLoginScreen();
            return;
        }

        currentUser = user;
        showMainApp();
    } else {
        currentUser = null;
        showLoginScreen();
    }
});

// ==========================================
// 設定機能
// ==========================================

// 許可されたメールアドレスを取得
async function getAllowedEmails() {
    try {
        const doc = await db.collection('settings').doc('config').get();
        if (doc.exists) {
            return doc.data().allowedEmails || [];
        }
        return [];
    } catch (error) {
        console.error('設定取得エラー:', error);
        return [];
    }
}

// 設定を読み込む
async function loadSettings() {
    try {
        const doc = await db.collection('settings').doc('config').get();

        if (doc.exists) {
            const data = doc.data();

            document.getElementById('calendarApiKey').value = data.calendarApiKey || '';
            document.getElementById('calendarId').value = data.calendarId || 'primary';

            renderEmailList(data.allowedEmails || []);
        } else {
            renderEmailList([]);
        }
    } catch (error) {
        console.error('設定読み込みエラー:', error);
        renderEmailList([]);
    }
}

// 設定を保存
async function saveSettings() {
    try {
        const calendarConfig = {
            calendarApiKey: document.getElementById('calendarApiKey').value,
            calendarId: document.getElementById('calendarId').value
        };

        // Firestoreから現在の許可メールアドレスを取得
        const doc = await db.collection('settings').doc('config').get();
        const allowedEmails = doc.exists ? (doc.data().allowedEmails || []) : [];

        await db.collection('settings').doc('config').set({
            allowedEmails: allowedEmails,
            calendarApiKey: calendarConfig.calendarApiKey,
            calendarId: calendarConfig.calendarId
        });

        alert('設定を保存しました');
        closeModal('settingsModal');
    } catch (error) {
        console.error('設定保存エラー:', error);
        alert('設定の保存に失敗しました');
    }
}

// メールアドレスリストを表示
function renderEmailList(emails) {
    const emailList = document.getElementById('emailList');
    emailList.innerHTML = '';

    emails.forEach((email, index) => {
        const div = document.createElement('div');
        div.className = 'email-item';
        div.innerHTML = `
            <span>${email}</span>
            <button class="email-remove" onclick="removeEmail('${email}')">✕</button>
        `;
        emailList.appendChild(div);
    });
}

// メールアドレスを追加
async function addEmail() {
    const input = document.getElementById('emailInput');
    const email = input.value.trim();

    if (!email) return;

    try {
        const doc = await db.collection('settings').doc('config').get();
        const allowedEmails = doc.exists ? (doc.data().allowedEmails || []) : [];

        if (!allowedEmails.includes(email)) {
            allowedEmails.push(email);
            await db.collection('settings').doc('config').set({
                allowedEmails
            }, { merge: true });

            renderEmailList(allowedEmails);
            input.value = '';
        }
    } catch (error) {
        console.error('メールアドレス追加エラー:', error);
        alert('メールアドレスの追加に失敗しました');
    }
}

// メールアドレスを削除
async function removeEmail(email) {
    try {
        const doc = await db.collection('settings').doc('config').get();
        let allowedEmails = doc.exists ? (doc.data().allowedEmails || []) : [];

        allowedEmails = allowedEmails.filter(e => e !== email);

        await db.collection('settings').doc('config').set({
            allowedEmails
        }, { merge: true });

        renderEmailList(allowedEmails);
    } catch (error) {
        console.error('メールアドレス削除エラー:', error);
        alert('メールアドレスの削除に失敗しました');
    }
}

// ==========================================
// 画面表示制御
// ==========================================

// ログイン画面を表示
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

// メインアプリを表示
function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('userName').textContent = currentUser.displayName || currentUser.email;

    renderPhotos();
    renderCalendar();
    renderNotices();
    renderContacts();
    updateMonthDisplay();
}

// モーダルを開く
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

// モーダルを閉じる
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// ==========================================
// 写真機能 (Firebase Storage)
// ==========================================

// 月の表示を更新
function updateMonthDisplay() {
    document.getElementById('currentMonth').textContent = `${currentYear}年 ${months[currentMonth]}`;
    renderPhotos();
}

// 前の月へ
function previousMonth() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    updateMonthDisplay();
}

// 次の月へ
function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    updateMonthDisplay();
}

// 写真をアップロード
async function uploadPhotos(files) {
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    try {
        for (const file of Array.from(files)) {
            // 画像を圧縮（1920px, 品質80%）
            const compressedBlob = await compressImage(file, 1920, 1920, 0.8);

            // ファイル名を生成
            const timestamp = Date.now();
            const fileName = `photos/${monthKey}/${timestamp}_${file.name.replace(/\.[^/.]+$/, '')}.jpg`;

            // Storageにアップロード（圧縮後の画像）
            const storageRef = storage.ref(fileName);
            await storageRef.put(compressedBlob, {
                contentType: 'image/jpeg'
            });

            // ダウンロードURL取得
            const url = await storageRef.getDownloadURL();

            // Firestoreに保存
            const doc = await db.collection('photos').doc(monthKey).get();
            const items = doc.exists ? (doc.data().items || []) : [];

            items.push({
                id: timestamp,
                url: url,
                date: new Date().toISOString()
            });

            await db.collection('photos').doc(monthKey).set({ items });
        }

        renderPhotos();
    } catch (error) {
        console.error('写真アップロードエラー:', error);
        alert('写真のアップロードに失敗しました');
    }
}

// 写真を表示
async function renderPhotos() {
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const photoGrid = document.getElementById('photoGrid');

    try {
        const doc = await db.collection('photos').doc(monthKey).get();
        const currentPhotos = doc.exists ? (doc.data().items || []) : [];

        if (currentPhotos.length === 0) {
            photoGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📷</div>
                    <p>写真がありません</p>
                </div>
            `;
            return;
        }

        photoGrid.innerHTML = currentPhotos.map(photo => `
            <div class="photo-item">
                <img src="${photo.url}" alt="家族の写真">
                <button class="photo-delete" onclick="deletePhoto(${photo.id})">✕</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('写真読み込みエラー:', error);
        photoGrid.innerHTML = `
            <div class="empty-state">
                <p>写真の読み込みに失敗しました</p>
            </div>
        `;
    }
}

// 写真を削除
async function deletePhoto(photoId) {
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    try {
        const doc = await db.collection('photos').doc(monthKey).get();

        if (doc.exists) {
            let items = doc.data().items || [];
            const photo = items.find(p => p.id === photoId);

            // Storageから削除
            if (photo && photo.url) {
                try {
                    const photoRef = storage.refFromURL(photo.url);
                    await photoRef.delete();
                } catch (storageError) {
                    console.error('Storage削除エラー:', storageError);
                }
            }

            // Firestoreから削除
            items = items.filter(p => p.id !== photoId);
            await db.collection('photos').doc(monthKey).set({ items });

            renderPhotos();
        }
    } catch (error) {
        console.error('写真削除エラー:', error);
        alert('写真の削除に失敗しました');
    }
}

// ==========================================
// カレンダー機能 (Google Calendar API)
// ==========================================

// カレンダーを表示
async function renderCalendar() {
    const eventsDiv = document.getElementById('calendarEvents');

    try {
        const settingsDoc = await db.collection('settings').doc('config').get();
        const calendarConfig = settingsDoc.exists ? settingsDoc.data() : {};

        if (!calendarConfig.calendarApiKey) {
            eventsDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <p>Google Calendar未設定</p>
                    <p style="font-size: 0.75rem;">設定から連携してください</p>
                </div>
            `;
            return;
        }

        const events = await loadCalendarEvents(calendarConfig);

        if (events.length === 0) {
            eventsDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <p>予定がありません</p>
                </div>
            `;
            return;
        }

        eventsDiv.innerHTML = events.map(event => {
            const startDate = new Date(event.start.dateTime || event.start.date);
            const endDate = new Date(event.end.dateTime || event.end.date);
            const dateStr = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
            const timeStr = event.start.dateTime
                ? `${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')} - ${endDate.getHours()}:${String(endDate.getMinutes()).padStart(2, '0')}`
                : '終日';

            return `
                <div class="event-item">
                    <div class="event-date">${dateStr}</div>
                    <div class="event-info">
                        <h3>${event.summary || '(タイトルなし)'}</h3>
                        <p>${timeStr}</p>
                        ${event.location ? `<p>📍 ${event.location}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('カレンダー読み込みエラー:', error);
        eventsDiv.innerHTML = `
            <div class="empty-state">
                <p>カレンダーの読み込みに失敗しました</p>
            </div>
        `;
    }
}

// Googleカレンダーからイベントを取得
async function loadCalendarEvents(config) {
    const now = new Date();
    let timeMin, timeMax;

    if (calendarView === 'today') {
        timeMin = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        timeMax = new Date(now.setHours(23, 59, 59, 999)).toISOString();
    } else if (calendarView === 'week') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        timeMin = new Date(weekStart.setHours(0, 0, 0, 0)).toISOString();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        timeMax = new Date(weekEnd.setHours(23, 59, 59, 999)).toISOString();
    } else {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        timeMin = new Date(monthStart.setHours(0, 0, 0, 0)).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        timeMax = new Date(monthEnd.setHours(23, 59, 59, 999)).toISOString();
    }

    const calendarId = config.calendarId || 'primary';
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${config.calendarApiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('カレンダーAPI呼び出し失敗');

    const data = await response.json();
    return data.items || [];
}

// カレンダービューを変更
function changeCalendarView(view) {
    calendarView = view;

    document.querySelectorAll('.cal-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    renderCalendar();
}

// ==========================================
// お知らせ機能 (Firestore + Storage)
// ==========================================

// お知らせを表示
async function renderNotices() {
    const noticeList = document.getElementById('noticeList');

    try {
        const snapshot = await db.collection('notices')
            .orderBy('date', 'desc')
            .get();

        const notices = [];
        snapshot.forEach(doc => {
            notices.push({ id: doc.id, ...doc.data() });
        });

        if (notices.length === 0) {
            noticeList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔔</div>
                    <p>お知らせはありません</p>
                </div>
            `;
            return;
        }

        noticeList.innerHTML = notices.map(notice => `
            <div class="notice-item">
                <div class="notice-header">
                    <div class="notice-title">${notice.title}</div>
                    <button class="notice-delete" onclick="deleteNotice('${notice.id}')">✕</button>
                </div>
                <div class="notice-content">${notice.content}</div>
                <div class="notice-date">${new Date(notice.date).toLocaleDateString('ja-JP')}</div>
                ${notice.image ? `<img src="${notice.image}" alt="お知らせ画像" class="notice-image">` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('お知らせ読み込みエラー:', error);
        noticeList.innerHTML = `
            <div class="empty-state">
                <p>お知らせの読み込みに失敗しました</p>
            </div>
        `;
    }
}

// お知らせを追加
async function addNotice() {
    const title = document.getElementById('noticeTitle').value;
    const content = document.getElementById('noticeContent').value;
    const imageInput = document.getElementById('noticeImage');

    if (!title || !content) {
        alert('タイトルと内容を入力してください');
        return;
    }

    try {
        let imageUrl = null;

        // 画像がある場合はStorageにアップロード
        if (imageInput.files.length > 0) {
            const file = imageInput.files[0];

            // 画像を圧縮（1920px, 品質80%）
            const compressedBlob = await compressImage(file, 1920, 1920, 0.8);

            const timestamp = Date.now();
            const fileName = `notices/${timestamp}_${file.name.replace(/\.[^/.]+$/, '')}.jpg`;

            const storageRef = storage.ref(fileName);
            await storageRef.put(compressedBlob, {
                contentType: 'image/jpeg'
            });
            imageUrl = await storageRef.getDownloadURL();
        }

        // Firestoreに保存
        await db.collection('notices').add({
            title: title,
            content: content,
            date: new Date().toISOString(),
            image: imageUrl
        });

        // フォームをリセット
        document.getElementById('noticeTitle').value = '';
        document.getElementById('noticeContent').value = '';
        document.getElementById('noticeImage').value = '';
        document.getElementById('noticeImagePreview').innerHTML = '';

        closeModal('noticeModal');
        renderNotices();
    } catch (error) {
        console.error('お知らせ追加エラー:', error);
        alert('お知らせの追加に失敗しました');
    }
}

// お知らせを削除
async function deleteNotice(id) {
    try {
        // お知らせ情報を取得
        const doc = await db.collection('notices').doc(id).get();

        if (doc.exists) {
            const notice = doc.data();

            // 画像がある場合はStorageから削除
            if (notice.image) {
                try {
                    const imageRef = storage.refFromURL(notice.image);
                    await imageRef.delete();
                } catch (storageError) {
                    console.error('Storage削除エラー:', storageError);
                }
            }

            // Firestoreから削除
            await db.collection('notices').doc(id).delete();
            renderNotices();
        }
    } catch (error) {
        console.error('お知らせ削除エラー:', error);
        alert('お知らせの削除に失敗しました');
    }
}

// お知らせ画像プレビュー
document.addEventListener('DOMContentLoaded', function() {
    const noticeImageInput = document.getElementById('noticeImage');
    if (noticeImageInput) {
        noticeImageInput.addEventListener('change', function(e) {
            const preview = document.getElementById('noticeImagePreview');
            const file = e.target.files[0];

            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `<img src="${e.target.result}" alt="プレビュー" style="width: 100%; height: 10rem; object-fit: cover; border-radius: 0.5rem; margin-top: 0.5rem;">`;
                };
                reader.readAsDataURL(file);
            } else {
                preview.innerHTML = '';
            }
        });
    }
});

// ==========================================
// 連絡先機能 (Firestore)
// ==========================================

// 連絡先を表示
async function renderContacts() {
    const contactList = document.getElementById('contactList');

    try {
        const snapshot = await db.collection('contacts').get();

        const contacts = [];
        snapshot.forEach(doc => {
            contacts.push({ id: doc.id, ...doc.data() });
        });

        if (contacts.length === 0) {
            contactList.innerHTML = `
                <div class="contact-empty">
                    <p>連絡先を追加してください</p>
                </div>
            `;
            return;
        }

        contactList.innerHTML = contacts.map(contact => `
            <div class="contact-item">
                <button class="contact-delete" onclick="deleteContact('${contact.id}')">✕</button>
                <div class="contact-name">${contact.name}</div>
                <a href="tel:${contact.phone}" class="contact-phone">📞 ${contact.phone}</a>
            </div>
        `).join('');
    } catch (error) {
        console.error('連絡先読み込みエラー:', error);
        contactList.innerHTML = `
            <div class="contact-empty">
                <p>連絡先の読み込みに失敗しました</p>
            </div>
        `;
    }
}

// 連絡先を追加
async function addContact() {
    const name = document.getElementById('contactName').value;
    const phone = document.getElementById('contactPhone').value;

    if (!name || !phone) {
        alert('名前と電話番号を入力してください');
        return;
    }

    try {
        await db.collection('contacts').add({
            name: name,
            phone: phone
        });

        document.getElementById('contactName').value = '';
        document.getElementById('contactPhone').value = '';

        closeModal('contactModal');
        renderContacts();
    } catch (error) {
        console.error('連絡先追加エラー:', error);
        alert('連絡先の追加に失敗しました');
    }
}

// 連絡先を削除
async function deleteContact(id) {
    try {
        await db.collection('contacts').doc(id).delete();
        renderContacts();
    } catch (error) {
        console.error('連絡先削除エラー:', error);
        alert('連絡先の削除に失敗しました');
    }
}

// ==========================================
// 初期化
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    // イベントリスナー設定
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.getElementById('settingsBtn').addEventListener('click', () => {
        loadSettings();
        openModal('settingsModal');
    });

    document.getElementById('headerSettingsBtn').addEventListener('click', () => {
        loadSettings();
        openModal('settingsModal');
    });

    // 設定モーダル
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('closeSettingsBtn').addEventListener('click', () => closeModal('settingsModal'));
    document.getElementById('addEmailBtn').addEventListener('click', addEmail);
    document.getElementById('emailInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addEmail();
    });

    // 写真
    document.getElementById('photoInput').addEventListener('change', (e) => uploadPhotos(e.target.files));
    document.getElementById('prevMonth').addEventListener('click', previousMonth);
    document.getElementById('nextMonth').addEventListener('click', nextMonth);

    // カレンダー
    document.querySelectorAll('.cal-tab').forEach(tab => {
        tab.addEventListener('click', (e) => changeCalendarView(e.target.dataset.view));
    });

    // お知らせ
    document.getElementById('addNoticeBtn').addEventListener('click', () => openModal('noticeModal'));
    document.getElementById('saveNoticeBtn').addEventListener('click', addNotice);
    document.getElementById('closeNoticeBtn').addEventListener('click', () => closeModal('noticeModal'));

    // 連絡先
    document.getElementById('addContactBtn').addEventListener('click', () => openModal('contactModal'));
    document.getElementById('saveContactBtn').addEventListener('click', addContact);
    document.getElementById('closeContactBtn').addEventListener('click', () => closeModal('contactModal'));
});

/*
==========================================
セキュリティルール設定
==========================================

【Firestore セキュリティルール】
Firebase Console → Firestore Database → ルール

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 認証済みユーザーのみアクセス可能
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}

【Storage セキュリティルール】
Firebase Console → Storage → ルール

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 認証済みユーザーのみアクセス可能
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }

    // より厳密なルール（オプション）
    // 画像ファイルのみ許可、10MBまで
    match /photos/{monthKey}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    match /notices/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}

==========================================
Firebase Console での設定手順
==========================================

1. Authentication 設定
   - Firebase Console → Authentication
   - 「Sign-in method」タブ
   - 「Google」を有効化
   - 承認済みドメインに Netlify のドメインを追加

2. Firestore Database 作成
   - Firestore Database → 「データベースを作成」
   - 本番環境モードで開始
   - ロケーション: asia-northeast1 (東京)

3. Storage 設定
   - Storage → 「始める」
   - 本番環境モードで開始
   - ロケーション: asia-northeast1 (東京)

4. セキュリティルール設定
   - 上記のルールを設定

==========================================
Firestoreデータ構造
==========================================

photos (コレクション)
  └── {year-month} (例: "2025-10")
      └── items: [
            {
              id: 1729756800000,
              url: "https://firebasestorage.googleapis.com/...",
              date: "2025-10-23T12:00:00.000Z"
            }
          ]

notices (コレクション)
  └── {auto-id}
      ├── title: "運動会のお知らせ"
      ├── content: "来月運動会があります"
      ├── date: "2025-10-23T12:00:00.000Z"
      └── image: "https://firebasestorage.googleapis.com/..." (optional)

contacts (コレクション)
  └── {auto-id}
      ├── name: "○○保育園"
      └── phone: "03-1234-5678"

settings (コレクション)
  └── config
      ├── allowedEmails: ["user1@gmail.com", "user2@gmail.com"]
      ├── calendarApiKey: "AIza..."
      └── calendarId: "primary"

==========================================
*/
