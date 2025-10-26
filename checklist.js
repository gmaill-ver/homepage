// ==========================================
// 持ち物チェックリスト機能
// ==========================================

let checklistItems = []; // 全アイテムリスト { name, person, categories: {travel: false, outing: false, nursery: false} }
let currentCategory = 'travel'; // 現在選択中のカテゴリ
let currentPersonFilter = 'all'; // 現在選択中の人物フィルター

// アイテムを読み込み
async function loadChecklistItems() {
    try {
        const doc = await db.collection('settings').doc('checklistItems').get();
        if (doc.exists) {
            checklistItems = doc.data().items || [];
        } else {
            // デフォルトアイテム
            checklistItems = [
                { name: '水筒', person: 'common', categories: { travel: false, outing: false, nursery: false } },
                { name: 'タオル', person: 'common', categories: { travel: false, outing: false, nursery: false } },
                { name: '帽子', person: 'son', categories: { travel: false, outing: false, nursery: false } },
                { name: '着替え', person: 'son', categories: { travel: false, outing: false, nursery: false } },
                { name: 'おむつ', person: 'son', categories: { travel: false, outing: false, nursery: false } },
                { name: 'おしりふき', person: 'son', categories: { travel: false, outing: false, nursery: false } },
                { name: 'ビニール袋', person: 'common', categories: { travel: false, outing: false, nursery: false } },
                { name: '日焼け止め', person: 'common', categories: { travel: false, outing: false, nursery: false } }
            ];
            await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        }
    } catch (error) {
        console.error('チェックリスト読み込みエラー:', error);
        checklistItems = [];
    }
}

// カテゴリを選択
function selectCategory(category) {
    currentCategory = category;

    // ボタンのアクティブ状態を更新
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.category-btn[data-category="${category}"]`).classList.add('active');

    renderChecklist();
}

// 人物フィルターを選択
function filterByPerson(person) {
    currentPersonFilter = person;

    // ボタンのアクティブ状態を更新
    document.querySelectorAll('.person-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.person-filter-btn[data-person="${person}"]`).classList.add('active');

    renderChecklist();
}

// 人物ラベルを取得
function getPersonLabel(person) {
    const labels = {
        'me': '👨',
        'wife': '👩',
        'son': '👶',
        'common': '🔗'
    };
    return labels[person] || '';
}

// チェックリストを表示
function renderChecklist() {
    const packingList = document.getElementById('packingList');
    const allItemsList = document.getElementById('allItemsList');
    const emptyMessage = document.getElementById('packingEmptyMessage');

    if (!packingList || !allItemsList) return;

    // 現在のカテゴリでチェックされているアイテム
    const checkedItems = checklistItems.filter(item => item.categories[currentCategory]);

    // 人物フィルターでフィルタリングされたアイテム
    let filteredItems = checklistItems;
    if (currentPersonFilter !== 'all') {
        filteredItems = checklistItems.filter(item => item.person === currentPersonFilter);
    }

    // 持っていくものリスト
    if (checkedItems.length === 0) {
        packingList.innerHTML = '';
        if (emptyMessage) emptyMessage.style.display = 'block';
    } else {
        if (emptyMessage) emptyMessage.style.display = 'none';
        packingList.innerHTML = checkedItems.map((item) => {
            const realIndex = checklistItems.findIndex(i => i.name === item.name && i.person === item.person);
            return `
                <div class="checklist-item">
                    <input type="checkbox"
                           id="packing_${realIndex}"
                           checked
                           onchange="toggleChecklistItem(${realIndex})">
                    <label for="packing_${realIndex}">${getPersonLabel(item.person)} ${item.name}</label>
                    <button class="remove-btn" onclick="removeChecklistItem(${realIndex})">🗑️</button>
                </div>
            `;
        }).join('');
    }

    // 全アイテムリスト（人物フィルター適用）
    allItemsList.innerHTML = filteredItems.map((item) => {
        const realIndex = checklistItems.findIndex(i => i.name === item.name && i.person === item.person);
        return `
            <div class="checklist-item">
                <input type="checkbox"
                       id="all_${realIndex}"
                       ${item.categories[currentCategory] ? 'checked' : ''}
                       onchange="toggleChecklistItem(${realIndex})">
                <label for="all_${realIndex}">${getPersonLabel(item.person)} ${item.name}</label>
                <button class="remove-btn" onclick="removeChecklistItem(${realIndex})">🗑️</button>
            </div>
        `;
    }).join('');
}

// チェック状態を切り替え
async function toggleChecklistItem(index) {
    checklistItems[index].categories[currentCategory] = !checklistItems[index].categories[currentCategory];

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('チェック状態保存エラー:', error);
        alert('保存に失敗しました');
    }
}

// アイテムを削除
async function removeChecklistItem(index) {
    if (!confirm(`「${checklistItems[index].name}」を削除しますか？`)) return;

    checklistItems.splice(index, 1);

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('アイテム削除エラー:', error);
        alert('削除に失敗しました');
    }
}

// アイテムを追加
async function addChecklistItem() {
    const input = document.getElementById('checklistItemName');
    const personSelect = document.getElementById('checklistItemPerson');
    if (!input || !personSelect) return;

    const name = input.value.trim();
    const person = personSelect.value;

    if (!name) {
        alert('アイテム名を入力してください');
        return;
    }

    if (checklistItems.some(item => item.name === name && item.person === person)) {
        alert('このアイテムは既に存在します');
        return;
    }

    checklistItems.push({
        name: name,
        person: person,
        categories: { travel: false, outing: false, nursery: false }
    });

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        input.value = '';
        personSelect.value = 'me';
        closeModal('checklistItemModal');
        renderChecklist();
    } catch (error) {
        console.error('アイテム追加エラー:', error);
        alert('追加に失敗しました');
    }
}

// チェックリスト機能の初期化
async function initializeChecklist() {
    await loadChecklistItems();
    renderChecklist();
}
