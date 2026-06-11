import { doc, updateDoc, collection, addDoc, getDoc } from 'firebase/firestore';

export interface OfflineAction {
  id: string;
  type: 'UPDATE_BOOKING_STATUS' | 'ADD_ADDITIONAL_CHARGE' | 'UPDATE_PARTNER_AVAILABILITY' | 'REGISTER_AMC_LEAD';
  path: string; // e.g., 'bookings/123'
  payload: any;
  timestamp: number;
}

class OfflineSyncEngine {
  private queue: OfflineAction[] = [];
  private db: any = null;
  private listeners: ((queueSize: number) => void)[] = [];

  constructor() {
    this.loadQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.syncPendingActions());
      window.addEventListener('offline', () => this.notifyListeners());
    }
  }

  public setDb(db: any) {
    this.db = db;
    // Attempt initial sync if online
    if (this.isOnline()) {
      this.syncPendingActions();
    }
  }

  public isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  private loadQueue() {
    try {
      const saved = localStorage.getItem('zomindia_offline_queue');
      if (saved) {
        this.queue = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load offline actions:', e);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem('zomindia_offline_queue', JSON.stringify(this.queue));
      this.notifyListeners();
    } catch (e) {
      console.error('Failed to save offline actions:', e);
    }
  }

  public getQueueSize(): number {
    return this.queue.length;
  }

  public subscribe(listener: (queueSize: number) => void) {
    this.listeners.push(listener);
    listener(this.queue.length);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.queue.length));
  }

  /**
   * Enqueues a Firestore write when offline. If online, executes it directly.
   */
  public async executeWrite(
    type: OfflineAction['type'],
    path: string,
    payload: any,
    fallbackExec: () => Promise<any>
  ): Promise<any> {
    if (this.isOnline()) {
      try {
        const res = await fallbackExec();
        return res;
      } catch (err: any) {
        // If write fails due to network, fall back to offline queuing
        if (err.message && (err.message.includes('network') || err.message.includes('offline') || err.message.includes('permission'))) {
          console.warn('[Offline Queue] Network failed. Queuing action: ', type);
        } else {
          throw err;
        }
      }
    }

    // Capture offline write request
    const action: OfflineAction = {
      id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      path,
      payload,
      timestamp: Date.now()
    };

    this.queue.push(action);
    this.saveQueue();
    console.log(`[Offline Queue] Enqueued offline action: ${type} targeting ${path}`);
    return { offlineQueued: true, actionId: action.id };
  }

  /**
   * Synchronizes all pending actions to Firestore
   */
  public async syncPendingActions() {
    if (!this.db || this.queue.length === 0 || !this.isOnline()) return;

    console.log(`[Offline Queue] Connection restored! Synchronizing ${this.queue.length} pending operations...`);
    const actionsToSync = [...this.queue];
    this.queue = [];
    this.saveQueue();

    for (const action of actionsToSync) {
      try {
        const [collectionName, docId] = action.path.split('/');
        
        switch (action.type) {
          case 'UPDATE_BOOKING_STATUS': {
            const docRef = doc(this.db, collectionName, docId);
            await updateDoc(docRef, {
              ...action.payload,
              updatedAt: new Date()
            });
            break;
          }
          case 'ADD_ADDITIONAL_CHARGE': {
            const docRef = doc(this.db, collectionName, docId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const currentData = docSnap.data();
              const existingCharges = currentData.additionalCharges || [];
              const finalPrice = Number(currentData.totalPrice || 0) + Number(action.payload.amount);
              
              await updateDoc(docRef, {
                additionalCharges: [...existingCharges, {
                  amount: action.payload.amount,
                  reason: action.payload.reason,
                  createdAt: new Date().toISOString()
                }],
                totalPrice: finalPrice,
                paymentStatus: "unpaid",
                updatedAt: new Date()
              });
            }
            break;
          }
          case 'UPDATE_PARTNER_AVAILABILITY': {
            const docRef = doc(this.db, collectionName, docId);
            await updateDoc(docRef, {
              availabilityStatus: action.payload,
              updatedAt: new Date()
            });
            break;
          }
          case 'REGISTER_AMC_LEAD': {
            await addDoc(collection(this.db, 'amcs'), {
              ...action.payload,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            break;
          }
        }
        console.log(`[Offline Queue] Synced action ${action.id} successfully.`);
      } catch (err) {
        console.error(`[Offline Queue] Failed to sync action ${action.id}:`, err);
        // Put back in queue to retry later
        this.queue.unshift(action);
        this.saveQueue();
        break; // Stop further synchronization to preserve action order
      }
    }
  }
}

export const offlineSyncEngine = new OfflineSyncEngine();
