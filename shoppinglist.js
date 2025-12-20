// ==========================================
// 買い物リスト機能
// ==========================================

let shoppingItems = [];
let shoppingListUnsubscribe = null;

// モード管理
let isShoppingEditMode = false;
let isShoppingDeleteMode = false;
let isShoppingReorderMode = false;

// データをリアルタイムで読み込み
function loadShoppingList() {
    try {
        // 既存のリスナーがあれば解除
        if (shoppingListUnsubscribe) {
            shoppingListUnsubscribe();
        }

        // リアルタイム更新を監視
        shoppingListUnsubscribe = db.collection('shoppingList')
            .orderBy('order', 'asc')
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                shoppingItems = [];
                snapshot.forEach((doc) => {
                    shoppingItems.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                renderShoppingList();
            }, (error) => {
                console.error('買い物リスト読み込みエラー:', error);
            });
    } catch (error) {
        console.error('買い物リスト読み込みエラー:', error);
    }
}

// 買い物リストを表示
function renderShoppingList() {
    const container = document.getElementById('shoppingListContainer');
    if (!container) return;

    if (shoppingItems.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #999;">まだアイテムがありません</div>';
        return;
    }

    // 通常モード
    if (!isShoppingEditMode && !isShoppingDeleteMode && !isShoppingReorderMode) {
        const html = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
                ${shoppingItems.map(item => `
                    <div onclick="togglePurchased('${item.id}')" class="shopping-item" style="padding: 0.75rem; background: ${item.purchased ? '#10B981' : 'white'}; border-radius: 0.5rem; border: 2px solid ${item.purchased ? '#10B981' : '#E5E7EB'}; cursor: pointer; transition: all 0.2s; text-align: center;">
                        <div style="font-weight: 600; font-size: 0.9rem; color: ${item.purchased ? 'white' : '#1F2937'}; margin-bottom: 0.25rem; ${item.purchased ? 'text-decoration: line-through;' : ''}\">${item.name}</div>
                        <div style="font-size: 0.75rem; color: ${item.purchased ? 'rgba(255,255,255,0.8)' : '#6B7280'};">${item.quantity || 1} ${item.unit || '個'}</div>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
    }
    // 編集モード
    else if (isShoppingEditMode) {
        const html = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
                ${shoppingItems.map(item => `
                    <div onclick="editShoppingItem('${item.id}')" class="shopping-item" style="padding: 0.75rem; background: ${item.purchased ? '#D1FAE5' : '#F3F4F6'}; border-radius: 0.5rem; border: 2px solid #9CA3AF; cursor: pointer; transition: all 0.2s; text-align: center;">
                        <div style="font-weight: 600; font-size: 0.9rem; color: #1F2937; margin-bottom: 0.25rem; ${item.purchased ? 'text-decoration: line-through;' : ''}\">${item.name}</div>
                        <div style="font-size: 0.75rem; color: #6B7280;">${item.quantity || 1} ${item.unit || '個'}</div>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
    }
    // 削除モード
    else if (isShoppingDeleteMode) {
        const html = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
                ${shoppingItems.map(item => `
                    <div class="shopping-item" style="padding: 0.75rem; background: ${item.purchased ? '#D1FAE5' : '#F3F4F6'}; border-radius: 0.5rem; border: 2px solid #9CA3AF; position: relative; text-align: center;">
                        <div style="font-weight: 600; font-size: 0.9rem; color: #1F2937; margin-bottom: 0.25rem; ${item.purchased ? 'text-decoration: line-through;' : ''}\">${item.name}</div>
                        <div style="font-size: 0.75rem; color: #6B7280;">${item.quantity || 1} ${item.unit || '個'}</div>
                        <button onclick="deleteShoppingItem('${item.id}')" style="position: absolute; top: 50%; right: 0.5rem; transform: translateY(-50%); background: #EF4444; color: white; border: none; border-radius: 0.25rem; width: 1.5rem; height: 1.5rem; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='#DC2626'" onmouseout="this.style.background='#EF4444'">🗑️</button>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
    }
    // 並び替えモード
    else if (isShoppingReorderMode) {
        const html = `
            <div style="display: grid; gap: 0.5rem;">
                ${shoppingItems.map((item, index) => `
                    <div class="shopping-item" style="padding: 0.75rem; background: #F3F4F6; border-radius: 0.5rem; border: 2px solid #9CA3AF; display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 0.9rem; color: #1F2937; ${item.purchased ? 'text-decoration: line-through;' : ''}\">${item.name}</div>
                            <div style="font-size: 0.75rem; color: #6B7280;">${item.quantity || 1} ${item.unit || '個'}</div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            ${index > 0 ? `<button onclick="moveShoppingItem('${item.id}', 'up')" style="background: #3B82F6; color: white; border: none; border-radius: 0.25rem; width: 2rem; height: 1.5rem; cursor: pointer; font-size: 0.875rem;">▲</button>` : '<div style="width: 2rem; height: 1.5rem;"></div>'}
                            ${index < shoppingItems.length - 1 ? `<button onclick="moveShoppingItem('${item.id}', 'down')" style="background: #3B82F6; color: white; border: none; border-radius: 0.25rem; width: 2rem; height: 1.5rem; cursor: pointer; font-size: 0.875rem;">▼</button>` : '<div style="width: 2rem; height: 1.5rem;"></div>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
    }
}

// 編集モードトグル
function toggleShoppingEditMode() {
    isShoppingEditMode = !isShoppingEditMode;
    isShoppingDeleteMode = false;
    isShoppingReorderMode = false;
    renderShoppingList();
}

// 削除モードトグル
function toggleShoppingDeleteMode() {
    isShoppingDeleteMode = !isShoppingDeleteMode;
    isShoppingEditMode = false;
    isShoppingReorderMode = false;
    renderShoppingList();
}

// 並び替えモードトグル
function toggleShoppingReorderMode() {
    isShoppingReorderMode = !isShoppingReorderMode;
    isShoppingEditMode = false;
    isShoppingDeleteMode = false;
    renderShoppingList();
}

// アイテムを追加
async function addShoppingItem() {
    const nameInput = document.getElementById('shoppingItemName');
    const name = nameInput.value.trim();

    if (!name) {
        alert('商品名を入力してください');
        return;
    }

    try {
        // 最大のorder値を取得
        const maxOrder = shoppingItems.length > 0 ? Math.max(...shoppingItems.map(item => item.order || 0)) : 0;

        await db.collection('shoppingList').add({
            name: name,
            quantity: 1,
            unit: '個',
            purchased: false,
            order: maxOrder + 1,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // フォームをリセット
        nameInput.value = '';
    } catch (error) {
        console.error('アイテム追加エラー:', error);
        alert('追加に失敗しました');
    }
}

// 購入済みトグル
async function togglePurchased(itemId) {
    const item = shoppingItems.find(i => i.id === itemId);
    if (!item) return;

    try {
        await db.collection('shoppingList').doc(itemId).update({
            purchased: !item.purchased
        });
    } catch (error) {
        console.error('更新エラー:', error);
    }
}

// アイテムを編集
let editingItemId = null;
function editShoppingItem(itemId) {
    const item = shoppingItems.find(i => i.id === itemId);
    if (!item) return;

    editingItemId = itemId;
    document.getElementById('editShoppingItemName').value = item.name;
    document.getElementById('editShoppingItemQuantity').value = item.quantity || 1;
    document.getElementById('editShoppingItemUnit').value = item.unit || '個';

    const modal = document.getElementById('editShoppingItemModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeEditShoppingItemModal() {
    const modal = document.getElementById('editShoppingItemModal');
    if (modal) {
        modal.style.display = 'none';
    }
    editingItemId = null;
}

async function saveEditedShoppingItem() {
    if (!editingItemId) return;

    const name = document.getElementById('editShoppingItemName').value.trim();
    const quantity = parseInt(document.getElementById('editShoppingItemQuantity').value) || 1;
    const unit = document.getElementById('editShoppingItemUnit').value.trim() || '個';

    if (!name) {
        alert('商品名を入力してください');
        return;
    }

    try {
        await db.collection('shoppingList').doc(editingItemId).update({
            name: name,
            quantity: quantity,
            unit: unit
        });
        closeEditShoppingItemModal();
    } catch (error) {
        console.error('更新エラー:', error);
        alert('更新に失敗しました');
    }
}

// アイテムを削除
async function deleteShoppingItem(itemId) {
    if (!confirm('このアイテムを削除しますか？')) return;

    try {
        await db.collection('shoppingList').doc(itemId).delete();
    } catch (error) {
        console.error('削除エラー:', error);
        alert('削除に失敗しました');
    }
}

// アイテムを移動
async function moveShoppingItem(itemId, direction) {
    const currentIndex = shoppingItems.findIndex(i => i.id === itemId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= shoppingItems.length) return;

    const currentItem = shoppingItems[currentIndex];
    const targetItem = shoppingItems[targetIndex];

    try {
        const batch = db.batch();

        // order値を入れ替え
        const currentOrder = currentItem.order || currentIndex;
        const targetOrder = targetItem.order || targetIndex;

        batch.update(db.collection('shoppingList').doc(currentItem.id), { order: targetOrder });
        batch.update(db.collection('shoppingList').doc(targetItem.id), { order: currentOrder });

        await batch.commit();
    } catch (error) {
        console.error('並び替えエラー:', error);
        alert('並び替えに失敗しました');
    }
}

// 初期化
function initializeShoppingList() {
    loadShoppingList();
}
