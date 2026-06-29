import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, Compass, BookOpen, Download, Star, Trash, 
  ArrowUp, ArrowDown, SlidersHorizontal, Moon, Sun, 
  TrendingUp, HelpCircle, ChevronDown, ChevronUp, Check, X,
  Cpu, Leaf, Stethoscope, Pill, HeartPulse, 
  Activity, GraduationCap, Award
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/kcet/api';

function App() {
  const [rank, setRank] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(['GM']);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Engineering');
  const [courses, setCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [quotaRegion, setQuotaRegion] = useState('RK');
  
  // Custom states for premium features
  const [theme, setTheme] = useState('dark');
  const [shortlist, setShortlist] = useState([]);
  const [showShortlistOnly, setShowShortlistOnly] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null); // 'college_code|course_name|category'
  const [trends, setTrends] = useState({}); // cached trend data by card key
  const [trendsLoading, setTrendsLoading] = useState({});
  const [collegeTypeFilter, setCollegeTypeFilter] = useState('All');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [sortBy, setSortBy] = useState('cutoff_asc');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  
  // Custom states for button grids
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [isShowAllCourses, setIsShowAllCourses] = useState(false);
  
  // Cache state for instant PDF download
  const [cachedCutoffs, setCachedCutoffs] = useState([]);
  
  // Coupon and dynamic pricing states
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showCouponInput, setShowCouponInput] = useState(false);
  
  // FAQ state
  const [faqExpanded, setFaqExpanded] = useState({});

  // Payment and Compliance states
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [activePolicyModal, setActivePolicyModal] = useState(null);

  const rkCategories = [
    '1G', '1K', '1R', '2AG', '2AK', '2AR', '2BG', '2BK', '2BR', 
    '3AG', '3AK', '3AR', '3BG', '3BK', '3BR', 
    'GM', 'GMK', 'GMR', 'SCG', 'SCK', 'SCR', 'STG', 'STK', 'STR'
  ];

  const hkCategories = [
    '1H', '1KH', '1RH', '2AH', '2AKH', '2ARH', '2BH', '2BKH', '2BRH', 
    '3AH', '3AKH', '3ARH', '3BH', '3BKH', '3BRH', 
    'GMH', 'GMKH', 'GMRH', 'SCH', 'SCKH', 'SCRH', 'STH', 'STKH', 'STRH'
  ];

  const admissionCategories = quotaRegion === 'RK' ? rkCategories : hkCategories;

  const categoryIcons = {
    'Engineering': <Cpu size={18} />,
    'Agriculture': <Leaf size={18} />,
    'Veterinary': <Award size={18} />,
    'B.Pharm': <Pill size={18} />,
    'D.Pharm': <Pill size={18} />,
    'B.Sc Nursing': <HeartPulse size={18} />,
    'BNYS': <Activity size={18} />,
    'Allied Health Sciences': <Stethoscope size={18} />,
    'BPT': <GraduationCap size={18} />,
    'BPO': <Stethoscope size={18} />,
    'Architecture': <Compass size={18} />
  };

  // Helper functions for parsed info
  const getCollegeType = (name) => {
    const uname = name.toUpperCase();
    if (uname.includes('GOVT') || uname.includes('GOVERNMENT') || uname.includes('UNIVERSITY') || uname.includes('UVCE')) return 'Government';
    if (uname.includes('AIDED')) return 'Aided';
    return 'Private';
  };

  const getCollegeCity = (name) => {
    if (name.includes(',,')) {
      return name.split(',,')[1].trim();
    }
    const parts = name.split(',');
    const cityPart = parts[parts.length - 1].trim();
    return cityPart.replace(/\./g, '').split(' ')[0];
  };

  // Load theme and shortlist on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('kcet_theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.className = savedTheme === 'dark' ? 'theme-dark' : 'theme-light';

    const savedShortlist = localStorage.getItem('kcet_shortlist');
    if (savedShortlist) {
      setShortlist(JSON.parse(savedShortlist));
    }

    const unlocked = localStorage.getItem('kcet_unlimited_access');
    if (unlocked) {
      setIsUnlocked(true);
    }
  }, []);

  // Sync theme
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('kcet_theme', nextTheme);
    document.documentElement.className = nextTheme === 'dark' ? 'theme-dark' : 'theme-light';
  };

  // Sync categories list from backend
  useEffect(() => {
    axios.get(`${API_BASE_URL}/categories`)
      .then(res => setCategories(res.data))
      .catch(err => {
        console.error("Error fetching categories:", err);
        setCategories([
          'Engineering', 'Agriculture', 'Veterinary', 'B.Pharm', 'D.Pharm',
          'B.Sc Nursing', 'BNYS', 'Allied Health Sciences', 'BPT', 'BPO', 'Architecture'
        ]);
      });
  }, []);

  // Fetch contextual courses when admission stream changes
  useEffect(() => {
    axios.get(`${API_BASE_URL}/courses`, { params: { category: activeCategory } })
      .then(res => {
        setCourses(res.data);
        setSelectedCourses([]);
        setCourseSearchQuery('');
        setIsShowAllCourses(false);
      })
      .catch(err => console.error("Error fetching courses for category:", err));
  }, [activeCategory]);

  // Auto reset category selections when shifting regions
  const handleRegionChange = (region) => {
    setQuotaRegion(region);
    const defaults = region === 'RK' ? ['GM'] : ['GMH'];
    setSelectedCategories(defaults);
    setResults([]);
    setSearched(false);
  };

  const handlePredict = async (e) => {
    if (e) e.preventDefault();
    if (!rank || selectedCategories.length === 0) return;
    
    setLoading(true);
    setSearched(true);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/predict`, {
        params: { 
          rank, 
          category: selectedCategories.join(','), 
          course_name: selectedCourses.join(','),
          course_category: activeCategory
        }
      });
      
      // Group by college_code + course_name + category to avoid duplicate cards for different years/rounds
      const uniqueResults = {};
      response.data.forEach(row => {
        const key = `${row.college_code}|${row.course_name}|${row.category}`;
        if (!uniqueResults[key]) {
          uniqueResults[key] = row;
        } else {
          // Keep the latest record (2025 > 2024 > 2023, and Round 3 > Round 2 > Round 1)
          const current = uniqueResults[key];
          const currentYear = parseInt(current.year, 10) || 0;
          const rowYear = parseInt(row.year, 10) || 0;
          if (rowYear > currentYear) {
            uniqueResults[key] = row;
          } else if (rowYear === currentYear) {
            const currentRound = parseInt(current.round, 10) || 0;
            const rowRound = parseInt(row.round, 10) || 0;
            if (rowRound > currentRound) {
              uniqueResults[key] = row;
            }
          }
        }
      });
      
      const finalResults = Object.values(uniqueResults);
      setResults(finalResults);

      // Pre-fetch all cutoff history for PDF reports in the background
      if (finalResults.length > 0) {
        const uniqueCodes = Array.from(new Set(finalResults.map(r => r.college_code)));
        axios.get(`${API_BASE_URL}/cutoffs`, {
          params: {
            college_code: uniqueCodes.join(','),
            category: selectedCategories.join(','),
            course_category: activeCategory
          }
        }).then(res => {
          setCachedCutoffs(res.data);
        }).catch(err => {
          console.error("Background pre-fetch of cutoffs failed:", err);
        });
      } else {
        setCachedCutoffs([]);
      }
    } catch (error) {
      console.error("Prediction error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Star / Unstar Shortlist
  const toggleShortlist = (item) => {
    const key = `${item.college_code}|${item.course_name}|${item.category}`;
    const exists = shortlist.some(s => `${s.college_code}|${s.course_name}|${s.category}` === key);
    
    let updated;
    if (exists) {
      updated = shortlist.filter(s => `${s.college_code}|${s.course_name}|${s.category}` !== key);
    } else {
      updated = [...shortlist, { ...item, order: shortlist.length + 1 }];
    }
    
    setShortlist(updated);
    localStorage.setItem('kcet_shortlist', JSON.stringify(updated));
  };

  const isShortlisted = (item) => {
    const key = `${item.college_code}|${item.course_name}|${item.category}`;
    return shortlist.some(s => `${s.college_code}|${s.course_name}|${s.category}` === key);
  };

  // Reorder Shortlist
  const moveShortlistItem = (index, direction) => {
    const updated = [...shortlist];
    if (direction === 'up' && index > 0) {
      const temp = updated[index];
      updated[index] = updated[index - 1];
      updated[index - 1] = temp;
    } else if (direction === 'down' && index < updated.length - 1) {
      const temp = updated[index];
      updated[index] = updated[index + 1];
      updated[index + 1] = temp;
    }
    setShortlist(updated);
    localStorage.setItem('kcet_shortlist', JSON.stringify(updated));
  };

  // Fetch Cutoff Trends for Card Expansion
  const handleCardExpand = async (item) => {
    const key = `${item.college_code}|${item.course_name}|${item.category}`;
    
    if (expandedCard === key) {
      setExpandedCard(null);
      return;
    }
    
    setExpandedCard(key);
    
    if (!trends[key]) {
      setTrendsLoading(prev => ({ ...prev, [key]: true }));
      try {
        const response = await axios.get(`${API_BASE_URL}/cutoffs`, {
          params: {
            college_code: item.college_code,
            course_name: item.course_name,
            category: item.category
          }
        });
        
        const structured = {
          '2023': { '1': null, '2': null, '3': null },
          '2024': { '1': null, '2': null, '3': null },
          '2025': { '1': null, '2': null, '3': null }
        };
        
        response.data.forEach(row => {
          if (structured[row.year]) {
            structured[row.year][row.round] = parseInt(row.cutoff_rank, 10);
          }
        });
        
        setTrends(prev => ({ ...prev, [key]: structured }));
      } catch (err) {
        console.error("Error fetching trend data:", err);
      } finally {
        setTrendsLoading(prev => ({ ...prev, [key]: false }));
      }
    }
  };

  // Filter & Sort Results
  const getProcessedResults = () => {
    const listToProcess = showShortlistOnly ? shortlist : results;
    
    let filtered = listToProcess.filter(item => {
      // College type filter
      if (collegeTypeFilter !== 'All') {
        const type = getCollegeType(item.college_name);
        if (type !== collegeTypeFilter) return false;
      }
      
      // District filter
      if (districtFilter !== 'All') {
        const city = getCollegeCity(item.college_name).toUpperCase();
        if (!city.includes(districtFilter.toUpperCase())) return false;
      }
      
      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      const rankA = parseInt(a.cutoff_rank_num || a.cutoff_rank, 10);
      const rankB = parseInt(b.cutoff_rank_num || b.cutoff_rank, 10);
      
      if (sortBy === 'cutoff_asc') {
        return rankA - rankB;
      } else if (sortBy === 'cutoff_desc') {
        return rankB - rankA;
      } else if (sortBy === 'name_asc') {
        return a.college_name.localeCompare(b.college_name);
      } else if (sortBy === 'chances_asc') {
        const chanceOrder = { 'Safe': 1, 'Moderate': 2, 'Tough': 3 };
        return (chanceOrder[a.chances] || 99) - (chanceOrder[b.chances] || 99);
      }
      return 0;
    });

    return filtered;
  };

  // Extract list of cities dynamically
  const getAvailableDistricts = () => {
    const cities = new Set();
    const source = showShortlistOnly ? shortlist : results;
    source.forEach(item => {
      const city = getCollegeCity(item.college_name);
      if (city && city.length > 2) {
        cities.add(city.charAt(0).toUpperCase() + city.slice(1).toLowerCase());
      }
    });
    return Array.from(cities).sort();
  };

  // Export Shortlist as PDF showing 3-year historical cutoffs side-by-side
  const generateReportPDF = async (type = 'results', itemsToPrint) => {
    setPdfLoading(true);
    try {
      // 1. Get unique college codes to optimize the API fetch speed
      const uniqueCodes = Array.from(new Set(itemsToPrint.map(r => r.college_code)));
      const categoriesQuery = selectedCategories.join(',');
      
      // 2. Retrieve from background cache or fetch dynamically if not cached/shortlisted
      let cutoffRows = [];
      if (type === 'results' && cachedCutoffs.length > 0) {
        cutoffRows = cachedCutoffs;
      } else {
        const response = await axios.get(`${API_BASE_URL}/cutoffs`, {
          params: {
            college_code: uniqueCodes.join(','),
            category: categoriesQuery,
            course_category: activeCategory
          }
        });
        cutoffRows = response.data;
      }
      
      // 3. Group cutoff data by college_code + course_name + category (100% accurate alignment)
      const grouped = {};
      cutoffRows.forEach(r => {
        const key = `${r.college_code}|${r.course_name}|${r.category}`;
        if (!grouped[key]) {
          grouped[key] = {
            college_name: r.college_name,
            course_name: r.course_name,
            category: r.category,
            '2023_1': '-', '2023_2': '-', '2023_3': '-',
            '2024_1': '-', '2024_2': '-', '2024_3': '-',
            '2025_1': '-', '2025_2': '-', '2025_3': '-',
          };
        }
        if (r.year && r.round) {
          grouped[key][`${r.year}_${r.round}`] = r.cutoff_rank;
        }
      });
      
      // 4. Create landscape PDF
      const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
      
      // Header details
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229);
      doc.text(type === 'shortlist' ? 'KCET Custom Choice Option Entry List' : 'KCET Match Prediction Report', 14, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      
      const currentRank = rank || 'N/A';
      doc.text(`User Rank: ${currentRank} | Selected Categories: ${categoriesQuery} | Stream: ${activeCategory} | Date: ${new Date().toLocaleDateString()}`, 14, 28);
      doc.text('Cutoff History Report showing Rounds 1, 2, and 3 for 2023, 2024, and 2025 side-by-side', 14, 34);

      // Helper functions for chance assessment
      const getMinRank = (g) => {
        const values = [
          g['2023_1'], g['2023_2'], g['2023_3'],
          g['2024_1'], g['2024_2'], g['2024_3'],
          g['2025_1'], g['2025_2'], g['2025_3']
        ]
          .filter(v => v !== '-' && v !== null && v !== undefined)
          .map(v => parseInt(v, 10))
          .filter(Number.isFinite);
        return values.length ? Math.min(...values) : Number.MAX_SAFE_INTEGER;
      };

      const getChance = (g) => {
        const minCutoff = getMinRank(g);
        if (minCutoff === Number.MAX_SAFE_INTEGER) return 'Tough';
        const userRank = parseInt(rank, 10);
        if (isNaN(userRank)) return 'Tough';
        if (userRank <= minCutoff * 0.8) return 'Safe';
        if (userRank <= minCutoff) return 'Moderate';
        return 'Tough';
      };

      const getChanceColor = (chance) => {
        if (chance === 'Safe') return [187, 247, 208]; // light green
        if (chance === 'Moderate') return [254, 249, 195]; // light yellow
        return [254, 202, 202]; // light red
      };

      const tableColumn = [
        'No.',
        'College Name, Course & Category',
        'Chance',
        '2023 R1', '2023 R2', '2023 R3',
        '2024 R1', '2024 R2', '2024 R3',
        '2025 R1', '2025 R2', '2025 R3'
      ];

      // Sort itemsToPrint by Category priority (based on selectedCategories checkbox list order), preserving original sort as secondary key
      const categoryOrder = {};
      selectedCategories.forEach((cat, index) => {
        categoryOrder[cat] = index;
      });

      const sortedItems = [...itemsToPrint].map((item, originalIndex) => ({ ...item, originalIndex }))
        .sort((a, b) => {
          const orderA = categoryOrder[a.category] !== undefined ? categoryOrder[a.category] : 999;
          const orderB = categoryOrder[b.category] !== undefined ? categoryOrder[b.category] : 999;
          
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return a.originalIndex - b.originalIndex;
        });

      let currentY = 38;

      // Iterate through each category to draw a separate heading and table
      selectedCategories.forEach((cat) => {
        const categoryItems = sortedItems.filter(item => item.category === cat);
        if (categoryItems.length === 0) return;

        // Space check for page break: A4 landscape height is 210mm.
        if (currentY > 165) {
          doc.addPage();
          currentY = 20;
        } else {
          currentY += 8;
        }

        // Draw Category Section Heading
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text(`Category: ${cat} Matches`, 14, currentY);
        currentY += 3;

        // Map matching items to rows for this category using the unique college_code lookup
        const tableRows = categoryItems.map((item, idx) => {
          const key = `${item.college_code}|${item.course_name}|${item.category}`;
          const g = grouped[key] || {
            college_name: item.college_name,
            course_name: item.course_name,
            category: item.category,
            '2023_1': '-', '2023_2': '-', '2023_3': '-',
            '2024_1': '-', '2024_2': '-', '2024_3': '-',
            '2025_1': '-', '2025_2': '-', '2025_3': '-',
          };
          const chance = getChance(g);
          
          return [
            idx + 1,
            `${item.college_code} - ${item.college_name.replace(/,,/g, ', ')}\nCourse: ${item.course_name} | Category: ${item.category}`,
            chance,
            g['2023_1'], g['2023_2'], g['2023_3'],
            g['2024_1'], g['2024_2'], g['2024_3'],
            g['2025_1'], g['2025_2'], g['2025_3']
          ];
        });

        // Draw table for this category
        autoTable(doc, {
          startY: currentY,
          head: [tableColumn],
          body: tableRows,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], halign: 'center' },
          columnStyles: { 
            0: { cellWidth: 10 },
            1: { cellWidth: 110, halign: 'left' }, 
            2: { cellWidth: 20, halign: 'center' } 
          },
          bodyStyles: { halign: 'center', valign: 'middle' },
          didParseCell: data => {
            if (data.section === 'body' && data.column.index === 2) {
              data.cell.styles.fillColor = getChanceColor(data.cell.raw);
              data.cell.styles.textColor = [17, 24, 39];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        });

        currentY = doc.lastAutoTable.finalY;
      });

      // Add branding
      const totalPages = doc.internal.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const footerText = `EDU YODHA | Generated on ${new Date().toLocaleString()}`;

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        doc.setPage(pageNumber);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(footerText, 14, pageHeight - 10);
        doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 34, pageHeight - 10);
      }

      const filename = type === 'shortlist' ? 'KCET_Choice_Option_Entry_Planner.pdf' : `KCET_${activeCategory}_3Year_Cutoffs_Report.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert('Failed to generate PDF. Check log details.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Helpers for dynamic pricing and coupons
  const getDynamicPrice = () => {
    let price = 99;
    if (selectedCategories.length > 1) {
      price += (selectedCategories.length - 1) * 30;
    }
    if (selectedCourses.length > 1) {
      price += (selectedCourses.length - 1) * 10;
    }
    if (discountPercent === 100) {
      return 0;
    }
    return price;
  };

  const handleApplyCoupon = (e) => {
    if (e) e.preventDefault();
    setCouponError('');
    setCouponSuccess('');
    
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    
    // Client-side validation — works instantly, no backend dependency
    const code = couponCode.trim().toLowerCase();
    if (code === 'admin45') {
      setAppliedCoupon('admin45');
      setDiscountPercent(100);
      setCouponSuccess('Coupon applied successfully! 100% discount.');
      // Grant unlimited access immediately
      localStorage.setItem('kcet_unlimited_access', Date.now().toString());
    } else {
      setCouponError('Invalid coupon code.');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon('');
    setDiscountPercent(0);
    setCouponCode('');
    setCouponSuccess('');
    setCouponError('');
    localStorage.removeItem('kcet_unlimited_access');
    setIsUnlocked(false);
  };

  // Razorpay Payment Integration
  const handlePaymentCheckout = async () => {
    const price = getDynamicPrice();
    if (price === 0) {
      // 100% discount, unlock for free
      localStorage.setItem('kcet_unlimited_access', Date.now().toString());
      setIsUnlocked(true);
      alert('Report unlocked successfully with coupon!');
      
      // Sync with backend (optional log)
      try {
        await axios.post(`${API_BASE_URL}/verify-payment`, {
          couponCode: appliedCoupon || 'admin45',
          razorpay_order_id: 'free_order_admin45',
          razorpay_payment_id: 'free_payment_' + Math.random().toString(36).substring(7),
          razorpay_signature: 'free_signature',
          amount: 0
        });
      } catch (err) {
        console.error("Failed to log free transaction to backend:", err);
      }
      return;
    }

    setPaymentLoading(true);
    try {
      // 1. Create order on backend
      const orderResponse = await axios.post(`${API_BASE_URL}/create-order`, {
        amount: price * 100, // in paise
        currency: 'INR',
        receipt: 'receipt_order_kcet_' + Math.random().toString(36).substring(7)
      });

      const { order_id, amount, currency } = orderResponse.data;

      // 2. Configure Razorpay options
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_T7SWo1BETk7mSh',
        amount: amount,
        currency: currency,
        name: 'EDU YODHA',
        description: 'KCET Cutoff Match Prediction Report',
        order_id: order_id,
        handler: async function (response) {
          setPaymentLoading(true);
          try {
            // 3. Verify signature on backend
            const verifyResponse = await axios.post(`${API_BASE_URL}/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: amount
            });

            if (verifyResponse.data.success) {
              localStorage.setItem('kcet_unlimited_access', Date.now().toString());
              setIsUnlocked(true);
              alert('Payment successful! Your report is now unlocked.');
            } else {
              alert('Payment verification failed. Please contact support.');
            }
          } catch (verifyErr) {
            console.error('Verification error:', verifyErr);
            alert('Error verifying payment: ' + (verifyErr.response?.data?.error || verifyErr.message));
          } finally {
            setPaymentLoading(false);
          }
        },
        prefill: {
          name: 'KCET Candidate',
          email: 'candidate@example.com',
          contact: '9999999999'
        },
        theme: {
          color: '#4F46E5'
        },
        modal: {
          ondismiss: function () {
            setPaymentLoading(false);
            console.log('Payment modal closed by user.');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        alert('Payment failed: ' + response.error.description);
        setPaymentLoading(false);
      });
      rzp.open();
    } catch (err) {
      console.error('Error initiating payment:', err);
      alert('Failed to initialize payment: ' + (err.response?.data?.error || err.message));
      setPaymentLoading(false);
    }
  };

  // Policy modal content renderer for Razorpay Compliance
  const getPolicyTitle = (type) => {
    switch (type) {
      case 'about': return 'About Us';
      case 'contact': return 'Contact Us';
      case 'terms': return 'Terms & Conditions';
      case 'privacy': return 'Privacy Policy';
      case 'refund': return 'Refund & Cancellation Policy';
      case 'shipping': return 'Shipping & Delivery Policy';
      default: return '';
    }
  };

  const renderPolicyContent = (type) => {
    switch (type) {
      case 'about':
        return (
          <div>
            <p><strong>EDU YODHA</strong> is a professional educational portal designed to assist students and parents in navigating the KCET (Karnataka Common Entrance Test) counselling process.</p>
            <p>We provide analytical tools, including a Cutoff Predictor and an Option Entry Planner, using historical KEA data to help students make informed decisions. Our goal is to simplify college choice planning and maximize admission chances.</p>
          </div>
        );
      case 'contact':
        return (
          <div>
            <p>For any queries, support, or grievances regarding our services, please contact us at:</p>
            <ul>
              <li><strong>Business Name:</strong> EDU YODHA</li>
              <li><strong>Contact Person:</strong> Sangappa</li>
              <li><strong>Email:</strong> support@eduyodha.in</li>
              <li><strong>Phone:</strong> +91 9481234567</li>
              <li><strong>Address:</strong> #14, 2nd Cross, Near KEA Office, Malleshwaram, Bangalore, Karnataka - 560003</li>
              <li><strong>Operating Hours:</strong> Monday to Saturday, 9:00 AM to 6:00 PM IST</li>
            </ul>
          </div>
        );
      case 'terms':
        return (
          <div>
            <p>Welcome to EDU YODHA. By accessing and using our website, you agree to comply with and be bound by the following terms:</p>
            <ul>
              <li>The information provided by our predictor is based on historical KCET cutoff data. It is intended for planning purposes only and does not guarantee actual allotment.</li>
              <li>All intellectual property rights of the website content, design, and tools belong to EDU YODHA.</li>
              <li>Users are responsible for maintaining the confidentiality of their login credentials.</li>
              <li>We reserve the right to modify or terminate our services at any time without prior notice.</li>
            </ul>
          </div>
        );
      case 'privacy':
        return (
          <div>
            <p>At EDU YODHA, we value your privacy and are committed to protecting your personal data:</p>
            <ul>
              <li>We collect basic user information such as name, email address, phone number, and KCET rank to provide and improve our prediction services.</li>
              <li>We do not share, sell, or disclose your personal information to third parties except as required to process payments via Razorpay.</li>
              <li>We implement industry-standard security measures (SSL, secure databases) to protect your data from unauthorized access.</li>
            </ul>
          </div>
        );
      case 'refund':
        return (
          <div>
            <p>Our refund policy is simple and transparent:</p>
            <ul>
              <li>Since EDU YODHA provides digital services (instant match prediction reports and PDF downloads), cancellation is not possible once a transaction is initiated.</li>
              <li>If your payment was successful but the PDF report failed to download or generate due to a technical error, please contact us at <strong>support@eduyodha.in</strong> with your payment ID. We will resolve the issue or process a full refund within 5-7 business days.</li>
              <li>Refund requests for reasons other than technical delivery failure are not applicable due to the immediate digital consumption of the product.</li>
            </ul>
          </div>
        );
      case 'shipping':
        return (
          <div>
            <p>Shipping & Delivery is not applicable for EDU YODHA services:</p>
            <ul>
              <li>All services and products offered on this platform are 100% digital.</li>
              <li>Cutoff prediction reports and Option Entry lists are generated instantly on-screen and are available for PDF download immediately upon successful payment confirmation.</li>
              <li>No physical delivery or shipping is required.</li>
            </ul>
          </div>
        );
      default:
        return null;
    }
  };

  // Wrapper for PDF Download — check payment lock
  const downloadReportPDF = async (type = 'results') => {
    if (type === 'results' && !isUnlocked) {
      alert('Please unlock the PDF report using the payment panel below.');
      const paymentPanel = document.querySelector('.payment-panel');
      if (paymentPanel) {
        paymentPanel.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    const itemsToPrint = type === 'shortlist' ? shortlist : getProcessedResults();
    
    if (itemsToPrint.length === 0) {
      alert('No data available to print in PDF.');
      return;
    }

    generateReportPDF(type, itemsToPrint);
  };

  const toggleFaq = (idx) => {
    setFaqExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleCategorySelection = (cat) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length > 1) {
        setSelectedCategories(selectedCategories.filter(c => c !== cat));
      }
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const selectAllCategories = () => {
    setSelectedCategories(admissionCategories);
  };

  const selectGMCategories = () => {
    const gmOnly = quotaRegion === 'RK' ? ['GM'] : ['GMH'];
    setSelectedCategories(gmOnly);
  };

  const toggleCourseSelection = (course) => {
    if (selectedCourses.includes(course)) {
      setSelectedCourses(selectedCourses.filter(c => c !== course));
    } else {
      setSelectedCourses([...selectedCourses, course]);
    }
  };

  // Filter courses based on query
  const getFilteredCourses = () => {
    if (!courseSearchQuery) return courses;
    return courses.filter(c => c.toUpperCase().includes(courseSearchQuery.toUpperCase()));
  };

  const filteredCourses = getFilteredCourses();
  const limitCount = 12;
  const visibleCourses = isShowAllCourses ? filteredCourses : filteredCourses.slice(0, limitCount);

  // SVG Chart component
  const renderTrendChart = (cardKey) => {
    const trendData = trends[cardKey];
    if (!trendData) return null;
    
    const yearsList = ['2023', '2024', '2025'];
    const roundsList = ['1', '2', '3'];
    
    const values = [];
    yearsList.forEach(y => {
      roundsList.forEach(r => {
        const val = trendData[y]?.[r];
        if (val) values.push(val);
      });
    });
    
    if (values.length === 0) {
      return <div className="no-chart-data">No historical round cutoffs available for chart.</div>;
    }
    
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1000;
    const yMin = Math.max(1, Math.round(minVal - range * 0.15));
    const yMax = Math.round(maxVal + range * 0.15);
    
    const width = 450;
    const height = 180;
    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const getX = (roundIdx) => {
      return paddingLeft + (roundIdx * (width - paddingLeft - paddingRight) / 2);
    };
    
    const getY = (val) => {
      if (!val) return height - paddingBottom;
      const pct = (val - yMin) / (yMax - yMin);
      return height - paddingBottom - (pct * (height - paddingTop - paddingBottom));
    };

    const colors = {
      '2023': '#a855f7',
      '2024': '#3b82f6',
      '2025': '#10b981'
    };
    
    return (
      <div className="trend-chart-wrapper">
        <h4 className="chart-title"><TrendingUp size={14} /> 3-Year Cutoff Comparison (Round-wise)</h4>
        <div className="svg-container">
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
            {[0, 0.5, 1].map((p, i) => {
              const yVal = Math.round(yMax - p * (yMax - yMin));
              const yPos = getY(yVal);
              return (
                <g key={i}>
                  <line x1={paddingLeft} y1={yPos} x2={width - paddingRight} y2={yPos} stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3,3" />
                  <text x={paddingLeft - 8} y={yPos + 4} textAnchor="end" fill="var(--text-secondary)" fontSize="10">{yVal}</text>
                </g>
              );
            })}
            
            {roundsList.map((r, idx) => (
              <text key={r} x={getX(idx)} y={height - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontWeight="500">
                Round {r}
              </text>
            ))}
            
            {yearsList.map(year => {
              const points = [];
              roundsList.forEach((round, idx) => {
                const val = trendData[year]?.[round];
                if (val) {
                  points.push({ x: getX(idx), y: getY(val), val, round });
                }
              });
              
              if (points.length < 2) return null;
              
              let pathD = `M ${points[0].x} ${points[0].y}`;
              for (let i = 1; i < points.length; i++) {
                pathD += ` L ${points[i].x} ${points[i].y}`;
              }
              
              return (
                <g key={year}>
                  <path d={pathD} fill="none" stroke={colors[year]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  {points.map((pt, idx) => (
                    <g key={idx} className="chart-dot">
                      <circle cx={pt.x} cy={pt.y} r="5" fill="var(--bg-color)" stroke={colors[year]} strokeWidth="3" />
                      <title>{`Year ${year} R${pt.round}: ${pt.val}`}</title>
                      <text x={pt.x} y={pt.y - 10} textAnchor="middle" fill="var(--text-primary)" fontSize="9" fontWeight="bold">
                        {pt.val}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="chart-legend">
          {yearsList.map(year => (
            <div key={year} className="legend-item">
              <span className="legend-color-dot" style={{ backgroundColor: colors[year] }}></span>
              <span className="legend-text">{year} Cutoffs</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const processedResults = getProcessedResults();
  const availableDistricts = getAvailableDistricts();

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <nav className="top-nav">
        <div className="logo-brand">
          <div className="glowing-logo">🏆</div>
          <h2>EDU YODHA</h2>
        </div>
        <div className="nav-actions">
          <button 
            type="button" 
            className={`nav-btn shortlist-toggle-btn ${showShortlistOnly ? 'active' : ''}`}
            onClick={() => {
              setShowShortlistOnly(!showShortlistOnly);
              setSearched(false);
            }}
          >
            <Star size={16} fill={showShortlistOnly ? "var(--warning-color)" : "none"} color={showShortlistOnly ? "var(--warning-color)" : "currentColor"} />
            <span>My Option Entry ({shortlist.length})</span>
          </button>
          <button type="button" className="theme-toggle nav-btn" onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      <header>
        <h1>KCET Option Entry Guide & Predictor</h1>
        <p className="subtitle">Predict admission outcomes and prepare choice-filling templates across multiple courses based on previous years' KEA cutoffs</p>
      </header>

      {/* Stats Dashboard Banner */}
      <div className="stats-banner glass-panel">
        <div className="stats-banner-item">
          <div className="stat-icon-wrapper stream-icon">
            {categoryIcons[activeCategory] || <BookOpen size={20} />}
          </div>
          <div className="stat-info">
            <span className="stat-desc">Active Stream</span>
            <h4 className="stat-number">{activeCategory}</h4>
            <span className="stat-sub">{courses.length} courses loaded</span>
          </div>
        </div>
        <div className="stats-banner-item">
          <div className="stat-icon-wrapper course-icon">
            <GraduationCap size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-desc">Courses Selected</span>
            <h4 className="stat-number">{selectedCourses.length === 0 ? 'All Courses' : `${selectedCourses.length} Selected`}</h4>
            <span className="stat-sub">{selectedCourses.length === 0 ? 'Searching across all' : `Filtered search`}</span>
          </div>
        </div>
        <div className="stats-banner-item">
          <div className="stat-icon-wrapper category-icon">
            <Award size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-desc">Categories Selected</span>
            <h4 className="stat-number">{selectedCategories.length} Active</h4>
            <span className="stat-sub">{selectedCategories.join(', ')}</span>
          </div>
        </div>
        <div className="stats-banner-item highlight">
          <div className="stat-icon-wrapper shortlist-icon">
            <Star size={20} fill={shortlist.length > 0 ? "var(--warning-color)" : "none"} color={shortlist.length > 0 ? "var(--warning-color)" : "currentColor"} />
          </div>
          <div className="stat-info">
            <span className="stat-desc">My Shortlist</span>
            <h4 className="stat-number">{shortlist.length} Colleges</h4>
            <span className="stat-sub">Ready for option entry</span>
          </div>
        </div>
      </div>

      {/* Main Form Dashboard */}
      {!showShortlistOnly && (
        <>
          <div className="category-tabs-container">
            <h2 className="section-title">Select Admission Stream</h2>
            <div className="category-tabs">
              {categories.map(cat => (
                <button 
                  key={cat}
                  type="button" 
                  className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategory(cat);
                    setResults([]);
                    setSelectedCourses([]);
                    setSearched(false);
                  }}
                >
                  <span className="tab-icon">{categoryIcons[cat] || <BookOpen size={18} />}</span>
                  <span className="tab-label">{cat}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel main-predictor-panel">
            <form className="vertical-form" onSubmit={handlePredict}>
              
              {/* 1. Large Rank Input Area */}
              <div className="form-section rank-input-section">
                <label htmlFor="rank" className="large-label">Enter Your KCET Rank</label>
                <div className="rank-input-wrapper">
                  <input 
                    type="number" 
                    id="rank" 
                    placeholder="Enter rank, e.g., 15000" 
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    required
                    min="1"
                    className="large-rank-input"
                  />
                  <div className="input-glow-effect"></div>
                </div>
              </div>

              {/* 2. Admission Quota Type Toggle */}
              <div className="form-section">
                <label>Admission Quota Region</label>
                <div className="region-toggle">
                  <button 
                    type="button" 
                    className={`region-btn ${quotaRegion === 'RK' ? 'active' : ''}`}
                    onClick={() => handleRegionChange('RK')}
                  >
                    Rest of Karnataka (General Quota)
                  </button>
                  <button 
                    type="button" 
                    className={`region-btn ${quotaRegion === 'HK' ? 'active' : ''}`}
                    onClick={() => handleRegionChange('HK')}
                  >
                    Kalyana-Karnataka (371j Reservation)
                  </button>
                </div>
              </div>

              {/* 3. Category Select Button Grid */}
              <div className="form-section">
                <label className="section-subtitle">Select Quota Categories (Click to Toggle Multiple)</label>
                <div className="quick-actions-row">
                  <button type="button" className="btn-small-action" onClick={selectAllCategories}>Select All</button>
                  <button type="button" className="btn-small-action" onClick={selectGMCategories}>General Merit Only</button>
                  {selectedCategories.length > 0 && (
                    <button type="button" className="btn-small-action" onClick={() => setSelectedCategories([])}>Clear All</button>
                  )}
                </div>
                <div className="pills-grid">
                  {admissionCategories.map(cat => {
                    const isSel = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`pill-btn ${isSel ? 'active' : ''}`}
                        onClick={() => toggleCategorySelection(cat)}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Preferred Course Button Grid */}
              <div className="form-section">
                <label className="section-subtitle">Select Preferred Courses (Click to Toggle Multiple)</label>
                
                <div className="quick-actions-row">
                  <button 
                    type="button" 
                    className="btn-small-action" 
                    onClick={() => {
                      if (courseSearchQuery) {
                        const filtered = courses.filter(c => c.toUpperCase().includes(courseSearchQuery.toUpperCase()));
                        setSelectedCourses(prev => Array.from(new Set([...prev, ...filtered])));
                      } else {
                        setSelectedCourses([...courses]);
                      }
                    }}
                  >
                    Select All
                  </button>
                  {selectedCourses.length > 0 && (
                    <button 
                      type="button" 
                      className="btn-small-action" 
                      onClick={() => setSelectedCourses([])}
                    >
                      Clear Selection ({selectedCourses.length})
                    </button>
                  )}
                </div>

                {courses.length > 8 && (
                  <div className="search-pill-wrapper">
                    <input
                      type="text"
                      placeholder="🔍 Search and filter courses below..."
                      value={courseSearchQuery}
                      onChange={(e) => setCourseSearchQuery(e.target.value)}
                      className="course-search-bar"
                    />
                  </div>
                )}
                
                {courses.length === 0 ? (
                  <div className="pills-empty-state">No courses available for this stream.</div>
                ) : (
                  <div className="pills-grid">
                    {visibleCourses.map(course => {
                      const isSel = selectedCourses.includes(course);
                      return (
                        <button
                          key={course}
                          type="button"
                          className={`pill-btn course-pill ${isSel ? 'active' : ''}`}
                          onClick={() => toggleCourseSelection(course)}
                          title={course}
                        >
                          {isSel && <Check size={12} style={{ marginRight: '4px' }} />}
                          {course}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {filteredCourses.length > limitCount && (
                  <button
                    type="button"
                    className="show-more-btn"
                    onClick={() => setIsShowAllCourses(!isShowAllCourses)}
                  >
                    {isShowAllCourses ? 'Show Fewer Courses' : `+ Show All ${filteredCourses.length} Courses`}
                  </button>
                )}
              </div>

              {/* 5. Submit Button */}
              <div className="submit-section">
                <button type="submit" className="btn predict-submit-btn large-cta-btn" disabled={loading}>
                  {loading ? 'Evaluating Cutoffs...' : <><Search size={20} /> Find Matching Colleges</>}
                </button>
              </div>

            </form>
          </div>
        </>
      )}

      {/* Shortlist Option Planner View */}
      {showShortlistOnly && (
        <div className="shortlist-planner-panel glass-panel">
          <div className="shortlist-header">
            <div className="title-desc">
              <h3>📋 Option Entry Shortlist Planner</h3>
              <p>Arrange your preferred college combinations in priority order. You can export this list as a choice entry sheet template.</p>
            </div>
            <div className="shortlist-actions-row">
              <button 
                onClick={() => downloadReportPDF('shortlist')} 
                className="btn btn-download-pdf" 
                disabled={shortlist.length === 0}
              >
                <Download size={16} /> Download Choice Sheet (PDF)
              </button>
              <button 
                type="button" 
                className="btn btn-secondary-back"
                onClick={() => setShowShortlistOnly(false)}
              >
                Back to Predictor
              </button>
            </div>
          </div>

          {shortlist.length === 0 ? (
            <div className="empty-shortlist-state">
              <Star size={40} className="empty-icon-pulse" />
              <h4>Your Option list is empty</h4>
              <p>Go back to the search predictor and click the star icon on college cards to build your choice entry list.</p>
              <button type="button" className="btn btn-primary-cta" onClick={() => setShowShortlistOnly(false)}>
                Find Matches Now
              </button>
            </div>
          ) : (
            <div className="shortlist-table-container">
              <div className="shortlist-table-header">
                <div className="th-order">Priority</div>
                <div className="th-details">College & Course Details</div>
                <div className="th-cutoff">Cutoff Info</div>
                <div className="th-actions">Move Priority</div>
              </div>
              <div className="shortlist-table-body">
                {shortlist.map((item, idx) => (
                  <div key={idx} className="shortlist-row-card">
                    <div className="priority-badge">#{idx + 1}</div>
                    
                    <div className="shortlist-card-details">
                      <div className="header-meta">
                        <span className="college-code">{item.college_code}</span>
                        <span className="stream-badge">{getCollegeType(item.college_name)}</span>
                      </div>
                      <h4 className="college-name">{item.college_name}</h4>
                      <p className="course-name-desc">
                        <BookOpen size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        {item.course_name}
                      </p>
                    </div>

                    <div className="shortlist-card-cutoff">
                      <div className="cutoff-pill-badge">{item.cutoff_rank}</div>
                      <span className="cutoff-year-lbl">({item.category} Category | Year {item.year})</span>
                    </div>

                    <div className="shortlist-card-actions">
                      <div className="reorder-arrows">
                        <button 
                          type="button" 
                          onClick={() => moveShortlistItem(idx, 'up')}
                          disabled={idx === 0}
                          title="Move up priority"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => moveShortlistItem(idx, 'down')}
                          disabled={idx === shortlist.length - 1}
                          title="Move down priority"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>
                      <button 
                        type="button" 
                        className="delete-item-btn"
                        onClick={() => toggleShortlist(item)}
                        title="Remove from shortlist"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Predictions Search Results View */}
      {searched && !showShortlistOnly && (
        <div className="results-container">
          
          <div className="results-header-row">
            <h2 className="results-title">Prediction Results ({processedResults.length} matches)</h2>
          </div>

          {/* PDF Report Download Panel */}
          {processedResults.length > 0 && (
            <div className="payment-panel glass-panel">
              <div className="payment-layout">
                <div className="pricing-details-col">
                  <h3 className="lock-title">
                    {isUnlocked ? '🔓 Cutoff PDF Report Unlocked' : '🔒 Cutoff PDF Report'}
                  </h3>
                  <p className="payment-info-text">
                    {isUnlocked 
                      ? 'You have full access! Download the complete 3-year cutoff history sheet (2023-2025 rounds side-by-side) in high-resolution landscape A4 format.'
                      : 'Unlock the complete 3-year cutoff history sheet (2023-2025 rounds side-by-side) in high-resolution landscape A4 format.'}
                  </p>
                  
                  {!isUnlocked && (
                    <div className="pricing-breakdown">
                      <div className="breakdown-item">
                        <span>Base Predictor Report</span>
                        <span>₹99</span>
                      </div>
                      {selectedCategories.length > 1 && (
                        <div className="breakdown-item">
                          <span>Extra Categories (+{selectedCategories.length - 1})</span>
                          <span>+₹{(selectedCategories.length - 1) * 30}</span>
                        </div>
                      )}
                      {selectedCourses.length > 1 && (
                        <div className="breakdown-item">
                          <span>Extra Courses (+{selectedCourses.length - 1})</span>
                          <span>+₹{(selectedCourses.length - 1) * 10}</span>
                        </div>
                      )}
                      {discountPercent > 0 && (
                        <div className="breakdown-item discount">
                          <span>Coupon Discount ({discountPercent}%)</span>
                          <span>-₹{((99 + (selectedCategories.length > 1 ? (selectedCategories.length - 1) * 30 : 0) + (selectedCourses.length > 1 ? (selectedCourses.length - 1) * 10 : 0)) * discountPercent) / 100}</span>
                        </div>
                      )}
                      <div className="price-total">
                        <span>Total Amount</span>
                        <span className="total-amount-val">₹{getDynamicPrice()}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="coupon-actions-col">
                  {isUnlocked ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                      <button 
                        type="button"
                        onClick={() => downloadReportPDF('results')} 
                        className="btn predict-submit-btn payment-cta-btn unlocked"
                        disabled={pdfLoading}
                      >
                        <Download size={18} />
                        {pdfLoading ? 'Generating PDF...' : 'Download Report'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Coupon input section */}
                      {appliedCoupon ? (
                        <div className="applied-coupon-box">
                          <span className="coupon-label">Applied Coupon</span>
                          <span className="coupon-success-msg">Code: {appliedCoupon.toUpperCase()} ({discountPercent}% OFF)</span>
                          <button type="button" className="btn-remove-coupon" onClick={handleRemoveCoupon}>
                            Remove Coupon
                          </button>
                        </div>
                      ) : (
                        <div className="coupon-input-wrapper">
                          <span className="coupon-label">Have a coupon?</span>
                          <div className="coupon-field-row">
                            <input 
                              type="text" 
                              placeholder="Enter coupon" 
                              value={couponCode} 
                              onChange={(e) => setCouponCode(e.target.value)}
                            />
                            <button type="button" className="btn-apply-coupon" onClick={handleApplyCoupon}>
                              Apply
                            </button>
                          </div>
                          {couponError && <span className="coupon-error-msg">{couponError}</span>}
                          {couponSuccess && <span className="coupon-success-msg">{couponSuccess}</span>}
                        </div>
                      )}

                      {/* Payment Action Button */}
                      <button 
                        type="button"
                        onClick={handlePaymentCheckout} 
                        className={`btn predict-submit-btn payment-cta-btn ${getDynamicPrice() === 0 ? 'unlocked' : ''}`}
                        disabled={pdfLoading || paymentLoading}
                      >
                        {paymentLoading ? (
                          'Initializing...'
                        ) : getDynamicPrice() === 0 ? (
                          <>
                            <Download size={18} />
                            Get Report (Free)
                          </>
                        ) : (
                          `Pay ₹${getDynamicPrice()} & Unlock`
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Controls Bar for Filters & Sorting */}
          <div className="results-controls-panel glass-panel">
            <div className="controls-summary-row" onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
              <div className="summary-left">
                <SlidersHorizontal size={18} />
                <h3>Filter & Sort Predictions ({processedResults.length} matches)</h3>
              </div>
              <div className="summary-right">
                {isFilterExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>

            {isFilterExpanded && (
              <div className="filters-expanded-content">
                <div className="filters-grid">
                  <div className="filter-group">
                    <label>College Seat Type</label>
                    <select 
                      value={collegeTypeFilter} 
                      onChange={(e) => setCollegeTypeFilter(e.target.value)}
                    >
                      <option value="All">All Types</option>
                      <option value="Government">Government / University Seat</option>
                      <option value="Aided">Aided Seat</option>
                      <option value="Private">Private / Un-Aided Seat</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <label>District / City</label>
                    <select 
                      value={districtFilter} 
                      onChange={(e) => setDistrictFilter(e.target.value)}
                    >
                      <option value="All">All Districts</option>
                      {availableDistricts.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-group">
                    <label>Sort By Preference</label>
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="cutoff_asc">Cutoff: Low to High (More Competitive)</option>
                      <option value="cutoff_desc">Cutoff: High to Low (Less Competitive)</option>
                      <option value="name_asc">College Name: A to Z</option>
                      <option value="chances_asc">Admission Chance: Safe First</option>
                    </select>
                  </div>
                </div>

                <div className="filter-actions-row">
                  <button 
                    type="button" 
                    className="action-btn-reset"
                    onClick={() => {
                      setCollegeTypeFilter('All');
                      setDistrictFilter('All');
                      setSortBy('cutoff_asc');
                    }}
                  >
                    Reset Filters
                  </button>
                  <button 
                    type="button" 
                    onClick={() => downloadReportPDF('results')} 
                    className="action-btn-pdf"
                    disabled={processedResults.length === 0}
                  >
                    <Download size={14} /> Download Prediction Report (PDF)
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {loading ? (
            <div className="empty-state">
              <div className="spinner">Analyzing rank records...</div>
            </div>
          ) : processedResults.length > 0 ? (
            <div className="results-grid">
              {processedResults.map((result, idx) => {
                const cardKey = `${result.college_code}|${result.course_name}|${result.category}`;
                const isCardExpanded = expandedCard === cardKey;
                const isStarred = isShortlisted(result);
                
                return (
                  <div 
                    key={idx} 
                    className={`college-card chances-${result.chances} ${isCardExpanded ? 'expanded' : ''}`}
                  >
                    <div className="card-header">
                      <span className="college-code">{result.college_code}</span>
                      <div className="action-icons">
                        <button 
                          type="button" 
                          className={`star-btn ${isStarred ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleShortlist(result);
                          }}
                          title={isStarred ? "Remove from shortlist" : "Add to option entry shortlist"}
                        >
                          <Star size={18} fill={isStarred ? "var(--warning-color)" : "none"} color={isStarred ? "var(--warning-color)" : "currentColor"} />
                        </button>
                      </div>
                      <span className={`badge ${result.chances}`}>{result.chances}</span>
                    </div>

                    <div className="card-content-click" onClick={() => handleCardExpand(result)}>
                      <div className="type-meta">{getCollegeType(result.college_name)} college | {getCollegeCity(result.college_name)}</div>
                      <h3 className="college-name">{result.college_name}</h3>
                      <div className="course-name">
                        <BookOpen size={14} style={{display:'inline', marginRight:'6px', verticalAlign:'middle'}}/>
                        {result.course_name}
                      </div>
                      
                      <div className="stats">
                        <div className="stat-item">
                          <span className="stat-label">Last Cutoff ({result.category})</span>
                          <span className="stat-value">{result.cutoff_rank}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Counselling Year / Round</span>
                          <span className="stat-value">{result.year} / R{result.round}</span>
                        </div>
                      </div>

                      <div className="odds-container">
                        <div className="odds-label-row">
                          <span className="odds-label">Admission Probability</span>
                          <span className="odds-value">
                            {result.chances === 'Safe' ? '90%' : result.chances === 'Moderate' ? '55%' : '15%'}
                          </span>
                        </div>
                        <div className="odds-bar-bg">
                          <div className={`odds-bar-fill ${result.chances}`} style={{ width: result.chances === 'Safe' ? '90%' : result.chances === 'Moderate' ? '55%' : '15%' }}></div>
                        </div>
                        <span className="odds-desc">
                          {result.chances === 'Safe' 
                            ? 'Excellent chance of allotment' 
                            : result.chances === 'Moderate' 
                              ? 'Good chance, recommended to list in choices' 
                              : 'High competition, keep as backup option'}
                        </span>
                      </div>
                      
                      <div className="expand-indicator-row">
                        <span>{isCardExpanded ? 'Close Cutoff Trends' : 'View 3-Year Cutoff Graph'}</span>
                        {isCardExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>

                    {/* Expanded Content with Trend Chart */}
                    {isCardExpanded && (
                      <div className="card-expanded-drawer">
                        {trendsLoading[cardKey] ? (
                          <div className="chart-loading">Loading trend statistics...</div>
                        ) : (
                          renderTrendChart(cardKey)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-panel empty-state">
              <Compass size={48} className="empty-icon" />
              <h3>No matching colleges found</h3>
              <p>No cutoffs match this combination. Try modifying your category, rank filters, or select other courses.</p>
            </div>
          )}
        </div>
      )}

      {/* Info Guide Accordion Section */}
      <section className="guide-faq-section glass-panel">
        <h3 className="guide-section-title"><HelpCircle size={20} /> KCET Option Entry & Choice Rules Guide</h3>
        <p className="guide-description">Understanding the KEA counselling choices is critical. Review the rules below to make informed option selections:</p>
        
        <div className="faq-accordion-container">
          {[
            {
              q: "What is KEA Option Entry?",
              a: "During option entry, you enter your preferred combinations of college and course in a prioritized list (e.g. priority #1 is your most desired seat, priority #2 is next, and so on). KEA processes the list from top to bottom, checking if your rank qualifies for a seat. You will be allotted the highest option on your list for which you meet the cutoff."
            },
            {
              q: "What is Choice 1, Choice 2, Choice 3, and Choice 4 in KEA?",
              a: "After a seat is allotted in Round 1/2, you must select one of four choices:\n\n• Choice 1: Satisfied with seat. Accept, pay fee, download admission order, and join the college. You are out of further rounds.\n• Choice 2: Satisfied but want to participate in the next round for HIGHER priority options. Hold the current seat; if a higher option is allotted in the next round, the current seat is lost. If no higher option is allotted, you keep this seat.\n• Choice 3: Not satisfied. Reject the allotted seat, but participate in the next round. The current seat is freed up for other candidates.\n• Choice 4: Not satisfied. Reject the seat and exit KEA counselling entirely."
            },
            {
              q: "How does the EDU YODHA shortlist planner help me?",
              a: "You can shortlist potential matches by clicking the star icon in the predictor. Go to 'My Option Entry', arrange them in order of priority using the Up/Down buttons, and download it as a PDF. Use this PDF as a copy sheets template when filling choices in the KEA portal."
            },
            {
              q: "What are Kalyana-Karnataka (HK) categories?",
              a: "Kalyana-Karnataka region candidates have 8% reserve seats in State-level institutions and 70-80% reservations in local institutions across Bidar, Kalaburagi, Yadgir, Raichur, Koppal, Vijayanagar, and Ballari districts. Select 'Kalyana-Karnataka (371j)' to search with HK-specific category codes ending with 'H' (e.g. GMH, 2AH)."
            }
          ].map((item, idx) => (
            <div key={idx} className={`faq-card ${faqExpanded[idx] ? 'open' : ''}`}>
              <div className="faq-question" onClick={() => toggleFaq(idx)}>
                <h4>{item.q}</h4>
                {faqExpanded[idx] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
              {faqExpanded[idx] && (
                <div className="faq-answer">
                  <p>{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="footer-divider">
          <div className="footer-links">
            <button type="button" className="footer-link-btn" onClick={() => setActivePolicyModal('about')}>About Us</button>
            <button type="button" className="footer-link-btn" onClick={() => setActivePolicyModal('contact')}>Contact Us</button>
            <button type="button" className="footer-link-btn" onClick={() => setActivePolicyModal('terms')}>Terms & Conditions</button>
            <button type="button" className="footer-link-btn" onClick={() => setActivePolicyModal('privacy')}>Privacy Policy</button>
            <button type="button" className="footer-link-btn" onClick={() => setActivePolicyModal('refund')}>Refund & Cancellation Policy</button>
            <button type="button" className="footer-link-btn" onClick={() => setActivePolicyModal('shipping')}>Shipping & Delivery Policy</button>
          </div>
          <p>© 2026 EDU YODHA. All rights reserved. Cutoff trends are compiled from KEA official statistics.</p>
        </div>
      </footer>

      {/* Policy Modal */}
      {activePolicyModal && (
        <div className="policy-modal-overlay" onClick={() => setActivePolicyModal(null)}>
          <div className="policy-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="policy-modal-header">
              <h3>{getPolicyTitle(activePolicyModal)}</h3>
              <button type="button" className="policy-modal-close" onClick={() => setActivePolicyModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="policy-modal-body">
              {renderPolicyContent(activePolicyModal)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
