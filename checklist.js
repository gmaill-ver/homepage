// ==========================================
// 持ち物チェックリスト機能
// ==========================================

let checklistItems = []; // 全アイテムリスト { name, person, categories: {travel: {checked: false, quantity: 1, packed: false}, outing: {...}, nursery: {...}} }
let currentCategory = 'travel'; // 現在選択中のカテゴリ
let currentPersonFilter = 'all'; // 現在選択中の人物フィルター（アイテム一覧用）
let currentPackingPersonTab = 'all'; // 現在選択中の人物タブ（持っていくものリスト用）

// カテゴリの定義
let categories = [
    { id: 'travel', icon: '✈️', name: '旅行' },
    { id: 'outing', icon: '🚶', name: '通常外出' },
    { id: 'nursery', icon: '🏫', name: '保育園' }
];

// 人物名のマッピング
const personNames = {
    'me': 'しでき',
    'wife': 'あゆ',
    'son': '翔真',
    'common': '共通'
};

// カテゴリを読み込み
async function loadCategories() {
    try {
        const doc = await db.collection('settings').doc('checklistCategories').get();
        if (doc.exists) {
            categories = doc.data().categories || categories;
        }
    } catch (error) {
        console.error('カテゴリ読み込みエラー:', error);
    }
}

// アイテムを読み込み
async function loadChecklistItems() {
    try {
        // カテゴリを先に読み込み
        await loadCategories();

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

                // すべてのカテゴリを確保
                const itemCategories = {};

                for (const category of categories) {
                    const catId = category.id;
                    const value = item.categories[catId];

                    if (typeof value === 'boolean') {
                        // 旧形式: boolean → 新形式: {checked, quantity, packed}
                        itemCategories[catId] = { checked: value, quantity: 1, packed: false };
                        needsMigration = true;
                    } else if (value && typeof value === 'object' && 'checked' in value) {
                        // 新形式: そのまま使用（packedがない場合は追加）
                        itemCategories[catId] = {
                            checked: value.checked,
                            quantity: value.quantity || 1,
                            packed: value.packed || false
                        };
                        if (!('packed' in value)) needsMigration = true;
                    } else {
                        // 不正なデータまたは存在しない: 初期化
                        itemCategories[catId] = { checked: false, quantity: 1, packed: false };
                        needsMigration = true;
                    }
                }

                item.categories = itemCategories;

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
            // デフォルトアイテム（すべてのカテゴリに対応）
            const defaultCats = {};
            categories.forEach(cat => {
                defaultCats[cat.id] = { checked: false, quantity: 1, packed: false };
            });

            checklistItems = [
                { name: '水筒', person: 'common', categories: {...defaultCats} },
                { name: 'タオル', person: 'common', categories: {...defaultCats} },
                { name: '帽子', person: 'son', categories: {...defaultCats} },
                { name: '着替え', person: 'son', categories: {...defaultCats} },
                { name: 'おむつ', person: 'son', categories: {...defaultCats} },
                { name: 'おしりふき', person: 'son', categories: {...defaultCats} },
                { name: 'ビニール袋', person: 'common', categories: {...defaultCats} },
                { name: '日焼け止め', person: 'common', categories: {...defaultCats} }
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
            const packed = item.categories[currentCategory]?.packed || false;
            return `
                <div class="checklist-item">
                    <input type="checkbox"
                           id="packing_${realIndex}"
                           ${packed ? 'checked' : ''}
                           onchange="togglePackedStatus(${realIndex})">
                    <label for="packing_${realIndex}">${getPersonLabel(item.person)} ${item.name}</label>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="changeQuantity(${realIndex}, -1)">−</button>
                        <span class="quantity-display">×${quantity}</span>
                        <button class="quantity-btn" onclick="changeQuantity(${realIndex}, 1)">+</button>
                    </div>
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

// チェック状態を切り替え（アイテム一覧用）
async function toggleChecklistItem(index) {
    const currentState = checklistItems[index].categories[currentCategory];

    if (currentState?.checked) {
        // チェックを外す（持っていくものリストから削除）
        checklistItems[index].categories[currentCategory] = { checked: false, quantity: 1, packed: false };
    } else {
        // チェックを入れる（持っていくものリストに追加）
        checklistItems[index].categories[currentCategory] = {
            checked: true,
            quantity: currentState?.quantity || 1,
            packed: false
        };
    }

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('チェック状態保存エラー:', error);
        alert('保存に失敗しました');
    }
}

// 準備完了状態を切り替え（持っていくものリスト用）
async function togglePackedStatus(index) {
    const currentState = checklistItems[index].categories[currentCategory];
    if (!currentState?.checked) return;

    checklistItems[index].categories[currentCategory].packed = !currentState.packed;

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('準備完了状態保存エラー:', error);
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

    // すべてのカテゴリに対応
    const newItemCategories = {};
    categories.forEach(cat => {
        newItemCategories[cat.id] = { checked: false, quantity: 1, packed: false };
    });

    checklistItems.push({
        name: name,
        person: person,
        categories: newItemCategories
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

// カテゴリボタンを描画
function renderCategoryButtons() {
    const container = document.getElementById('categoryButtonsContainer');
    if (!container) return;

    container.innerHTML = categories.map(cat => `
        <button class="category-btn ${cat.id === currentCategory ? 'active' : ''}"
                data-category="${cat.id}"
                onclick="selectCategory('${cat.id}')">
            ${cat.icon} ${cat.name}
        </button>
    `).join('');
}

// カテゴリ編集モーダルを描画
function renderCategoryEditModal() {
    const categoryList = document.getElementById('categoryList');
    if (!categoryList) return;

    categoryList.innerHTML = categories.map((cat, index) => `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.75rem; background: #F9FAFB; border-radius: 0.5rem;">
            <span style="font-size: 1.5rem;">${cat.icon}</span>
            <span style="flex: 1; font-weight: 500;">${cat.name}</span>
            <button onclick="removeCategory(${index})" class="remove-btn" style="opacity: 1;">🗑️</button>
        </div>
    `).join('');
}

// カテゴリを追加
async function addCategory() {
    const iconInput = document.getElementById('newCategoryIcon');
    const nameInput = document.getElementById('newCategoryName');

    const icon = iconInput.value.trim() || '📝';
    const name = nameInput.value.trim();

    if (!name) {
        alert('カテゴリ名を入力してください');
        return;
    }

    // 一意のIDを生成
    const id = 'cat_' + Date.now();

    categories.push({ id, icon, name });

    // すべてのアイテムに新しいカテゴリを追加
    checklistItems.forEach(item => {
        if (!item.categories[id]) {
            item.categories[id] = { checked: false, quantity: 1, packed: false };
        }
    });

    try {
        await db.collection('settings').doc('checklistCategories').set({ categories });
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });

        iconInput.value = '';
        nameInput.value = '';

        renderCategoryButtons();
        renderCategoryEditModal();
        renderChecklist();
    } catch (error) {
        console.error('カテゴリ追加エラー:', error);
        alert('追加に失敗しました');
    }
}

// カテゴリを削除
async function removeCategory(index) {
    const cat = categories[index];

    if (!confirm(`「${cat.name}」カテゴリを削除しますか？\nこのカテゴリのチェック情報も削除されます。`)) {
        return;
    }

    const catId = cat.id;
    categories.splice(index, 1);

    // すべてのアイテムからこのカテゴリを削除
    checklistItems.forEach(item => {
        delete item.categories[catId];
    });

    // 削除したカテゴリが選択中だった場合は最初のカテゴリに切り替え
    if (currentCategory === catId && categories.length > 0) {
        currentCategory = categories[0].id;
    }

    try {
        await db.collection('settings').doc('checklistCategories').set({ categories });
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });

        renderCategoryButtons();
        renderCategoryEditModal();
        renderChecklist();
    } catch (error) {
        console.error('カテゴリ削除エラー:', error);
        alert('削除に失敗しました');
    }
}

// チェックリスト機能の初期化
async function initializeChecklist() {
    await loadChecklistItems();
    renderCategoryButtons();
    renderChecklist();

    // モーダルを開いた時にカテゴリ一覧を更新
    const categoryEditModal = document.getElementById('categoryEditModal');
    if (categoryEditModal) {
        categoryEditModal.addEventListener('click', (e) => {
            if (e.target === categoryEditModal) return;
            renderCategoryEditModal();
        });
    }
}
