import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, Compass, BookOpen, Download, 
  Cpu, Leaf, Stethoscope, Pill, HeartPulse, 
  Activity, GraduationCap, Award
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';



function App() {
  const [rank, setRank] = useState('');
  const [category, setCategory] = useState('1G');
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Engineering');
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [quotaRegion, setQuotaRegion] = useState('RK');

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

  useEffect(() => {
    axios.get(`${API_BASE_URL}/courses`, { params: { category: activeCategory } })
      .then(res => {
        setCourses(res.data);
        setSelectedCourse('');
      })
      .catch(err => console.error("Error fetching courses for category:", err));
  }, [activeCategory]);

  const handlePredict = async (e) => {
    e.preventDefault();
    if (!rank || !category) return;
    
    setLoading(true);
    setSearched(true);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/predict`, {
        params: { 
          rank, 
          category, 
          course_name: selectedCourse,
          course_category: activeCategory
        }
      });
      const sortedResults = response.data.slice().sort((a, b) => {
        if (a.cutoff_rank_num !== b.cutoff_rank_num) {
          return a.cutoff_rank_num - b.cutoff_rank_num;
        }
        if (a.year !== b.year) {
          return a.year - b.year;
        }
        if (a.round !== b.round) {
          return a.round - b.round;
        }
        const collegeCompare = a.college_name.localeCompare(b.college_name);
        return collegeCompare !== 0 ? collegeCompare : a.course_name.localeCompare(b.course_name);
      });
      setResults(sortedResults);
    } catch (error) {
      console.error("Prediction error:", error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!rank || !category) {
      alert('Please enter your rank and category before downloading the report.');
      return;
    }

    setPdfLoading(true);
    try {
      const params = new URLSearchParams({ category });
      if (selectedCourse) params.append('course_name', selectedCourse);
      if (activeCategory) params.append('course_category', activeCategory);

      const response = await axios.get(`${API_BASE_URL}/cutoffs?${params.toString()}`);
      let rows = response.data;

      // Filter to only include college + course combinations present in the prediction results
      const allowedCombinations = new Set(results.map(r => `${r.college_code}|${r.course_name}`));
      rows = rows.filter(r => allowedCombinations.has(`${r.college_code}|${r.course_name}`));

      if (!rows || rows.length === 0) {
        alert('No cutoff data available for the selected inputs.');
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
      const addPdfBranding = () => {
        const totalPages = doc.internal.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const footerText = `EDU YODHA | Generated on ${new Date().toLocaleString()}`;

        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
          doc.setPage(pageNumber);

          doc.saveGraphicsState();
          doc.setGState(new doc.GState({ opacity: 0.04 }));
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(42);
          doc.setTextColor(45, 55, 72);

          for (let y = 18; y < pageHeight + 80; y += 58) {
            for (let x = -35; x < pageWidth + 80; x += 105) {
              doc.text('EDU YODHA', x, y, { angle: -28 });
            }
          }

          doc.restoreGraphicsState();
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(100);
          doc.text(footerText, 14, pageHeight - 10);
          doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 34, pageHeight - 10);
        }
      };
      
      doc.setFontSize(18);
      doc.text('KCET Cutoff History Report', 14, 20);
      doc.setFontSize(12);
      doc.text(`Category: ${category} | User Rank: ${rank} | Stream: ${activeCategory}`, 14, 28);
      if (selectedCourse) {
        doc.text(`Preferred Course: ${selectedCourse}`, 14, 34);
      }
      doc.text('Full cutoff history for 2023, 2024, and 2025 (Rounds 1–3)', 14, 40);

      const grouped = {};
      rows.forEach(r => {
        const key = `${r.college_name} \n(${r.course_name})`;
        if (!grouped[key]) {
          grouped[key] = {
            name: key,
            '2023_1': '-', '2023_2': '-', '2023_3': '-',
            '2024_1': '-', '2024_2': '-', '2024_3': '-',
            '2025_1': '-', '2025_2': '-', '2025_3': '-',
          };
        }
        if (r.year && r.round) {
          grouped[key][`${r.year}_${r.round}`] = r.cutoff_rank;
        }
      });

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
        const cutoffs = [
          g['2023_1'], g['2023_2'], g['2023_3'],
          g['2024_1'], g['2024_2'], g['2024_3'],
          g['2025_1'], g['2025_2'], g['2025_3']
        ]
          .filter(v => v !== '-' && v !== null && v !== undefined)
          .map(v => parseInt(v, 10))
          .filter(Number.isFinite);
        if (!cutoffs.length) return 'Tough';
        const minCutoff = Math.min(...cutoffs);
        if (!rank) return 'Tough';
        const userRank = parseInt(rank, 10);
        if (userRank <= minCutoff * 0.8) return 'Safe';
        if (userRank <= minCutoff) return 'Moderate';
        return 'Tough';
      };

      const getChanceColor = (chance) => {
        if (chance === 'Safe') return [187, 247, 208];
        if (chance === 'Moderate') return [254, 249, 195];
        return [254, 202, 202];
      };

      const tableColumn = [
        'College Name & Course',
        'Chance',
        '2023 R1', '2023 R2', '2023 R3',
        '2024 R1', '2024 R2', '2024 R3',
        '2025 R1', '2025 R2', '2025 R3'
      ];

      const tableRows = Object.values(grouped)
        .sort((a, b) => {
          const aMin = getMinRank(a);
          const bMin = getMinRank(b);
          if (aMin !== bMin) return aMin - bMin;
          return a.name.localeCompare(b.name);
        })
        .map(g => [
          g.name,
          getChance(g),
          g['2023_1'], g['2023_2'], g['2023_3'],
          g['2024_1'], g['2024_2'], g['2024_3'],
          g['2025_1'], g['2025_2'], g['2025_3']
        ]);

      autoTable(doc, {
        startY: 52,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [49, 46, 129], textColor: [255, 255, 255], halign: 'center' },
        columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 30 } },
        bodyStyles: { halign: 'center' },
        didParseCell: data => {
          if (data.section === 'body' && data.column.index === 0) {
            data.cell.styles.halign = 'left';
          }
          if (data.section === 'body' && data.column.index === 1) {
            data.cell.styles.fillColor = getChanceColor(data.cell.raw);
            data.cell.styles.textColor = [17, 24, 39];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      addPdfBranding();

      const filename = `KCET_${activeCategory}_Cutoffs_${category}_Rank${rank}.pdf`;
      const pdfData = doc.output('blob');
      const pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Failed to generate PDF. Check console for details.');
    } finally {
      setPdfLoading(false);
    }
  };



  return (
    <div className="app-container">
      <header>
        <h1>KCET Multi-Course Predictor</h1>
        <p className="subtitle">Check your admission chances across Engineering, Agriculture, Veterinary, Pharmacy, Nursing, BNYS, Allied Health, BPT, and BPO in Karnataka</p>
      </header>

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
                setSearched(false);
              }}
            >
              <span className="tab-icon">{categoryIcons[cat] || <BookOpen size={18} />}</span>
              <span className="tab-label">{cat}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel">
        <form className="search-form" onSubmit={handlePredict}>
          <div className="form-group region-selector-group" style={{ gridColumn: '1 / -1' }}>
            <label>Quota Region</label>
            <div className="region-toggle">
              <button 
                type="button" 
                className={`region-btn ${quotaRegion === 'RK' ? 'active' : ''}`}
                onClick={() => {
                  setQuotaRegion('RK');
                  setCategory('1G');
                  setResults([]);
                  setSearched(false);
                }}
              >
                Rest of Karnataka (General Quota)
              </button>
              <button 
                type="button" 
                className={`region-btn ${quotaRegion === 'HK' ? 'active' : ''}`}
                onClick={() => {
                  setQuotaRegion('HK');
                  setCategory('1H');
                  setResults([]);
                  setSearched(false);
                }}
              >
                Kalyana-Karnataka (371j Quota)
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="rank">Your KCET Rank</label>
            <input 
              type="number" 
              id="rank" 
              placeholder="e.g., 15000" 
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              required
              min="1"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="category">Quota Category</label>
            <select 
              id="category" 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
            >
              {admissionCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="course">Preferred {activeCategory} Course (Optional)</label>
            <select 
              id="course" 
              value={selectedCourse} 
              onChange={(e) => setSelectedCourse(e.target.value)}
            >
              <option value="">All {activeCategory} Courses</option>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Evaluating...' : <><Search size={18} /> Find Match Cutoffs</>}
          </button>
        </form>
      </div>

      {searched && (
        <div className="results-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontWeight: 600, fontSize: '1.75rem' }}>
              Prediction Results ({results.length} matched)
            </h2>
            {results.length > 0 && (
              <button onClick={generatePDF} className="btn btn-download" style={{ background: '#10b981', height: 'auto', padding: '0.6rem 1.2rem', marginTop: 0 }} disabled={pdfLoading}>
                <Download size={18} /> {pdfLoading ? 'Generating PDF...' : `Download ${activeCategory} Cutoff Report`}
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="empty-state">
              <div className="spinner">Evaluating college criteria...</div>
            </div>
          ) : results.length > 0 ? (
            <div className="results-grid">
              {results.map((result, idx) => (
                <div key={idx} className={`college-card chances-${result.chances}`}>
                  <div className="card-header">
                    <span className="college-code">{result.college_code}</span>
                    <span className={`badge ${result.chances}`}>{result.chances}</span>
                  </div>
                  <h3 className="college-name">{result.college_name}</h3>
                  <div className="course-name">
                    <BookOpen size={14} style={{display:'inline', marginRight:'6px', verticalAlign:'middle'}}/>
                    {result.course_name}
                  </div>
                  
                  <div className="stats">
                    <div className="stat-item">
                      <span className="stat-label">Previous Cutoff</span>
                      <span className="stat-value">{result.cutoff_rank}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Year / Round</span>
                      <span className="stat-value">{result.year} / R{result.round}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel empty-state">
              <Compass size={48} className="empty-icon" />
              <h3>No colleges found in this range</h3>
              <p>Try modifying your category or rank preferences.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
