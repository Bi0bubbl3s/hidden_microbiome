import React, { useState, useRef } from 'react';
import { 
  Leaf, 
  Microscope, 
  Database, 
  BookOpen, 
  Trash2, 
  Search, 
  Dna, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  FileText,
  Binary
} from 'lucide-react';
import api from '../utils/api'; 

const TAB_CONFIG = {
  crops: {
    label: 'Crop Species',
    icon: Leaf,
    filename: 'crop_species_template.csv',
    endpoint: '/crops/',
    batchEndpoint: '/crops/batch/',
    requiredCol: 'common_name',
    headers: ['common_name', 'scientific_name', 'plant_group'],
    templateContent: 'common_name,scientific_name,plant_group\nBarley,Hordeum vulgare,Monocot\nTomato,Solanum lycopersicum,Dicot\nRice,Oryza sativa,Monocot\nSunflower,Helianthus annuus,Dicot\n',
    description: 'Provide common name (required), scientific name, and plant clade (Monocot, Dicot, Other).'
  },
  types: {
    label: 'Endophyte Types',
    icon: Microscope,
    filename: 'endophyte_types_template.csv',
    endpoint: '/endophyte-types/',
    batchEndpoint: '/endophyte-types/batch/',
    requiredCol: 'type_name',
    headers: ['type_name'],
    templateContent: 'type_name\nActinobacterial\nYeast\nOomycete\n',
    description: 'Provide taxonomy group name (required).'
  },
  endophytes: {
    label: 'Endophyte Species',
    icon: Dna,
    filename: 'endophyte_species_template.csv',
    endpoint: '/endophytes/',
    batchEndpoint: '/endophytes/batch/',
    requiredCol: 'scientific_name',
    headers: ['scientific_name', 'type_name'],
    templateContent: 'scientific_name,type_name\nFusarium oxysporum,Fungal\nPseudomonas putida,Bacterial\nPenicillium chrysogenum,Fungal\nStreptomyces griseus,Bacterial\n',
    description: 'Provide scientific species name (required) and taxonomic category (e.g. Fungal, Bacterial).'
  },
  structures: {
    label: 'Plant Structures',
    icon: Database,
    filename: 'plant_structures_template.csv',
    endpoint: '/structures/',
    batchEndpoint: '/structures/batch/',
    requiredCol: 'name',
    headers: ['name'],
    templateContent: 'name\nFlower\nPetiole\nTuber\nBark\n',
    description: 'Provide botanical tissue or structure name (required).'
  },
  references: {
    label: 'References',
    icon: BookOpen,
    filename: 'references_template.csv',
    endpoint: '/references/',
    batchEndpoint: '/references/batch/',
    requiredCol: 'title',
    headers: ['title', 'publication_year', 'reference_link'],
    templateContent: 'title,publication_year,reference_link\nBioprospecting agricultural endophytes for stress tolerance,2024,https://doi.org/10.1016/j.agron.2024.01\nPlant microbiome dynamics across seasonal cultivars,2023,https://doi.org/10.1038/s41598-023-0001\n',
    description: 'Provide article title (required), year, and DOI/URL link.'
  },
  sequencing: {
    label: 'Sequencing Methods',
    icon: Binary,
    filename: 'sequencing_methods_template.csv',
    endpoint: '/sequencing-methods/',
    batchEndpoint: '/sequencing-methods/batch/',
    requiredCol: 'method_name',
    headers: ['method_name', 'platform_type', 'description'],
    templateContent: 'method_name,platform_type,description\nSanger Sequencing,Capillary Electrophoresis,Targeted 16S/ITS marker sequencing\nNGS - Whole Genome Sequencing (WGS),Illumina NovaSeq,Short-read whole genome sequencing of isolates\nNGS - Amplicon Metabarcoding,Illumina MiSeq,High-throughput 16S V3-V4 and fungal ITS profiling\nLong-Read (Oxford Nanopore),Oxford Nanopore MinION,Full length 16S-ITS-23S operon sequencing\nLong-Read (PacBio HiFi),PacBio Sequel IIe,High-accuracy long reads for structural variants\nShotgun Metagenomics,Illumina NovaSeq,Direct metagenomic community sequencing\n',
    description: 'Provide sequencing method/technology (required), platform/instrument, and description.'
  }
};

