import React, { useState, useEffect, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import { 
  MapPin, 
  Clock, 
  Upload, 
  CheckCircle, 
  ChefHat, 
  UtensilsCrossed, 
  Globe, 
  Plus, 
  Minus, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  X, 
  MessageCircle, 
  Send, 
  Loader2, 
  CupSoda, 
  Apple, 
  ShieldAlert, 
  Copy, 
  Share2, 
  Edit, 
  RotateCcw, 
  RotateCw, 
  Landmark, 
  CreditCard, 
  Timer, 
  ShoppingBag, 
  AlertTriangle, 
  User, 
  Truck, 
  ArrowRight, 
  Mail, 
  Hourglass,
  Heart,
  Flame,
  PartyPopper,
  Info,
  CalendarCheck,
  Package,
  HandPlatter
} from 'lucide-react';
import { Language, MenuItem, AppStep, CustomerInfo, ChatMessage } from './types';
import { MENU_ITEMS, ADD_ONS, THEME_INFO, TEXTS } from './constants';
import { generateChefNote, getDishStory, getConciergeResponse, OrderedDishInfo, generateOwnerEmail } from './services/geminiService';

const DAY_ORDER: Record<string, number> = {
  'Monday': 0, '星期一': 0,
  'Tuesday': 1, '星期二': 1,
  'Wednesday': 2, '星期三': 2,
  'Thursday': 3, '星期四': 3,
  'Friday': 4, '星期五': 4
};

const App: React.FC = () => {
  // Main State
  const [lang, setLang] = useState<Language>(Language.EN);
  const [step, setStep] = useState<AppStep>(AppStep.MENU);
  const [showIntro, setShowIntro] = useState(true);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: '', phone: '', email: '', address: '', deliveryInstruction: ''
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState<number>(900);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [chefNote, setChefNote] = useState<{en: string, zh: string} | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [mapUrl, setMapUrl] = useState<string>('');
  const [mapZoom, setMapZoom] = useState(16);
  const [isLocating, setIsLocating] = useState(false);
  const [orderId, setOrderId] = useState<string>('');
  const [highlightedCartItem, setHighlightedCartItem] = useState<string | null>(null);
  const [ownerEmailDraft, setOwnerEmailDraft] = useState<string>('');

  // Parallax Scroll State for Intro
  const [scrollY, setScrollY] = useState(0);

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelModalType, setCancelModalType] = useState<'manual' | 'timeout'>('manual');

  // Payment Page State
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'tng'>('bank');
  
  // Receipt Editor State
  const [isReceiptEditorOpen, setIsReceiptEditorOpen] = useState(false);
  const [editorSourceUrl, setEditorSourceUrl] = useState<string | null>(null);
  const [editorRotation, setEditorRotation] = useState(0);
  const [originalFileForEditing, setOriginalFileForEditing] = useState<File | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [editorStep, setEditorStep] = useState<'cropping' | 'previewing'>('cropping');
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);

  // AI Storyteller State
  const [activeStoryItem, setActiveStoryItem] = useState<MenuItem | null>(null);
  const [itemStory, setItemStory] = useState<string>('');
  const [loadingStory, setLoadingStory] = useState(false);

  // AI Concierge State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLParagraphElement>(null);

  // Details Page State
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const deliveryInstructionRef = useRef<HTMLInputElement>(null);

  const t = TEXTS[lang];

  // Helper to check availability based on time/date
  const isItemAvailable = (dayIndex: number) => {
    const now = new Date();
    let today = now.getDay(); // 0 is Sunday, 1 is Monday...
    const currentDay = today === 0 ? 7 : today; // Map Sun to 7
    const currentHour = now.getHours();

    // If it's Saturday or Sunday, we're in the pre-order period for the upcoming week.
    if (currentDay >= 6) return true;

    // Past days are unavailable
    if (currentDay > dayIndex) return false;

    // Same day is unavailable (cut-off was yesterday 8pm)
    if (currentDay === dayIndex) return false;

    // Day before check (8 PM cut-off)
    if (currentDay === dayIndex - 1 && currentHour >= 20) return false;

    return true;
  };

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step]);

  // Handle intro scroll parallax
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    if (showIntro) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showIntro]);

  // Close concierge when leaving menu step
  useEffect(() => {
    if (step !== AppStep.MENU) {
      setIsChatOpen(false);
    }
  }, [step]);

  // Validation Logic
  const validate = () => {
    const errors: Record<string, string> = {};
    if (customer.name.trim().length < 2) errors.name = t.nameError;
    if (!/^\+?[\d\s-]{8,}$/.test(customer.phone)) errors.phone = t.phoneError;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) errors.email = t.emailError;
    if (customer.address.trim().length < 5) errors.address = t.addressError;
    if (!customer.deliveryInstruction || customer.deliveryInstruction.trim().length < 2) {
      errors.deliveryInstruction = t.deliveryInstructionError;
    }
    return errors;
  };

  const validationErrors = validate();

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Initialize Inventory
  useEffect(() => {
    const initialInv: Record<string, number> = {};
    MENU_ITEMS.forEach(item => {
      initialInv[item.id] = item.maxInventory;
    });
    setInventory(initialInv);
  }, []);
  
  // Cleanup receipt preview Object URLs
  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    };
  }, [receiptPreview]);

  // Update map URL when address, coordinates, or zoom change
  useEffect(() => {
    if (customer.coordinates) {
      const { lat, lng } = customer.coordinates;
      setMapUrl(`https://maps.google.com/maps?q=${lat},${lng}&t=&z=${mapZoom}&ie=UTF8&iwloc=&output=embed`);
    } else if (customer.address) {
      const encoded = encodeURIComponent(customer.address);
      setMapUrl(`https://maps.google.com/maps?q=${encoded}&t=&z=${mapZoom}&ie=UTF8&iwloc=&output=embed`);
    } else {
      setMapUrl(`https://maps.google.com/maps?q=Kuantan&t=&z=${mapZoom}&ie=UTF8&iwloc=&output=embed`);
    }
  }, [customer.address, customer.coordinates, mapZoom]);

  // Scroll Chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Timer Logic
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (step === AppStep.PAYMENT && timeLeft > 0 && !showCancelModal) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft <= 0 && step === AppStep.PAYMENT) {
      setCancelModalType('timeout');
      setShowCancelModal(true);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft, lang, showCancelModal]);
  
  const toggleLang = () => {
    setLang(prev => prev === Language.EN ? Language.ZH : Language.EN);
  };

  const updateCart = (id: string, delta: number, max: number) => {
    setHighlightedCartItem(id);
    setTimeout(() => setHighlightedCartItem(null), 700);

    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, Math.min(current + delta, max));
      const newCart = { ...prev, [id]: next };
      
      const menuItem = MENU_ITEMS.find(m => m.id === id);
      if (menuItem && next === 0) {
        ADD_ONS.forEach(addon => {
          delete newCart[`${id}_${addon.id}`];
        });
      }

      if (next === 0) delete newCart[id];
      return newCart;
    });
  };

  const getItemDetails = (id: string) => {
    const main = MENU_ITEMS.find(m => m.id === id);
    if (main) return { ...main, itemType: 'main' as const };

    const parts = id.split('_');
    if (parts.length > 1) {
      const addonId = parts[parts.length - 1];
      const itemId = parts.slice(0, -1).join('_');
      
      const addon = ADD_ONS.find(a => a.id === addonId);
      const parentItem = MENU_ITEMS.find(m => m.id === itemId);
      
      if (addon && parentItem) {
        return { 
          ...addon, 
          itemType: 'addon' as const,
          parentTitle: lang === Language.EN ? parentItem.title : parentItem.titleZh,
          parentDay: lang === Language.EN ? parentItem.day : parentItem.dayZh,
          parentDayEn: parentItem.day 
        };
      }
    }
    
    return null;
  };

  const calculateTotal = () => {
    let totalValue = 0;
    Object.entries(cart).forEach(([id, q]) => {
      const details = getItemDetails(id);
      if (details) totalValue += details.price * Number(q);
    });
    return totalValue;
  };

  const total = calculateTotal();

  useEffect(() => {
    if (totalRef.current && total > 0) {
      totalRef.current.classList.add('animate-pulse-once');
      const timer = setTimeout(() => {
        totalRef.current?.classList.remove('animate-pulse-once');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [total]);

  const handleOpenStory = async (item: MenuItem) => {
    setActiveStoryItem(item);
    setLoadingStory(true);
    setItemStory('');
    const story = await getDishStory(item, lang);
    setItemStory(story);
    setLoadingStory(false);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    const response = await getConciergeResponse(chatInput, chatHistory, MENU_ITEMS, lang);
    const modelMsg: ChatMessage = { role: 'model', text: response };
    setChatHistory(prev => [...prev, modelMsg]);
    setIsChatLoading(false);
  };

  const handleLocate = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: lat, longitude: lng } = position.coords;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
              headers: { 'Accept-Language': lang === Language.ZH ? 'zh-CN' : 'en-US' }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.display_name) {
                setCustomer(prev => ({ 
                  ...prev, 
                  address: data.display_name,
                  coordinates: { lat, lng }
                }));
              } else {
                setCustomer(prev => ({ ...prev, coordinates: { lat, lng }, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
              }
            } else {
              setCustomer(prev => ({ ...prev, coordinates: { lat, lng }, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
            }
            setMapZoom(18); 
          } catch (e) { 
            console.error(e); 
            setCustomer(prev => ({ ...prev, coordinates: { lat, lng }, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
            setMapZoom(18);
          } finally {
            setIsLocating(false);
            setTouched(prev => ({ ...prev, address: true }));
          }
        },
        (error) => {
          setIsLocating(false);
          alert("Could not pin exact location. Please ensure location services are enabled.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const handleProceedToReview = () => {
    setTouched({ name: true, phone: true, email: true, address: true, deliveryInstruction: true });
    const currentErrors = validate();
    if (Object.keys(currentErrors).length > 0) {
      const errorFields: (keyof CustomerInfo)[] = ['name', 'phone', 'email', 'address', 'deliveryInstruction'];
      const firstErrorField = errorFields.find(field => currentErrors[field]);
      
      if (firstErrorField) {
        const refs: Record<string, React.RefObject<any>> = {
          name: nameRef, phone: phoneRef, email: emailRef, address: addressRef, deliveryInstruction: deliveryInstructionRef
        };
        const errorElement = refs[firstErrorField]?.current;
        errorElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        errorElement?.focus({ preventScroll: true });
      }
    } else {
      setStep(AppStep.REVIEW);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const cropValue = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 80,
          height: 80
        },
        undefined, 
        width,
        height
      ),
      width,
      height
    );
    setCrop(cropValue);
    setCompletedCrop(cropValue as PixelCrop);
  };

  const openEditor = (file: File) => {
    setOriginalFileForEditing(file);
    const url = URL.createObjectURL(file);
    setEditorSourceUrl(url);
    setEditorRotation(0);
    setCrop(undefined);
    setEditorStep('cropping');
    setIsReceiptEditorOpen(true);
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    openEditor(file);
  };
  
  const handleEditReceipt = () => {
    if (!receiptFile) return;
    openEditor(receiptFile);
  };

  const handlePreviewCrop = () => {
    if (!completedCrop || !imgRef.current || !originalFileForEditing) {
      return;
    }
    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    if (editorRotation % 180 !== 0) {
      canvas.width = cropHeight;
      canvas.height = cropWidth;
    } else {
      canvas.width = cropWidth;
      canvas.height = cropHeight;
    }
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(editorRotation * Math.PI / 180);
    
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      cropWidth,
      cropHeight,
      -cropWidth / 2,
      -cropHeight / 2,
      cropWidth,
      cropHeight
    );
    
    canvas.toBlob((blob) => {
      if (blob) {
        setCroppedBlob(blob);
        if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
        setCroppedPreviewUrl(URL.createObjectURL(blob));
        setEditorStep('previewing');
      }
    }, originalFileForEditing.type, 0.9);
  };
  
  const handleRecrop = () => {
    if (croppedPreviewUrl) {
      URL.revokeObjectURL(croppedPreviewUrl);
    }
    setCroppedPreviewUrl(null);
    setCroppedBlob(null);
    setEditorStep('cropping');
    setCrop(undefined);
  };

  const handleConfirmReceiptEdit = () => {
    if (!croppedBlob || !originalFileForEditing) return;

    const newFile = new File([croppedBlob], originalFileForEditing.name, { type: originalFileForEditing.type || 'image/png' });
    setReceiptFile(newFile);
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview(URL.createObjectURL(newFile));
    
    handleCancelReceiptEdit();
  };

  const handleCancelReceiptEdit = () => {
    if(editorSourceUrl) URL.revokeObjectURL(editorSourceUrl);
    if(croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    setIsReceiptEditorOpen(false);
    setEditorSourceUrl(null);
    setOriginalFileForEditing(null);
    setCroppedBlob(null);
    setCroppedPreviewUrl(null);
    setEditorStep('cropping');
    setEditorRotation(0);
    setCrop(undefined);
  };

  const clearReceipt = () => {
    setReceiptFile(null);
    setOriginalFileForEditing(null);
    if (receiptPreview) {
        URL.revokeObjectURL(receiptPreview);
        setReceiptPreview(null);
    }
    const input = document.getElementById('receipt-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  const resetOrder = () => {
    setStep(AppStep.MENU);
    setCart({});
    setCustomer({
      name: '', phone: '', email: '', address: '', deliveryInstruction: ''
    });
    setTouched({});
    setTimeLeft(900);
    clearReceipt();
    setChefNote(null);
    setOrderId('');
    setIsCartExpanded(false);
    setShowCancelModal(false);
    setOwnerEmailDraft('');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedValue(text);
      setTimeout(() => setCopiedValue(null), 2000);
    });
  };
  
  const handleShareOrder = () => {
    const itemsList = getGroupedCart().map(group => 
      `${group.dayLabel}:\n` + group.items.map(item => 
        `  - ${lang === Language.EN ? item.details.title : item.details.titleZh} x${item.q}`
      ).join('\n')
    ).join('\n\n');

    const shareT = TEXTS[lang];
    const shareText = `
${shareT.shareTitle} (${orderId})
------------------------------------
${shareT.shareCustomer}: ${customer.name}

${shareT.shareItems}:
${itemsList}

${shareT.cartTotal}: RM ${total.toFixed(2)}
${shareT.address}: ${customer.address}
${shareT.estimatedDelivery}: ${shareT.deliveryWindow}
------------------------------------
${shareT.shareThanks}
    `;

    navigator.clipboard.writeText(shareText.trim());
    setCopiedValue('share');
    setTimeout(() => setCopiedValue(null), 2000);
  };

  const handlePaymentSubmit = async () => {
    if (!receiptFile) return alert(t.noFile);
    setLoadingAI(true);
    
    const newOrderId = `WS${Math.floor(100000 + Math.random() * 900000)}`;
    setOrderId(newOrderId);
    
    // 1. Extract Order Summary for Email
    const orderSummaryStr = getGroupedCart().map(group => 
      `${group.dayLabel}: ` + group.items.map(item => 
        `${lang === Language.EN ? item.details.title : item.details.titleZh} x${item.q}`
      ).join(', ')
    ).join(' | ');

    // 2. Generate Chef's Note
    const orderedMainDishes: OrderedDishInfo[] = Object.entries(cart)
      .map(([id, q]) => {
        const details = getItemDetails(id);
        if (details && details.itemType === 'main') {
          return {
            title: details.title,
            titleZh: details.titleZh,
            description: details.description,
            descriptionZh: details.descriptionZh
          };
        }
        return null;
      })
      .filter((item): item is OrderedDishInfo => item !== null);
    
    const note = await generateChefNote(customer, orderedMainDishes);
    setChefNote(note);

    // 3. Draft Owner Verification Email
    const emailDraft = await generateOwnerEmail(customer, orderSummaryStr, newOrderId);
    setOwnerEmailDraft(emailDraft);
    
    // Transition to VERIFYING
    setStep(AppStep.VERIFYING);
    setLoadingAI(false);
  };

  const handleManualConfirmByAdmin = () => {
    setStep(AppStep.CONFIRMATION);
  };

  const handleBackFromPayment = () => {
    setCancelModalType('manual');
    setShowCancelModal(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderHeader = () => (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-brand-parchment">
      <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
        <button 
          onClick={() => setShowIntro(true)}
          className="flex items-center gap-2 group text-left outline-none transition-all"
        >
          <ChefHat className="text-brand-red h-6 w-6 group-hover:scale-110 group-active:scale-95 transition-all" />
          <h1 className="font-pacifico text-2xl text-brand-brown tracking-tight pt-1 group-hover:text-brand-red transition-colors">
            {lang === Language.EN ? "The Wandering Spoon" : "漫游勺"}
          </h1>
        </button>
        <button onClick={toggleLang} className="flex items-center gap-1 px-3 py-1 rounded-full bg-brand-parchment/50 hover:bg-brand-parchment text-brand-brown text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-red">
          <Globe className="w-4 h-4" /> {lang}
        </button>
      </div>
    </header>
  );

  const getGroupedCart = () => {
    const groups: Record<string, { dayLabel: string, items: any[] }> = {};
    
    Object.entries(cart).forEach(([id, q]) => {
      const details = getItemDetails(id);
      if (!details) return;

      const dayKey = details.itemType === 'main' ? (lang === Language.EN ? details.day : details.dayZh) : details.parentDay;
      const dayEn = details.itemType === 'main' ? details.day : (details as any).parentDayEn;

      if (!groups[dayEn]) {
        groups[dayEn] = { dayLabel: dayKey, items: [] };
      }
      groups[dayEn].items.push({ id, q: Number(q), details });
    });

    return Object.entries(groups)
      .sort(([dayA], [dayB]) => (DAY_ORDER[dayA] ?? 99) - (DAY_ORDER[dayB] ?? 99))
      .map(([_, group]) => {
        group.items.sort((a, b) => {
          const typeA = a.details.itemType === 'main' ? 0 : 1;
          const typeB = b.details.itemType === 'main' ? 0 : 1;
          return typeA - typeB;
        });
        return group;
      });
  };

  const renderIntroPage = () => (
    <div className="fixed inset-0 z-[100] bg-brand-cream overflow-y-auto animate-in fade-in duration-500 custom-scrollbar">
      {/* Top Bar for Language Toggle & Close */}
      <div className="fixed top-0 left-0 right-0 z-[110] px-6 py-4 flex justify-between items-center pointer-events-none">
        <button 
          onClick={toggleLang} 
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-brand-parchment/50 text-brand-brown text-sm font-black hover:bg-white transition-all active:scale-95"
        >
          <Globe size={16} className="text-brand-red" />
          <span>{lang}</span>
        </button>
        <button 
          onClick={() => setShowIntro(false)}
          className="pointer-events-auto p-4 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-white active:scale-90 transition-all text-brand-brown border border-brand-parchment/50"
        >
          <X size={24} />
        </button>
      </div>

      {/* Hero Section */}
      <div className="relative h-[55vh] w-full overflow-hidden">
        <div 
          className="absolute inset-0 w-full h-[120%] -top-10"
          style={{ 
            transform: `translateY(${scrollY * 0.1}px)`,
            backgroundImage: `url('https://storage.googleapis.com/genai-content-generation-output/05a06cc6-9a29-4509-906b-b453e0078864/input_file_1.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-cream via-brand-brown/20 to-transparent"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center pt-12">
            <h1 className="text-5xl md:text-8xl font-pacifico drop-shadow-2xl mb-3 animate-in slide-in-from-bottom duration-700 select-none">
               {lang === Language.EN ? (
                 <>
                   <span className="text-brand-red">The</span>{" "}
                   <span className="text-brand-green">Wandering</span>{" "}
                   <span className="text-brand-red">Spoon</span>
                 </>
               ) : "漫游勺"}
            </h1>
            <h2 className="text-white text-lg sm:text-2xl md:text-4xl font-fredoka font-bold whitespace-nowrap drop-shadow-xl animate-in slide-in-from-bottom duration-1000 delay-200">
               {lang === Language.EN ? "A New Flavour Journey Every Week" : "每周开启全新的味蕾之旅"}
            </h2>
        </div>
      </div>

      {/* Dashboard Transition */}
      <div className="max-w-6xl mx-auto px-6 relative z-10 -mt-16 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Card: Brand Narrative */}
          <div className="lg:col-span-8 bg-white rounded-[3rem] p-10 shadow-xl border border-brand-parchment/50">
             <div className="inline-flex items-center gap-3 px-4 py-2 bg-brand-red/5 rounded-full border border-brand-red/10 text-brand-red text-[10px] font-black uppercase tracking-[0.2em] mb-8">
               <ChefHat size={14} />
               <span>{lang === Language.EN ? "Our Story" : "品牌故事"}</span>
             </div>
             <h3 className="text-3xl md:text-5xl font-serif text-brand-brown leading-tight mb-8">
                {lang === Language.EN ? "Kuantan's First Thematic Bento Kitchen" : "关丹首家主题便当厨房"}
             </h3>
             <div className="space-y-6 text-stone-600 text-lg md:text-xl leading-relaxed font-merriweather italic border-l-4 border-brand-red/20 pl-8">
                <p className="first-letter:text-6xl first-letter:font-serif first-letter:text-brand-red first-letter:mr-4 first-letter:float-left first-letter:leading-none">
                  {lang === Language.EN 
                    ? "We are a premium home kitchen in Kuantan dedicated to crafting meals that are more than just fuel—they are mini getaways from the everyday."
                    : "我们是关丹的一家高端私房厨房，致力于打造不仅仅是能量补充、更是心灵寄托的餐点—它们是平凡日常中的一场微旅行。"}
                </p>
                <p>
                  {lang === Language.EN
                    ? "From heritage kitchens to modern streets, our weekly menu are released every Saturday so you don't have to eat the same thing twice. We believe lunch should be an escape from the mundane."
                    : "从传统厨房到现代街头，我们的每周菜单都会在周六发布，让您永远不会吃到重复的美味。我们相信午餐应该是从平凡中逃离的一次享受。"}
                </p>
             </div>
          </div>

          {/* Card: The Promise */}
          <div className="lg:col-span-4 bg-white rounded-[3rem] p-10 shadow-xl border border-brand-parchment/50">
             <div className="space-y-8 h-full flex flex-col justify-center">
                <h3 className="text-4xl font-serif text-brand-brown mb-2">{lang === Language.EN ? "The Commitment" : "核心承诺"}</h3>
                <div className="space-y-6">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-brand-red/10 rounded-2xl flex items-center justify-center text-brand-red"><Heart size={24} /></div>
                    <div>
                      <p className="font-bold text-sm uppercase tracking-widest text-brand-brown">{lang === Language.EN ? "Zero Shortcuts" : "拒绝捷径"}</p>
                      <p className="text-stone-500 text-xs">{lang === Language.EN ? "No MSG overload, just honest ingredients." : "拒绝过量味精，只用诚意食材。"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-brand-green/10 rounded-2xl flex items-center justify-center text-brand-green"><Flame size={24} /></div>
                    <div>
                      <p className="font-bold text-sm uppercase tracking-widest text-brand-brown">{lang === Language.EN ? "Piping Hot" : "极致新鲜"}</p>
                      <p className="text-stone-500 text-xs">{lang === Language.EN ? "Small batch cooking for peak quality." : "小班制制作，确保每一口都新鲜。"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-brand-parchment/30 rounded-2xl flex items-center justify-center text-brand-brown"><Sparkles size={24} /></div>
                    <div>
                      <p className="font-bold text-sm uppercase tracking-widest text-brand-brown">{lang === Language.EN ? "Weekly Themes" : "每周主题"}</p>
                      <p className="text-stone-500 text-xs">{lang === Language.EN ? "A changing culinary landscape every week." : "每周更新主题，开启无尽美味之旅。"}</p>
                    </div>
                  </div>
                </div>
             </div>
          </div>

          {/* Card: Order Process (Stepper) */}
          <div className="lg:col-span-12 bg-white rounded-[3rem] p-10 shadow-xl border border-brand-parchment/50">
             <div className="flex flex-col lg:flex-row items-start justify-between gap-12">
                <div className="lg:w-1/4 text-center lg:text-left">
                  <h3 className="text-4xl font-serif text-brand-brown mb-4">{lang === Language.EN ? "How to Order" : "如何订餐"}</h3>
                  <p className="text-stone-500 text-sm leading-relaxed font-serif">
                    {lang === Language.EN 
                      ? "We operate exclusively on a pre-order basis to ensure zero food waste and peak freshness for every bento."
                      : "我们全采用预购制，以确保零浪费并保证每份便当在送达时处于最佳新鲜状态。"}
                  </p>
                </div>
                <div className="lg:w-3/4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                   {[
                     { 
                       step: "1", 
                       labelEn: "Discover", 
                       labelZh: "探索", 
                       icon: <CalendarCheck size={24}/>,
                       descEn: "Every Saturday, we release a new thematic menu. Explore our selection for the week.",
                       descZh: "每周六发布新主题菜单。提前探索下周我们精心挑选的高端便当系列。"
                     },
                     { 
                       step: "2", 
                       labelEn: "Pre-Order", 
                       labelZh: "预订", 
                       icon: <Clock size={24}/>,
                       descEn: "Order by 8:00 PM the night before delivery to secure your slot.",
                       descZh: "请在配送日前一天晚上 8:00 前完成下单，锁定美味席位。"
                     },
                     { 
                       step: "3", 
                       labelEn: "Kitchen", 
                       labelZh: "筹备", 
                       icon: <ChefHat size={24}/>,
                       descEn: "Our chef prepares your meal from scratch using fresh ingredients on delivery day.",
                       descZh: "主厨在配送日当天从零开始为您现做。坚持使用当日新鲜食材。"
                     },
                     { 
                       step: "4", 
                       labelEn: "Delivery", 
                       labelZh: "配送", 
                       icon: <Package size={24}/>,
                       descEn: "Expect your bento between 11:00 AM and 1:00 PM straight to your doorstep.",
                       descZh: "餐点将于上午 11:00 至下午 1:00 之间准时送达。家门或办公室直达。"
                     }
                   ].map((item, i) => (
                     <div key={i} className="flex flex-col items-center lg:items-start text-center lg:text-left gap-3 group bg-brand-parchment/10 p-4 rounded-2xl hover:bg-brand-parchment/20 transition-all">
                        <div className="w-12 h-12 rounded-full bg-white border-2 border-brand-parchment flex items-center justify-center text-brand-red shadow-sm group-hover:scale-110 group-hover:bg-brand-red group-hover:text-white group-hover:border-brand-red transition-all">
                          {item.icon}
                        </div>
                        <div>
                          <p className="font-black text-xs uppercase tracking-[0.2em] text-brand-brown mb-1.5">
                            {lang === Language.EN ? item.labelEn : item.labelZh}
                          </p>
                          <p className="text-[10px] leading-relaxed text-stone-500 font-sans">
                            {lang === Language.EN ? item.descEn : item.descZh}
                          </p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>

          {/* Row 3: Delivery Areas and Contact Info */}
          <div className="lg:col-span-6 bg-white rounded-[3rem] p-10 shadow-xl border border-brand-parchment/50 text-center flex flex-col justify-center">
             <h3 className="text-3xl font-serif text-brand-brown mb-4">{lang === Language.EN ? "Delivery Areas" : "配送区域"}</h3>
             <div className="flex flex-wrap justify-center gap-2">
                {["Kuantan Town", "Air Putih", "Alor Akar", "Indera Mahkota"].map((area, i) => (
                  <span key={i} className="px-3 py-1.5 bg-brand-cream rounded-full border border-brand-parchment text-brand-brown font-black text-xs uppercase tracking-[0.2em] shadow-sm hover:border-brand-red hover:text-brand-red transition-all cursor-default">
                    {area}
                  </span>
                ))}
             </div>
          </div>

          <div className="lg:col-span-6 bg-white rounded-[3rem] p-10 shadow-xl border border-brand-parchment/50 text-center flex flex-col justify-center">
             <h3 className="text-3xl font-serif text-brand-brown mb-2">{t.contactHeader}</h3>
             <p className="text-sm text-stone-500 mb-6 font-serif">{t.inquiriesLabel}</p>
             <div className="flex flex-col gap-4 max-w-xs mx-auto w-full">
                <div className="flex items-center gap-4 bg-brand-cream/50 p-3 rounded-2xl border border-brand-parchment/30">
                   <div className="w-10 h-10 rounded-full bg-brand-red/10 flex items-center justify-center text-brand-red flex-shrink-0">
                      <MessageCircle size={18} />
                   </div>
                   <div className="text-left">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-brown/40 mb-0.5">{t.whatsappLabel}</p>
                      <p className="text-xs font-bold text-brand-brown">+6017-9653871</p>
                   </div>
                </div>
                <div className="flex items-center gap-4 bg-brand-cream/50 p-3 rounded-2xl border border-brand-parchment/30">
                   <div className="w-10 h-10 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green flex-shrink-0">
                      <Mail size={18} />
                   </div>
                   <div className="text-left min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-brown/40 mb-0.5">{t.emailLabel}</p>
                      <p className="text-xs font-bold text-brand-brown break-all">thewanderingspoon@outlook.com</p>
                   </div>
                </div>
             </div>
          </div>
          
        </div>

        {/* Brand Signoff */}
        <div className="mt-12 text-center">
           <button 
             onClick={() => setShowIntro(false)}
             className="px-6 py-4 bg-brand-red text-white rounded-full font-black text-sm shadow-[0_15px_40px_rgba(228,76,42,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 mx-auto group w-fit whitespace-nowrap"
           >
             <span>{lang === Language.EN ? "View this week's menu" : "查看本周菜单"}</span>
             <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
           </button>
        </div>

      </div>
    </div>
  );

  const renderConfirmationModal = () => {
    if (!showCancelModal) return null;
    const isTimeout = cancelModalType === 'timeout';
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-brand-brown/60 backdrop-blur-sm" onClick={() => !isTimeout && setShowCancelModal(false)}></div>
        <div className="bg-white w-full max-w-sm rounded-3xl shadow-3xl relative p-8 text-center animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-brand-red/10 text-brand-red rounded-full flex items-center justify-center mx-auto mb-6">
            {isTimeout ? <Timer size={32} /> : <AlertTriangle size={32} />}
          </div>
          <h3 className="text-2xl font-serif font-bold text-brand-brown mb-2">
            {isTimeout ? t.timeUpTitle : t.cancelOrder}
          </h3>
          <p className="text-stone-500 text-sm mb-8 leading-relaxed">
            {isTimeout ? t.timeUpDesc : t.cancelOrderDesc}
          </p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={resetOrder}
              className="w-full bg-brand-red text-white py-4 rounded-xl font-bold text-base shadow-lg active:scale-95 transition-all"
            >
              {isTimeout ? t.orderAgain : t.confirmCancel}
            </button>
            {!isTimeout && (
              <button 
                onClick={() => setShowCancelModal(false)}
                className="w-full bg-stone-100 text-brand-brown py-4 rounded-xl font-bold text-base active:scale-95 transition-all"
              >
                {t.keepPaying}
              </button>
            )}
            {isTimeout && (
              <button 
                onClick={() => {
                  setShowCancelModal(false);
                  setStep(AppStep.MENU);
                }}
                className="w-full bg-stone-100 text-brand-brown py-4 rounded-xl font-bold text-base active:scale-95 transition-all"
              >
                {t.backToMenu}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderReceiptEditor = () => {
    if (!isReceiptEditorOpen || !editorSourceUrl) return null;

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-brand-brown/80 backdrop-blur-md"></div>
        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-3xl relative animate-in zoom-in-95 duration-500 max-h-[90vh] flex flex-col overflow-hidden">
          <div className="p-6 border-b border-stone-100 flex justify-between items-center">
            <h4 className="font-serif font-bold text-xl text-brand-brown">{t.editReceipt}</h4>
            <button onClick={handleCancelReceiptEdit} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-4 bg-stone-50 custom-scrollbar">
            {editorStep === 'cropping' ? (
              <>
                <p className="text-xs text-stone-400 italic font-medium">{t.dragToCrop}</p>
                <div className="w-full flex-1 flex items-center justify-center bg-white p-4 rounded-2xl border border-stone-200 shadow-inner overflow-hidden">
                  <div className="max-w-full max-h-full overflow-auto">
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => setCompletedCrop(c)}
                    >
                      <img
                        ref={imgRef}
                        src={editorSourceUrl}
                        alt="Receipt Editor"
                        style={{ 
                          transform: `rotate(${editorRotation}deg)`, 
                          transition: 'transform 0.3s ease',
                          maxHeight: '60vh',
                          width: 'auto'
                        }}
                        onLoad={onImageLoad}
                        className="object-contain"
                      />
                    </ReactCrop>
                  </div>
                </div>
                <div className="flex gap-4 py-2">
                  <button onClick={() => setEditorRotation(prev => prev - 90)} className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm font-bold text-brand-brown hover:bg-stone-50 transition-all shadow-sm active:scale-95">
                    <RotateCcw size={16} /> {t.rotateLeft}
                  </button>
                  <button onClick={() => setEditorRotation(prev => prev + 90)} className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm font-bold text-brand-brown hover:bg-stone-50 transition-all shadow-sm active:scale-95">
                    <RotateCw size={16} /> {t.rotateRight}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-6 flex flex-col items-center w-full">
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-brown/40 mb-2">{t.previewCrop}</p>
                  <div className="bg-white p-4 rounded-2xl border-4 border-brand-green/20 shadow-xl inline-block max-w-full">
                    {croppedPreviewUrl && (
                      <img src={croppedPreviewUrl} alt="Cropped Preview" className="max-h-[50vh] object-contain rounded-lg" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-stone-100 flex gap-4 bg-white">
            <button 
              onClick={editorStep === 'cropping' ? handleCancelReceiptEdit : handleRecrop}
              className="flex-1 py-4 rounded-xl font-bold text-base bg-stone-100 text-brand-brown hover:bg-stone-200 transition-all"
            >
              {editorStep === 'cropping' ? t.back : t.recrop}
            </button>
            <button 
              onClick={editorStep === 'cropping' ? handlePreviewCrop : handleConfirmReceiptEdit}
              className="flex-1 py-4 rounded-xl font-bold text-base bg-brand-green text-white hover:bg-brand-green/90 shadow-lg transition-all"
            >
              {editorStep === 'cropping' ? t.next : t.confirmChanges}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-brand-cream pb-12 text-stone-800">
      {renderHeader()}
      {showIntro && renderIntroPage()}
      {renderConfirmationModal()}
      {renderReceiptEditor()}
      
      {step === AppStep.MENU && (
        <>
          <div className="relative h-48 md:h-56 w-full overflow-hidden">
            <img src="https://images.unsplash.com/photo-1547517023-7ca0c162f816?q=80&w=1200&auto=format&fit=crop" alt="Hero" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-brown/95 via-brand-brown/40 to-transparent flex flex-col justify-end p-4 md:p-8">
              <div className="max-w-3xl mx-auto w-full">
                <span className="inline-block px-2 py-0.5 bg-brand-red text-[9px] font-bold uppercase tracking-[0.2em] rounded-full mb-2 text-white shadow-lg">
                  {THEME_INFO.dateRange}
                </span>
                <h2 className="text-3xl font-serif font-bold text-brand-cream mb-2 leading-tight">
                  {lang === Language.EN ? THEME_INFO.title : THEME_INFO.titleZh}
                </h2>
                
                <div className="flex flex-col gap-y-1.5 text-brand-parchment text-[10px] sm:text-xs font-bold tracking-[0.05em] uppercase">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-brand-green" />
                    <span>{t.nonHalal}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-brand-red" />
                    <span>{t.cutoff}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-3xl mx-auto px-4 py-8 relative flex flex-col min-h-[60vh]">
            <div className="grid gap-5 mb-10 flex-grow">
              {MENU_ITEMS.map(item => {
                const qty = cart[item.id] || 0;
                const remaining = inventory[item.id] || 0;
                const available = isItemAvailable(item.dayIndex);
                const isSoldOut = remaining <= 0;
                const allergenList = lang === Language.EN ? item.allergies : item.allergiesZh;

                return (
                  <div key={item.id} className={`bg-white rounded-[24px] shadow-sm border border-brand-parchment/40 overflow-hidden flex flex-col transition-all ${!available ? 'opacity-70 saturate-50 pointer-events-none grayscale-[0.3]' : 'hover:shadow-md'}`}>
                    <div className="flex flex-col md:flex-row">
                      <div className="md:w-52 h-40 md:h-auto overflow-hidden relative flex-shrink-0">
                        <img src={item.image} className="w-full h-full object-cover transition-all duration-700" alt={item.title} />
                        {!available && (
                          <div className="absolute inset-0 bg-stone-900/40 flex items-center justify-center p-4">
                            <span className="bg-white/90 text-brand-brown px-4 py-2 rounded-full font-bold text-xs shadow-lg backdrop-blur-sm">
                               {t.orderClosed}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 p-4 sm:p-5 flex flex-col">
                        <div className="mb-0.5">
                          <span className="text-brand-red text-xs font-bold uppercase tracking-[0.15em]">
                            {lang === Language.EN ? item.day : item.dayZh}
                          </span>
                        </div>

                        <div className="flex justify-between items-center mb-1.5">
                          <h4 className="text-lg sm:text-xl font-bold text-brand-brown leading-tight">
                            {lang === Language.EN ? item.title : item.titleZh}
                          </h4>
                          <p className="text-lg font-georgia font-bold text-brand-green whitespace-nowrap ml-4">
                            RM {item.price.toFixed(2)}
                          </p>
                        </div>

                        <p className="text-stone-500 text-[13px] mb-3 leading-relaxed font-sans line-clamp-2">
                          {lang === Language.EN ? item.description : item.descriptionZh}
                        </p>

                        {allergenList && allergenList.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-[11px] text-brand-brown/40 font-bold whitespace-nowrap">
                              {t.allergens}:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {allergenList.map(a => (
                                <span key={a} className="text-[10px] bg-brand-cream text-brand-green px-2 py-0.5 rounded-full font-bold border border-brand-green/10">
                                  {a}
                                  </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-auto pt-1 flex items-center justify-between gap-3">
                          <button 
                            onClick={(e) => {
                              if (!available) return;
                              handleOpenStory(item);
                            }}
                            className={`bg-[#F0F3FF] text-[#5C59E8] px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm group whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#5C59E8] ${available ? 'hover:bg-[#E0E7FF]' : 'cursor-default'}`}
                          >
                            <Sparkles className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> {t.discoverStory}
                          </button>
                          
                          <div className="flex items-center ml-auto">
                            {!available ? (
                               <div className="px-4 py-2 bg-stone-200 text-stone-500 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{t.notAvailable}</span>
                               </div>
                            ) : isSoldOut ? (
                              <div className="px-4 py-2 bg-brand-red text-brand-cream text-[10px] font-bold uppercase tracking-[0.2em] rounded-full shadow-md flex items-center gap-2 animate-in slide-in-from-right-4 duration-700">
                                <ShieldAlert className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                                <span className="whitespace-nowrap">{t.soldOut}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5 sm:gap-4 bg-white py-1.5 px-3 sm:py-2 sm:px-4 rounded-[16px] border border-stone-100 shadow-sm min-w-[100px] sm:min-w-[120px] justify-between">
                                <button 
                                  onClick={() => updateCart(item.id, -1, remaining)} 
                                  className={`rounded-full transition-colors ${qty > 0 ? 'text-stone-500 hover:text-stone-700' : 'text-stone-300'} focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red`}
                                  disabled={qty === 0}
                                  aria-label={`Decrease quantity of ${lang === Language.EN ? item.title : item.titleZh}`}
                                >
                                  <Minus className="w-3.5 h-3.5 sm:w-4 h-4" strokeWidth={3} />
                                </button>
                                <span
                                  key={`${item.id}-${qty}`}
                                  className="text-base sm:text-lg font-bold text-stone-800 animate-in zoom-in-125 duration-200"
                                >
                                  {qty}
                                </span>
                                <button 
                                  onClick={() => updateCart(item.id, 1, remaining)} 
                                  className="text-emerald-600 hover:text-emerald-700 transition-colors active:scale-110 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                  disabled={qty >= remaining}
                                  aria-label={`Increase quantity of ${lang === Language.EN ? item.title : item.titleZh}`}
                                >
                                  <Plus className="w-3.5 h-3.5 sm:w-4 h-4" strokeWidth={3} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {qty > 0 && !isSoldOut && available && (
                      <div className="bg-brand-parchment/10 border-t border-brand-parchment/30 p-4 animate-in slide-in-from-top-2 duration-300 pointer-events-auto">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="text-[9px] font-bold text-brand-green uppercase tracking-[0.2em]">{t.addOnsHeader}</h5>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {ADD_ONS.map(addon => {
                            const compoundId = `${item.id}_${addon.id}`;
                            const addonQty = cart[compoundId] || 0;
                            return (
                              <div key={addon.id} className="bg-white rounded-xl p-3 border border-brand-parchment flex items-center justify-between shadow-sm hover:border-brand-green/30 transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <div className="bg-brand-cream p-2 rounded-lg text-brand-red">
                                    {addon.type === 'drink' ? <CupSoda className="w-4 h-4" /> : <Apple className="w-4 h-4" />}
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-bold text-brand-brown tracking-tight">{lang === Language.EN ? addon.title : addon.titleZh}</p>
                                    <p className="text-[9px] text-brand-red font-georgia font-bold">+ RM {addon.price.toFixed(2)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 bg-white py-1 px-2.5 rounded-[12px] border border-stone-50 shadow-sm min-w-[80px] justify-between">
                                  <button 
                                    onClick={() => updateCart(compoundId, -1, qty)} 
                                    className={`rounded-full transition-colors ${addonQty > 0 ? 'text-stone-500 hover:text-stone-700' : 'text-stone-300'} focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red`}
                                    disabled={addonQty === 0}
                                    aria-label={`Decrease quantity of ${lang === Language.EN ? addon.title : addon.titleZh}`}
                                  >
                                    <Minus className="w-3 h-3" strokeWidth={3} />
                                  </button>
                                  <span
                                    key={`${compoundId}-${addonQty}`}
                                    className="text-xs font-bold text-stone-800 animate-in zoom-in-125 duration-200"
                                  >
                                    {addonQty}
                                  </span>
                                  <button 
                                    onClick={() => updateCart(compoundId, 1, qty)} 
                                    className={`rounded-full transition-colors ${addonQty >= qty ? 'text-stone-300' : 'text-emerald-600 hover:text-emerald-700 active:scale-110'} focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500`}
                                    disabled={addonQty >= qty}
                                    aria-label={`Increase quantity of ${lang === Language.EN ? addon.title : addon.titleZh}`}
                                  >
                                    <Plus className="w-3 h-3" strokeWidth={3} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-0 md:bottom-6 z-40 bg-white border border-brand-brown/10 p-4 shadow-lg rounded-[4px] w-full mt-6 self-center transition-all duration-300">
              <div className="flex items-center justify-between gap-4">
                <button type="button" onClick={() => setIsCartExpanded(!isCartExpanded)} className="group text-left">
                  <p className="text-[9px] font-bold text-brand-brown/40 uppercase tracking-[0.2em] mb-0.5 flex items-center gap-1.5 group-hover:text-brand-brown transition-colors">
                    {t.cartTotal} {isCartExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronUp className="w-2.5 h-2.5" />}
                  </p>
                  <p ref={totalRef} className="text-xl sm:text-2xl font-georgia font-bold text-brand-green whitespace-nowrap">RM {total.toFixed(2)}</p>
                </button>
                <button 
                  onClick={() => total > 0 && setStep(AppStep.DETAILS)}
                  disabled={total <= 0}
                  className={`px-8 py-4 rounded-xl font-bold shadow-md transition-all text-base ${total > 0 ? 'bg-brand-green text-white hover:bg-brand-green/90 active:scale-95' : 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'}`}
                >
                  {t.next}
                </button>
              </div>
              {isCartExpanded && (
                <div className="mt-4 pb-1 animate-in slide-in-from-bottom duration-500 max-h-[40vh] overflow-y-auto custom-scrollbar">
                  {getGroupedCart().length > 0 ? (
                    getGroupedCart().map((group, groupIdx) => (
                      <div key={groupIdx} className="mb-3 border-b border-brand-parchment/20 last:border-0 pb-1.5 last:pb-0">
                        <div className="text-[9px] font-bold text-brand-red uppercase tracking-[0.25em] mb-1.5 sticky top-0 bg-white py-1 z-10">
                          {group.dayLabel}
                        </div>
                        <div className="space-y-0.5">
                          {group.items.map(({ id, q, details }) => {
                              const isMain = details.itemType === 'main';
                              let maxQuantity = 99;
                              if (isMain) {
                                  maxQuantity = inventory[id] || 0;
                              } else {
                                  const parts = id.split('_');
                                  const parentId = parts.slice(0, -1).join('_');
                                  maxQuantity = cart[parentId] || 0;
                              }
                              return (
                                  <div
                                    key={id}
                                    className={`flex justify-between items-start py-1.5 rounded-lg px-2 -mx-2 transition-all duration-500 ${!isMain ? 'pl-5' : 'pl-2'} ${highlightedCartItem === id ? 'bg-brand-parchment scale-[1.01]' : 'bg-transparent scale-100'}`}
                                  >
                                      <div className="flex-1 pr-3">
                                          <p className={`font-bold ${isMain ? 'text-brand-brown text-[13px]' : 'text-stone-700 text-xs'}`}>
                                              {lang === Language.EN ? details.title : details.titleZh}
                                          </p>
                                          <p className="text-[10px] text-stone-500 font-georgia mt-0.5">
                                              RM {details.price.toFixed(2)} each
                                          </p>
                                      </div>
                                      <div className="flex items-center gap-2 sm:gap-3">
                                          <div className="flex items-center gap-1.5 bg-stone-100/50 p-0.5 rounded-lg border border-stone-200/40">
                                            <button 
                                              onClick={() => updateCart(id, -1, maxQuantity)}
                                              className="p-1 text-stone-500 hover:text-brand-red transition-colors"
                                              aria-label="Decrease quantity"
                                            >
                                              <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="text-11px font-bold text-brand-brown w-3 text-center">{q}</span>
                                            <button 
                                              onClick={() => updateCart(id, 1, maxQuantity)}
                                              className={`p-1 transition-colors ${q >= maxQuantity ? 'text-stone-300' : 'text-stone-500 hover:text-brand-green'}`}
                                              disabled={q >= maxQuantity}
                                              aria-label="Increase quantity"
                                            >
                                              <Plus className="w-3 h-3" />
                                            </button>
                                          </div>
                                          <p className="font-bold text-brand-green font-georgia text-xs sm:text-sm text-right min-w-[55px] sm:min-w-[70px]">
                                              RM {(details.price * q).toFixed(2)}
                                          </p>
                                          <button onClick={() => updateCart(id, -q, 99)} className="p-1 text-stone-300 hover:text-brand-red transition-colors ml-0.5" title="Remove all">
                                              <X className="w-3 h-3" />
                                          </button>
                                      </div>
                                  </div>
                              );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in-95 duration-500">
                      <div className="w-16 h-16 bg-brand-parchment/20 rounded-full flex items-center justify-center mb-3 text-brand-green/30 shadow-inner">
                        <ShoppingBag size={28} />
                      </div>
                      <p className="text-brand-brown font-serif font-bold text-base text-center px-6">
                        {lang === Language.EN ? "Your order is empty." : "您的订单是空的。"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {step === AppStep.DETAILS && (
        <div className="max-w-xl mx-auto px-4 py-8">
          <div className="bg-white rounded-[4px] shadow-lg p-6 flex flex-col gap-6">
            <div className="space-y-1">
              <h3 className="text-3xl font-serif font-bold text-brand-brown leading-tight">{t.detailsHeader}</h3>
              <p className="text-brand-brown/60 text-sm font-merriweather leading-relaxed">{t.detailsSubheader}</p>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-serif font-bold text-brand-brown">{t.contactInfo}</h4>
              <div className="space-y-3">
                <input 
                  ref={nameRef}
                  type="text" 
                  placeholder={t.namePlaceholder}
                  className={`w-full bg-white border border-brand-brown/20 rounded-[4px] p-3 text-sm outline-none transition-all placeholder:text-brand-brown/40 ${touched.name && validationErrors.name ? 'border-brand-red' : 'focus:border-brand-brown/60'}`}
                  value={customer.name} 
                  onChange={e => setCustomer({...customer, name: e.target.value})}
                  onBlur={() => handleBlur('name')}
                />
                <input 
                  ref={phoneRef}
                  type="tel" 
                  placeholder={t.phonePlaceholder}
                  className={`w-full bg-white border border-brand-brown/20 rounded-[4px] p-3 text-sm outline-none transition-all placeholder:text-brand-brown/40 ${touched.phone && validationErrors.phone ? 'border-brand-red' : 'focus:border-brand-brown/60'}`}
                  value={customer.phone} 
                  onChange={e => setCustomer({...customer, phone: e.target.value})}
                  onBlur={() => handleBlur('phone')}
                />
                <input
                  ref={emailRef}
                  type="email" 
                  placeholder={t.emailPlaceholder}
                  className={`w-full bg-white border border-brand-brown/20 rounded-[4px] p-3 text-sm outline-none transition-all placeholder:text-brand-brown/40 ${touched.email && validationErrors.email ? 'border-brand-red' : 'focus:border-brand-brown/60'}`}
                  value={customer.email} 
                  onChange={e => setCustomer({...customer, email: e.target.value})}
                  onBlur={() => handleBlur('email')}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-serif font-bold text-brand-brown">{t.shippingInfo}</h4>
              <div className="space-y-4">
                <textarea 
                  ref={addressRef}
                  placeholder={t.addressPlaceholder}
                  rows={4}
                  className={`w-full bg-white border border-brand-brown/20 rounded-[4px] p-3 text-sm outline-none transition-all placeholder:text-brand-brown/40 resize-none ${touched.address && validationErrors.address ? 'border-brand-red' : 'focus:border-brand-brown/60'}`}
                  value={customer.address} 
                  onChange={e => setCustomer(prev => ({...prev, address: e.target.value, coordinates: undefined}))}
                  onBlur={() => handleBlur('address')}
                />

                <button 
                  onClick={handleLocate}
                  className="w-full bg-brand-red text-white py-3.5 rounded-[4px] font-bold text-sm flex items-center justify-center gap-2 transition-all hover:bg-brand-red/90 shadow-sm"
                >
                  <MapPin className="w-4 h-4" />
                  {t.mapBtn}
                </button>

                <div className="relative w-full aspect-[2/1] bg-stone-100 rounded-[4px] overflow-hidden border border-brand-brown/10">
                  {isLocating && (
                    <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 className="animate-spin text-brand-brown" />
                    </div>
                  )}
                  <div className="absolute right-2 top-2 z-20 flex flex-col gap-1 shadow-sm">
                    <button 
                      type="button"
                      onClick={() => setMapZoom(prev => Math.min(prev + 1, 21))}
                      className="bg-white/95 p-1.5 border border-stone-200 rounded-t-sm hover:bg-stone-50 transition-colors shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
                      aria-label="Zoom in"
                    >
                      <Plus className="w-4 h-4 text-stone-600" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => setMapZoom(prev => Math.max(prev - 1, 1))}
                      className="bg-white/95 p-1.5 border border-t-0 border-stone-200 rounded-b-sm hover:bg-stone-50 transition-colors shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
                      aria-label="Zoom out"
                    >
                      <Minus className="w-4 h-4 text-stone-600" />
                    </button>
                  </div>
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    style={{ border: 0 }}
                    src={mapUrl}
                    allowFullScreen
                    title="Map"
                  ></iframe>
                </div>

                <input 
                  ref={deliveryInstructionRef}
                  type="text" 
                  placeholder={t.deliveryInstructionPlaceholder}
                  className={`w-full bg-white border border-brand-brown/20 rounded-[4px] p-3 text-sm outline-none transition-all placeholder:text-brand-brown/40 ${touched.deliveryInstruction && validationErrors.deliveryInstruction ? 'border-brand-red' : 'focus:border-brand-brown/60'}`}
                  value={customer.deliveryInstruction}
                  onChange={e => setCustomer({...customer, deliveryInstruction: e.target.value})}
                  onBlur={() => handleBlur('deliveryInstruction')}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <button 
                onClick={() => setStep(AppStep.MENU)}
                className="flex-1 bg-stone-100 text-brand-brown py-4 rounded-xl font-bold text-base transition-all hover:bg-stone-200"
              >
                {t.back}
              </button>
              <button 
                onClick={handleProceedToReview}
                className="flex-1 bg-brand-green text-white py-4 rounded-xl font-bold text-base transition-all hover:bg-brand-green/90 shadow-md"
              >
                {t.next}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === AppStep.REVIEW && (
        <div className="max-w-xl mx-auto px-4 py-8 animate-in fade-in duration-500">
          <div className="bg-white rounded-[4px] shadow-lg p-6 flex flex-col gap-6">
            <div className="space-y-1">
              <h3 className="text-3xl font-serif font-bold text-brand-brown leading-tight">{t.reviewHeader}</h3>
              <p className="text-brand-brown/60 text-sm font-merriweather leading-relaxed">{t.reviewSubheader}</p>
            </div>

            <div className="space-y-6">
              <div className="p-5 bg-brand-cream rounded-xl border border-brand-parchment/60 space-y-3 relative group transition-all hover:border-brand-brown/20">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-brand-brown">
                    <User size={18} strokeWidth={2.5} />
                    <h4 className="font-serif font-bold text-lg">{t.reviewContact}</h4>
                  </div>
                  <button onClick={() => setStep(AppStep.DETAILS)} className="text-brand-red text-[11px] font-bold uppercase tracking-widest hover:underline">{t.edit}</button>
                </div>
                <div className="space-y-1.5 pl-6 border-l-2 border-brand-parchment">
                  <p className="text-sm font-bold text-brand-brown">{customer.name}</p>
                  <p className="text-xs text-brand-brown/70">{customer.phone}</p>
                  <p className="text-xs text-brand-brown/70">{customer.email}</p>
                </div>
              </div>

              <div className="p-5 bg-brand-cream rounded-xl border border-brand-parchment/60 space-y-3 relative group transition-all hover:border-brand-brown/20">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-brand-brown">
                    <Truck size={18} strokeWidth={2.5} />
                    <h4 className="font-serif font-bold text-lg">{t.reviewDelivery}</h4>
                  </div>
                  <button onClick={() => setStep(AppStep.DETAILS)} className="text-brand-red text-[11px] font-bold uppercase tracking-widest hover:underline">{t.edit}</button>
                </div>
                <div className="space-y-2 pl-6 border-l-2 border-brand-parchment">
                  <p className="text-xs text-brand-brown/80 leading-relaxed italic">{customer.address}</p>
                  {customer.deliveryInstruction && (
                    <div className="bg-white/50 p-2 rounded border border-brand-parchment/30">
                      <p className="text-[10px] text-brand-brown/50 font-black uppercase tracking-widest mb-0.5">Note</p>
                      <p className="text-xs text-brand-brown/70 leading-relaxed font-merriweather italic">{customer.deliveryInstruction}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 bg-white border-2 border-brand-parchment rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-brand-brown">
                    <ShoppingBag size={18} strokeWidth={2.5} />
                    <h4 className="font-serif font-bold text-lg">{t.reviewItems}</h4>
                  </div>
                  <button onClick={() => setStep(AppStep.MENU)} className="text-brand-red text-[11px] font-bold uppercase tracking-widest hover:underline">{t.edit}</button>
                </div>
                <div className="space-y-4">
                  {getGroupedCart().map((group, idx) => (
                    <div key={idx} className="space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.25em] text-brand-red/60">{group.dayLabel}</span>
                      <div className="space-y-1">
                        {group.items.map(({id, q, details}) => (
                          <div key={id} className="flex justify-between items-center text-sm">
                            <span className="text-brand-brown font-serif">{lang === Language.EN ? details.title : details.titleZh} <span className="text-brand-red font-sans font-bold text-xs ml-1">×{q}</span></span>
                            <span className="text-brand-brown font-georgia font-bold">RM {(details.price * q).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t-2 border-dashed border-brand-parchment flex justify-between items-center">
                    <span className="text-brand-brown font-serif font-black text-sm uppercase tracking-widest">{t.cartTotal}</span>
                    <span className="text-brand-green font-georgia font-black text-2xl">RM {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <button 
                onClick={() => setStep(AppStep.DETAILS)}
                className="flex-1 bg-stone-100 text-brand-brown py-4 rounded-xl font-bold text-base transition-all hover:bg-stone-200"
              >
                {t.back}
              </button>
              <button 
                onClick={() => setStep(AppStep.PAYMENT)}
                className="flex-[1.5] bg-brand-green text-white py-4 rounded-xl font-bold text-sm sm:text-base uppercase tracking-wider transition-all hover:bg-brand-green/90 shadow-md flex items-center justify-center whitespace-nowrap"
              >
                {t.reviewConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === AppStep.PAYMENT && (
        <div className="max-w-xl mx-auto px-4 py-8">
          <div className="bg-white rounded-[4px] shadow-lg p-6 flex flex-col gap-6">
            <div className="space-y-1">
              <h3 className="text-3xl font-serif font-bold text-brand-brown leading-tight">{t.paymentHeader}</h3>
              <p className="text-brand-brown/60 text-sm font-merriweather leading-relaxed">{t.paymentInstruction}</p>
            </div>

            <div className="bg-[#FEF2F2] border border-[#FEE2E2] rounded-[8px] p-4 flex flex-col items-center justify-center">
              <p className="text-[#991B1B] text-[10px] font-black uppercase tracking-[0.2em] mb-1">{t.timeRemaining}</p>
              <div className="flex items-center gap-2.5">
                <Timer className="w-5 h-5 text-[#991B1B] animate-pulse" strokeWidth={2.5} />
                <p className="text-[#991B1B] text-2xl font-mono font-bold tracking-tighter">{formatTime(timeLeft)}</p>
              </div>
            </div>

            <div className="flex border-b border-stone-200">
              <button 
                onClick={() => setPaymentMethod('bank')}
                className={`flex-1 pb-3 flex items-center justify-center gap-2 font-bold text-sm transition-all ${paymentMethod === 'bank' ? 'text-[#0D9488] border-b-2 border-[#0D9488]' : 'text-stone-400'}`}
              >
                <Landmark className="w-4 h-4" />
                {t.payWithBank}
              </button>
              <button 
                onClick={(() => setPaymentMethod('tng'))}
                className={`flex-1 pb-3 flex items-center justify-center gap-2 font-bold text-sm transition-all ${paymentMethod === 'tng' ? 'text-[#0D9488] border-b-2 border-[#0D9488]' : 'text-stone-400'}`}
              >
                <CreditCard className="w-4 h-4" />
                {t.payWithTng}
              </button>
            </div>

            <div className="bg-[#F8F9FA]/50 rounded-[8px] p-6 border border-stone-100 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-500 font-merriweather">{t.accountNameLabel}</span>
                <span className="text-brand-brown font-bold">{THEME_INFO.accountName}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-500 font-merriweather">{lang === Language.EN ? 'Bank' : '银行'}</span>
                <span className="text-brand-brown font-bold">{paymentMethod === 'bank' ? THEME_INFO.bankName : 'Touch \'n Go eWallet'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-500 font-merriweather">{paymentMethod === 'bank' ? (lang === Language.EN ? 'Account No.' : '账号') : (lang === Language.EN ? 'Phone Number' : '电话号码')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-brand-brown font-bold font-mono">
                    {paymentMethod === 'bank' ? THEME_INFO.bankAccount : THEME_INFO.tngPhoneNumber}
                  </span>
                  <button 
                    onClick={() => handleCopy(paymentMethod === 'bank' ? THEME_INFO.bankAccount : THEME_INFO.tngPhoneNumber)}
                    className="text-[#0D9488] p-1 hover:bg-[#0D9488]/10 rounded transition-colors"
                  >
                    {copiedValue === (paymentMethod === 'bank' ? THEME_INFO.bankAccount : THEME_INFO.tngPhoneNumber) ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-stone-100 flex justify-between items-center">
                <span className="text-brand-brown font-serif font-bold text-lg">{t.cartTotal}</span>
                <span className="text-brand-brown font-georgia font-bold text-lg">RM {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-brand-brown font-serif font-bold">{t.uploadReceipt}</h4>
              {receiptPreview && receiptFile ? (
                <div className="border-2 border-[#0D9488]/30 rounded-[8px] p-4 flex items-center justify-between bg-[#F0FDFA]">
                  <div className="flex items-center gap-4">
                    <img src={receiptPreview} alt="Receipt" className="w-12 h-12 object-cover rounded-md" />
                    <div>
                      <p className="text-sm font-bold text-brand-brown truncate max-w-[150px]">{receiptFile.name}</p>
                      <p className="text-xs text-stone-400">{(receiptFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleEditReceipt} className="p-2 text-stone-500 hover:bg-stone-200 rounded-full transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={clearReceipt} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <label htmlFor="receipt-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-stone-200 rounded-[8px] bg-white p-10 flex flex-col items-center justify-center gap-3 group transition-all hover:border-[#0D9488]/40">
                      <div className="text-stone-400 group-hover:text-[#0D9488] transition-colors">
                        <Upload className="w-10 h-10" />
                      </div>
                      <div className="text-center">
                        <p className="text-[#0D9488] font-bold text-sm underline">{t.uploadBtn}</p>
                        <p className="text-stone-400 text-xs mt-1">{lang === Language.EN ? 'No file chosen' : '未选择文件'}</p>
                      </div>
                    </div>
                  </label>
                  <input 
                    type="file" 
                    id="receipt-upload" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleReceiptFileChange} 
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 pt-4">
              <button 
                onClick={handleBackFromPayment}
                className="flex-1 bg-stone-100 text-brand-brown py-4 rounded-xl font-bold text-base transition-all hover:bg-stone-200"
              >
                {t.back}
              </button>
              <button 
                disabled={!receiptFile || loadingAI}
                onClick={handlePaymentSubmit}
                className={`flex-1 py-4 rounded-xl font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 ${!receiptFile || loadingAI ? 'bg-stone-300 text-stone-500 cursor-not-allowed' : 'bg-brand-green text-white hover:bg-brand-green/90'}`}
              >
                {loadingAI && <Loader2 className="animate-spin w-4 h-4" />}
                {t.confirmOrder}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === AppStep.VERIFYING && (
        <div className="max-w-xl mx-auto px-4 py-8 animate-in fade-in duration-700">
          <div className="bg-white rounded-[4px] shadow-lg p-8 flex flex-col items-center text-center gap-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-brand-parchment flex items-center justify-center text-brand-green">
                <Hourglass size={40} className="animate-spin duration-[3s]" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-white p-1.5 rounded-full shadow-md">
                <Mail size={20} className="text-brand-red animate-bounce" />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-3xl font-serif font-bold text-brand-brown">{t.verifyingTitle}</h3>
              <p className="text-stone-500 text-sm font-merriweather leading-relaxed max-w-sm mx-auto">
                {t.verifyingDesc}
              </p>
            </div>

            <div className="w-full space-y-4 px-4 text-left">
              <div className="flex items-center gap-3 text-brand-green font-bold text-sm">
                <CheckCircle size={18} />
                <span>{t.verifyingStep1}</span>
              </div>
              <div className="flex items-center gap-3 text-brand-green font-bold text-sm">
                <CheckCircle size={18} />
                <span>{t.verifyingStep2}</span>
              </div>
              <div className="flex items-center gap-3 text-stone-300 font-bold text-sm">
                <Loader2 size={18} className="animate-spin" />
                <span>{t.verifyingStep3}</span>
              </div>
            </div>

            <div className="w-full pt-6 border-t border-brand-parchment/30">
              <div className="bg-brand-cream/50 rounded-xl p-4 flex flex-col items-center gap-4">
                 <p className="text-[10px] font-black uppercase tracking-widest text-brand-brown/40">Owner Confirmation Simulation</p>
                 <button 
                  onClick={handleManualConfirmByAdmin}
                  className="w-full bg-brand-brown text-white py-3 rounded-lg font-bold text-xs uppercase tracking-widest shadow-md hover:bg-brand-brown/90 transition-all"
                 >
                   {t.adminConfirm}
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === AppStep.CONFIRMATION && (
        <div className="max-w-xl mx-auto px-4 py-8">
          <div className="bg-white rounded-[4px] shadow-lg p-6 flex flex-col gap-6">
            <div className="text-center space-y-3 pt-6 pb-2">
              <div className="flex justify-center mb-2">
                <CheckCircle className="w-24 h-24 text-brand-green" strokeWidth={1} />
              </div>
              <h2 className="text-3xl font-serif font-bold text-brand-green tracking-tight">{t.thankYou}</h2>
              <p className="text-stone-500 text-sm font-merriweather max-w-xs mx-auto leading-relaxed whitespace-pre-wrap">
                {t.confirmationDesc}
              </p>
            </div>

            <div className="bg-[#FAF7F2] rounded-xl p-6 space-y-4 mx-2">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-brand-red" />
                <span className="text-lg font-serif font-bold text-brand-red">{t.chefNote}</span>
              </div>
              <p className="text-brand-brown font-serif italic text-base leading-relaxed opacity-90">
                "{chefNote?.[lang === Language.EN ? 'en' : 'zh']}"
              </p>
            </div>

            <div className="space-y-3 px-2 pt-4 border-t border-stone-100">
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-400 font-merriweather">{t.orderId}</span>
                <span className="text-brand-brown font-bold">#{orderId}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-400 font-merriweather">{t.estimatedDelivery}</span>
                <span className="text-brand-brown font-bold">{t.deliveryWindow}</span>
              </div>
            </div>

            <div className="space-y-4 pt-6 px-2">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="h-[1px] flex-1 bg-brand-brown/10"></div>
                <h4 className="font-serif font-bold text-brand-brown text-lg whitespace-nowrap">Order Summary</h4>
                <div className="h-[1px] flex-1 bg-brand-brown/10"></div>
              </div>
              
              <div className="bg-white border-2 border-brand-parchment/60 rounded-[8px] overflow-hidden shadow-md flex flex-col relative">
                <div className="max-h-[300px] overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[radial-gradient(#f0f0f0_1px,transparent_1px)] [background-size:20px_20px]">
                  {getGroupedCart().map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-500" style={{ animationDelay: `${groupIdx * 100}ms` }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-red bg-brand-red/5 px-2 py-0.5 rounded">
                          {group.dayLabel}
                        </span>
                        <div className="h-[1px] flex-1 border-b border-dashed border-stone-200"></div>
                      </div>
                      <div className="space-y-2.5">
                        {group.items.map(({ id, q, details }) => (
                          <div key={id} className="flex justify-between items-start gap-3">
                            <div className="flex-1">
                              <p className="text-brand-brown font-serif font-bold text-sm leading-tight">
                                {lang === Language.EN ? details.title : details.titleZh}
                              </p>
                              <p className="text-[10px] text-stone-500 font-sans mt-0.5 tracking-tight">
                                 {q} × RM {details.price.toFixed(2)}
                              </p>
                            </div>
                            <span className="text-brand-brown font-bold font-georgia text-sm whitespace-nowrap pt-1">
                              RM {(details.price * q).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="bg-brand-cream/40 border-t-2 border-dashed border-brand-parchment p-5 px-6">
                  <div className="flex justify-between items-center">
                    <span className="text-brand-brown font-serif font-black text-xs uppercase tracking-widest opacity-60">Total Bill</span>
                    <span className="text-brand-green font-georgia font-black text-2xl tracking-tighter">RM {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-6 px-2">
              <button onClick={resetOrder} className="w-full bg-[#E5E7EB]/50 text-brand-brown py-4 rounded-xl font-bold text-base transition-all hover:bg-stone-200">{t.orderAgain}</button>
              <button onClick={handleShareOrder} className="w-full bg-brand-green text-white py-4 rounded-xl font-bold text-base transition-all hover:bg-brand-green/90 shadow-md flex items-center justify-center gap-2 group">
                <Share2 className="w-4 h-4" />
                {copiedValue === 'share' ? t.shareCopied : t.shareOrder}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeStoryItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-brown/60 backdrop-blur-md" onClick={() => setActiveStoryItem(null)}></div>
          <div className="bg-brand-cream w-full max-w-lg rounded-[48px] shadow-3xl relative animate-in zoom-in-95 duration-500 max-h-[90vh] overflow-y-auto overflow-x-hidden border-2 border-brand-parchment custom-scrollbar">
            <button onClick={() => setActiveStoryItem(null)} className="absolute top-6 right-6 p-3 bg-brand-parchment/80 backdrop-blur-sm rounded-full hover:bg-brand-parchment transition-all z-20 shadow-md group">
              <X className="w-5 h-5 text-brand-brown group-hover:rotate-90 transition-transform" />
            </button>
            <div className="h-60 overflow-hidden relative flex-shrink-0">
              <img src={activeStoryItem.image} className="w-full h-full object-cover" alt="Story cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-cream via-transparent"></div>
            </div>
            <div className="px-10 pb-12 pt-4 text-center">
              <span className="text-brand-green text-[10px] font-bold uppercase tracking-[0.3em] mb-4 block">Nyonya Heritage</span>
              <h4 className="text-4xl font-serif text-brand-brown mb-8">{lang === Language.EN ? activeStoryItem.title : activeStoryItem.titleZh}</h4>
              <div className="min-h-[200px] flex items-center justify-center">
                {loadingStory ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-brand-red w-10 h-10" />
                    <p className="text-brand-brown/40 text-sm italic font-medium tracking-widest">{t.storyLoading}</p>
                  </div>
                ) : (
                  <p className="text-brand-brown font-serif leading-loose italic text-xl whitespace-pre-wrap opacity-90 text-left">
                    {itemStory}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div 
        className={`fixed left-0 right-0 z-50 flex flex-col items-end px-4 sm:left-auto sm:right-6 sm:px-0 transition-all duration-500 pointer-events-none ${step !== AppStep.MENU || isCartExpanded ? 'opacity-0' : 'opacity-100'}`}
        style={{ bottom: step === AppStep.MENU ? '85px' : '20px' }}
      >
        {isChatOpen && (
          <div className="bg-brand-cream w-full sm:w-[420px] h-[min(600px,65vh)] sm:h-[min(600px,75vh)] rounded-[40px] shadow-3xl border-2 border-brand-parchment flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 origin-bottom-right mb-2 pointer-events-auto">
            <div className="bg-brand-brown px-6 py-5 flex justify-between items-center text-brand-cream">
              <div className="flex items-center gap-3">
                <ChefHat className="w-5 h-5 text-brand-parchment" />
                <h5 className="font-fredoka text-xl text-brand-parchment tracking-normal">{t.aiConciergeTitle}</h5>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="hover:rotate-90 transition-transform p-1 rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar bg-white/40">
              <div className="bg-brand-parchment/50 p-5 rounded-[30px] rounded-tl-none border border-brand-parchment/60 shadow-sm">
                <p className="text-sm text-brand-brown leading-relaxed font-bold tracking-tight italic">{t.chatIntro}</p>
              </div>
              {chatHistory.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] p-5 rounded-[30px] text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-brand-red text-white rounded-tr-none font-medium' : 'bg-brand-parchment/50 text-brand-brown rounded-tl-none border border-brand-parchment/60 font-bold italic tracking-tight'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-brand-parchment/50 p-4 rounded-[30px] rounded-tl-none border border-brand-parchment/60 flex gap-2 shadow-sm">
                    <span className="w-2 h-2 bg-brand-parchment rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-brand-parchment rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 bg-brand-parchment rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef}></div>
            </div>
            <div className="p-5 bg-white border-t border-brand-parchment flex gap-3 items-center">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder={t.aiConciergePlaceholder} 
                  className="w-full bg-brand-cream/60 border-2 border-transparent focus:border-brand-parchment/50 rounded-full px-6 py-4 text-sm outline-none font-bold text-brand-brown placeholder:text-brand-brown/30 shadow-inner"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                />
              </div>
              <button 
                onClick={handleSendMessage}
                disabled={isChatLoading || !chatInput.trim()}
                className="bg-stone-400 hover:bg-brand-brown text-white p-4 rounded-full disabled:bg-stone-300 disabled:cursor-not-allowed transition-all shadow-lg active:scale-90 flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`w-16 h-16 rounded-full shadow-3xl transition-all active:scale-90 border-4 flex items-center justify-center group pointer-events-auto ${isChatOpen ? 'bg-brand-cream border-brand-brown text-brand-brown rotate-90' : 'bg-brand-red border-white text-white hover:scale-110 shadow-brand-red/40'}`}
        >
          {isChatOpen ? <X size={28} /> : <MessageCircle size={32} className="group-hover:rotate-12 transition-transform" />}
        </button>
      </div>

    </div>
  );
};

export default App;