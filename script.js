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

        // 買い物リストを初期化（その他ページのウィジェット用）
        if (typeof initializeShoppingList === 'function') {
            initializeShoppingList();
        }
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

    // 最小限の初期化のみ実行（高速化）
    renderWeather();

    // その他は少し遅延させて読み込み（ログイン体感速度向上）
    setTimeout(() => {
        renderPhotos();
        renderCalendar();
        renderNotices();
        renderMessages();
        renderContacts();
        updateMonthDisplay();
    }, 100);
}

// モーダルを開く
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';

    // カテゴリ編集モーダルを開く時は一覧を更新
    if (modalId === 'categoryEditModal' && typeof renderCategoryEditModal === 'function') {
        renderCategoryEditModal();
    }
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
        const calendarColors = ['#60A5FA', '#3B82F6', '#34D399', '#8B5CF6'];

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

// お知らせを表示（アーカイブされていないもの）
async function renderNotices() {
    const noticeList = document.getElementById('noticeList');

    try {
        const snapshot = await db.collection('notices').get();

        const notices = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.archived) {
                notices.push({ id: doc.id, ...data });
            }
        });

        // order値でソート（orderがない場合は日付順）
        notices.sort((a, b) => {
            if (a.order !== undefined && b.order !== undefined) {
                return a.order - b.order;
            }
            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return dateB - dateA;
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

        noticeList.innerHTML = notices.map((notice, index) => `
            <div class="notice-item" draggable="true" data-id="${notice.id}" data-index="${index}">
                <div class="notice-header">
                    <div class="notice-drag-handle">☰</div>
                    <div class="notice-title">${notice.title}</div>
                    <div class="notice-actions">
                        <button class="notice-edit" onclick="editNotice('${notice.id}')">✏️</button>
                        <button class="notice-archive" onclick="archiveNotice('${notice.id}')" title="その他に移動">📁</button>
                    </div>
                </div>
                <div class="notice-content">${notice.content}</div>
                <div class="notice-date">${(notice.date?.toDate ? notice.date.toDate() : new Date(notice.date)).toLocaleDateString('ja-JP')}</div>
                ${notice.image ? `<img src="${notice.image}" alt="お知らせ画像" class="notice-image">` : ''}
            </div>
        `).join('');

        // ドラッグ&ドロップイベントを設定
        setupNoticeDragAndDrop();
    } catch (error) {
        console.error('お知らせ読み込みエラー:', error);
        noticeList.innerHTML = `
            <div class="empty-state">
                <p>お知らせの読み込みに失敗しました</p>
            </div>
        `;
    }
}

// お知らせのドラッグ&ドロップ設定
function setupNoticeDragAndDrop() {
    const noticeList = document.getElementById('noticeList');
    const items = noticeList.querySelectorAll('.notice-item');
    let draggedItem = null;
    let touchStartY = 0;
    let longPressTimer = null;

    items.forEach(item => {
        // PC向けドラッグ&ドロップ
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedItem = null;
            saveNoticeOrder();
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (draggedItem && draggedItem !== item) {
                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    item.parentNode.insertBefore(draggedItem, item);
                } else {
                    item.parentNode.insertBefore(draggedItem, item.nextSibling);
                }
            }
        });

        // スマホ向け長押しドラッグ
        item.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
            longPressTimer = setTimeout(() => {
                draggedItem = item;
                item.classList.add('dragging');
                navigator.vibrate && navigator.vibrate(50);
            }, 500);
        });

        item.addEventListener('touchmove', (e) => {
            if (!draggedItem) {
                clearTimeout(longPressTimer);
                return;
            }
            e.preventDefault();
            const touchY = e.touches[0].clientY;
            const elements = document.elementsFromPoint(e.touches[0].clientX, touchY);
            const targetItem = elements.find(el => el.classList.contains('notice-item') && el !== draggedItem);
            if (targetItem) {
                const rect = targetItem.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (touchY < midY) {
                    targetItem.parentNode.insertBefore(draggedItem, targetItem);
                } else {
                    targetItem.parentNode.insertBefore(draggedItem, targetItem.nextSibling);
                }
            }
        }, { passive: false });

        item.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
            if (draggedItem) {
                item.classList.remove('dragging');
                draggedItem = null;
                saveNoticeOrder();
            }
        });
    });
}

// お知らせの並び順を保存
async function saveNoticeOrder() {
    const noticeList = document.getElementById('noticeList');
    const items = noticeList.querySelectorAll('.notice-item');
    const batch = db.batch();

    items.forEach((item, index) => {
        const id = item.dataset.id;
        const ref = db.collection('notices').doc(id);
        batch.update(ref, { order: index });
    });

    try {
        await batch.commit();
    } catch (error) {
        console.error('並び順保存エラー:', error);
    }
}

// 過去のお知らせを表示（アーカイブされたもの）
async function renderArchivedNotices() {
    const noticeList = document.getElementById('archivedNoticeList');
    if (!noticeList) return;

    try {
        const snapshot = await db.collection('notices').get();

        const notices = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.archived) {
                notices.push({ id: doc.id, ...data });
            }
        });

        // 日付順（新しい順）でソート
        notices.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return dateB - dateA;
        });

        if (notices.length === 0) {
            noticeList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <p>過去のお知らせはありません</p>
                </div>
            `;
            return;
        }

        noticeList.innerHTML = notices.map(notice => `
            <div class="notice-item">
                <div class="notice-header">
                    <div class="notice-title">${notice.title}</div>
                    <div class="notice-actions">
                        <button class="notice-restore" onclick="restoreNotice('${notice.id}')" title="ホームに戻す">↩️</button>
                        <button class="notice-delete" onclick="deleteArchivedNotice('${notice.id}')" title="完全に削除">🗑️</button>
                    </div>
                </div>
                <div class="notice-content">${notice.content}</div>
                <div class="notice-date">${(notice.date?.toDate ? notice.date.toDate() : new Date(notice.date)).toLocaleDateString('ja-JP')}</div>
                ${notice.image ? `<img src="${notice.image}" alt="お知らせ画像" class="notice-image">` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('過去のお知らせ読み込みエラー:', error);
        noticeList.innerHTML = `
            <div class="empty-state">
                <p>読み込みに失敗しました</p>
            </div>
        `;
    }
}

// お知らせをホームに戻す
async function restoreNotice(id) {
    try {
        await db.collection('notices').doc(id).update({ archived: false });
        renderArchivedNotices();
    } catch (error) {
        console.error('お知らせ復元エラー:', error);
        alert('お知らせの復元に失敗しました');
    }
}

let editingNoticeId = null;

