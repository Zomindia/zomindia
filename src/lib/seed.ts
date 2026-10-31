import { db, auth } from './firebase';
import { collection, addDoc, getDocs, doc, setDoc } from 'firebase/firestore';
import { DEFAULT_CATEGORIES, DEFAULT_SERVICES, healFirestoreCatalogIfNeeded } from '../data/services';

export async function seedDatabase() {
  if (!auth.currentUser || auth.currentUser.email !== 'sarthakwebtech@gmail.com') {
    return;
  }

  try {
    // Seed Categories
    const catsSnap = await getDocs(collection(db, 'categories'));
    if (catsSnap.empty) {
      console.log('Seeding categories...');
      for (const cat of DEFAULT_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), {
          name: cat.name,
          icon: cat.icon,
          description: cat.description,
          imageURL: cat.imageURL || '',
        });
      }
    }

    // Seed Services
    const servicesSnap = await getDocs(collection(db, 'services'));
    if (servicesSnap.empty) {
      console.log('Seeding services...');
      for (const svc of DEFAULT_SERVICES) {
        await setDoc(doc(db, 'services', svc.id), svc);
      }
    } else {
      const currentCats = catsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const currentSvcs = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      await healFirestoreCatalogIfNeeded(currentCats, currentSvcs);
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

    // Seed Banners
    const bannersSnap = await getDocs(collection(db, 'banners'));
    if (bannersSnap.empty) {
      console.log('Seeding initial hero banners...');
      const allCats = await getDocs(collection(db, 'categories'));
      const catMap: Record<string, { id: string; name: string }> = {};
      allCats.forEach((d) => {
        const catData = d.data();
        catMap[catData.name] = { id: d.id, name: catData.name };
      });

      const findCat = (keyword: string) => {
        const key = Object.keys(catMap).find((k) => k.toLowerCase().includes(keyword.toLowerCase()));
        return key ? catMap[key] : null;
      };

      const acCat = findCat('ac') || { id: 'ac', name: 'AC Repair & Service' };
      const washingCat = findCat('wash') || { id: 'washing', name: 'Washing Machine' };
      const roCat = findCat('ro') || { id: 'ro', name: 'RO Water Purifier' };
      const fridgeCat = findCat('refrigerat') || findCat('fridge') || { id: 'fridge', name: 'Refrigerator' };

      const INITIAL_BANNERS = [
        {
          title: 'AC Jet Service & Repair',
          subtitle: 'Deep anti-bacterial foam cleaning • 45 min doorstep service',
          badge: 'SUMMER SPECIAL • 20% OFF',
          imageURL: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80',
          targetType: 'category',
          categoryId: acCat.id,
          categoryName: acCat.name,
          order: 1,
          isActive: true,
          active: true,
          createdAt: new Date().toISOString(),
        },
        {
          title: 'Washing Machine Checkup',
          subtitle: 'Motor, drum & spin drainage repair • 30-day warranty',
          badge: 'FLAT ₹99 OFF',
          imageURL: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=80',
          targetType: 'category',
          categoryId: washingCat.id,
          categoryName: washingCat.name,
          order: 2,
          isActive: true,
          active: true,
          createdAt: new Date().toISOString(),
        },
        {
          title: 'RO Water Purifier Service',
          subtitle: 'Genuine membrane replacement & multi-stage TDS calibration',
          badge: 'VERIFIED HOME SERVICES',
          imageURL: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=1200&q=80',
          targetType: 'category',
          categoryId: roCat.id,
          categoryName: roCat.name,
          order: 3,
          isActive: true,
          active: true,
          createdAt: new Date().toISOString(),
        },
        {
          title: 'Refrigerator Maintenance',
          subtitle: 'Cooling coil, thermostat & compressor diagnostics at doorstep',
          badge: 'INDORE CERTIFIED',
          imageURL: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=1200&q=80',
          targetType: 'category',
          categoryId: fridgeCat.id,
          categoryName: fridgeCat.name,
          order: 4,
          isActive: true,
          active: true,
          createdAt: new Date().toISOString(),
        },
      ];

      for (const banner of INITIAL_BANNERS) {
        await addDoc(collection(db, 'banners'), banner);
      }
    }

  } catch (err) {
    console.warn('Seeding issue:', err);
  }
}
