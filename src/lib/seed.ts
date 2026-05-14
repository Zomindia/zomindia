import { db, auth } from './firebase';
import { collection, addDoc, getDocs, query, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestore-errors';

const CATEGORIES = [
  { name: 'Cleaning', icon: 'Sparkles', description: 'Deep cleaning, sofa & carpet' },
  { name: 'Repairs', icon: 'Wrench', description: 'Plumbing, Electrician, Carpenter' },
  { name: 'Appliance', icon: 'Smartphone', description: 'AC, TV, Refrigerator, RO' },
  { name: 'Painting', icon: 'PaintBucket', description: 'Full house painting' },
  { name: 'Beauty', icon: 'Sparkles', description: 'Salon at home for women' },
];

export async function seedDatabase() {
  if (!auth.currentUser || auth.currentUser.email !== 'sarthakwebtech@gmail.com') {
    return;
  }

  const path = 'categories';
  try {
    const catsSnap = await getDocs(query(collection(db, path), limit(1)));
    if (!catsSnap.empty) return; // Already seeded

    console.log('Seeding database...');
    for (const cat of CATEGORIES) {
      const catRef = await addDoc(collection(db, 'categories'), cat);
      
      // Add sub-services
      if (cat.name === 'Cleaning') {
         await addDoc(collection(db, 'services'), {
           categoryId: catRef.id,
           name: 'Full Home Cleaning',
           description: 'Deep cleaning of all rooms, balcony and kitchen.',
           basePrice: 120,
           duration: '4-5 Hours'
         });
         await addDoc(collection(db, 'services'), {
           categoryId: catRef.id,
           name: 'Bathroom Cleaning',
           description: 'Sparkling clean bathroom with specialized chemicals.',
           basePrice: 40,
           duration: '1-2 Hours'
         });
      }
    }
  } catch (err) {
    console.warn('Seeding issue:', err);
    // Silent fail for seeding as it's a dev utility
  }
}