// お知らせを追加/更新
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

        if (editingNoticeId) {
            // 編集モード：更新
            const updateData = { title, content };
            if (imageUrl) updateData.image = imageUrl;
            await db.collection('notices').doc(editingNoticeId).update(updateData);
            editingNoticeId = null;
        } else {
            // 新規追加
            await db.collection('notices').add({
                title: title,
                content: content,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                image: imageUrl,
                archived: false
            });
        }

        // フォームをリセット
        document.getElementById('noticeTitle').value = '';
        document.getElementById('noticeContent').value = '';
        document.getElementById('noticeImage').value = '';
        document.getElementById('noticeImagePreview').innerHTML = '';
        document.querySelector('#noticeModal h3').textContent = 'お知らせを追加';
        document.getElementById('saveNoticeBtn').textContent = '追加';

        closeModal('noticeModal');
        renderNotices();
    } catch (error) {
        console.error('お知らせ保存エラー:', error);
        alert('お知らせの保存に失敗しました');
    }
}

// お知らせを編集
async function editNotice(id) {
    try {
        const doc = await db.collection('notices').doc(id).get();
        if (doc.exists) {
            const notice = doc.data();
            editingNoticeId = id;
            document.getElementById('noticeTitle').value = notice.title;
            document.getElementById('noticeContent').value = notice.content;
            document.getElementById('noticeImagePreview').innerHTML = notice.image ?
                `<img src="${notice.image}" alt="現在の画像" style="width: 100%; height: 10rem; object-fit: cover; border-radius: 0.5rem; margin-top: 0.5rem;">` : '';
            document.querySelector('#noticeModal h3').textContent = 'お知らせを編集';
            document.getElementById('saveNoticeBtn').textContent = '更新';
            openModal('noticeModal');
        }
    } catch (error) {
        console.error('お知らせ取得エラー:', error);
    }
}

// お知らせを削除
// お知らせをアーカイブ（その他に移動）
async function archiveNotice(id) {
    try {
        await db.collection('notices').doc(id).update({ archived: true });
        renderNotices();
    } catch (error) {
        console.error('お知らせアーカイブエラー:', error);
        alert('お知らせの移動に失敗しました');
    }
}

// 過去のお知らせから完全削除
async function deleteArchivedNotice(id) {
    if (!confirm('このお知らせを完全に削除しますか？')) return;

    try {
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

            await db.collection('notices').doc(id).delete();
            renderArchivedNotices();
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
// 連絡機能 (Firestore) - 掲示板形式
// ==========================================

let selectedMessageTo = 'hide'; // 宛先（hide or ayu）
let editingMessageId = null;

// 宛先選択
function selectMessageTo(to) {
    selectedMessageTo = to;
    document.querySelectorAll('.message-to-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.to === to);
    });
}

// メッセージを表示（アーカイブされていないもの）
async function renderMessages() {
    const messageList = document.getElementById('messageList');

    try {
        const snapshot = await db.collection('messages').get();

        const messages = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.archived) {
                messages.push({ id: doc.id, ...data });
            }
        });

        // 日付順（新しい順）でソート
        messages.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return dateB - dateA;
        });

        if (messages.length === 0) {
            messageList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💌</div>
                    <p>連絡はありません</p>
                </div>
            `;
            return;
        }

        messageList.innerHTML = messages.map(msg => {
            const toName = msg.to === 'ayu' ? 'あゆ' : 'ひで';
            const toClass = msg.to === 'ayu' ? 'to-ayu' : 'to-hide';
            return `
            <div class="message-item ${toClass}">
                <div class="message-header">
                    <span class="message-to-label">${msg.to === 'ayu' ? '🌸' : '🌊'} ${toName}へ</span>
                    <div class="message-actions">
                        <button class="message-edit" onclick="editMessage('${msg.id}')">✏️</button>
                        <button class="message-archive" onclick="archiveMessage('${msg.id}')" title="その他に移動">📁</button>
                    </div>
                </div>
                <div class="message-content">${msg.content}</div>
                ${msg.image ? `<div class="message-image"><img src="${msg.image}" alt="画像" onclick="window.open('${msg.image}', '_blank')" style="max-width: 100%; border-radius: 0.5rem; margin-top: 0.5rem; cursor: pointer;"></div>` : ''}
                <div class="message-date">${(msg.date?.toDate ? msg.date.toDate() : new Date(msg.date)).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `}).join('');
    } catch (error) {
        console.error('メッセージ読み込みエラー:', error);
        messageList.innerHTML = `
            <div class="empty-state">
                <p>メッセージの読み込みに失敗しました</p>
            </div>
        `;
    }
}

// 過去の連絡を表示（アーカイブされたもの）
async function renderArchivedMessages() {
    const messageList = document.getElementById('archivedMessageList');
    if (!messageList) return;

    try {
        const snapshot = await db.collection('messages').get();

        const messages = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.archived) {
                messages.push({ id: doc.id, ...data });
            }
        });

        // 日付順（新しい順）でソート
        messages.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return dateB - dateA;
        });

        if (messages.length === 0) {
            messageList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <p>過去の連絡はありません</p>
                </div>
            `;
            return;
        }

        messageList.innerHTML = messages.map(msg => {
            const toName = msg.to === 'ayu' ? 'あゆ' : 'ひで';
            const toClass = msg.to === 'ayu' ? 'to-ayu' : 'to-hide';
            return `
            <div class="message-item ${toClass}">
                <div class="message-header">
                    <span class="message-to-label">${msg.to === 'ayu' ? '🌸' : '🌊'} ${toName}へ</span>
                    <div class="message-actions">
                        <button class="message-restore" onclick="restoreMessage('${msg.id}')" title="ホームに戻す">↩️</button>
                        <button class="message-delete" onclick="deleteArchivedMessage('${msg.id}')" title="完全に削除">🗑️</button>
                    </div>
                </div>
                <div class="message-content">${msg.content}</div>
                <div class="message-date">${(msg.date?.toDate ? msg.date.toDate() : new Date(msg.date)).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `}).join('');
    } catch (error) {
        console.error('過去の連絡読み込みエラー:', error);
        messageList.innerHTML = `
            <div class="empty-state">
                <p>読み込みに失敗しました</p>
            </div>
        `;
    }
}

// 連絡をアーカイブ
async function archiveMessage(id) {
    try {
        await db.collection('messages').doc(id).update({ archived: true });
        renderMessages();
    } catch (error) {
        console.error('連絡アーカイブエラー:', error);
        alert('連絡の移動に失敗しました');
    }
}

// 連絡をホームに戻す
async function restoreMessage(id) {
    try {
        await db.collection('messages').doc(id).update({ archived: false });
        renderArchivedMessages();
    } catch (error) {
        console.error('連絡復元エラー:', error);
        alert('連絡の復元に失敗しました');
    }
}

// 過去の連絡から完全削除
async function deleteArchivedMessage(id) {
    if (!confirm('この連絡を完全に削除しますか？')) return;

    try {
        await db.collection('messages').doc(id).delete();
        renderArchivedMessages();
    } catch (error) {
        console.error('連絡削除エラー:', error);
        alert('連絡の削除に失敗しました');
    }
}

