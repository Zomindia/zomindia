import { db, auth } from './firebase';
import { collection, addDoc, getDocs, doc, setDoc } from 'firebase/firestore';

const CATEGORIES = [
  { name: 'AC Repair & Service', icon: 'Wind', description: 'Jet service, gas refill, installation' },
  { name: 'Washing Machine', icon: 'RotateCcw', description: 'Drum repair, motor fix, spin issue' },
  { name: 'RO Water Purifier', icon: 'Droplets', description: 'Filter change, membrane replacement' },
  { name: 'Refrigerator', icon: 'Zap', description: 'Cooling check, gas charging' },
  { name: 'TV Repair', icon: 'Tv', description: 'LED/LCD screen, motherboard, sound' },
  { name: 'Electrician', icon: 'Plug', description: 'Wiring, switchboard, fuse repair' },
  { name: 'Plumber', icon: 'Wrench', description: 'Pipe leak, tap fittings, motor pump' },
  { name: 'Home Cleaning', icon: 'Sparkles', description: 'Deep bathroom & kitchen sanitization' },
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
