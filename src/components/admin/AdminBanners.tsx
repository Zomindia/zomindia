import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Banner, BannerTargetType, Category, Service } from '../../types';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Image as ImageIcon, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  Check, 
  X, 
  Sparkles, 
  Tag, 
  Search,
  Layers,
  ArrowRight
} from 'lucide-react';

interface AdminBannersProps {
  categories: Category[];
  services: Service[];
}

const PRESET_IMAGE_TEMPLATES = [
  {
    name: 'AC Jet Cleaning',
    url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80',
    badge: 'SUMMER SPECIAL • 20% OFF',
    title: 'AC Jet Service & Repair',
    subtitle: 'Deep anti-bacterial foam cleaning • 45 min doorstep',
    targetType: 'category' as BannerTargetType,
  },
  {
    name: 'Washing Machine Repair',
    url: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=80',
    badge: 'FLAT ₹99 OFF',
    title: 'Washing Machine Checkup',
    subtitle: 'Motor, drum & spin drainage repair • 30-day warranty',
    targetType: 'category' as BannerTargetType,
  },
  {
    name: 'RO Purifier Service',
    url: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=1200&q=80',
    badge: 'VERIFIED HOME SERVICES',
    title: 'RO Water Purifier Service',
    subtitle: 'Genuine membrane replacement & multi-stage TDS calibration',
    targetType: 'category' as BannerTargetType,
  },
  {
    name: 'Refrigerator Maintenance',
    url: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=1200&q=80',
    badge: 'INDORE CERTIFIED',
    title: 'Refrigerator Maintenance',
    subtitle: 'Cooling coil, thermostat & compressor diagnostics',
    targetType: 'category' as BannerTargetType,
  },
  {
    name: 'TV Repair & Audio',
    url: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=1200&q=80',
    badge: 'SAME DAY FIX',
    title: 'LED/LCD TV Repair',
    subtitle: 'Screen panel, motherboard & audio diagnostics at home',
    targetType: 'category' as BannerTargetType,
  },
];

