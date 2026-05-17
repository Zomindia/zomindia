import { db, auth } from './firebase';
import { collection, addDoc, getDocs, query, limit, doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestore-errors';

const CATEGORIES = [
  { name: 'Cleaning', icon: 'Sparkles', description: 'Deep cleaning, sofa & carpet' },
  { name: 'Repairs', icon: 'Wrench', description: 'Plumbing, Electrician, Carpenter' },
  { name: 'Appliance', icon: 'Smartphone', description: 'AC, TV, Refrigerator, RO' },
  { name: 'Painting', icon: 'PaintBucket', description: 'Full house painting' },
  { name: 'Beauty', icon: 'Sparkles', description: 'Salon at home for women' },
  { name: 'Appliance Repair', icon: 'Smartphone', description: 'Repair services for electronics, home appliances, and gadgets' },
  { name: 'Phone Repair', icon: 'Smartphone', description: 'Expert repair services for all smartphone brands' },
];

export async function seedDatabase() {
  if (!auth.currentUser || auth.currentUser.email !== 'sarthakwebtech@gmail.com') {
    return;
  }

  try {
    // Seed Categories
    const catsSnap = await getDocs(collection(db, 'categories'));
    if (catsSnap.empty) {
      console.log('Seeding categories...');
      for (const cat of CATEGORIES) {
        if (cat.name === 'Phone Repair') {
           // Use explicit ID as requested by user
           await setDoc(doc(db, 'categories', 'Phone Repair'), cat);
        } else {
           await addDoc(collection(db, 'categories'), cat);
        }
      }
    }

    // Seed Services
    const servicesSnap = await getDocs(collection(db, 'services'));
    if (servicesSnap.empty) {
       console.log('Seeding services...');
       const allCats = await getDocs(collection(db, 'categories'));
       const catMap: Record<string, string> = {};
       allCats.forEach(d => catMap[d.data().name] = d.id);

       const cleaningId = catMap['Cleaning'];
       if (cleaningId) {
          await addDoc(collection(db, 'services'), {
            categoryId: cleaningId,
            name: 'Full Home Cleaning',
            description: 'Deep cleaning of all rooms, balcony and kitchen.',
            basePrice: 120,
            duration: '4-5 Hours'
          });
          await addDoc(collection(db, 'services'), {
            categoryId: cleaningId,
            name: 'Bathroom Cleaning',
            description: 'Sparkling clean bathroom with specialized chemicals.',
            basePrice: 40,
            duration: '1-2 Hours'
          });
       }

       // Add requested service
       // We can use catMap['Phone Repair'] or the hardcoded 'Phone Repair' ID
       await addDoc(collection(db, 'services'), {
          categoryId: 'Phone Repair',
          name: 'Screen Replacement',
          description: 'Replacement of cracked phone screens for all major brands.',
          basePrice: 2500,
          duration: '2 Hours',
          imageURL: 'https://example.com/images/screen-replacement.jpg',
          rating: 4.9,
          reviewCount: 120
       });
    }

    // Seed Promotions
    const promoSnap = await getDocs(collection(db, 'promotions'));
    if (promoSnap.empty) {
       console.log('Seeding promotions...');
       await addDoc(collection(db, 'promotions'), {
          name: 'First Timer Discount',
          code: 'WELCOME10',
          discountType: 'percent',
          discountValue: 10,
          description: 'Get 10% off your first service booking.',
          active: true,
          applicableCategories: [], // Applicable to all
          createdAt: new Date().toISOString()
       });
    }

    // Seed FAQs
    const faqSnap = await getDocs(collection(db, 'faqs'));
    if (faqSnap.empty) {
       console.log('Seeding FAQs...');
       await addDoc(collection(db, 'faqs'), {
          question: 'What if my service partner is late?',
          answer: 'Our partners strive for punctuality. If a delay occurs, you will be notified and can contact support. We offer compensation for significant delays.',
          category: 'General',
          order: 1,
          isPublished: true,
          createdAt: new Date().toISOString()
       });
    }

  } catch (err) {
    console.warn('Seeding issue:', err);
  }
}