// メッセージを追加/更新
async function addMessage() {
    const content = document.getElementById('messageContent').value;
    const imageFile = document.getElementById('messageImage').files[0];

    if (!content && !imageFile) {
        alert('メッセージまたは画像を入力してください');
        return;
    }

    try {
        let imageUrl = null;

        // 画像アップロード
        if (imageFile) {
            const compressed = await compressImage(imageFile, 1280, 1280, 0.7);
            const fileName = `messages/${Date.now()}_${imageFile.name}`;
            const ref = storage.ref(fileName);
            await ref.put(compressed);
            imageUrl = await ref.getDownloadURL();
        }

        if (editingMessageId) {
            // 編集モード：更新
            const updateData = { content, to: selectedMessageTo };
            if (imageUrl) updateData.image = imageUrl;
            await db.collection('messages').doc(editingMessageId).update(updateData);
            editingMessageId = null;
        } else {
            // 新規追加
            const msgData = {
                to: selectedMessageTo,
                content: content,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                archived: false
            };
            if (imageUrl) msgData.image = imageUrl;
            await db.collection('messages').add(msgData);
        }

        document.getElementById('messageContent').value = '';
        document.getElementById('messageImage').value = '';
        document.getElementById('messageImagePreview').innerHTML = '';
        document.getElementById('messageModalTitle').textContent = '連絡を追加';
        document.getElementById('saveMessageBtn').textContent = '追加';
        closeModal('messageModal');
        renderMessages();
    } catch (error) {
        console.error('メッセージ保存エラー:', error);
        alert('メッセージの保存に失敗しました');
    }
}

// メッセージを編集
async function editMessage(id) {
    try {
        const doc = await db.collection('messages').doc(id).get();
        if (doc.exists) {
            const msg = doc.data();
            editingMessageId = id;
            selectedMessageTo = msg.to || 'hide';
            selectMessageTo(selectedMessageTo);
            document.getElementById('messageContent').value = msg.content;
            document.getElementById('messageModalTitle').textContent = '連絡を編集';
            document.getElementById('saveMessageBtn').textContent = '更新';
            openModal('messageModal');
        }
    } catch (error) {
        console.error('メッセージ取得エラー:', error);
    }
}

