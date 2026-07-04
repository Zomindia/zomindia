import { db, auth } from './firebase';
import { collection, addDoc, getDocs, doc, setDoc } from 'firebase/firestore';

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
  try {
    // 1. Seed Categories in a self-healing way (check individually by name)
    const catsSnap = await getDocs(collection(db, 'categories'));
    const existingCatNames = new Set(catsSnap.docs.map(d => d.data().name));

    for (const cat of CATEGORIES) {
      if (!existingCatNames.has(cat.name)) {
        console.log(`Seeding missing category: ${cat.name}`);
        if (cat.name === 'Phone Repair') {
          // Use explicit ID as requested by user
          await setDoc(doc(db, 'categories', 'Phone Repair'), cat);
        } else {
          await addDoc(collection(db, 'categories'), cat);
        }
      }
    }

    // Refresh categories snapshot to get all real IDs (including newly added ones)
    const allCats = await getDocs(collection(db, 'categories'));
    const catMap: Record<string, string> = {};
    allCats.forEach(d => {
      catMap[d.data().name] = d.id;
    });

    // 2. Seed Services in a self-healing way (check individually by name)
    const servicesSnap = await getDocs(collection(db, 'services'));
    const existingServiceNames = new Set(servicesSnap.docs.map(d => d.data().name));

    const defaultServices = [
      {
        categoryName: 'Cleaning',
        name: 'Full Home Cleaning',
        description: 'Deep cleaning of all rooms, balcony, kitchen, and bathroom sanitation.',
        basePrice: 2499,
        duration: '4-5 Hours',
        imageURL: 'https://images.unsplash.com/photo-1581578731548-c64695ce6958?auto=format&fit=crop&q=80&w=600',
        rating: 4.8,
        reviewCount: 320
      },
      {
        categoryName: 'Cleaning',
        name: 'Bathroom Cleaning',
        description: 'Sparkling clean bathroom with specialized anti-scaling chemicals.',
        basePrice: 399,
        duration: '1-2 Hours',
        imageURL: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=600',
        rating: 4.7,
        reviewCount: 154
      },
      {
        categoryName: 'Repairs',
        name: 'Plumbing Repair Visit',
        description: 'Professional plumber for fixing leaks, blockages, taps, and sanitary fittings.',
        basePrice: 199,
        duration: '1 Hour',
        imageURL: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=600',
        rating: 4.9,
        reviewCount: 420
      },
      {
        categoryName: 'Repairs',
        name: 'Electrician Visit',
        description: 'Certified electrician for switches, wiring, sockets, fans, and light installations.',
        basePrice: 149,
        duration: '1 Hour',
        imageURL: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=600',
        rating: 4.8,
        reviewCount: 290
      },
      {
        categoryName: 'Appliance',
        name: 'AC Service & Repair',
        description: 'Deep filter cleaning, gas pressure checks, cooling optimization, and general maintenance.',
        basePrice: 599,
        duration: '2 Hours',
        imageURL: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=600',
        rating: 4.9,
        reviewCount: 512
      },
      {
        categoryName: 'Painting',
        name: 'Full House Painting',
        description: 'Premium interior/exterior wall painting with custom consultation and color mixing.',
        basePrice: 15000,
        duration: '3-5 Days',
        imageURL: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=600',
        rating: 4.9,
        reviewCount: 88
      },
      {
        categoryName: 'Beauty',
        name: 'Salon at Home Classic',
        description: 'Waxing, facial, manicure, pedicure, and premium beauty treatment done at home.',
        basePrice: 1299,
        duration: '2-3 Hours',
        imageURL: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=600',
        rating: 4.8,
        reviewCount: 194
      },
      {
        categoryName: 'Appliance Repair',
        name: 'RO Water Purifier Repair',
        description: 'Filter replacement, membrane cleaning, water quality TDS checks, and leakage fixes.',
        basePrice: 299,
        duration: '1-2 Hours',
        imageURL: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=600',
        rating: 4.6,
        reviewCount: 77
      },
      {
        categoryName: 'Phone Repair',
        name: 'Screen Replacement',
        description: 'Expert replacement of cracked phone screens for all major smartphone brands.',
        basePrice: 2499,
        duration: '2 Hours',
        imageURL: 'https://images.unsplash.com/photo-1597740985671-2a8a3b80502e?auto=format&fit=crop&q=80&w=600',
        rating: 4.9,
        reviewCount: 120
      }
    ];

    for (const svc of defaultServices) {
      if (!existingServiceNames.has(svc.name)) {
        const catId = catMap[svc.categoryName];
        if (catId) {
          console.log(`Seeding missing service: ${svc.name}`);
          const { categoryName, ...serviceData } = svc;
          await addDoc(collection(db, 'services'), {
            ...serviceData,
            categoryId: catId,
          });
        }
      }
    }

    // 3. Seed Promotions
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

    // 4. Seed FAQs
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
