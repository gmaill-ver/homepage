// ==========================================
// 持ち物チェックリスト機能
// ==========================================

let checklistItems = []; // 全アイテムリスト { name, person, categories: {travel: {checked: false, quantity: 1}, outing: {...}, nursery: {...}} }
let currentCategory = 'travel'; // 現在選択中のカテゴリ
let currentPersonFilter = 'all'; // 現在選択中の人物フィルター（アイテム一覧用）
let currentPackingPersonTab = 'all'; // 現在選択中の人物タブ（持っていくものリスト用）

// 人物名のマッピング
const personNames = {
    'me': 'しでき',
    'wife': 'あゆ',
    'son': '翔真実',
    'common': '共通'
};

// アイテムを読み込み
async function loadChecklistItems() {
    try {
        const doc = await db.collection('settings').doc('checklistItems').get();
        if (doc.exists) {
            checklistItems = doc.data().items || [];

            // 旧データ形式から新データ形式へのマイグレーション
            let needsMigration = false;
            checklistItems = checklistItems.map(item => {
                // categoriesが存在しない場合は初期化
                if (!item.categories) {
                    item.categories = {};
                    needsMigration = true;
                }

                // すべての必須カテゴリ（travel, outing, nursery）を確保
                const requiredCategories = ['travel', 'outing', 'nursery'];
                const categories = {};

                for (const category of requiredCategories) {
                    const value = item.categories[category];

                    if (typeof value === 'boolean') {
                        // 旧形式: boolean → 新形式: {checked, quantity}
                        categories[category] = { checked: value, quantity: 1 };
                        needsMigration = true;
                    } else if (value && typeof value === 'object' && 'checked' in value) {
                        // 新形式: そのまま使用
                        categories[category] = { checked: value.checked, quantity: value.quantity || 1 };
                    } else {
                        // 不正なデータまたは存在しない: 初期化
                        categories[category] = { checked: false, quantity: 1 };
                        needsMigration = true;
                    }
                }

                item.categories = categories;

                // personが存在しない場合はデフォルト値を設定
                if (!item.person) {
                    item.person = 'common';
                    needsMigration = true;
                }

                return item;
            });

            // マイグレーションが必要な場合は保存
            if (needsMigration) {
                await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
            }
        } else {
            // デフォルトアイテム
            checklistItems = [
                { name: '水筒', person: 'common', categories: { travel: {checked: false, quantity: 1}, outing: {checked: false, quantity: 1}, nursery: {checked: false, quantity: 1} } },
                { name: 'タオル', person: 'common', categories: { travel: {checked: false, quantity: 1}, outing: {checked: false, quantity: 1}, nursery: {checked: false, quantity: 1} } },
                { name: '帽子', person: 'son', categories: { travel: {checked: false, quantity: 1}, outing: {checked: false, quantity: 1}, nursery: {checked: false, quantity: 1} } },
                { name: '着替え', person: 'son', categories: { travel: {checked: false, quantity: 1}, outing: {checked: false, quantity: 1}, nursery: {checked: false, quantity: 1} } },
                { name: 'おむつ', person: 'son', categories: { travel: {checked: false, quantity: 1}, outing: {checked: false, quantity: 1}, nursery: {checked: false, quantity: 1} } },
                { name: 'おしりふき', person: 'son', categories: { travel: {checked: false, quantity: 1}, outing: {checked: false, quantity: 1}, nursery: {checked: false, quantity: 1} } },
                { name: 'ビニール袋', person: 'common', categories: { travel: {checked: false, quantity: 1}, outing: {checked: false, quantity: 1}, nursery: {checked: false, quantity: 1} } },
                { name: '日焼け止め', person: 'common', categories: { travel: {checked: false, quantity: 1}, outing: {checked: false, quantity: 1}, nursery: {checked: false, quantity: 1} } }
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

// 持っていくものリストの人物タブを切り替え
function selectPackingPersonTab(person) {
    currentPackingPersonTab = person;

    // ボタンのアクティブ状態を更新
    document.querySelectorAll('.packing-person-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.packing-person-tab[data-person="${person}"]`)?.classList.add('active');

    renderChecklist();
}

// チェックリストを表示
function renderChecklist() {
    const packingList = document.getElementById('packingList');
    const allItemsList = document.getElementById('allItemsList');
    const emptyMessage = document.getElementById('packingEmptyMessage');

    if (!packingList || !allItemsList) return;

    // 現在のカテゴリでチェックされているアイテム
    let checkedItems = checklistItems.filter(item => item.categories[currentCategory]?.checked);

    // 持っていくものリストを人物タブでフィルタリング
    if (currentPackingPersonTab !== 'all') {
        checkedItems = checkedItems.filter(item => item.person === currentPackingPersonTab);
    }

    // 人物フィルターでフィルタリングされたアイテム（アイテム一覧用）
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
            const quantity = item.categories[currentCategory]?.quantity || 1;
            return `
                <div class="checklist-item">
                    <input type="checkbox"
                           id="packing_${realIndex}"
                           checked
                           onchange="toggleChecklistItem(${realIndex})">
                    <label for="packing_${realIndex}">${getPersonLabel(item.person)} ${item.name}</label>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="changeQuantity(${realIndex}, -1)">−</button>
                        <span class="quantity-display">×${quantity}</span>
                        <button class="quantity-btn" onclick="changeQuantity(${realIndex}, 1)">+</button>
                    </div>
                    <button class="remove-btn" onclick="removeChecklistItem(${realIndex})">🗑️</button>
                </div>
            `;
        }).join('');
    }

    // 全アイテムリスト（人物フィルター適用）
    allItemsList.innerHTML = filteredItems.map((item) => {
        const realIndex = checklistItems.findIndex(i => i.name === item.name && i.person === item.person);
        const isChecked = item.categories[currentCategory]?.checked;
        const quantity = item.categories[currentCategory]?.quantity || 1;
        return `
            <div class="checklist-item">
                <input type="checkbox"
                       id="all_${realIndex}"
                       ${isChecked ? 'checked' : ''}
                       onchange="toggleChecklistItem(${realIndex})">
                <label for="all_${realIndex}">${getPersonLabel(item.person)} ${item.name}</label>
                ${isChecked ? `
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="changeQuantity(${realIndex}, -1)">−</button>
                        <span class="quantity-display">×${quantity}</span>
                        <button class="quantity-btn" onclick="changeQuantity(${realIndex}, 1)">+</button>
                    </div>
                ` : ''}
                <button class="remove-btn" onclick="removeChecklistItem(${realIndex})">🗑️</button>
            </div>
        `;
    }).join('');
}

// チェック状態を切り替え
async function toggleChecklistItem(index) {
    const currentState = checklistItems[index].categories[currentCategory];

    if (currentState?.checked) {
        // チェックを外す
        checklistItems[index].categories[currentCategory] = { checked: false, quantity: 1 };
    } else {
        // チェックを入れる
        checklistItems[index].categories[currentCategory] = { checked: true, quantity: currentState?.quantity || 1 };
    }

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('チェック状態保存エラー:', error);
        alert('保存に失敗しました');
    }
}

// 数量を変更
async function changeQuantity(index, delta) {
    const currentState = checklistItems[index].categories[currentCategory];
    if (!currentState?.checked) return;

    const newQuantity = Math.max(1, (currentState.quantity || 1) + delta);
    checklistItems[index].categories[currentCategory].quantity = newQuantity;

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('数量変更エラー:', error);
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
        categories: {
            travel: { checked: false, quantity: 1 },
            outing: { checked: false, quantity: 1 },
            nursery: { checked: false, quantity: 1 }
        }
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
