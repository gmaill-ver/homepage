// ==========================================
// 買い物リスト機能
// ==========================================

let shoppingItems = [];
let shoppingListUnsubscribe = null;

// データをリアルタイムで読み込み
function loadShoppingList() {
    try {
        // 既存のリスナーがあれば解除
        if (shoppingListUnsubscribe) {
            shoppingListUnsubscribe();
        }

        // リアルタイム更新を監視
        shoppingListUnsubscribe = db.collection('shoppingList')
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

    const html = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
            ${shoppingItems.map(item => `
                <div onclick="togglePurchased('${item.id}')" class="shopping-item" style="padding: 0.75rem; background: ${item.purchased ? '#10B981' : 'white'}; border-radius: 0.5rem; border: 2px solid ${item.purchased ? '#10B981' : '#E5E7EB'}; cursor: pointer; transition: all 0.2s; text-align: center;">
                    <div style="font-weight: 600; font-size: 0.9rem; color: ${item.purchased ? 'white' : '#1F2937'}; margin-bottom: 0.25rem; ${item.purchased ? 'text-decoration: line-through;' : ''}">${item.name}</div>
                    <div style="font-size: 0.75rem; color: ${item.purchased ? 'rgba(255,255,255,0.8)' : '#6B7280'};">${item.quantity} ${item.unit || '個'}</div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;
}

// アイテムを追加
async function addShoppingItem() {
    const nameInput = document.getElementById('shoppingItemName');
    const quantityInput = document.getElementById('shoppingItemQuantity');
    const unitInput = document.getElementById('shoppingItemUnit');

    const name = nameInput.value.trim();
    const quantity = parseInt(quantityInput.value) || 1;
    const unit = unitInput.value.trim() || '個';

    if (!name) {
        alert('商品名を入力してください');
        return;
    }

    try {
        await db.collection('shoppingList').add({
            name: name,
            quantity: quantity,
            unit: unit,
            purchased: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // フォームをリセット
        nameInput.value = '';
        quantityInput.value = '1';
        unitInput.value = '個';
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
    document.getElementById('editShoppingItemQuantity').value = item.quantity;
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

// 購入済みアイテムを一括削除
async function clearPurchasedItems() {
    const purchasedItems = shoppingItems.filter(item => item.purchased);

    if (purchasedItems.length === 0) {
        alert('購入済みのアイテムがありません');
        return;
    }

    if (!confirm(`購入済みの${purchasedItems.length}件のアイテムを削除しますか？`)) return;

    try {
        const batch = db.batch();
        purchasedItems.forEach(item => {
            const docRef = db.collection('shoppingList').doc(item.id);
            batch.delete(docRef);
        });
        await batch.commit();
    } catch (error) {
        console.error('一括削除エラー:', error);
        alert('削除に失敗しました');
    }
}

// 初期化
function initializeShoppingList() {
    loadShoppingList();
}
