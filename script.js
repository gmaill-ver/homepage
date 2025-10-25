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
let calendarView = 'week';
let isLoggingIn = false; // ログイン処理中フラグ
let chatHistory = []; // チャット履歴（メモリ内）
let lastVisibleMessage = null; // ページネーション用
let isLoadingMoreMessages = false; // 追加読み込み中フラグ
const MESSAGES_PER_PAGE = 20; // 1ページあたりのメッセージ数

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
    // 既にログイン処理中の場合は何もしない
    if (isLoggingIn) {
        console.log('ログイン処理中です');
        return;
    }

    isLoggingIn = true;

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);

        // メールアドレスチェック
        const allowedEmails = await getAllowedEmails();

        if (allowedEmails.length > 0 && !allowedEmails.includes(result.user.email)) {
            alert('このメールアドレスはアクセスが許可されていません。');
            await auth.signOut();
            isLoggingIn = false;
            return;
        }

        currentUser = result.user;
        showMainApp();
    } catch (error) {
        console.error('ログインエラー:', error);
        // キャンセルされた場合は通知しない
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
            alert('ログインに失敗しました: ' + error.message);
        }
    } finally {
        isLoggingIn = false;
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

            // 複数のカレンダーIDに対応（旧形式との互換性も保持）
            const calendarIds = data.calendarIds || (data.calendarId ? [data.calendarId] : ['primary']);
            document.getElementById('calendarId1').value = calendarIds[0] || 'primary';
            document.getElementById('calendarId2').value = calendarIds[1] || '';
            document.getElementById('calendarId3').value = calendarIds[2] || '';
            document.getElementById('calendarId4').value = calendarIds[3] || '';

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
            calendarIds: [
                document.getElementById('calendarId1').value,
                document.getElementById('calendarId2').value,
                document.getElementById('calendarId3').value,
                document.getElementById('calendarId4').value
            ].filter(id => id.trim() !== '') // 空白を除外
        };

        // Firestoreから現在の許可メールアドレスを取得
        const doc = await db.collection('settings').doc('config').get();
        const allowedEmails = doc.exists ? (doc.data().allowedEmails || []) : [];

        await db.collection('settings').doc('config').set({
            allowedEmails: allowedEmails,
            calendarApiKey: calendarConfig.calendarApiKey,
            calendarIds: calendarConfig.calendarIds
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

    // ホームページを表示
    switchPage('home');

    renderWeather();
    renderPhotos();
    renderCalendar();
    renderNotices();
    renderContacts();
    renderInsurances();
    initializeMonthlyExpenses();
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
// 天気機能 (WeatherAPI.com)
// ==========================================

// 天気情報APIキー
const WEATHER_API_KEY = '2edf15f522d541879f2223518252410';

// 天気情報を取得して表示
async function renderWeather() {
    const weatherInfo = document.getElementById('weatherInfo');

    try {
        // 高崎の天気を取得（3日間予報）
        const url = `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=Takasaki&days=3&aqi=no&lang=ja`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('天気情報の取得に失敗しました');

        const data = await response.json();

        // 現在の天気
        const current = data.current;
        const location = data.location;

        // 3日間の予報
        const forecast = data.forecast.forecastday;

        weatherInfo.innerHTML = `
            <!-- 現在の天気 -->
            <div class="weather-current">
                <div class="weather-main">
                    <img src="https:${current.condition.icon}" alt="${current.condition.text}" class="weather-icon">
                    <div class="weather-temp">${Math.round(current.temp_c)}°C</div>
                </div>
                <div class="weather-details">
                    <div class="weather-condition">${current.condition.text}</div>
                    <div class="weather-location">${location.name}</div>
                    <div style="font-size: 0.75rem; color: #9CA3AF;">
                        湿度: ${current.humidity}% | 風: ${current.wind_kph}km/h
                    </div>
                </div>
            </div>

            <!-- 3日間予報 -->
            <div class="weather-forecast">
                ${forecast.map((day, index) => {
                    const date = new Date(day.date);
                    const dayName = index === 0 ? '今日' : index === 1 ? '明日' : `${date.getMonth() + 1}/${date.getDate()}`;

                    return `
                        <div class="forecast-day">
                            <div class="forecast-date">${dayName}</div>
                            <img src="https:${day.day.condition.icon}" alt="${day.day.condition.text}" class="forecast-icon">
                            <div class="forecast-temp">${Math.round(day.day.avgtemp_c)}°C</div>
                            <div class="forecast-temp-range">
                                ${Math.round(day.day.mintemp_c)}° / ${Math.round(day.day.maxtemp_c)}°
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (error) {
        console.error('天気情報取得エラー:', error);
        weatherInfo.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🌤️</div>
                <p>天気情報の取得に失敗しました</p>
            </div>
        `;
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

        // カレンダーごとの色設定
        const calendarColors = ['#FB923C', '#60A5FA', '#34D399', '#F472B6'];

        eventsDiv.innerHTML = events.map(event => {
            const startDate = new Date(event.start.dateTime || event.start.date);
            const endDate = new Date(event.end.dateTime || event.end.date);
            const dateStr = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
            const timeStr = event.start.dateTime
                ? `${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')} - ${endDate.getHours()}:${String(endDate.getMinutes()).padStart(2, '0')}`
                : '終日';

            // カレンダーインデックスに応じた色を取得
            const colorIndex = event.calendarIndex || 0;
            const borderColor = calendarColors[colorIndex % calendarColors.length];

            return `
                <div class="event-item" style="border-left: 4px solid ${borderColor};">
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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 今日の00:00:00
    let timeMin, timeMax;

    // 常に今日以降のイベントのみ取得
    timeMin = today.toISOString();

    if (calendarView === 'week') {
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + 7);
        timeMax = new Date(weekEnd.setHours(23, 59, 59, 999)).toISOString();
    } else if (calendarView === 'month') {
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        timeMax = new Date(monthEnd.setHours(23, 59, 59, 999)).toISOString();
    } else if (calendarView === 'nextMonth') {
        const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        timeMax = new Date(nextMonthEnd.setHours(23, 59, 59, 999)).toISOString();
    }

    // 複数カレンダーIDに対応
    const calendarIds = config.calendarIds || [config.calendarId || 'primary'];
    let allEvents = [];

    // 各カレンダーからイベントを取得
    for (let i = 0; i < calendarIds.length; i++) {
        const calendarId = calendarIds[i];
        try {
            const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${config.calendarApiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`カレンダー ${calendarId} の取得に失敗`);
                continue;
            }

            const data = await response.json();
            // カレンダーインデックスを各イベントに追加
            const eventsWithCalendarIndex = (data.items || []).map(event => ({
                ...event,
                calendarIndex: i
            }));
            allEvents = allEvents.concat(eventsWithCalendarIndex);
        } catch (error) {
            console.error(`カレンダー ${calendarId} エラー:`, error);
        }
    }

    // 開始時刻でソート（今日の予定が最上部に来る）
    allEvents.sort((a, b) => {
        const startA = new Date(a.start.dateTime || a.start.date);
        const startB = new Date(b.start.dateTime || b.start.date);
        return startA - startB;
    });

    return allEvents;
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

// 連絡先編集モーダルを開く
async function openContactEditModal() {
    try {
        const snapshot = await db.collection('contacts').get();

        const contacts = [];
        snapshot.forEach(doc => {
            contacts.push({ id: doc.id, ...doc.data() });
        });

        const contactEditList = document.getElementById('contactEditList');

        if (contacts.length === 0) {
            contactEditList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #9CA3AF;">
                    連絡先がありません
                </div>
            `;
        } else {
            contactEditList.innerHTML = contacts.map(contact => `
                <div class="contact-edit-item" id="edit-${contact.id}">
                    <div class="contact-edit-header">
                        <div class="contact-edit-info">
                            <div class="contact-edit-name">${contact.name}</div>
                            <div class="contact-edit-phone">📞 ${contact.phone}</div>
                        </div>
                        <div class="contact-edit-actions">
                            <button class="contact-edit-btn" onclick="editContactInline('${contact.id}')">編集</button>
                            <button class="contact-delete-btn" onclick="deleteContactFromEdit('${contact.id}')">削除</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        openModal('contactEditModal');
    } catch (error) {
        console.error('連絡先編集モーダル表示エラー:', error);
        alert('連絡先の読み込みに失敗しました');
    }
}

// 連絡先をインライン編集
async function editContactInline(id) {
    try {
        const doc = await db.collection('contacts').doc(id).get();
        if (!doc.exists) return;

        const contact = doc.data();
        const editItem = document.getElementById(`edit-${id}`);

        editItem.innerHTML = `
            <div class="contact-edit-header">
                <div class="contact-edit-info" style="width: 100%;">
                    <input type="text" id="editName-${id}" value="${contact.name}"
                           style="width: 100%; padding: 0.5rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; margin-bottom: 0.5rem;">
                    <input type="tel" id="editPhone-${id}" value="${contact.phone}"
                           style="width: 100%; padding: 0.5rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; margin-bottom: 0.5rem;">
                </div>
            </div>
            <div class="contact-edit-actions" style="justify-content: flex-end;">
                <button class="contact-edit-btn" onclick="saveContactEdit('${id}')">保存</button>
                <button class="btn-secondary" style="padding: 0.25rem 0.625rem; font-size: 0.75rem;" onclick="openContactEditModal()">キャンセル</button>
            </div>
        `;
    } catch (error) {
        console.error('連絡先編集エラー:', error);
        alert('連絡先の読み込みに失敗しました');
    }
}

// 連絡先編集を保存
async function saveContactEdit(id) {
    const name = document.getElementById(`editName-${id}`).value;
    const phone = document.getElementById(`editPhone-${id}`).value;

    if (!name || !phone) {
        alert('名前と電話番号を入力してください');
        return;
    }

    try {
        await db.collection('contacts').doc(id).update({
            name: name,
            phone: phone
        });

        openContactEditModal(); // リストを再表示
        renderContacts(); // メインの連絡先リストも更新
    } catch (error) {
        console.error('連絡先更新エラー:', error);
        alert('連絡先の更新に失敗しました');
    }
}

// 連絡先を編集モーダルから削除
async function deleteContactFromEdit(id) {
    if (!confirm('この連絡先を削除しますか？')) return;

    try {
        await db.collection('contacts').doc(id).delete();
        openContactEditModal(); // リストを再表示
        renderContacts(); // メインの連絡先リストも更新
    } catch (error) {
        console.error('連絡先削除エラー:', error);
        alert('連絡先の削除に失敗しました');
    }
}

// ==========================================
// カード折りたたみ機能
// ==========================================
function toggleCard(cardId) {
    const card = document.getElementById(cardId);
    const content = card.querySelector('.card-content');
    const toggle = card.querySelector('.card-toggle');

    content.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed');
}

// ==========================================
// ページ切り替え機能
// ==========================================
function switchPage(pageName) {
    // すべてのページを非表示
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    // 選択されたページを表示
    const selectedPage = document.getElementById(`${pageName}Page`);
    if (selectedPage) {
        selectedPage.classList.add('active');
        selectedPage.style.display = 'block';
    }

    // チャットページに切り替えた時は履歴をロード
    if (pageName === 'chat' && currentUser) {
        loadChatHistory();
    }

    // タブのアクティブ状態を更新
    document.querySelectorAll('.header-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeTab = document.querySelector(`[data-page="${pageName}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
}

// ==========================================
// Claude チャット機能
// ==========================================

// チャットメッセージを表示
function addChatMessage(role, content) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;

    const avatar = role === 'user' ? '👤' : '🤖';

    messageDiv.innerHTML = `
        <div class="chat-avatar">${avatar}</div>
        <div class="chat-bubble">${formatChatMessage(content)}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// メッセージのフォーマット（改行やコードブロックを処理）
function formatChatMessage(text) {
    // 改行を<br>に変換
    let formatted = text.replace(/\n/g, '<br>');

    // コードブロックを検出して整形
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });

    return formatted;
}

// ローディング表示
function showChatLoading() {
    const chatMessages = document.getElementById('chatMessages');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message assistant';
    loadingDiv.id = 'chatLoading';
    loadingDiv.innerHTML = `
        <div class="chat-avatar">🤖</div>
        <div class="chat-bubble">
            <div class="chat-loading">
                <div class="chat-loading-dot"></div>
                <div class="chat-loading-dot"></div>
                <div class="chat-loading-dot"></div>
            </div>
        </div>
    `;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ローディング削除
function hideChatLoading() {
    const loading = document.getElementById('chatLoading');
    if (loading) {
        loading.remove();
    }
}

// Firestoreからチャット履歴を読み込む（ページネーション対応）
async function loadChatHistory(loadMore = false) {
    if (!currentUser) return;

    if (isLoadingMoreMessages) return;
    isLoadingMoreMessages = true;

    try {
        let query = db.collection('chatrooms')
            .doc(currentUser.uid)
            .collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(MESSAGES_PER_PAGE);

        // 追加読み込みの場合は、前回の最後のドキュメントから開始
        if (loadMore && lastVisibleMessage) {
            query = query.startAfter(lastVisibleMessage);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            isLoadingMoreMessages = false;
            return;
        }

        // 最後のドキュメントを保存（次のページネーション用）
        lastVisibleMessage = snapshot.docs[snapshot.docs.length - 1];

        // メッセージを古い順に並び替えて表示
        const messages = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            messages.push(data);

            // チャット履歴配列にも追加
            if (data.role === 'user' || data.role === 'assistant') {
                chatHistory.push({
                    role: data.role,
                    content: data.content
                });
            }
        });

        // 古い順に表示
        messages.reverse().forEach(msg => {
            addChatMessage(msg.role, msg.content);
        });

        isLoadingMoreMessages = false;
    } catch (error) {
        console.error('Error loading chat history:', error);
        isLoadingMoreMessages = false;
    }
}

// 「さらに読み込む」ボタンをチャットエリアの上部に追加
function addLoadMoreButton() {
    const chatMessages = document.getElementById('chatMessages');

    // 既存のボタンがあれば削除
    const existingButton = document.getElementById('loadMoreBtn');
    if (existingButton) {
        existingButton.remove();
    }

    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.id = 'loadMoreBtn';
    loadMoreBtn.className = 'load-more-btn';
    loadMoreBtn.textContent = '過去のメッセージを読み込む';
    loadMoreBtn.onclick = () => loadChatHistory(true);

    chatMessages.insertBefore(loadMoreBtn, chatMessages.firstChild);
}

// Claude APIにメッセージを送信
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');
    const message = input.value.trim();

    if (!message) return;

    // ユーザーメッセージを表示
    addChatMessage('user', message);
    input.value = '';

    // 送信ボタンを無効化
    sendBtn.disabled = true;

    // 会話履歴に追加
    chatHistory.push({
        role: 'user',
        content: message
    });

    try {
        // ローディング表示
        showChatLoading();

        // 現在のユーザーを取得
        const user = auth.currentUser;
        console.log('Current user:', user ? user.uid : 'not logged in');

        // Firebase Functions経由でClaude APIを呼び出し
        const response = await fetch('https://chatwithclaude-ydgcevv45q-uc.a.run.app', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: chatHistory,
                userId: user ? user.uid : null
            })
        });

        hideChatLoading();

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const assistantMessage = data.content[0].text;

        // アシスタントメッセージを表示
        addChatMessage('assistant', assistantMessage);

        // 会話履歴に追加
        chatHistory.push({
            role: 'assistant',
            content: assistantMessage
        });

    } catch (error) {
        hideChatLoading();
        console.error('Claude API エラー:', error);
        addChatMessage('assistant', '申し訳ございません。エラーが発生しました。もう一度お試しください。');
    } finally {
        sendBtn.disabled = false;
    }
}

// Enterキーで送信（Shift+Enterで改行）
function handleChatKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

// ==========================================
// 保険情報機能 (Firestore)
// ==========================================

// 保険情報を表示
async function renderInsurances() {
    const insuranceList = document.getElementById('insuranceList');

    try {
        const snapshot = await db.collection('insurances').get();

        const insurances = [];
        snapshot.forEach(doc => {
            insurances.push({ id: doc.id, ...doc.data() });
        });

        if (insurances.length === 0) {
            insuranceList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏥</div>
                    <p>保険情報を追加してください</p>
                </div>
            `;
            return;
        }

        insuranceList.innerHTML = insurances.map(insurance => `
            <div class="insurance-item">
                <div class="insurance-header">
                    <div class="insurance-name">${insurance.name}</div>
                    <span class="insurance-status ${insurance.status}">${insurance.status === 'active' ? '加入中' : '解約済み'}</span>
                </div>
                <div class="insurance-info">📋 ${insurance.company}</div>
                ${insurance.number ? `<div class="insurance-info">🔢 ${insurance.number}</div>` : ''}
                ${insurance.premium ? `<div class="insurance-info">💰 月額 ${Number(insurance.premium).toLocaleString()}円</div>` : ''}
                ${insurance.notes ? `<div class="insurance-info" style="margin-top: 0.5rem;">📝 ${insurance.notes}</div>` : ''}
                <div class="insurance-actions">
                    <button class="insurance-edit" onclick="editInsurance('${insurance.id}')">編集</button>
                    <button class="insurance-delete" onclick="deleteInsurance('${insurance.id}')">削除</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('保険情報読み込みエラー:', error);
        insuranceList.innerHTML = `
            <div class="empty-state">
                <p>保険情報の読み込みに失敗しました</p>
            </div>
        `;
    }
}

// 保険を追加/編集
async function saveInsurance() {
    const id = document.getElementById('insuranceId').value;
    const name = document.getElementById('insuranceName').value;
    const company = document.getElementById('insuranceCompany').value;
    const number = document.getElementById('insuranceNumber').value;
    const premium = document.getElementById('insurancePremium').value;
    const status = document.getElementById('insuranceStatus').value;
    const notes = document.getElementById('insuranceNotes').value;

    if (!name || !company) {
        alert('保険名と保険会社を入力してください');
        return;
    }

    try {
        const data = {
            name,
            company,
            number,
            premium: premium ? Number(premium) : null,
            status,
            notes
        };

        if (id) {
            // 編集
            await db.collection('insurances').doc(id).update(data);
        } else {
            // 新規追加
            await db.collection('insurances').add(data);
        }

        // フォームをリセット
        document.getElementById('insuranceId').value = '';
        document.getElementById('insuranceName').value = '';
        document.getElementById('insuranceCompany').value = '';
        document.getElementById('insuranceNumber').value = '';
        document.getElementById('insurancePremium').value = '';
        document.getElementById('insuranceStatus').value = 'active';
        document.getElementById('insuranceNotes').value = '';

        closeModal('insuranceModal');
        renderInsurances();
    } catch (error) {
        console.error('保険情報保存エラー:', error);
        alert('保険情報の保存に失敗しました');
    }
}

// 保険を編集
async function editInsurance(id) {
    try {
        const doc = await db.collection('insurances').doc(id).get();
        if (!doc.exists) return;

        const insurance = doc.data();

        document.getElementById('insuranceModalTitle').textContent = '保険を編集';
        document.getElementById('insuranceId').value = id;
        document.getElementById('insuranceName').value = insurance.name || '';
        document.getElementById('insuranceCompany').value = insurance.company || '';
        document.getElementById('insuranceNumber').value = insurance.number || '';
        document.getElementById('insurancePremium').value = insurance.premium || '';
        document.getElementById('insuranceStatus').value = insurance.status || 'active';
        document.getElementById('insuranceNotes').value = insurance.notes || '';

        openModal('insuranceModal');
    } catch (error) {
        console.error('保険情報読み込みエラー:', error);
        alert('保険情報の読み込みに失敗しました');
    }
}

// 保険を削除
async function deleteInsurance(id) {
    if (!confirm('この保険情報を削除しますか？')) return;

    try {
        await db.collection('insurances').doc(id).delete();
        renderInsurances();
    } catch (error) {
        console.error('保険情報削除エラー:', error);
        alert('保険情報の削除に失敗しました');
    }
}

// ==========================================
// 月次費用管理機能
// ==========================================

let expenseItems = []; // 費用項目リスト
let currentExpenseYear = new Date().getFullYear();
let currentExpenseMonth = new Date().getMonth();
let expenseChart = null;

// 費用項目を読み込み
async function loadExpenseItems() {
    try {
        const doc = await db.collection('settings').doc('expenseItems').get();
        if (doc.exists) {
            expenseItems = doc.data().items || [];
        } else {
            // デフォルト項目
            expenseItems = ['電気代', 'ガス代', '住宅ローン', '管理費'];
            await db.collection('settings').doc('expenseItems').set({ items: expenseItems });
        }
    } catch (error) {
        console.error('費用項目読み込みエラー:', error);
        expenseItems = ['電気代', 'ガス代', '住宅ローン', '管理費'];
    }
}

// 費用項目リストを表示（モーダル内）
function renderExpenseItemsList() {
    const list = document.getElementById('expenseItemsList');
    list.innerHTML = expenseItems.map((item, index) => `
        <div class="email-item">
            <span>${item}</span>
            <button class="email-remove" onclick="removeExpenseItem(${index})">✕</button>
        </div>
    `).join('');
}

// 費用項目を追加
async function addExpenseItem() {
    const input = document.getElementById('expenseItemName');
    const name = input.value.trim();

    if (!name) {
        alert('項目名を入力してください');
        return;
    }

    if (expenseItems.includes(name)) {
        alert('この項目は既に存在します');
        return;
    }

    expenseItems.push(name);

    try {
        await db.collection('settings').doc('expenseItems').set({ items: expenseItems });
        input.value = '';
        renderExpenseItemsList();
        renderExpenseInputs();
    } catch (error) {
        console.error('費用項目追加エラー:', error);
        alert('費用項目の追加に失敗しました');
    }
}

// 費用項目を削除
async function removeExpenseItem(index) {
    if (!confirm('この項目を削除しますか？')) return;

    expenseItems.splice(index, 1);

    try {
        await db.collection('settings').doc('expenseItems').set({ items: expenseItems });
        renderExpenseItemsList();
        renderExpenseInputs();
    } catch (error) {
        console.error('費用項目削除エラー:', error);
        alert('費用項目の削除に失敗しました');
    }
}

// 費用入力フォームを表示
function renderExpenseInputs() {
    const container = document.getElementById('expenseInputs');
    const yearMonth = `${currentExpenseYear}-${String(currentExpenseMonth + 1).padStart(2, '0')}`;

    container.innerHTML = expenseItems.map((item, index) => `
        <div class="expense-item">
            <label>${item}</label>
            <input type="number" id="expense_${index}" placeholder="0" min="0" data-item="${item}">
        </div>
    `).join('');

    // イベントリスナーを追加
    expenseItems.forEach((item, index) => {
        document.getElementById(`expense_${index}`).addEventListener('input', calculateExpenseTotal);
    });

    // 保存済みデータを読み込み
    loadExpenseData(yearMonth);
}

// 指定月の費用データを読み込み
async function loadExpenseData(yearMonth) {
    try {
        const doc = await db.collection('monthlyExpenses').doc(yearMonth).get();

        if (doc.exists) {
            const data = doc.data();
            expenseItems.forEach((item, index) => {
                const input = document.getElementById(`expense_${index}`);
                if (input) {
                    input.value = data[item] || '';
                }
            });
        } else {
            // データがない場合は空にする
            expenseItems.forEach((item, index) => {
                const input = document.getElementById(`expense_${index}`);
                if (input) {
                    input.value = '';
                }
            });
        }

        calculateExpenseTotal();
    } catch (error) {
        console.error('費用データ読み込みエラー:', error);
    }
}

// 合計を計算
function calculateExpenseTotal() {
    let total = 0;
    expenseItems.forEach((item, index) => {
        const input = document.getElementById(`expense_${index}`);
        if (input) {
            total += Number(input.value) || 0;
        }
    });
    document.getElementById('totalExpenses').textContent = total.toLocaleString() + ' 円';
}

// 月次費用を保存
async function saveMonthlyExpenses() {
    const yearMonth = `${currentExpenseYear}-${String(currentExpenseMonth + 1).padStart(2, '0')}`;
    const data = {};

    expenseItems.forEach((item, index) => {
        const input = document.getElementById(`expense_${index}`);
        if (input) {
            data[item] = Number(input.value) || 0;
        }
    });

    try {
        await db.collection('monthlyExpenses').doc(yearMonth).set(data);
        alert(`${currentExpenseYear}年${currentExpenseMonth + 1}月の費用を保存しました`);
        renderExpenseChart();
    } catch (error) {
        console.error('月次費用保存エラー:', error);
        alert('月次費用の保存に失敗しました');
    }
}

// 年月表示を更新
function updateExpenseMonthDisplay() {
    document.getElementById('currentExpenseMonth').textContent =
        `${currentExpenseYear}年 ${currentExpenseMonth + 1}月`;
}

// 前月へ
function previousExpenseMonth() {
    currentExpenseMonth--;
    if (currentExpenseMonth < 0) {
        currentExpenseMonth = 11;
        currentExpenseYear--;
    }
    updateExpenseMonthDisplay();
    renderExpenseInputs();
}

// 次月へ
function nextExpenseMonth() {
    currentExpenseMonth++;
    if (currentExpenseMonth > 11) {
        currentExpenseMonth = 0;
        currentExpenseYear++;
    }
    updateExpenseMonthDisplay();
    renderExpenseInputs();
}

// 折れ線グラフを表示
async function renderExpenseChart() {
    try {
        // 過去6ヶ月のデータを取得
        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }

        const itemAverages = {}; // 各項目の平均金額
        const colors = ['#FB923C', '#60A5FA', '#34D399', '#F472B6', '#FBBF24', '#A78BFA', '#F87171', '#4ADE80'];

        // 各項目のデータと平均を計算
        const itemData = {};
        for (let i = 0; i < expenseItems.length; i++) {
            const item = expenseItems[i];
            const data = [];

            for (const month of months) {
                const doc = await db.collection('monthlyExpenses').doc(month).get();
                if (doc.exists) {
                    data.push(doc.data()[item] || 0);
                } else {
                    data.push(0);
                }
            }

            itemData[item] = data;
            // 平均を計算（0を除く）
            const nonZeroData = data.filter(v => v > 0);
            itemAverages[item] = nonZeroData.length > 0
                ? nonZeroData.reduce((a, b) => a + b, 0) / nonZeroData.length
                : 0;
        }

        // 全項目の平均の中央値を閾値として計算
        const allAverages = Object.values(itemAverages).filter(v => v > 0).sort((a, b) => a - b);
        const threshold = allAverages.length > 0
            ? allAverages[Math.floor(allAverages.length / 2)]
            : 30000; // デフォルト3万円

        // 左軸・右軸に振り分け
        const leftAxisDatasets = [];
        const rightAxisDatasets = [];

        expenseItems.forEach((item, i) => {
            const dataset = {
                label: item,
                data: itemData[item],
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length] + '20',
                tension: 0.3
            };

            if (itemAverages[item] >= threshold) {
                dataset.yAxisID = 'y';
                leftAxisDatasets.push(dataset);
            } else {
                dataset.yAxisID = 'y1';
                rightAxisDatasets.push(dataset);
            }
        });

        const datasets = [...leftAxisDatasets, ...rightAxisDatasets];

        const ctx = document.getElementById('expenseChart');

        if (expenseChart) {
            expenseChart.destroy();
        }

        expenseChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months.map(m => {
                    const [y, mo] = m.split('-');
                    return `${y}/${mo}`;
                }),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '高額項目',
                            color: '#666'
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString() + '円';
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '少額項目',
                            color: '#666'
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString() + '円';
                            }
                        },
                        grid: {
                            drawOnChartArea: false,
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('グラフ表示エラー:', error);
    }
}

// 月次費用機能の初期化
async function initializeMonthlyExpenses() {
    await loadExpenseItems();
    updateExpenseMonthDisplay();
    renderExpenseInputs();
    renderExpenseChart();
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
    document.getElementById('editContactsBtn').addEventListener('click', openContactEditModal);
    document.getElementById('closeContactEditBtn').addEventListener('click', () => closeModal('contactEditModal'));

    // 保険
    document.getElementById('addInsuranceBtn').addEventListener('click', () => {
        document.getElementById('insuranceModalTitle').textContent = '保険を追加';
        document.getElementById('insuranceId').value = '';
        document.getElementById('insuranceName').value = '';
        document.getElementById('insuranceCompany').value = '';
        document.getElementById('insuranceNumber').value = '';
        document.getElementById('insurancePremium').value = '';
        document.getElementById('insuranceStatus').value = 'active';
        document.getElementById('insuranceNotes').value = '';
        openModal('insuranceModal');
    });
    document.getElementById('saveInsuranceBtn').addEventListener('click', saveInsurance);
    document.getElementById('closeInsuranceBtn').addEventListener('click', () => closeModal('insuranceModal'));

    // 月次費用
    document.getElementById('saveExpensesBtn').addEventListener('click', saveMonthlyExpenses);
    document.getElementById('prevExpenseMonth').addEventListener('click', previousExpenseMonth);
    document.getElementById('nextExpenseMonth').addEventListener('click', nextExpenseMonth);
    document.getElementById('manageExpenseItemsBtn').addEventListener('click', () => {
        renderExpenseItemsList();
        openModal('expenseItemsModal');
    });
    document.getElementById('addExpenseItemBtn').addEventListener('click', addExpenseItem);
    document.getElementById('closeExpenseItemsBtn').addEventListener('click', () => closeModal('expenseItemsModal'));
    document.getElementById('expenseItemName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addExpenseItem();
    });

    // ページ切り替えタブ
    document.querySelectorAll('.header-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const pageName = e.target.dataset.page;
            switchPage(pageName);
        });
    });

    // チャット機能
    document.getElementById('sendChatBtn').addEventListener('click', sendChatMessage);
    document.getElementById('chatInput').addEventListener('keypress', handleChatKeyPress);
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
