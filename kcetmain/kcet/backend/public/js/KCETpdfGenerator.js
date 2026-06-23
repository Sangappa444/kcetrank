// public/js/pdfGenerator.js
const { jsPDF } = window.jspdf;

async function generatePDF({ rank, selectedCategories, selectedCourses, activeCategory, results, API_BASE_URL, setLoadingState }) {
  setLoadingState(true);
  try {
    // Reuse the pre-fetched results from the predict API call instead of fetching again
    let rows = results;
    console.log('[PDF] Using pre-fetched prediction results. Total records:', rows.length);

    // Yield
    await new Promise(resolve => setTimeout(resolve, 50));

    if (!rows || rows.length === 0) {
      Toastify({ text: "No cutoff data available.", backgroundColor: "#DB4437" }).showToast();
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
    doc.text(`Categories: ${selectedCategories.join(', ')} | User Rank: ${rank} | Stream: ${activeCategory}`, 14, 28);
    if (selectedCourses.length > 0) {
      doc.text(`Selected Courses: ${selectedCourses.join(', ')}`, 14, 34);
    }
    doc.text('Full cutoff history for 2023, 2024, and 2025 (Rounds 1–3)', 14, 40);

    const grouped = {};
    rows.forEach(r => {
      const codeStr = r.college_code ? `[${r.college_code}] ` : '';
      const key = `${codeStr}${r.college_name} \n(${r.course_name}) [Category: ${r.category}]`;
      if (!grouped[key]) {
        grouped[key] = {
          name: `${codeStr}${r.college_name} \n(${r.course_name})`,
          category: r.category,
          '2023_1': '-', '2023_2': '-', '2023_3': '-',
          '2024_1': '-', '2024_2': '-', '2024_3': '-',
          '2025_1': '-', '2025_2': '-', '2025_3': '-',
        };
      }
      if (r.year && r.round) {
        grouped[key].college_name = r.college_name;
        grouped[key][`${r.year}_${r.round}`] = r.cutoff_rank_num || r.cutoff_rank;
      }
    });

    const getMinRank = (g) => {
      const values = [
        g['2023_1'], g['2023_2'], g['2023_3'],
        g['2024_1'], g['2024_2'], g['2024_3'],
        g['2025_1'], g['2025_2'], g['2025_3']
      ];
      let min = Number.MAX_SAFE_INTEGER;
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v !== '-' && v != null) {
          const parsed = parseInt(v, 10);
          if (!isNaN(parsed) && parsed < min) {
            min = parsed;
          }
        }
      }
      return min;
    };

    const getChance = (minCutoff) => {
      if (minCutoff === Number.MAX_SAFE_INTEGER) return 'Tough';
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
      'Category',
      'Chance',
      '2023 R1', '2023 R2', '2023 R3',
      '2024 R1', '2024 R2', '2024 R3',
      '2025 R1', '2025 R2', '2025 R3'
    ];

    const groupsArray = Object.values(grouped).map(g => {
      const minRank = getMinRank(g);
      const chance = getChance(minRank);
      return { ...g, minRank, chance };
    });

    const tableRows = groupsArray
      .sort((a, b) => {
        if (a.minRank !== b.minRank) return a.minRank - b.minRank;
        return a.name.localeCompare(b.name);
      })
      .map(g => [
        g.name,
        g.category,
        g.chance,
        g['2023_1'], g['2023_2'], g['2023_3'],
        g['2024_1'], g['2024_2'], g['2024_3'],
        g['2025_1'], g['2025_2'], g['2025_3']
      ]);

    console.log('[PDF] Total table rows to render:', tableRows.length);
    console.log('[PDF] Grouped colleges count:', Object.keys(grouped).length);

    doc.autoTable({
      startY: 52,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [49, 46, 129], textColor: [255, 255, 255], halign: 'center' },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 20 }, 2: { cellWidth: 25 } },
      bodyStyles: { halign: 'center' },
      didParseCell: data => {
        if (data.section === 'body' && data.column.index === 0) {
          data.cell.styles.halign = 'left';
        }
        if (data.section === 'body' && data.column.index === 2) {
          data.cell.styles.fillColor = getChanceColor(data.cell.raw);
          data.cell.styles.textColor = [17, 24, 39];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    addPdfBranding();

    const filename = `KCET_${activeCategory}_Cutoffs_${selectedCategories.join('_')}_Rank${rank}.pdf`;
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
    Toastify({ text: "PDF downloaded successfully!", backgroundColor: "#0F9D58" }).showToast();
  } catch (err) {
    console.error('PDF Generation Error:', err);
    Toastify({ text: "Failed to generate PDF.", backgroundColor: "#DB4437" }).showToast();
  } finally {
    setLoadingState(false);
  }
}
