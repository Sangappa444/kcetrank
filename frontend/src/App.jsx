import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Compass, BookOpen, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

function App() {
  const [rank, setRank] = useState('');
  const [category, setCategory] = useState('1G');
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const categories = [
    '1G', '1K', '1R', '2AG', '2AK', '2AR', '2BG', '2BK', '2BR', 
    '3AG', '3AK', '3AR', '3BG', '3BK', '3BR', 
    'GM', 'GMK', 'GMR', 'SCG', 'SCK', 'SCR', 'STG', 'STK', 'STR'
  ];

  useEffect(() => {
    // Fetch unique courses on mount
    axios.get(`${API_BASE_URL}/courses`)
      .then(res => setCourses(res.data))
      .catch(err => console.error("Error fetching courses:", err));
  }, []);

  const handlePredict = async (e) => {
    e.preventDefault();
    if (!rank || !category) return;
    
    setLoading(true);
    setSearched(true);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/predict`, {
        params: { rank, category, course_name: selectedCourse }
      });
      setResults(response.data);
    } catch (error) {
      console.error("Prediction error:", error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    try {
      if (results.length === 0) {
        alert("No results to generate PDF");
        return;
      }
      
      // Initialize properly for modern jsPDF
      const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
      
      doc.setFontSize(18);
      doc.text('KCET Cutoff Rank Predictions', 14, 20);
      
      doc.setFontSize(12);
      doc.text(`Category: ${category} | User Rank: ${rank}`, 14, 28);
      if (selectedCourse) {
        doc.text(`Preferred Course: ${selectedCourse}`, 14, 34);
      }
      
      // Pivot data by College and Course
      const grouped = {};
      results.forEach(r => {
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

      const tableColumn = [
        "College Name & Course", 
        "2023 R1", "2023 R2", "2023 R3", 
        "2024 R1", "2024 R2", "2024 R3", 
        "2025 R1", "2025 R2", "2025 R3"
      ];
      
      const tableRows = Object.values(grouped).map(g => [
        g.name,
        g['2023_1'], g['2023_2'], g['2023_3'],
        g['2024_1'], g['2024_2'], g['2024_3'],
        g['2025_1'], g['2025_2'], g['2025_3']
      ]);

      autoTable(doc, {
        startY: selectedCourse ? 40 : 34,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [99, 102, 241], halign: 'center' },
        columnStyles: {
          0: { cellWidth: 80 }
        },
        bodyStyles: { halign: 'center' },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 0) {
            data.cell.styles.halign = 'left';
          }
        }
      });

      // Force reliable download by manually creating Blob and Anchor tag
      const filename = `KCET_Cutoffs_${category}_Rank${rank}.pdf`;
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
      console.error("PDF Generation Error:", err);
      alert("Failed to generate PDF. Check console for details.");
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>KCET Predictor</h1>
        <p className="subtitle">Discover your chances of getting into top engineering colleges in Karnataka</p>
      </header>

      <div className="glass-panel">
        <form className="search-form" onSubmit={handlePredict}>
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
            <label htmlFor="category">Category</label>
            <select 
              id="category" 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="course">Preferred Course (Optional)</label>
            <select 
              id="course" 
              value={selectedCourse} 
              onChange={(e) => setSelectedCourse(e.target.value)}
            >
              <option value="">All Courses</option>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Predicting...' : <><Search size={18} /> Predict Colleges</>}
          </button>
        </form>
      </div>

      {searched && (
        <div className="results-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontWeight: 600 }}>
              Prediction Results ({results.length} matched)
            </h2>
            {results.length > 0 && (
              <button onClick={generatePDF} className="btn" style={{ background: '#10b981', height: 'auto', padding: '0.5rem 1rem' }}>
                <Download size={18} /> Download Full PDF Report
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="empty-state">
              <div className="spinner">Loading your future...</div>
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
                    <BookOpen size={14} style={{display:'inline', marginRight:'4px', verticalAlign:'middle'}}/>
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
              <p>Try modifying your category or course preferences.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
