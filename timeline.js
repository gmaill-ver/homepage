// ==========================================
// 時系列ログ機能
// ==========================================

let timelineTrips = [];
let currentTimelineTripId = null;

// データを読み込み
async function loadTimelineData() {
    try {
        const doc = await db.collection('settings').doc('timelineLog').get();
        if (doc.exists) {
            const data = doc.data();
            timelineTrips = data.trips || [];
            currentTimelineTripId = data.currentTripId || null;
            loadTimelineTrips();
            renderTimelineEntries();
        }
    } catch (error) {
        console.error('時系列データ読み込みエラー:', error);
    }
}

// データを保存
async function saveTimelineData() {
    try {
        await db.collection('settings').doc('timelineLog').set({
            trips: timelineTrips,
            currentTripId: currentTimelineTripId
        });
    } catch (error) {
        console.error('時系列データ保存エラー:', error);
        alert('保存に失敗しました');
    }
}

// 訪問先リストを読み込み
function loadTimelineTrips() {
    const select = document.getElementById('timelineTripSelect');
    if (!select) return;

    select.innerHTML = '<option value="">新規作成...</option>';

    timelineTrips.forEach(trip => {
        const option = document.createElement('option');
        option.value = trip.id;
        option.textContent = `${trip.name} (${trip.date})`;
        select.appendChild(option);
    });

    if (currentTimelineTripId) {
        select.value = currentTimelineTripId;
    }

    select.addEventListener('change', (e) => {
        currentTimelineTripId = e.target.value || null;
        saveTimelineData();
        renderTimelineEntries();
    });
}

// 新規訪問先モーダルを表示
function showNewTimelineTripModal() {
    const modal = document.getElementById('newTimelineTripModal');
    if (modal) {
        modal.style.display = 'flex';
        const dateInput = document.getElementById('timelineTripDate');
        if (dateInput) {
            dateInput.valueAsDate = new Date();
        }
    }
}

// 新規訪問先モーダルを閉じる
function closeNewTimelineTripModal() {
    const modal = document.getElementById('newTimelineTripModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 新規訪問先を作成
async function createNewTimelineTrip() {
    const name = document.getElementById('timelineTripName').value.trim();
    const date = document.getElementById('timelineTripDate').value;

    if (!name || !date) {
        alert('訪問先名と日付を入力してください');
        return;
    }

    const newTrip = {
        id: Date.now().toString(),
        name: name,
        date: date,
        entries: []
    };

    timelineTrips.push(newTrip);
    currentTimelineTripId = newTrip.id;

    await saveTimelineData();
    loadTimelineTrips();

    const select = document.getElementById('timelineTripSelect');
    if (select) {
        select.value = currentTimelineTripId;
    }
    renderTimelineEntries();
    closeNewTimelineTripModal();

    document.getElementById('timelineTripName').value = '';
}

// 現在時刻をセット
function setCurrentTimelineTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeInput = document.getElementById('timelineTime');
    if (timeInput) {
        timeInput.value = `${hours}:${minutes}`;
    }
}

// エントリーを追加
async function addTimelineEntry() {
    if (!currentTimelineTripId) {
        alert('まず訪問先を選択または作成してください');
        return;
    }

    const time = document.getElementById('timelineTime').value;
    const location = document.getElementById('timelineLocation').value.trim();
    const memo = document.getElementById('timelineMemo').value.trim();

    if (!time || !location) {
        alert('時刻と場所を入力してください');
        return;
    }

    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    const entry = {
        id: Date.now(),
        time: time,
        location: location,
        memo: memo
    };

    trip.entries.push(entry);
    trip.entries.sort((a, b) => a.time.localeCompare(b.time));

    await saveTimelineData();
    renderTimelineEntries();

    // フォームをリセット
    document.getElementById('timelineLocation').value = '';
    document.getElementById('timelineMemo').value = '';
    setCurrentTimelineTime();
}

// タイムラインを表示
function renderTimelineEntries() {
    const container = document.getElementById('timelineEntriesContainer');
    const headerContainer = document.getElementById('timelineTripHeader');

    if (!container || !headerContainer) return;

    if (!currentTimelineTripId) {
        container.innerHTML = '<div style="text-align: center; padding: 1rem; color: #999; font-size: 0.875rem;">訪問先を選択してください</div>';
        headerContainer.innerHTML = '';
        return;
    }

    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip || trip.entries.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 1rem; color: #999; font-size: 0.875rem;">まだログがありません</div>';
        headerContainer.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.5rem;">
                <h3 style="font-size: 1.125rem; margin-bottom: 0.25rem;">${trip.name}</h3>
                <p style="font-size: 0.875rem; opacity: 0.9;">${trip.date}</p>
            </div>
        `;
        return;
    }

    headerContainer.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.5rem;">
            <h3 style="font-size: 1.125rem; margin-bottom: 0.25rem;">${trip.name}</h3>
            <p style="font-size: 0.875rem; opacity: 0.9;">${trip.date} - ${trip.entries.length}件のログ</p>
        </div>
    `;

    const timelineHTML = trip.entries.map(entry => `
        <div style="position: relative; margin-bottom: 0.75rem; padding: 0.75rem; background: #F9FAFB; border-radius: 0.5rem; border-left: 4px solid #667eea;">
            <button onclick="deleteTimelineEntry('${entry.id}')" style="position: absolute; top: 0.5rem; right: 0.5rem; background: #EF4444; color: white; border: none; border-radius: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; cursor: pointer;">削除</button>
            <div style="font-weight: bold; color: #667eea; font-size: 1rem; margin-bottom: 0.25rem;">${entry.time}</div>
            <div style="font-size: 1.125rem; font-weight: 600; color: #212529; margin-bottom: 0.25rem;">${entry.location}</div>
            ${entry.memo ? `<div style="color: #6B7280; font-size: 0.875rem; line-height: 1.5;">${entry.memo}</div>` : ''}
        </div>
    `).join('');

    container.innerHTML = timelineHTML;
}

// エントリーを削除
async function deleteTimelineEntry(entryId) {
    if (!confirm('このログを削除しますか?')) return;

    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    trip.entries = trip.entries.filter(e => e.id != entryId);
    await saveTimelineData();
    renderTimelineEntries();
}

// データをエクスポート
function exportTimelineData() {
    if (!currentTimelineTripId) {
        alert('エクスポートする訪問先を選択してください');
        return;
    }

    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    let text = `${trip.name} - ${trip.date}\n`;
    text += '='.repeat(40) + '\n\n';

    trip.entries.forEach(entry => {
        text += `[${entry.time}] ${entry.location}\n`;
        if (entry.memo) {
            text += `  メモ: ${entry.memo}\n`;
        }
        text += '\n';
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline_${trip.name}_${trip.date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// 初期化
async function initializeTimeline() {
    await loadTimelineData();
    setCurrentTimelineTime();
}