export const AdminBanners: React.FC<AdminBannersProps> = ({ categories, services }) => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [badge, setBadge] = useState<string>('');
  const [imageURL, setImageURL] = useState<string>('');
  const [targetType, setTargetType] = useState<BannerTargetType>('category');
  const [categoryId, setCategoryId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [order, setOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Real-time Firestore subscription with local storage fallback
  useEffect(() => {
    let isMounted = true;
    const q = query(collection(db, 'banners'), orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isMounted) return;
        const fetchedBanners = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.title || '',
            subtitle: data.subtitle || '',
            badge: data.badge || '',
            imageURL: data.imageURL || data.imageUrl || '',
            targetType: (data.targetType || 'category') as BannerTargetType,
            categoryId: data.categoryId || '',
            categoryName: data.categoryName || '',
            serviceId: data.serviceId || '',
            serviceName: data.serviceName || '',
            order: typeof data.order === 'number' ? data.order : 0,
            isActive: data.isActive !== undefined ? data.isActive : (data.active !== false),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          } as Banner;
        });

        setBanners(fetchedBanners);
        try {
          localStorage.setItem('zomindia_admin_banners_cache', JSON.stringify(fetchedBanners));
        } catch {
          // ignore cache quota
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Real-time banners subscription notice:', err);
        if (!isMounted) return;
        try {
          const cached = localStorage.getItem('zomindia_admin_banners_cache');
          if (cached) {
            setBanners(JSON.parse(cached));
          }
        } catch {
          // ignore
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const openCreateModal = () => {
    setEditingBanner(null);
    setTitle('');
    setSubtitle('');
    setBadge('');
    setImageURL('');
    setTargetType('category');
    setCategoryId(categories[0]?.id || '');
    setServiceId(services[0]?.id || '');
    setOrder((banners.length + 1));
    setIsActive(true);
    setErrorNotice(null);
    setIsModalOpen(true);
  };

  const openEditModal = (banner: Banner) => {
    setEditingBanner(banner);
    setTitle(banner.title);
    setSubtitle(banner.subtitle || '');
    setBadge(banner.badge || '');
    setImageURL(banner.imageURL);
    setTargetType(banner.targetType || 'category');
    setCategoryId(banner.categoryId || categories[0]?.id || '');
    setServiceId(banner.serviceId || services[0]?.id || '');
    setOrder(banner.order || 1);
    setIsActive(banner.isActive);
    setErrorNotice(null);
    setIsModalOpen(true);
  };

  const handleApplyTemplate = (tpl: typeof PRESET_IMAGE_TEMPLATES[0]) => {
    setImageURL(tpl.url);
    setTitle(tpl.title);
    setSubtitle(tpl.subtitle);
    setBadge(tpl.badge);
    setTargetType(tpl.targetType);

    // Try finding matching category
    const matched = categories.find((c) => 
      c.name.toLowerCase().includes(tpl.name.toLowerCase().split(' ')[0])
    );
    if (matched) {
      setCategoryId(matched.id);
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorNotice('Banner title is required.');
      return;
    }
    if (!imageURL.trim()) {
      setErrorNotice('Image URL is required.');
      return;
    }

    setSaving(true);
    setErrorNotice(null);

    const selectedCategory = categories.find((c) => c.id === categoryId);
    const selectedService = services.find((s) => s.id === serviceId);

    const payload: Partial<Banner> = {
      title: title.trim(),
      subtitle: subtitle.trim(),
      badge: badge.trim(),
      imageURL: imageURL.trim(),
      targetType,
      categoryId: targetType === 'category' ? categoryId : '',
      categoryName: targetType === 'category' ? (selectedCategory?.name || '') : '',
      serviceId: targetType === 'service' ? serviceId : '',
      serviceName: targetType === 'service' ? (selectedService?.name || '') : '',
      order: Number(order) || 1,
      isActive,
      active: isActive,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingBanner) {
        const docRef = doc(db, 'banners', editingBanner.id);
        await updateDoc(docRef, payload);
        setSuccessNotice('Banner updated successfully!');
      } else {
        await addDoc(collection(db, 'banners'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setSuccessNotice('New banner published successfully!');
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err: any) {
      console.error('Error saving banner:', err);
      // Local fallback in case network has offline transient issue
      if (editingBanner) {
        setBanners((prev) =>
          prev.map((b) => (b.id === editingBanner.id ? { ...b, ...payload, id: b.id } as Banner : b))
        );
      } else {
        const fakeId = `local-${Date.now()}`;
        setBanners((prev) => [...prev, { ...payload, id: fakeId } as Banner]);
      }
      setIsModalOpen(false);
      setSuccessNotice('Saved locally! Syncing with cloud...');
      setTimeout(() => setSuccessNotice(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    const nextState = !banner.isActive;
    try {
      const docRef = doc(db, 'banners', banner.id);
      await updateDoc(docRef, { isActive: nextState, active: nextState, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error('Error toggling active state:', err);
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, isActive: nextState, active: nextState } : b))
      );
    }
  };

  const handleDeleteBanner = async (banner: Banner) => {
    if (!window.confirm(`Are you sure you want to delete banner "${banner.title}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'banners', banner.id));
      setSuccessNotice('Banner deleted.');
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err) {
      console.error('Error deleting banner:', err);
      setBanners((prev) => prev.filter((b) => b.id !== banner.id));
    }
  };

  const handleMoveOrder = async (banner: Banner, direction: 'up' | 'down') => {
    const currentIndex = banners.findIndex((b) => b.id === banner.id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const otherBanner = banners[targetIndex];
    const newCurrentOrder = otherBanner.order;
    const newOtherOrder = banner.order;

    try {
      await updateDoc(doc(db, 'banners', banner.id), { order: newCurrentOrder, updatedAt: serverTimestamp() });
      await updateDoc(doc(db, 'banners', otherBanner.id), { order: newOtherOrder, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error('Error updating banner order:', err);
      const reordered = [...banners];
      reordered[currentIndex] = { ...otherBanner, order: newOtherOrder };
      reordered[targetIndex] = { ...banner, order: newCurrentOrder };
      reordered.sort((a, b) => a.order - b.order);
      setBanners(reordered);
    }
  };

  const filteredBanners = banners.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      (b.subtitle && b.subtitle.toLowerCase().includes(q)) ||
      (b.badge && b.badge.toLowerCase().includes(q)) ||
      (b.categoryName && b.categoryName.toLowerCase().includes(q)) ||
      (b.serviceName && b.serviceName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header & Stats Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider mb-2">
              <Layers size={14} /> Hero Slider Engine
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Hero Banners & Promotional Sliders
            </h2>
            <p className="text-slate-500 text-sm mt-1 max-w-2xl font-medium">
              Manage promotional cards shown at the top of the Customer App. Connect banners directly to categories, specific services, or offers.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="self-start md:self-auto inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-black text-sm px-5 py-3 rounded-2xl shadow-lg shadow-blue-700/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={18} />
            <span>Add New Banner</span>
          </button>
        </div>

        {/* Quick Stats Pill Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Total Banners</span>
            <span className="text-2xl font-black text-slate-800">{banners.length}</span>
          </div>
          <div className="bg-emerald-50/60 rounded-2xl p-3.5 border border-emerald-100">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-0.5">Active in App</span>
            <span className="text-2xl font-black text-emerald-800">
              {banners.filter((b) => b.isActive).length}
            </span>
          </div>
          <div className="bg-blue-50/60 rounded-2xl p-3.5 border border-blue-100">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block mb-0.5">Category Links</span>
            <span className="text-2xl font-black text-blue-800">
              {banners.filter((b) => b.targetType === 'category').length}
            </span>
          </div>
          <div className="bg-indigo-50/60 rounded-2xl p-3.5 border border-indigo-100">
            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block mb-0.5">Service Links</span>
            <span className="text-2xl font-black text-indigo-800">
              {banners.filter((b) => b.targetType === 'service').length}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between animate-fade-in text-sm font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <Check size={18} className="text-emerald-600" />
            <span>{successNotice}</span>
          </div>
          <button type="button" onClick={() => setSuccessNotice(null)} className="text-emerald-500 hover:text-emerald-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, badge, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
          />
        </div>
      </div>

      {/* Banners Grid / List */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-100">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-semibold">Loading live banners...</p>
        </div>
      ) : filteredBanners.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <ImageIcon size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-1">No Promotional Banners Found</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
            {searchQuery 
              ? 'No banners match your search. Try a different query.' 
              : 'Add your first banner to configure what promotional slides customers see on the home screen.'}
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus size={16} /> Create Banner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBanners.map((banner, index) => {
            const isFirst = index === 0;
            const isLast = index === filteredBanners.length - 1;

            return (
              <div
                key={banner.id}
                className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md ${
                  banner.isActive ? 'border-slate-200/90' : 'border-slate-200/60 opacity-70 bg-slate-50/50'
                }`}
              >
                <div>
                  {/* Banner Image Preview Card */}
                  <div className="relative aspect-[2.4/1] bg-slate-900 overflow-hidden group">
                    <img
                      src={banner.imageURL}
                      alt={banner.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80';
                      }}
                    />

                    {/* Gradient Overlay & Mimic Card */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent flex flex-col justify-end p-3.5 text-white">
                      {banner.badge && (
                        <span className="inline-flex items-center self-start text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600/90 backdrop-blur-xs text-white mb-1 shadow-xs">
                          {banner.badge}
                        </span>
                      )}
                      <h4 className="text-sm font-black text-white uppercase tracking-tight line-clamp-1 drop-shadow-sm">
                        {banner.title}
                      </h4>
                      {banner.subtitle && (
                        <p className="text-[10px] text-slate-200 line-clamp-1 font-medium drop-shadow-xs">
                          {banner.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Order Pill */}
                    <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-black text-white border border-white/20">
                      Order #{banner.order}
                    </div>

                    {/* Active Status Badge */}
                    <div className="absolute top-2.5 right-2.5">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-md ${
                        banner.isActive 
                          ? 'bg-emerald-500/90 text-white shadow-xs' 
                          : 'bg-slate-700/80 text-slate-300'
                      }`}>
                        {banner.isActive ? <Eye size={10} /> : <EyeOff size={10} />}
                        {banner.isActive ? 'Active' : 'Hidden'}
                      </span>
                    </div>
                  </div>

                  {/* Banner Metadata & Destination */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Destination Target
                      </span>
                      <span className="text-xs font-black text-blue-700 capitalize bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1">
                        <ExternalLink size={11} />
                        {banner.targetType === 'category' && `Category: ${banner.categoryName || 'Linked'}`}
                        {banner.targetType === 'service' && `Service: ${banner.serviceName || 'Direct Booking'}`}
                        {banner.targetType === 'offers' && 'Offers Page'}
                        {banner.targetType === 'custom' && 'Custom Action'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {banner.subtitle || 'Standard promotional card configured for homepage hero slider rotation.'}
                    </p>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/60">
                  {/* Order Shift Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveOrder(banner, 'up')}
                      title="Move slide left / higher priority"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-600 transition-colors"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveOrder(banner, 'down')}
                      title="Move slide right / lower priority"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-600 transition-colors"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(banner)}
                      className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border transition-all ${
                        banner.isActive
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                      }`}
                    >
                      {banner.isActive ? 'Hide' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(banner)}
                      className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-blue-700 border border-slate-200 transition-colors"
                      title="Edit banner"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBanner(banner)}
                      className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 transition-colors"
                      title="Delete banner"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Banner Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {editingBanner ? 'Edit Promotional Banner' : 'Create New Promotional Banner'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Configure slider copy, target redirection, and visual imagery.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {errorNotice && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-xl text-xs font-bold">
                {errorNotice}
              </div>
            )}

            {/* Quick Template Buttons for Admin Convenience */}
            <div className="mb-6 bg-slate-50 rounded-2xl p-3 border border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1">
                <Sparkles size={12} className="text-amber-500" /> One-Click Quick Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_IMAGE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="text-[11px] font-bold px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-lg text-slate-700 transition-all cursor-pointer"
                  >
                    + {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveBanner} className="space-y-4">
              {/* Live Preview Mimic */}
              {imageURL && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Live Banner Preview
                  </label>
                  <div className="w-full aspect-[2.6/1] rounded-2xl overflow-hidden relative shadow-inner bg-slate-900 border border-slate-200">
                    <img 
                      src={imageURL} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent flex flex-col justify-end p-4 text-white">
                      {badge && (
                        <span className="inline-flex items-center self-start text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600/90 backdrop-blur-xs text-white mb-1 shadow-xs">
                          {badge}
                        </span>
                      )}
                      <h4 className="text-base font-black text-white uppercase tracking-tight line-clamp-1 drop-shadow-sm">
                        {title || 'Banner Title'}
                      </h4>
                      <p className="text-xs text-slate-200 line-clamp-1 font-medium drop-shadow-xs">
                        {subtitle || 'Doorstep service in 45 mins across Indore'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Title & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Banner Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AC Jet Cleaning & Gas Refill"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Offer Badge / Tag
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 20% OFF or FLAT ₹99 OFF"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                  Subtitle / Offer Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Doorstep service in 45 mins • 30-day warranty"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                  Banner Image URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/..."
                  value={imageURL}
                  onChange={(e) => setImageURL(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-xs focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Target Redirection Controls */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-800">
                  Target Click Action
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType('category')}
                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                      targetType === 'category'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Category
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('service')}
                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                      targetType === 'service'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Direct Service
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('offers')}
                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                      targetType === 'offers'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Offers Page
                  </button>
                </div>

                {targetType === 'category' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Select Linked Category
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {targetType === 'service' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Select Linked Service (Direct Booking)
                    </label>
                    <select
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold"
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (₹{s.basePrice})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {targetType === 'offers' && (
                  <p className="text-xs text-slate-500 font-medium">
                    When customer taps this banner, they will instantly navigate to the Customer Offers & Coupons tab.
                  </p>
                )}
              </div>

              {/* Order & Active Toggle */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Display Order (1 = First)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={order}
                    onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Active Status
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-black text-sm shadow-md disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{editingBanner ? 'Update Banner' : 'Create Banner'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBanners;
