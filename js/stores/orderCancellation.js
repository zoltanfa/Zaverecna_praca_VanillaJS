import {doc, runTransaction, serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
import { db } from '../firebase.js';

const DEFAULT_CANCELLABLE_STATUSES = ['Created', 'Processed'];

export async function cancelOrderWithRestock({
  orderId,
  cancellableStatuses = DEFAULT_CANCELLABLE_STATUSES
}) {
  if (!orderId) {
    throw new Error('Order ID is required.');
  }

  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnapshot = await transaction.get(orderRef);

    if (!orderSnapshot.exists()) {
      throw new Error('Order not found.');
    }

    const latestOrder = orderSnapshot.data();
    const latestStatus = latestOrder?.status || 'Created';

    if (!cancellableStatuses.includes(latestStatus)) {
      throw new Error('Order can no longer be cancelled.');
    }

    const items = Array.isArray(latestOrder?.items) ? latestOrder.items : [];
    const productReads = [];

    for (const item of items) {
      const productRef = doc(db, 'products', String(item.id));
      const productSnapshot = await transaction.get(productRef);
      productReads.push({ item, productRef, productSnapshot });
    }

    for (const { item, productRef, productSnapshot } of productReads) {
      if (!productSnapshot.exists()) {
        continue;
      }

      const currentStock = productSnapshot.data()?.stock;
      if (typeof currentStock !== 'number') {
        continue;
      }

      const quantityToRestore = Math.max(0, Number(item?.quantity) || 0);
      if (quantityToRestore === 0) {
        continue;
      }

      transaction.update(productRef, {
        stock: currentStock + quantityToRestore
      });
    }

    transaction.update(orderRef, {
      status: 'Cancelled',
      updatedAt: serverTimestamp()
    });
  });
}