// Robust CSV parser handling commas inside quotes, CRLF, and spaces
const parseCSV = (text) => {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return { headers: [], rows: [] };
  
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
    } else if (char === ',' && !inQuotes) {
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
    h.toLowerCase().trim().replace(/[\s_-]+/g, '_')
  );

  const rows = lines.slice(1).map(line => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = line[idx] !== undefined ? line[idx].trim() : '';
    });
    return obj;
  });
  
  return { headers, rows };
};

const MasterDataScreen = ({ masterData, notify, refreshData }) => {
  const [activeTab, setActiveTab] = useState('crops');
  
  const [newValue, setNewValue] = useState('');
  const [newSubValue, setNewSubValue] = useState(''); 
  const [newCropGroup, setNewCropGroup] = useState('');
  const [newRefYear, setNewRefYear] = useState('');
  const [newRefLink, setNewRefLink] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // CSV Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetTab, setImportTargetTab] = useState('crops');
  const [parsedData, setParsedData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  const currentTabConfig = TAB_CONFIG[activeTab];

  // Helper to trigger CSV Template Download
  const handleDownloadTemplate = (tabKey = activeTab) => {
    const config = TAB_CONFIG[tabKey] || TAB_CONFIG.crops;
    const blob = new Blob([config.templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', config.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify(`Downloaded CSV template for ${config.label}`, 'success');
  };

  // Open import modal for active tab
  const handleOpenImportModal = (tabKey = activeTab) => {
    setImportTargetTab(tabKey);
    setParsedData(null);
    setFileName('');
    setImportError('');
    setIsImportModalOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle file selection and parsing
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setImportError('Please upload a valid .csv file.');
      return;
    }

    setFileName(file.name);
    setImportError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') return;
        
        const { headers, rows } = parseCSV(text);
        if (rows.length === 0) {
          setImportError('The selected CSV file does not contain any data rows.');
          setParsedData(null);
          return;
        }

        const config = TAB_CONFIG[importTargetTab];
        // Validate required header
        const hasRequired = headers.some(h => 
          h === config.requiredCol || 
          h.includes(config.requiredCol) || 
          (config.requiredCol === 'common_name' && (h === 'name' || h === 'crop')) ||
          (config.requiredCol === 'type_name' && (h === 'name' || h === 'type')) ||
          (config.requiredCol === 'scientific_name' && (h === 'species' || h === 'name')) ||
          (config.requiredCol === 'title' && (h === 'name' || h === 'article'))
        );

        if (!hasRequired) {
          setImportError(`Missing required column "${config.requiredCol}". Please download the template to view the expected format.`);
        }

        setParsedData({ headers, rows });
      } catch (err) {
        console.error('Error parsing CSV:', err);
        setImportError('Could not parse the CSV file. Please verify its formatting.');
        setParsedData(null);
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  // Process and send the imported batch
  const handleExecuteImport = async () => {
    if (!parsedData || parsedData.rows.length === 0) return;

    setIsImporting(true);
    setImportError('');
    const config = TAB_CONFIG[importTargetTab];

    try {
      let formattedItems = [];

      if (importTargetTab === 'crops') {
        formattedItems = parsedData.rows.map(row => {
          const common = row.common_name || row.name || row.crop || row[Object.keys(row)[0]];
          const sci = row.scientific_name || row.scientific || null;
          const group = row.plant_group || row.clade || row.group || 'Unknown';
          return { common_name: common, scientific_name: sci, plant_group: group };
        }).filter(item => item.common_name);
      } else if (importTargetTab === 'types') {
        formattedItems = parsedData.rows.map(row => {
          const typeName = row.type_name || row.name || row.type || row[Object.keys(row)[0]];
          return { type_name: typeName };
        }).filter(item => item.type_name);
      } else if (importTargetTab === 'endophytes') {
        formattedItems = parsedData.rows.map(row => {
          const sci = row.scientific_name || row.species || row.name || row[Object.keys(row)[0]];
          const typeName = row.type_name || row.type || row.category || '';
          const typeId = row.endophyte_type_id || null;
          return { scientific_name: sci, type_name: typeName, endophyte_type_id: typeId };
        }).filter(item => item.scientific_name);
      } else if (importTargetTab === 'structures') {
        formattedItems = parsedData.rows.map(row => {
          const structName = row.name || row.structure || row.plant_structure || row[Object.keys(row)[0]];
          return { name: structName };
        }).filter(item => item.name);
      } else if (importTargetTab === 'references') {
        formattedItems = parsedData.rows.map(row => {
          const title = row.title || row.article || row.name || row[Object.keys(row)[0]];
          const year = row.publication_year || row.year || null;
          const link = row.reference_link || row.link || row.url || row.doi || null;
          return { 
            title, 
            publication_year: year ? parseInt(year) : null, 
            reference_link: link 
          };
        }).filter(item => item.title);
      } else if (importTargetTab === 'sequencing') {
        formattedItems = parsedData.rows.map(row => {
          const methodName = row.method_name || row.name || row.method || row.technology || row[Object.keys(row)[0]];
          const platform = row.platform_type || row.platform || row.instrument || null;
          const desc = row.description || row.desc || null;
          return { 
            method_name: methodName, 
            platform_type: platform, 
            description: desc 
          };
        }).filter(item => item.method_name);
      }

      if (formattedItems.length === 0) {
        throw new Error(`No valid records found to import for ${config.label}.`);
      }

      // Try batch import endpoint
      try {
        await api.post(config.batchEndpoint, formattedItems);
      } catch (batchErr) {
        // Fallback to sequential individual posts
        console.warn('Batch endpoint failed, falling back to sequential inserts:', batchErr);
        for (const item of formattedItems) {
          await api.post(config.endpoint, item);
        }
      }

      notify(`Successfully imported ${formattedItems.length} ${config.label.toLowerCase()} record(s)!`, 'success');
      setIsImportModalOpen(false);
      setParsedData(null);
      setFileName('');
      refreshData();
    } catch (err) {
      console.error('Import error:', err);
      setImportError(err.message || 'Failed to complete import.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddData = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === 'crops') {
        await api.post('/crops/', { 
          common_name: newValue, 
          scientific_name: newSubValue || null,
          plant_group: newCropGroup || 'Unknown'
        });
      } else if (activeTab === 'structures') {
        await api.post('/structures/', { name: newValue });
      } else if (activeTab === 'types') {
        await api.post('/endophyte-types/', { type_name: newValue });
      } else if (activeTab === 'references') {
        await api.post('/references/', { 
          title: newValue, 
          publication_year: newRefYear ? parseInt(newRefYear) : null,
          reference_link: newRefLink || null
        });
      } else if (activeTab === 'endophytes') {
        await api.post('/endophytes/', { 
          scientific_name: newValue, 
          endophyte_type_id: parseInt(newSubValue) 
        });
      } else if (activeTab === 'sequencing') {
        await api.post('/sequencing-methods/', {
          method_name: newValue,
          platform_type: newSubValue || null,
          description: newRefLink || null
        });
      }
      
      notify('Master data added successfully!', 'success');
      setNewValue('');
      setNewSubValue('');
      setNewCropGroup('');
      setNewRefYear('');
      setNewRefLink('');
      refreshData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleUpdateCropGroup = async (crop, newGroup) => {
    try {
      await api.put(`/crops/${crop.crop_species_id}`, {
        common_name: crop.common_name,
        scientific_name: crop.scientific_name,
        plant_group: newGroup
      });
      notify('Crop updated successfully!', 'success');
      refreshData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDelete = async (id, endpoint) => {
    try {
      await api.delete(`${endpoint}${id}`);
      notify('Item deleted successfully!', 'success');
      refreshData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const term = searchTerm.toLowerCase();
  
  const filteredCrops = masterData.crops?.filter(c => 
    c.common_name.toLowerCase().includes(term) || 
    (c.scientific_name && c.scientific_name.toLowerCase().includes(term))
  ) || [];
  
  const filteredTypes = masterData.endophyteTypes?.filter(t => 
    t.type_name.toLowerCase().includes(term)
  ) || [];

  const filteredEndophytes = masterData.endophytes?.filter(e => 
    e.scientific_name.toLowerCase().includes(term)
  ) || [];
  
  const filteredStructures = masterData.structures?.filter(s => 
    s.name.toLowerCase().includes(term)
  ) || [];
  
  const filteredReferences = masterData.references?.filter(r => 
    r.title.toLowerCase().includes(term) || 
    (r.publication_year && r.publication_year.toString().includes(term))
  ) || [];

  const filteredSequencing = masterData.sequencingMethods?.filter(s => 
    s.method_name.toLowerCase().includes(term) || 
    (s.platform_type && s.platform_type.toLowerCase().includes(term)) ||
    (s.description && s.description.toLowerCase().includes(term))
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header with Title and Global CSV Tools */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Master Data Management</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage definitions for crops, structures, and endophyte taxonomy.</p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleDownloadTemplate(activeTab)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors shadow-xs"
            title={`Download CSV template for ${currentTabConfig.label}`}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Download CSV Template</span>
          </button>
          
          <button
            onClick={() => handleOpenImportModal(activeTab)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
            title={`Import master data CSV for ${currentTabConfig.label}`}
          >
            <Upload className="w-4 h-4" />
            <span>Import Master Data</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto">
        {Object.entries(TAB_CONFIG).map(([id, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setSearchTerm(''); }}
              className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id 
                ? 'border-emerald-500 text-emerald-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab Sub-Bar with Quick Helper Banner */}
      <div className="flex items-center justify-between bg-emerald-50/60 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>
            Working in <strong>{currentTabConfig.label}</strong>. Need to add multiple items at once?
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadTemplate(activeTab)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            Get Template ({currentTabConfig.filename})
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => handleOpenImportModal(activeTab)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-1">
        {/* Quick Add Form Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4 capitalize">
              Add New {activeTab === 'endophytes' ? 'Species' : activeTab.slice(0, -1)}
            </h3>
            <form onSubmit={handleAddData} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  {activeTab === 'references' ? 'Article Title *' : 
                   activeTab === 'endophytes' ? 'Scientific Name *' : 
                   activeTab === 'sequencing' ? 'Method / Strategy Name *' :
                   'Name / Title *'}
                </label>
                <input 
                  required value={newValue} onChange={(e) => setNewValue(e.target.value)}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50" 
                  placeholder={
                    activeTab === 'references' ? "Enter article title..." : 
                    activeTab === 'endophytes' ? "e.g. Aspergillus niger" : 
                    activeTab === 'sequencing' ? "e.g. Sanger, NGS - WGS, Amplicon 16S" :
                    "Enter name..."
                  }
                />
              </div>
              
              {activeTab === 'crops' && (
                <>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Scientific Name</label>
                    <input 
                      value={newSubValue} onChange={(e) => setNewSubValue(e.target.value)}
                      className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50" 
                      placeholder="Enter scientific name..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Plant Clade *</label>
                    <select 
                      required value={newCropGroup} onChange={(e) => setNewCropGroup(e.target.value)}
                      className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50" 
                    >
                      <option value="">Select...</option>
                      <option value="Monocot">Monocot</option>
                      <option value="Dicot">Dicot</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'endophytes' && (
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Taxonomic Type *</label>
                  <select 
                    required value={newSubValue} onChange={(e) => setNewSubValue(e.target.value)}
                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50" 
                  >
                    <option value="">Select a Category...</option>
                    {masterData.endophyteTypes?.map(t => (
                      <option key={t.endophyte_type_id} value={t.endophyte_type_id}>{t.type_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'references' && (
                <>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Publication Year</label>
                    <input 
                      type="number" value={newRefYear} onChange={(e) => setNewRefYear(e.target.value)}
                      className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50" placeholder="e.g. 2024"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Link / DOI</label>
                    <input 
                      type="url" value={newRefLink} onChange={(e) => setNewRefLink(e.target.value)}
                      className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50" placeholder="https://doi.org/..."
                    />
                  </div>
                </>
              )}

              {activeTab === 'sequencing' && (
                <>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Platform / Instrument (Optional)</label>
                    <input 
                      value={newSubValue} onChange={(e) => setNewSubValue(e.target.value)}
                      className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50" 
                      placeholder="e.g. Illumina NovaSeq, Oxford Nanopore MinION"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Description / Target (Optional)</label>
                    <input 
                      value={newRefLink} onChange={(e) => setNewRefLink(e.target.value)}
                      className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50" 
                      placeholder="e.g. Targeted 16S/ITS marker or whole genome"
                    />
                  </div>
                </>
              )}

              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
                Save Single Record
              </button>
            </form>
          </div>

          {/* Quick CSV Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100/60 rounded-lg text-emerald-700">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-800">Batch CSV Operations</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Upload spreadsheets with multiple records at once to populate {currentTabConfig.label.toLowerCase()}.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleDownloadTemplate(activeTab)}
                    className="flex-1 py-1.5 px-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Template
                  </button>
                  <button
                    onClick={() => handleOpenImportModal(activeTab)}
                    className="flex-1 py-1.5 px-2.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* List View with Search Bar */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" placeholder={`Search ${currentTabConfig.label}...`}
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm bg-white"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-6 py-3 w-24">ID</th>
                  <th className="px-6 py-3">Details</th>
                  {activeTab === 'crops' && <th className="px-6 py-3 w-32">Plant Clade</th>}
                  <th className="px-6 py-3 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeTab === 'crops' && filteredCrops.map(c => (
                  <tr key={c.crop_species_id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4 text-slate-500">#{c.crop_species_id}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {c.common_name} 
                      {c.scientific_name && <span className="text-slate-400 italic font-normal ml-2">{c.scientific_name}</span>}
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={c.plant_group || 'Unknown'} 
                        onChange={(e) => handleUpdateCropGroup(c, e.target.value)}
                        className="rounded border border-slate-300 text-xs p-1.5 bg-slate-50 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="Unknown">Unknown</option>
                        <option value="Monocot">Monocot</option>
                        <option value="Dicot">Dicot</option>
                        <option value="Other">Other</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(c.crop_species_id, '/crops/')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4 inline" /></button>
                    </td>
                  </tr>
                ))}
                
                {activeTab === 'types' && filteredTypes.map(t => (
                  <tr key={t.endophyte_type_id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4 text-slate-500">#{t.endophyte_type_id}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{t.type_name}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(t.endophyte_type_id, '/endophyte-types/')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4 inline" /></button>
                    </td>
                  </tr>
                ))}

                {activeTab === 'endophytes' && filteredEndophytes.map(e => {
                  const type = masterData.endophyteTypes?.find(t => t.endophyte_type_id === e.endophyte_type_id);
                  return (
                    <tr key={e.endophyte_id} className="hover:bg-slate-50/60">
                      <td className="px-6 py-4 text-slate-500">#{e.endophyte_id}</td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        <span className="italic">{e.scientific_name}</span>
                        {type && <span className="ml-2 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full border border-slate-200">{type.type_name}</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDelete(e.endophyte_id, '/endophytes/')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4 inline" /></button>
                      </td>
                    </tr>
                  )
                })}
                
                {activeTab === 'structures' && filteredStructures.map(s => (
                  <tr key={s.plant_structure_id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4 text-slate-500">#{s.plant_structure_id}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{s.name}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(s.plant_structure_id, '/structures/')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4 inline" /></button>
                    </td>
                  </tr>
                ))}
                
                {activeTab === 'references' && filteredReferences.map(r => (
                  <tr key={r.reference_id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4 text-slate-500">#{r.reference_id}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      <div>{r.title}</div>
                      {r.publication_year && <span className="text-slate-500 text-xs font-normal">Published {r.publication_year}</span>}
                      {r.reference_link && (
                        <a href={r.reference_link} target="_blank" rel="noreferrer" className="block text-xs text-emerald-600 hover:text-emerald-700 hover:underline mt-0.5">View Research Article</a>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(r.reference_id, '/references/')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4 inline" /></button>
                    </td>
                  </tr>
                ))}

                {activeTab === 'sequencing' && filteredSequencing.map(s => (
                  <tr key={s.sequencing_method_id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4 text-slate-500">#{s.sequencing_method_id}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{s.method_name}</span>
                        {s.platform_type && (
                          <span className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 font-normal">
                            {s.platform_type}
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <p className="text-slate-500 text-xs mt-0.5 font-normal">{s.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(s.sequencing_method_id, '/sequencing-methods/')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4 inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {((activeTab === 'crops' && filteredCrops.length === 0) ||
              (activeTab === 'types' && filteredTypes.length === 0) ||
              (activeTab === 'endophytes' && filteredEndophytes.length === 0) ||
              (activeTab === 'structures' && filteredStructures.length === 0) ||
              (activeTab === 'references' && filteredReferences.length === 0) ||
              (activeTab === 'sequencing' && filteredSequencing.length === 0)) && (
              <div className="p-12 text-center text-slate-500">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-medium text-slate-700">No records found matching "{searchTerm}"</p>
                <p className="text-xs text-slate-400 mt-1">Add items individually or use the CSV template to import records in bulk.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Import Master Data via CSV</h3>
                  <p className="text-xs text-slate-500">Upload batch records into your dataset</p>
                </div>
              </div>
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Category Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Select Master Data Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(TAB_CONFIG).map(([id, config]) => {
                    const isSelected = importTargetTab === id;
                    const Icon = config.icon;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setImportTargetTab(id);
                          setParsedData(null);
                          setFileName('');
                          setImportError('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                          isSelected 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span>{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Format Description & Template Download Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-slate-400" />
                    Expected CSV Column Format for {TAB_CONFIG[importTargetTab].label}:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate(importTargetTab)}
                    className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Template
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-1.5">
                  {TAB_CONFIG[importTargetTab].headers.map((h, i) => (
                    <span 
                      key={h} 
                      className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                        i === 0 
                          ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900 font-bold' 
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      {h}{i === 0 ? ' (required)' : ''}
                    </span>
                  ))}
                </div>
                <p className="text-slate-500">{TAB_CONFIG[importTargetTab].description}</p>
              </div>

              {/* File Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Upload CSV File
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center transition-colors bg-slate-50/50">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-file-input"
                  />
                  <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center justify-center">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm font-medium text-slate-700">
                      {fileName ? fileName : 'Click to select or drag and drop a .csv file'}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      UTF-8 encoded CSV files up to 5MB supported
                    </span>
                  </label>
                </div>
              </div>

              {/* Error Alert */}
              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Parsed Preview */}
              {parsedData && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Parsed {parsedData.rows.length} row(s) ready to import
                    </span>
                    <span className="text-slate-400">Previewing first 5 rows</span>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          {parsedData.headers.map(h => (
                            <th key={h} className="px-3 py-2 font-mono">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedData.rows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            {parsedData.headers.map(h => (
                              <td key={h} className="px-3 py-1.5 text-slate-700 truncate max-w-[150px]">
                                {row[h] || <span className="text-slate-300 italic">-</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!parsedData || parsedData.rows.length === 0 || isImporting}
                onClick={handleExecuteImport}
                className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isImporting ? (
                  <span>Importing...</span>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Import {parsedData ? `${parsedData.rows.length} Record(s)` : 'Data'}</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default MasterDataScreen;