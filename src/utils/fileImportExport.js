// @ts-nocheck
import * as XLSX from 'xlsx';

/**
 * Universal Table/File Parser supporting:
 * - .xlsx, .xls (Excel workbooks)
 * - .csv (Comma-separated values)
 * - .tsv, .txt (Tab-separated or comma-separated text)
 */

export const parseDataFile = async (file) => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  // Handle Excel files (.xlsx, .xls)
  if (extension === 'xlsx' || extension === 'xls') {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Pick the first sheet or a sheet named 'Observations' / 'Import Data' if available
    let sheetName = workbook.SheetNames[0];
    const preferredSheet = workbook.SheetNames.find(n => 
      n.toLowerCase().includes('observation') || 
      n.toLowerCase().includes('template') || 
      n.toLowerCase().includes('data')
    );
    if (preferredSheet) sheetName = preferredSheet;

    const worksheet = workbook.Sheets[sheetName];
    // Convert to 2D array of strings/values
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!rawData || rawData.length === 0) {
      return { headers: [], rows: [] };
    }

    // Find header line (first non-empty array)
    const headerRowIdx = rawData.findIndex(row => Array.isArray(row) && row.some(cell => String(cell).trim() !== ''));
    if (headerRowIdx === -1) {
      return { headers: [], rows: [] };
    }

    const rawHeaders = rawData[headerRowIdx];
    const headers = rawHeaders.map(h => 
      String(h).toLowerCase().trim().replace(/[\s_-]+/g, '_')
    );

    const rows = [];
    for (let r = headerRowIdx + 1; r < rawData.length; r++) {
      const line = rawData[r];
      if (!Array.isArray(line)) continue;
      
      const rowObj = {};
      let hasData = false;
      headers.forEach((h, idx) => {
        if (!h) return;
        const val = line[idx] !== undefined && line[idx] !== null ? String(line[idx]).trim() : '';
        rowObj[h] = val;
        if (val !== '') hasData = true;
      });

      if (hasData) {
        rows.push(rowObj);
      }
    }

    return { headers, rows, sheetName, availableSheets: workbook.SheetNames };
  }

  // Handle CSV, TSV, or TXT text files
  const text = await file.text();
  return parseDelimitedText(text);
};

/**
 * Robust CSV/TSV/TXT parser handling quotes, multiple delimiters, CRLF, and UTF-8 BOM
 */
export const parseDelimitedText = (text) => {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return { headers: [], rows: [] };

  // Detect delimiter: check if tab (\t) or comma (,) or semicolon (;) is the dominant delimiter
  const firstLine = clean.split(/\r\n|\r|\n/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t';
  } else if (semicolonCount > commaCount && semicolonCount > tabCount) {
    delimiter = ';';
  }

  const lines = [];
  let currentField = '';
  let inQuotes = false;
  let currentLine = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentLine.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentLine.push(currentField.trim());
      currentField = '';
      if (currentLine.some(c => c !== '')) {
        lines.push(currentLine);
      }
      currentLine = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    if (currentLine.some(c => c !== '')) {
      lines.push(currentLine);
    }
  }

  if (lines.length === 0) return { headers: [], rows: [] };

  const rawHeaders = lines[0];
  const headers = rawHeaders.map(h => 
    String(h).toLowerCase().trim().replace(/[\s_-]+/g, '_')
  );

  const rows = [];
  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    const rowObj = {};
    let hasData = false;
    headers.forEach((h, idx) => {
      if (!h) return;
      const val = line[idx] !== undefined ? line[idx].trim() : '';
      rowObj[h] = val;
      if (val !== '') hasData = true;
    });

    if (hasData) {
      rows.push(rowObj);
    }
  }

  return { headers, rows };
};

/**
 * Downloads data as a multi-sheet, user-friendly Excel workbook (.xlsx)
 * with styled column widths and an instructions sheet.
 */
export const downloadExcelFile = ({
  filename = 'data_template.xlsx',
  sheets = [
    {
      name: 'Data',
      headers: [],
      rows: []
    }
  ]
}) => {
  const wb = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    // If headers & rows are provided as array of objects:
    let ws;
    if (sheet.data2D) {
      ws = XLSX.utils.aoa_to_sheet(sheet.data2D);
    } else if (sheet.headers && sheet.rows) {
      // Create with headers row first
      const data = [sheet.headers, ...sheet.rows.map(row => 
        sheet.headers.map(h => row[h] !== undefined ? row[h] : '')
      )];
      ws = XLSX.utils.aoa_to_sheet(data);
    } else {
      ws = XLSX.utils.aoa_to_sheet([['No data']]);
    }

    // Auto calculate column widths
    if (sheet.headers) {
      const colWidths = sheet.headers.map(h => {
        let maxLen = String(h).length;
        if (sheet.rows) {
          sheet.rows.forEach(r => {
            const valLen = String(r[h] || '').length;
            if (valLen > maxLen) maxLen = valLen;
          });
        }
        return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
      });
      ws['!cols'] = colWidths;
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
  });

  XLSX.writeFile(wb, filename);
};

/**
 * Downloads data as plain CSV
 */
export const downloadCSVFile = ({ filename = 'export.csv', content = '' }) => {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