// メッセージを削除
async function deleteMessage(id) {
    if (!confirm('この連絡を削除しますか？')) return;

    try {
        await db.collection('messages').doc(id).delete();
        renderMessages();
    } catch (error) {
        console.error('メッセージ削除エラー:', error);
        alert('メッセージの削除に失敗しました');
    }
}

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
    if (!card) return;

    const content = card.querySelector('.card-content');
    const toggle = card.querySelector('.card-toggle');

    if (content) {
        content.classList.toggle('collapsed');
    }
    if (toggle) {
        toggle.classList.toggle('collapsed');
    }
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


    // その他ページに切り替えた時はカードグリッドを表示
    if (pageName === 'other') {
        showCardGrid();
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
// 機能カード表示管理
// ==========================================

// カードグリッドを表示
function showCardGrid() {
    // すべての機能ページを非表示
    document.querySelectorAll('.feature-page').forEach(page => {
        page.style.display = 'none';
    });

    // カードグリッドを表示
    const cardGrid = document.getElementById('featureCardGrid');
    if (cardGrid) {
        cardGrid.style.display = 'grid';
    }

    // チェック済み買い物リストを更新
    if (typeof renderCheckedShoppingWidget === 'function') {
        renderCheckedShoppingWidget();
    }
}

// 機能ページを表示（遅延読み込み付き）
function showFeature(featureName) {
    // カードグリッドを非表示
    const cardGrid = document.getElementById('featureCardGrid');
    if (cardGrid) {
        cardGrid.style.display = 'none';
    }

    // すべての機能ページを非表示
    document.querySelectorAll('.feature-page').forEach(page => {
        page.style.display = 'none';
    });

    // 選択された機能ページを表示
    const featurePage = document.getElementById(`${featureName}FeaturePage`);
    if (featurePage) {
        featurePage.style.display = 'block';
    }

    // 機能ごとにデータを読み込む（遅延読み込み）
    loadFeatureData(featureName);
}

// 機能データの遅延読み込み
function loadFeatureData(featureName) {
    switch(featureName) {
        case 'checklist':
            initializeChecklist();
            break;
        case 'memo':
            renderMemos();
            break;
        case 'insurance':
            renderInsurances();
            break;
        case 'expenses':
            initializeMonthlyExpenses();
            break;
        case 'splitbill':
            initializeSplitBill();
            break;
        case 'timeline':
            initializeTimeline();
            break;
        case 'shopping':
            initializeShoppingList();
            break;
        case 'archivedNotices':
            renderArchivedNotices();
            break;
        case 'archivedMessages':
            renderArchivedMessages();
            break;
        case 'expiry':
            renderExpiryItems();
            break;
        case 'menu':
            initializeMenu();
            break;
    }
}


// ==========================================
// 保険情報機能 (Firestore)
// ==========================================

let insuranceEditMode = false;

function toggleInsuranceEditMode() {
    insuranceEditMode = !insuranceEditMode;
    renderInsurances();
}

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
                ${insuranceEditMode ? `<div class="insurance-actions">
                    <button class="insurance-edit" onclick="editInsurance('${insurance.id}')">編集</button>
                    <button class="insurance-delete" onclick="deleteInsurance('${insurance.id}')">削除</button>
                </div>` : ''}
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
// 家族のメモ機能
// ==========================================

let memoEditMode = false;

function toggleMemoEditMode() {
    memoEditMode = !memoEditMode;
    renderMemos();
}

// メモ一覧を表示
async function renderMemos() {
    const memoList = document.getElementById('memoList');

    try {
        const snapshot = await db.collection('memos').orderBy('createdAt', 'desc').get();

        const memos = [];
        snapshot.forEach(doc => {
            memos.push({ id: doc.id, ...doc.data() });
        });

        if (memos.length === 0) {
            memoList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <p>メモを追加してください</p>
                </div>
            `;
            return;
        }

        memoList.innerHTML = memos.map(memo => `
            <div class="memo-item">
                <div class="memo-header">
                    <div class="memo-title">${memo.title || '無題'}</div>
                    <div class="memo-date">${memo.createdAt ? new Date(memo.createdAt.seconds * 1000).toLocaleDateString('ja-JP') : ''}</div>
                </div>
                <div class="memo-content">${memo.content ? memo.content.replace(/\n/g, '<br>') : ''}</div>
                ${memoEditMode ? `<div class="memo-actions">
                    <button class="memo-edit" onclick="editMemo('${memo.id}')">編集</button>
                    <button class="memo-delete" onclick="deleteMemo('${memo.id}')">削除</button>
                </div>` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('メモ読み込みエラー:', error);
        memoList.innerHTML = `
            <div class="empty-state">
                <p>メモの読み込みに失敗しました</p>
            </div>
        `;
    }
}

// メモを追加/編集
async function saveMemo() {
    const id = document.getElementById('memoId').value;
    const title = document.getElementById('memoTitle').value;
    const content = document.getElementById('memoContent').value;

    if (!title && !content) {
        alert('タイトルまたは内容を入力してください');
        return;
    }

    try {
        const data = {
            title: title || '無題',
            content: content || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (id) {
            // 編集
            await db.collection('memos').doc(id).update(data);
        } else {
            // 新規追加
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('memos').add(data);
        }

        // フォームをリセット
        document.getElementById('memoId').value = '';
        document.getElementById('memoTitle').value = '';
        document.getElementById('memoContent').value = '';

        closeModal('memoModal');
        renderMemos();
    } catch (error) {
        console.error('メモ保存エラー:', error);
        alert('メモの保存に失敗しました');
    }
}

// メモを編集
async function editMemo(id) {
    try {
        const doc = await db.collection('memos').doc(id).get();
        if (!doc.exists) return;

        const memo = doc.data();

        document.getElementById('memoModalTitle').textContent = 'メモを編集';
        document.getElementById('memoId').value = id;
        document.getElementById('memoTitle').value = memo.title || '';
        document.getElementById('memoContent').value = memo.content || '';

        openModal('memoModal');
    } catch (error) {
        console.error('メモ読み込みエラー:', error);
        alert('メモの読み込みに失敗しました');
    }
}

// メモを削除
async function deleteMemo(id) {
    if (!confirm('このメモを削除しますか？')) return;

    try {
        await db.collection('memos').doc(id).delete();
        renderMemos();
    } catch (error) {
        console.error('メモ削除エラー:', error);
        alert('メモの削除に失敗しました');
    }
}

// ==========================================
// 献立管理機能
// ==========================================

let currentMenuYear = new Date().getFullYear();
let currentMenuMonth = new Date().getMonth();
let dishList = [];
let menuInitialized = false;

function initializeMenu() {
    if (!menuInitialized) {
        document.getElementById('prevMenuMonth').addEventListener('click', previousMenuMonth);
        document.getElementById('nextMenuMonth').addEventListener('click', nextMenuMonth);
        document.getElementById('saveMenuBtn').addEventListener('click', saveMenu);
        document.getElementById('manageDishListBtn').addEventListener('click', () => {
            renderDishItemsList();
            openModal('dishListModal');
        });
        document.getElementById('addDishItemBtn').addEventListener('click', addDishItem);
        document.getElementById('dishItemName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addDishItem();
        });
        document.getElementById('closeDishListBtn').addEventListener('click', () => closeModal('dishListModal'));
        menuInitialized = true;
    }
    updateMenuMonthDisplay();
    loadDishList().then(() => {
        renderMenuInputs();
        loadMenuData();
    });
}

function updateMenuMonthDisplay() {
    document.getElementById('currentMenuMonth').textContent =
        `${currentMenuYear}年 ${currentMenuMonth + 1}月`;
}

function previousMenuMonth() {
    currentMenuMonth--;
    if (currentMenuMonth < 0) {
        currentMenuMonth = 11;
        currentMenuYear--;
    }
    updateMenuMonthDisplay();
    renderMenuInputs();
    loadMenuData();
}

function nextMenuMonth() {
    currentMenuMonth++;
    if (currentMenuMonth > 11) {
        currentMenuMonth = 0;
        currentMenuYear++;
    }
    updateMenuMonthDisplay();
    renderMenuInputs();
    loadMenuData();
}

function renderMenuInputs() {
    const container = document.getElementById('menuList');
    const daysInMonth = new Date(currentMenuYear, currentMenuMonth + 1, 0).getDate();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    let html = '<datalist id="dishDatalist">';
    dishList.forEach(dish => {
        html += `<option value="${dish}">`;
    });
    html += '</datalist>';

    const half = Math.ceil(daysInMonth / 2);

    function dayHtml(day) {
        const date = new Date(currentMenuYear, currentMenuMonth, day);
        const dayName = dayNames[date.getDay()];
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const dayClass = isWeekend ? ' weekend' : '';
        return `<div class="menu-day-row${dayClass}">
            <label class="menu-day-label">${day}日(${dayName})</label>
            <input type="text" id="menu-day-${day}" class="menu-day-input" list="dishDatalist" placeholder="メニュー">
        </div>`;
    }

    html += '<div class="menu-grid"><div class="menu-column">';
    for (let day = 1; day <= half; day++) {
        html += dayHtml(day);
    }
    html += '</div><div class="menu-column">';
    for (let day = half + 1; day <= daysInMonth; day++) {
        html += dayHtml(day);
    }
    html += '</div></div>';
    container.innerHTML = html;
}

async function loadDishList() {
    try {
        const doc = await db.collection('settings').doc('dishList').get();
        if (doc.exists) {
            dishList = doc.data().items || [];
        } else {
            dishList = [];
        }
    } catch (error) {
        console.error('料理リスト読み込みエラー:', error);
        dishList = [];
    }
}

async function saveDishList() {
    try {
        await db.collection('settings').doc('dishList').set({ items: dishList });
    } catch (error) {
        console.error('料理リスト保存エラー:', error);
    }
}

function renderDishItemsList() {
    const list = document.getElementById('dishItemsList');
    list.innerHTML = dishList.map((item, index) => `
        <div class="email-item">
            <span>${item}</span>
            <button class="email-remove" onclick="removeDishItem(${index})">✕</button>
        </div>
    `).join('');
}

async function addDishItem() {
    const input = document.getElementById('dishItemName');
    const name = input.value.trim();
    if (!name) return;
    if (dishList.includes(name)) {
        alert('この料理は既に登録されています');
        return;
    }
    dishList.push(name);
    dishList.sort();
    await saveDishList();
    input.value = '';
    renderDishItemsList();
    renderMenuInputs();
    loadMenuData();
}

async function removeDishItem(index) {
    dishList.splice(index, 1);
    await saveDishList();
    renderDishItemsList();
    renderMenuInputs();
    loadMenuData();
}

async function loadMenuData() {
    const yearMonth = `${currentMenuYear}-${String(currentMenuMonth + 1).padStart(2, '0')}`;
    try {
        const doc = await db.collection('menus').doc(yearMonth).get();
        if (doc.exists) {
            const data = doc.data();
            Object.keys(data).forEach(day => {
                const input = document.getElementById(`menu-day-${day}`);
                if (input) {
                    input.value = data[day];
                }
            });
        }
    } catch (error) {
        console.error('献立データ読み込みエラー:', error);
    }
}

async function saveMenu() {
    const yearMonth = `${currentMenuYear}-${String(currentMenuMonth + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(currentMenuYear, currentMenuMonth + 1, 0).getDate();
    const data = {};

    for (let day = 1; day <= daysInMonth; day++) {
        const input = document.getElementById(`menu-day-${day}`);
        if (input && input.value.trim()) {
            data[String(day)] = input.value.trim();
        }
    }

    try {
        await db.collection('menus').doc(yearMonth).set(data);
        alert(`${currentMenuYear}年${currentMenuMonth + 1}月の献立を保存しました`);
    } catch (error) {
        console.error('献立保存エラー:', error);
        alert('保存に失敗しました');
    }
}

// ==========================================
// 月次費用管理機能
// ==========================================

let incomeItems = []; // 収入項目リスト
let expenseItems = []; // 支出項目リスト
let currentExpenseYear = new Date().getFullYear();
let currentExpenseMonth = new Date().getMonth();
let currentChartYear = new Date().getFullYear(); // グラフ表示用の年
let summaryChart = null; // 収支合計グラフ
let incomeChart = null; // 収入詳細グラフ
let expenseChart = null; // 支出詳細グラフ

// 収入・支出項目を読み込み
async function loadExpenseItems() {
    try {
        const doc = await db.collection('settings').doc('expenseItems').get();
        if (doc.exists) {
            const data = doc.data();
            incomeItems = data.incomeItems || [];
            expenseItems = data.expenseItems || [];

            // 旧形式からの移行
            if (!data.incomeItems && data.items) {
                expenseItems = data.items;
            }
        } else {
            // デフォルト項目
            incomeItems = ['給与'];
            expenseItems = ['電気代', 'ガス代', '住宅ローン', '管理費'];
            await db.collection('settings').doc('expenseItems').set({
                incomeItems: incomeItems,
                expenseItems: expenseItems
            });
        }

        // デフォルト値がない場合
        if (incomeItems.length === 0) {
            incomeItems = ['給与'];
        }
        if (expenseItems.length === 0) {
            expenseItems = ['電気代', 'ガス代', '住宅ローン', '管理費'];
        }
    } catch (error) {
        console.error('項目読み込みエラー:', error);
        incomeItems = ['給与'];
        expenseItems = ['電気代', 'ガス代', '住宅ローン', '管理費'];
    }
}

// 収入・支出項目リストを表示（モーダル内）
function renderExpenseItemsList() {
    // 収入項目リスト
    const incomeList = document.getElementById('incomeItemsList');
    incomeList.innerHTML = incomeItems.map((item, index) => `
        <div class="email-item">
            <span>${item}</span>
            <button class="email-remove" onclick="removeIncomeItem(${index})">✕</button>
        </div>
    `).join('');

    // 支出項目リスト
    const expenseList = document.getElementById('expenseItemsList');
    expenseList.innerHTML = expenseItems.map((item, index) => `
        <div class="email-item">
            <span>${item}</span>
            <button class="email-remove" onclick="removeExpenseItem(${index})">✕</button>
        </div>
    `).join('');
}

// 収入項目を追加
async function addIncomeItem() {
    const input = document.getElementById('incomeItemName');
    const name = input.value.trim();

    if (!name) {
        alert('項目名を入力してください');
        return;
    }

    if (incomeItems.includes(name)) {
        alert('この項目は既に存在します');
        return;
    }

    incomeItems.push(name);

    try {
        await db.collection('settings').doc('expenseItems').set({
            incomeItems: incomeItems,
            expenseItems: expenseItems
        });
        input.value = '';
        renderExpenseItemsList();
        renderExpenseInputs();
    } catch (error) {
        console.error('収入項目追加エラー:', error);
        alert('収入項目の追加に失敗しました');
    }
}

// 収入項目を削除
async function removeIncomeItem(index) {
    if (!confirm('この項目を削除しますか？')) return;

    incomeItems.splice(index, 1);

    try {
        await db.collection('settings').doc('expenseItems').set({
            incomeItems: incomeItems,
            expenseItems: expenseItems
        });
        renderExpenseItemsList();
        renderExpenseInputs();
    } catch (error) {
        console.error('収入項目削除エラー:', error);
        alert('収入項目の削除に失敗しました');
    }
}

// 支出項目を追加
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
        await db.collection('settings').doc('expenseItems').set({
            incomeItems: incomeItems,
            expenseItems: expenseItems
        });
        input.value = '';
        renderExpenseItemsList();
        renderExpenseInputs();
    } catch (error) {
        console.error('支出項目追加エラー:', error);
        alert('支出項目の追加に失敗しました');
    }
}

// 支出項目を削除
async function removeExpenseItem(index) {
    if (!confirm('この項目を削除しますか？')) return;

    expenseItems.splice(index, 1);

    try {
        await db.collection('settings').doc('expenseItems').set({
            incomeItems: incomeItems,
            expenseItems: expenseItems
        });
        renderExpenseItemsList();
        renderExpenseInputs();
    } catch (error) {
        console.error('支出項目削除エラー:', error);
        alert('支出項目の削除に失敗しました');
    }
}

// 収入・支出入力フォームを表示
function renderExpenseInputs() {
    const incomeContainer = document.getElementById('incomeInputs');
    const expenseContainer = document.getElementById('expenseInputs');
    const yearMonth = `${currentExpenseYear}-${String(currentExpenseMonth + 1).padStart(2, '0')}`;

    // 収入入力欄
    incomeContainer.innerHTML = incomeItems.map((item, index) => `
        <tr>
            <td class="item-label">${item}</td>
            <td class="item-input"><input type="number" id="income_${index}" placeholder="0" min="0" data-item="${item}"></td>
        </tr>
    `).join('');

    // 支出入力欄
    expenseContainer.innerHTML = expenseItems.map((item, index) => `
        <tr>
            <td class="item-label">${item}</td>
            <td class="item-input"><input type="number" id="expense_${index}" placeholder="0" min="0" data-item="${item}"></td>
        </tr>
    `).join('');

    // イベントリスナーを追加
    incomeItems.forEach((item, index) => {
        document.getElementById(`income_${index}`).addEventListener('input', calculateExpenseTotal);
    });
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

            // 収入データを読み込み
            incomeItems.forEach((item, index) => {
                const input = document.getElementById(`income_${index}`);
                if (input) {
                    input.value = data.income?.[item] || '';
                }
            });

            // 支出データを読み込み
            expenseItems.forEach((item, index) => {
                const input = document.getElementById(`expense_${index}`);
                if (input) {
                    input.value = data.expenses?.[item] || data[item] || ''; // 旧形式も対応
                }
            });
        } else {
            // データがない場合は空にする
            incomeItems.forEach((item, index) => {
                const input = document.getElementById(`income_${index}`);
                if (input) input.value = '';
            });
            expenseItems.forEach((item, index) => {
                const input = document.getElementById(`expense_${index}`);
                if (input) input.value = '';
            });
        }

        calculateExpenseTotal();
    } catch (error) {
        console.error('費用データ読み込みエラー:', error);
    }
}

// 合計を計算
function calculateExpenseTotal() {
    let totalIncome = 0;
    let totalExpense = 0;

    // 収入合計
    incomeItems.forEach((item, index) => {
        const input = document.getElementById(`income_${index}`);
        if (input) {
            totalIncome += Number(input.value) || 0;
        }
    });

    // 支出合計
    expenseItems.forEach((item, index) => {
        const input = document.getElementById(`expense_${index}`);
        if (input) {
            totalExpense += Number(input.value) || 0;
        }
    });

    // 収支
    const balance = totalIncome - totalExpense;

    document.getElementById('totalIncome').textContent = totalIncome.toLocaleString() + ' 円';
    document.getElementById('totalExpenses').textContent = totalExpense.toLocaleString() + ' 円';
    document.getElementById('totalBalance').textContent = balance.toLocaleString() + ' 円';
}

// 月次費用を保存
async function saveMonthlyExpenses() {
    const yearMonth = `${currentExpenseYear}-${String(currentExpenseMonth + 1).padStart(2, '0')}`;
    const data = {
        income: {},
        expenses: {}
    };

    // 収入データ
    incomeItems.forEach((item, index) => {
        const input = document.getElementById(`income_${index}`);
        if (input) {
            data.income[item] = Number(input.value) || 0;
        }
    });

    // 支出データ
    expenseItems.forEach((item, index) => {
        const input = document.getElementById(`expense_${index}`);
        if (input) {
            data.expenses[item] = Number(input.value) || 0;
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

// 収支合計グラフを表示
async function renderExpenseChart() {
    try {
        // 指定年の12ヶ月分のデータを取得
        const months = [];
        for (let i = 1; i <= 12; i++) {
            months.push(`${currentChartYear}-${String(i).padStart(2, '0')}`);
        }

        // グラフ年表示を更新
        document.getElementById('currentChartYear').textContent = `${currentChartYear}年`;

        // 収入合計・支出合計・収支のデータ収集
        const totalIncomeData = [];
        const totalExpenseData = [];
        const balanceData = [];
        const cumulativeBalanceData = [];
        const monthlyRawData = []; // 月ごとの生データ
        let cumulativeBalance = 0;

        for (const month of months) {
            const doc = await db.collection('monthlyExpenses').doc(month).get();
            if (doc.exists) {
                const data = doc.data();

                // 収入合計
                let totalIncome = 0;
                if (data.income) {
                    totalIncome = Object.values(data.income).reduce((a, b) => a + b, 0);
                }

                // 支出合計
                let totalExpense = 0;
                if (data.expenses) {
                    totalExpense = Object.values(data.expenses).reduce((a, b) => a + b, 0);
                } else {
                    // 旧形式対応
                    totalExpense = Object.entries(data)
                        .filter(([key]) => !['income', 'expenses'].includes(key))
                        .reduce((sum, [, value]) => sum + (typeof value === 'number' ? value : 0), 0);
                }

                const monthBalance = totalIncome - totalExpense;
                totalIncomeData.push(totalIncome);
                totalExpenseData.push(totalExpense);
                balanceData.push(monthBalance);
                monthlyRawData.push({ income: data.income || {}, expenses: data.expenses || {} });

                // 累積収支を計算
                cumulativeBalance += monthBalance;
                cumulativeBalanceData.push(cumulativeBalance);
            } else {
                totalIncomeData.push(0);
                totalExpenseData.push(0);
                balanceData.push(0);
                monthlyRawData.push(null);
                cumulativeBalanceData.push(cumulativeBalance);
            }
        }

        // 年間一覧テーブルを描画
        const tableContainer = document.getElementById('yearlyExpenseTable');
        const monthLabels = months.map(m => `${parseInt(m.split('-')[1])}月`);
        let tableHTML = `<table class="expenses-table yearly-summary-table">
            <thead><tr><th>月</th><th>収入</th><th>支出</th><th>収支</th></tr></thead><tbody>`;
        let yearTotalIncome = 0, yearTotalExpense = 0;
        for (let i = 0; i < 12; i++) {
            yearTotalIncome += totalIncomeData[i];
            yearTotalExpense += totalExpenseData[i];
            const bal = balanceData[i];
            const balClass = bal >= 0 ? 'positive' : 'negative';
            tableHTML += `<tr class="yearly-month-row" onclick="toggleMonthDetail(this, ${i})">
                <td>${monthLabels[i]}</td>
                <td class="num">${totalIncomeData[i].toLocaleString()}</td>
                <td class="num">${totalExpenseData[i].toLocaleString()}</td>
                <td class="num ${balClass}">${bal >= 0 ? '+' : ''}${bal.toLocaleString()}</td>
            </tr>`;

            // 詳細行（初期非表示）
            const raw = monthlyRawData[i];
            let detailContent = '';
            if (raw) {
                const incomeEntries = Object.entries(raw.income).filter(([, v]) => v > 0);
                const expenseEntries = Object.entries(raw.expenses).filter(([, v]) => v > 0);
                if (incomeEntries.length > 0 || expenseEntries.length > 0) {
                    if (incomeEntries.length > 0) {
                        detailContent += '<div class="month-detail-section"><span class="month-detail-label income-label">収入</span>';
                        for (const [name, val] of incomeEntries) {
                            detailContent += `<div class="month-detail-item"><span>${name}</span><span class="positive">${val.toLocaleString()}円</span></div>`;
                        }
                        detailContent += '</div>';
                    }
                    if (expenseEntries.length > 0) {
                        detailContent += '<div class="month-detail-section"><span class="month-detail-label expense-label">支出</span>';
                        for (const [name, val] of expenseEntries) {
                            detailContent += `<div class="month-detail-item"><span>${name}</span><span class="negative">${val.toLocaleString()}円</span></div>`;
                        }
                        detailContent += '</div>';
                    }
                } else {
                    detailContent = '<div class="month-detail-empty">データなし</div>';
                }
            } else {
                detailContent = '<div class="month-detail-empty">データなし</div>';
            }
            tableHTML += `<tr class="month-detail-row" style="display:none;">
                <td colspan="4"><div class="month-detail-content">${detailContent}</div></td>
            </tr>`;
        }
        const yearBalance = yearTotalIncome - yearTotalExpense;
        const yearBalClass = yearBalance >= 0 ? 'positive' : 'negative';
        tableHTML += `</tbody><tfoot><tr class="total-row yearly-total-row">
            <td>合計</td>
            <td class="num">${yearTotalIncome.toLocaleString()}</td>
            <td class="num">${yearTotalExpense.toLocaleString()}</td>
            <td class="num ${yearBalClass}">${yearBalance >= 0 ? '+' : ''}${yearBalance.toLocaleString()}</td>
        </tr></tfoot></table>`;
        tableContainer.innerHTML = tableHTML;

        const ctx = document.getElementById('expenseSummaryChart');

        if (summaryChart) {
            summaryChart.destroy();
        }

        summaryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months.map(m => {
                    const [y, mo] = m.split('-');
                    return `${parseInt(mo)}月`;
                }),
                datasets: [
                    {
                        label: '収入合計',
                        data: totalIncomeData,
                        borderColor: '#10B981',
                        backgroundColor: '#10B98120',
                        tension: 0.3,
                        borderWidth: 3
                    },
                    {
                        label: '支出合計',
                        data: totalExpenseData,
                        borderColor: '#EF4444',
                        backgroundColor: '#EF444420',
                        tension: 0.3,
                        borderWidth: 3
                    },
                    {
                        label: '累積収支',
                        data: cumulativeBalanceData,
                        borderColor: '#8B5CF6',
                        backgroundColor: '#8B5CF620',
                        tension: 0.3,
                        borderWidth: 4
                    }
                ]
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
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString() + '円';
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('グラフ表示エラー:', error);
    }
}

// 月詳細行のトグル
function toggleMonthDetail(rowEl, index) {
    const detailRow = rowEl.nextElementSibling;
    if (detailRow && detailRow.classList.contains('month-detail-row')) {
        const isVisible = detailRow.style.display !== 'none';
        detailRow.style.display = isVisible ? 'none' : 'table-row';
        rowEl.classList.toggle('expanded', !isVisible);
    }
}

// 収入詳細グラフを表示
async function renderIncomeDetailChart() {
    try {
        const months = [];
        for (let i = 1; i <= 12; i++) {
            months.push(`${currentChartYear}-${String(i).padStart(2, '0')}`);
        }

        const colors = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0'];
        const datasets = [];

        for (let i = 0; i < incomeItems.length; i++) {
            const item = incomeItems[i];
            const data = [];

            for (const month of months) {
                const doc = await db.collection('monthlyExpenses').doc(month).get();
                if (doc.exists) {
                    data.push(doc.data().income?.[item] || 0);
                } else {
                    data.push(0);
                }
            }

            datasets.push({
                label: item,
                data: data,
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length] + '20',
                tension: 0.3
            });
        }

        const ctx = document.getElementById('incomeChart');

        if (incomeChart) {
            incomeChart.destroy();
        }

        incomeChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months.map(m => {
                    const [y, mo] = m.split('-');
                    return `${parseInt(mo)}月`;
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
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString() + '円';
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('収入詳細グラフ表示エラー:', error);
    }
}

// 支出詳細グラフを表示
async function renderExpenseDetailChart() {
    try {
        const months = [];
        for (let i = 1; i <= 12; i++) {
            months.push(`${currentChartYear}-${String(i).padStart(2, '0')}`);
        }

        const colors = ['#EF4444', '#F87171', '#FCA5A5', '#FECACA'];
        const datasets = [];

        for (let i = 0; i < expenseItems.length; i++) {
            const item = expenseItems[i];
            const data = [];

            for (const month of months) {
                const doc = await db.collection('monthlyExpenses').doc(month).get();
                if (doc.exists) {
                    data.push(doc.data().expenses?.[item] || doc.data()[item] || 0);
                } else {
                    data.push(0);
                }
            }

            datasets.push({
                label: item,
                data: data,
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length] + '20',
                tension: 0.3
            });
        }

        const ctx = document.getElementById('expenseChart');

        if (expenseChart) {
            expenseChart.destroy();
        }

        expenseChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months.map(m => {
                    const [y, mo] = m.split('-');
                    return `${parseInt(mo)}月`;
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
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString() + '円';
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('支出詳細グラフ表示エラー:', error);
    }
}

// グラフの前年へ
function previousChartYear() {
    currentChartYear--;
    renderExpenseChart();
}

// グラフの次年へ
function nextChartYear() {
    currentChartYear++;
    renderExpenseChart();
}

// 詳細グラフの折りたたみ
function toggleDetailChart(type) {
    const chartDiv = document.getElementById(`${type}Chart`);

    if (!chartDiv) return;

    if (chartDiv.style.display === 'none' || chartDiv.style.display === '') {
        chartDiv.style.display = 'block';

        // グラフを描画
        if (type === 'incomeDetail') {
            renderIncomeDetailChart();
        } else if (type === 'expenseDetail') {
            renderExpenseDetailChart();
        }
    } else {
        chartDiv.style.display = 'none';
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

    // 連絡
    document.getElementById('addMessageBtn').addEventListener('click', () => {
        document.getElementById('messageModalTitle').textContent = '連絡を追加';
        document.getElementById('saveMessageBtn').textContent = '追加';
        document.getElementById('messageContent').value = '';
        document.getElementById('messageImage').value = '';
        document.getElementById('messageImagePreview').innerHTML = '';
        selectedMessageTo = 'hide';
        selectMessageTo('hide');
        openModal('messageModal');
    });
    document.getElementById('saveMessageBtn').addEventListener('click', addMessage);
    document.getElementById('closeMessageBtn').addEventListener('click', () => closeModal('messageModal'));
    document.getElementById('messageImage').addEventListener('change', (e) => {
        const file = e.target.files[0];
        const preview = document.getElementById('messageImagePreview');
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                preview.innerHTML = `<img src="${ev.target.result}" style="max-width: 100%; border-radius: 0.5rem; margin-top: 0.5rem;">`;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = '';
        }
    });

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

    // メモ
    document.getElementById('addMemoBtn').addEventListener('click', () => {
        document.getElementById('memoModalTitle').textContent = 'メモを追加';
        document.getElementById('memoId').value = '';
        document.getElementById('memoTitle').value = '';
        document.getElementById('memoContent').value = '';
        openModal('memoModal');
    });
    document.getElementById('saveMemoBtn').addEventListener('click', saveMemo);
    document.getElementById('closeMemoBtn').addEventListener('click', () => closeModal('memoModal'));

    // 月次費用
    document.getElementById('saveExpensesBtn').addEventListener('click', saveMonthlyExpenses);
    document.getElementById('prevExpenseMonth').addEventListener('click', previousExpenseMonth);
    document.getElementById('nextExpenseMonth').addEventListener('click', nextExpenseMonth);
    document.getElementById('prevChartYear').addEventListener('click', previousChartYear);
    document.getElementById('nextChartYear').addEventListener('click', nextChartYear);
    document.getElementById('manageExpenseItemsBtn').addEventListener('click', () => {
        renderExpenseItemsList();
        openModal('expenseItemsModal');
    });

    // 収入項目の追加
    document.getElementById('addIncomeItemBtn').addEventListener('click', addIncomeItem);
    document.getElementById('incomeItemName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addIncomeItem();
    });

    // 支出項目の追加
    document.getElementById('addExpenseItemBtn').addEventListener('click', addExpenseItem);
    document.getElementById('expenseItemName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addExpenseItem();
    });

    document.getElementById('closeExpenseItemsBtn').addEventListener('click', () => closeModal('expenseItemsModal'));

    // ページ切り替えタブ
    document.querySelectorAll('.header-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const pageName = e.target.dataset.page;
            switchPage(pageName);
        });
    });


    // チェックリスト機能
    document.getElementById('addChecklistItemBtn')?.addEventListener('click', () => {
        openModal('checklistItemModal');
    });
    document.getElementById('saveChecklistItemBtn')?.addEventListener('click', addChecklistItem);
    document.getElementById('closeChecklistItemBtn')?.addEventListener('click', () => {
        closeModal('checklistItemModal');
    });
    document.getElementById('checklistItemName')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addChecklistItem();
    });
});

// ==========================================
// 期限管理機能 (Firestore)
// ==========================================

let expiryEditMode = false;

function toggleExpiryEditMode() {
    expiryEditMode = !expiryEditMode;
    renderExpiryItems();
}

// 期限日付セレクト初期化
function initExpiryDateSelects() {
    const currentYear = new Date().getFullYear();
    const yearRange = { start: 2000, end: currentYear + 30 };

    ['expiryStartYear', 'expiryEndYear'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel.options.length > 1) return;
        for (let y = yearRange.start; y <= yearRange.end; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y + '年';
            sel.appendChild(opt);
        }
    });

    ['expiryStartMonth', 'expiryEndMonth'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel.options.length > 1) return;
        for (let m = 1; m <= 12; m++) {
            const opt = document.createElement('option');
            opt.value = String(m).padStart(2, '0');
            opt.textContent = m + '月';
            sel.appendChild(opt);
        }
    });

    ['expiryStartDay', 'expiryEndDay'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel.options.length > 1) return;
        for (let d = 1; d <= 31; d++) {
            const opt = document.createElement('option');
            opt.value = String(d).padStart(2, '0');
            opt.textContent = d + '日';
            sel.appendChild(opt);
        }
    });
}

// セレクトから日付文字列を取得
function getExpiryDateFromSelects(prefix) {
    const y = document.getElementById(prefix + 'Year').value;
    const m = document.getElementById(prefix + 'Month').value;
    const d = document.getElementById(prefix + 'Day').value;
    if (!y || !m || !d) return '';
    return `${y}-${m}-${d}`;
}

// 日付文字列をセレクトにセット
function setExpiryDateToSelects(prefix, dateStr) {
    if (!dateStr) {
        document.getElementById(prefix + 'Year').value = '';
        document.getElementById(prefix + 'Month').value = '';
        document.getElementById(prefix + 'Day').value = '';
        return;
    }
    const [y, m, d] = dateStr.split('-');
    document.getElementById(prefix + 'Year').value = parseInt(y);
    document.getElementById(prefix + 'Month').value = m;
    document.getElementById(prefix + 'Day').value = d;
}

// 期限アイテム一覧を表示
async function renderExpiryItems() {
    const expiryList = document.getElementById('expiryList');

    try {
        const snapshot = await db.collection('expiryItems').orderBy('expiryDate', 'asc').get();

        const items = [];
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });

        if (items.length === 0) {
            expiryList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <p>期限アイテムを追加してください</p>
                </div>
            `;
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        expiryList.innerHTML = items.map(item => {
            const expiryDate = new Date(item.expiryDate);
            expiryDate.setHours(0, 0, 0, 0);
            const remainingDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

            let percentage = 50;
            let barClass = '';
            let statusText = '';

            if (item.startDate) {
                const startDate = new Date(item.startDate);
                startDate.setHours(0, 0, 0, 0);
                const totalDays = Math.max((expiryDate - startDate) / (1000 * 60 * 60 * 24), 1);
                const remainingRatio = Math.max(0, Math.min(1, remainingDays / totalDays));
                percentage = Math.round(remainingRatio * 100);

                if (remainingDays <= 0) {
                    barClass = 'expired';
                    statusText = '期限切れ';
                } else if (remainingRatio <= 0.1) {
                    barClass = 'danger';
                    statusText = `残り ${remainingDays} 日`;
                } else if (remainingRatio <= 0.3) {
                    barClass = 'warning';
                    statusText = `残り ${remainingDays} 日`;
                } else {
                    statusText = `残り ${remainingDays} 日`;
                }
            } else {
                if (remainingDays <= 0) {
                    barClass = 'expired';
                    statusText = '期限切れ';
                    percentage = 100;
                } else if (remainingDays <= 30) {
                    barClass = 'danger';
                    statusText = `残り ${remainingDays} 日`;
                    percentage = 10;
                } else if (remainingDays <= 90) {
                    barClass = 'warning';
                    statusText = `残り ${remainingDays} 日`;
                    percentage = 30;
                } else {
                    statusText = `残り ${remainingDays} 日`;
                    percentage = Math.min(90, Math.round(remainingDays / 365 * 50) + 40);
                }
            }

            const editBtns = expiryEditMode ? `
                        <div class="expiry-item-actions">
                            <button class="btn-icon-simple" onclick="editExpiryItem('${item.id}')" title="編集">✏️</button>
                            <button class="btn-icon-simple" onclick="deleteExpiryItem('${item.id}')" title="削除">🗑️</button>
                        </div>` : '';

            return `
                <div class="expiry-item">
                    <div class="expiry-item-header">
                        <div class="expiry-item-name">📄 ${item.name}</div>
                        ${editBtns}
                    </div>
                    <div class="expiry-item-meta">
                        <span class="expiry-date-range">〜 ${item.expiryDate}</span>
                        <span class="expiry-status-text ${barClass}">${statusText}</span>
                    </div>
                    <div class="expiry-bar-container">
                        <div class="expiry-bar ${barClass}" style="width: ${remainingDays <= 0 ? 100 : percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('期限アイテム取得エラー:', error);
        expiryList.innerHTML = '<p style="color: red;">読み込みエラー</p>';
    }
}

// 期限モーダルを開く（新規）
function openExpiryModal() {
    initExpiryDateSelects();
    document.getElementById('expiryModalTitle').textContent = '期限アイテムを追加';
    document.getElementById('expiryItemId').value = '';
    document.getElementById('expiryName').value = '';
    setExpiryDateToSelects('expiryStart', '');
    setExpiryDateToSelects('expiryEnd', '');
    openModal('expiryModal');
}

// 期限モーダルを閉じる
function closeExpiryModal() {
    closeModal('expiryModal');
}

// 期限アイテムを保存（追加/編集）
async function saveExpiryItem() {
    const id = document.getElementById('expiryItemId').value;
    const name = document.getElementById('expiryName').value.trim();
    const startDate = getExpiryDateFromSelects('expiryStart');
    const expiryDate = getExpiryDateFromSelects('expiryEnd');

    if (!name || !expiryDate) {
        alert('名前と有効期限を入力してください');
        return;
    }

    if (startDate && new Date(startDate) >= new Date(expiryDate)) {
        alert('有効期限は開始日より後の日付にしてください');
        return;
    }

    try {
        const data = { name, startDate: startDate || '', expiryDate };

        if (id) {
            await db.collection('expiryItems').doc(id).update(data);
        } else {
            await db.collection('expiryItems').add(data);
        }

        closeExpiryModal();
        renderExpiryItems();
    } catch (error) {
        console.error('期限アイテム保存エラー:', error);
        alert('保存に失敗しました');
    }
}

// 期限アイテムを編集
async function editExpiryItem(id) {
    try {
        initExpiryDateSelects();
        const doc = await db.collection('expiryItems').doc(id).get();
        if (!doc.exists) return;

        const data = doc.data();
        document.getElementById('expiryModalTitle').textContent = '期限アイテムを編集';
        document.getElementById('expiryItemId').value = id;
        document.getElementById('expiryName').value = data.name;
        setExpiryDateToSelects('expiryStart', data.startDate);
        setExpiryDateToSelects('expiryEnd', data.expiryDate);
        openModal('expiryModal');
    } catch (error) {
        console.error('期限アイテム読み込みエラー:', error);
    }
}

// 期限アイテムを削除
async function deleteExpiryItem(id) {
    if (!confirm('このアイテムを削除しますか？')) return;

    try {
        await db.collection('expiryItems').doc(id).delete();
        renderExpiryItems();
    } catch (error) {
        console.error('期限アイテム削除エラー:', error);
        alert('削除に失敗しました');
    }
}

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
