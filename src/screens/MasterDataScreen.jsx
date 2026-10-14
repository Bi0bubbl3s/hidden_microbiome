// @ts-nocheck
import React, { useState, useRef, useMemo } from 'react';
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
  Binary,
  ShieldCheck,
  ExternalLink,
  Eye,
  Filter,
  Layers,
  MapPin,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import api from '../utils/api'; 
import { parseDataFile, downloadExcelFile, downloadCSVFile } from '../utils/fileImportExport'; 

const TAB_CONFIG = {
  full_entries: {
    label: 'Complete Entries & Verification',
    icon: ShieldCheck,
    isSpecial: true,
    badge: 'Admin Audit',
    description: 'Consolidated view of all joined database records across crop species, physical specimens, tissue tropism, endophyte taxonomy, and citations on one single page.'
  },
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

const MasterDataScreen = ({ masterData, notify, refreshData }) => {
  // Default to the new Complete Entries & Verification view or crops
  const [activeTab, setActiveTab] = useState('full_entries');
  
  // Single record add form state for standard tabs
  const [newValue, setNewValue] = useState('');
  const [newSubValue, setNewSubValue] = useState(''); 
  const [newCropGroup, setNewCropGroup] = useState('');
  const [newRefYear, setNewRefYear] = useState('');
  const [newRefLink, setNewRefLink] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Complete Entries Sub-View & Filters
  const [verificationSubView, setVerificationSubView] = useState('joined'); // 'joined' | 'all_tables'
  const [verificationFilter, setVerificationFilter] = useState('all'); // 'all' | 'complete' | 'missing_accession' | 'missing_reference' | 'missing_coords' | 'fungal' | 'bacterial'
  const [inspectingEntry, setInspectingEntry] = useState(null);

  // CSV/Excel Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetTab, setImportTargetTab] = useState('crops');
  const [parsedData, setParsedData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  const currentTabConfig = TAB_CONFIG[activeTab] || TAB_CONFIG.full_entries;

  // -------------------------------------------------------------
  // RESOLVE FULL JOINED RECORDS FOR VERIFICATION
  // -------------------------------------------------------------
  const joinedFullEntries = useMemo(() => {
    const observations = masterData.observations || [];
    const specimens = masterData.specimens || [];
    const crops = masterData.crops || [];
    const structures = masterData.structures || [];
    const endophytes = masterData.endophytes || [];
    const endophyteTypes = masterData.endophyteTypes || [];
    const references = masterData.references || [];
    const sequencingMethods = masterData.sequencingMethods || [];

    return observations.map((obs) => {
      const specimen = specimens.find(s => s.plant_specimen_id === obs.plant_specimen_id);
      const crop = specimen ? crops.find(c => c.crop_species_id === specimen.crop_species_id) : null;
      const structure = structures.find(s => s.plant_structure_id === obs.plant_structure_id);
      const endo = endophytes.find(e => e.endophyte_id === obs.endophyte_id);
      const endoType = endo ? endophyteTypes.find(t => t.endophyte_type_id === endo.endophyte_type_id) : null;
      const ref = obs.reference_id ? references.find(r => r.reference_id === obs.reference_id) : null;
      
      let seqMethodName = obs.sequencing_method || null;
      let seqPlatform = null;
      if (obs.sequencing_method_id) {
        const foundSeq = sequencingMethods.find(s => s.sequencing_method_id === obs.sequencing_method_id);
        if (foundSeq) {
          seqMethodName = foundSeq.method_name;
          seqPlatform = foundSeq.platform_type;
        }
      }

      const hasCoordinates = specimen && (specimen.latitude !== 0 || specimen.longitude !== 0) && !isNaN(specimen.latitude);
      const hasAccession = Boolean(obs.ncbi_accession && obs.ncbi_accession.trim());
      const hasReference = Boolean(ref && ref.title);
      const isComplete = Boolean(crop && structure && endo && endoType && (hasAccession || hasReference));

      return {
        observation_id: obs.observation_id,
        observation_date: obs.observation_date,
        created_by: obs.created_by,
        ncbi_accession: obs.ncbi_accession,
        specimen,
        specimen_identifier: specimen?.specimen_identifier || `SPEC-${obs.plant_specimen_id}`,
        latitude: specimen?.latitude,
        longitude: specimen?.longitude,
        location_estimated: specimen?.location_estimated,
        crop,
        crop_common_name: crop?.common_name || 'Unassigned Host',
        crop_scientific_name: crop?.scientific_name || '',
        crop_plant_group: crop?.plant_group || 'Unknown',
        structure,
        structure_name: structure?.name || 'Unspecified Tissue',
        endophyte: endo,
        endophyte_name: endo?.scientific_name || 'Unidentified Taxon',
        endophyte_type: endoType?.type_name || 'Unassigned',
        sequencing_method: seqMethodName || 'Not recorded',
        sequencing_platform: seqPlatform,
        reference: ref,
        hasCoordinates,
        hasAccession,
        hasReference,
        isComplete,
        raw: obs
      };
    });
  }, [masterData]);

  // Filtered Complete Entries for verification
  const filteredFullEntries = useMemo(() => {
    let list = [...joinedFullEntries];
    const q = searchTerm.trim().toLowerCase();

    if (q) {
      list = list.filter(item => 
        item.specimen_identifier.toLowerCase().includes(q) ||
        item.crop_common_name.toLowerCase().includes(q) ||
        item.crop_scientific_name.toLowerCase().includes(q) ||
        item.structure_name.toLowerCase().includes(q) ||
        item.endophyte_name.toLowerCase().includes(q) ||
        item.endophyte_type.toLowerCase().includes(q) ||
        item.sequencing_method.toLowerCase().includes(q) ||
        (item.ncbi_accession && item.ncbi_accession.toLowerCase().includes(q)) ||
        (item.reference && item.reference.title.toLowerCase().includes(q))
      );
    }

    if (verificationFilter === 'complete') {
      list = list.filter(item => item.isComplete);
    } else if (verificationFilter === 'missing_accession') {
      list = list.filter(item => !item.hasAccession);
    } else if (verificationFilter === 'missing_reference') {
      list = list.filter(item => !item.hasReference);
    } else if (verificationFilter === 'missing_coords') {
      list = list.filter(item => !item.hasCoordinates);
    } else if (verificationFilter === 'fungal') {
      list = list.filter(item => item.endophyte_type.toLowerCase().includes('fung'));
    } else if (verificationFilter === 'bacterial') {
      list = list.filter(item => item.endophyte_type.toLowerCase().includes('bact'));
    }

    return list;
  }, [joinedFullEntries, searchTerm, verificationFilter]);

  // Overall database verification statistics
  const verificationStats = useMemo(() => {
    const total = joinedFullEntries.length;
    const completeCount = joinedFullEntries.filter(e => e.isComplete).length;
    const withAccession = joinedFullEntries.filter(e => e.hasAccession).length;
    const withRef = joinedFullEntries.filter(e => e.hasReference).length;
    const withCoords = joinedFullEntries.filter(e => e.hasCoordinates).length;
    const pctComplete = total > 0 ? Math.round((completeCount / total) * 100) : 100;

    return {
      total,
      completeCount,
      withAccession,
      withRef,
      withCoords,
      pctComplete,
      cropsCount: masterData.crops?.length || 0,
      endophytesCount: masterData.endophytes?.length || 0,
      structuresCount: masterData.structures?.length || 0,
      seqMethodsCount: masterData.sequencingMethods?.length || 0,
      referencesCount: masterData.references?.length || 0
    };
  }, [joinedFullEntries, masterData]);

  // -------------------------------------------------------------
  // EXPORT ALL MASTER DATA & COMPLETE AUDIT TABLE
  // -------------------------------------------------------------
  const handleExportFullDatabaseWorkbook = () => {
    try {
      // 1. Full Audit Sheet
      const fullRows = joinedFullEntries.map(e => ({
        observation_id: e.observation_id,
        specimen_identifier: e.specimen_identifier,
        crop_common_name: e.crop_common_name,
        crop_scientific_name: e.crop_scientific_name,
        plant_clade: e.crop_plant_group,
        plant_structure: e.structure_name,
        endophyte_scientific_name: e.endophyte_name,
        endophyte_type: e.endophyte_type,
        sequencing_method: e.sequencing_method,
        sequencing_platform: e.sequencing_platform || '',
        ncbi_accession: e.ncbi_accession || '',
        reference_title: e.reference?.title || '',
        reference_year: e.reference?.publication_year || '',
        reference_link: e.reference?.reference_link || '',
        latitude: e.latitude ?? '',
        longitude: e.longitude ?? '',
        location_estimated: e.location_estimated ? 'YES' : 'NO',
        observation_date: e.observation_date,
        verification_status: e.isComplete ? 'VERIFIED_COMPLETE' : 'PARTIAL'
      }));

      // 2. Crop Master Sheet
      const cropRows = (masterData.crops || []).map(c => ({
        crop_species_id: c.crop_species_id,
        common_name: c.common_name,
        scientific_name: c.scientific_name || '',
        plant_group: c.plant_group || ''
      }));

      // 3. Endophyte Master Sheet
      const endoRows = (masterData.endophytes || []).map(e => {
        const type = masterData.endophyteTypes?.find(t => t.endophyte_type_id === e.endophyte_type_id);
        return {
          endophyte_id: e.endophyte_id,
          scientific_name: e.scientific_name,
          endophyte_type: type?.type_name || ''
        };
      });

      // 4. Structures Master Sheet
      const structRows = (masterData.structures || []).map(s => ({
        plant_structure_id: s.plant_structure_id,
        name: s.name
      }));

      // 5. Sequencing Methods Sheet
      const seqRows = (masterData.sequencingMethods || []).map(s => ({
        sequencing_method_id: s.sequencing_method_id,
        method_name: s.method_name,
        platform_type: s.platform_type || '',
        description: s.description || ''
      }));

      // 6. References Sheet
      const refRows = (masterData.references || []).map(r => ({
        reference_id: r.reference_id,
        title: r.title,
        publication_year: r.publication_year || '',
        reference_link: r.reference_link || ''
      }));

      downloadExcelFile({
        filename: `Microbiome_Master_Database_Complete_${new Date().toISOString().split('T')[0]}.xlsx`,
        sheets: [
          {
            name: 'Full_Verified_Entries',
            headers: [
              'observation_id', 'specimen_identifier', 'crop_common_name', 'crop_scientific_name',
              'plant_clade', 'plant_structure', 'endophyte_scientific_name', 'endophyte_type',
              'sequencing_method', 'sequencing_platform', 'ncbi_accession', 'reference_title',
              'reference_year', 'reference_link', 'latitude', 'longitude', 'location_estimated',
              'observation_date', 'verification_status'
            ],
            rows: fullRows
          },
          {
            name: 'Crop_Species_Master',
            headers: ['crop_species_id', 'common_name', 'scientific_name', 'plant_group'],
            rows: cropRows
          },
          {
            name: 'Endophyte_Taxa_Master',
            headers: ['endophyte_id', 'scientific_name', 'endophyte_type'],
            rows: endoRows
          },
          {
            name: 'Plant_Structures_Master',
            headers: ['plant_structure_id', 'name'],
            rows: structRows
          },
          {
            name: 'Sequencing_Methods_Master',
            headers: ['sequencing_method_id', 'method_name', 'platform_type', 'description'],
            rows: seqRows
          },
          {
            name: 'References_Master',
            headers: ['reference_id', 'title', 'publication_year', 'reference_link'],
            rows: refRows
          }
        ]
      });

      notify('Exported complete database workbook with all master tables (.xlsx)!', 'success');
    } catch (err) {
      console.error(err);
      notify('Failed to generate export workbook: ' + err.message, 'error');
    }
  };

  // Export full entries to CSV
  const handleExportFullCSV = () => {
    try {
      const headers = [
        'observation_id', 'specimen_identifier', 'crop_common_name', 'crop_scientific_name',
        'plant_clade', 'plant_structure', 'endophyte_scientific_name', 'endophyte_type',
        'sequencing_method', 'ncbi_accession', 'reference_title', 'latitude', 'longitude',
        'observation_date', 'verification_status'
      ];

      const escapeCSV = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = joinedFullEntries.map(e => [
        e.observation_id,
        escapeCSV(e.specimen_identifier),
        escapeCSV(e.crop_common_name),
        escapeCSV(e.crop_scientific_name),
        escapeCSV(e.crop_plant_group),
        escapeCSV(e.structure_name),
        escapeCSV(e.endophyte_name),
        escapeCSV(e.endophyte_type),
        escapeCSV(e.sequencing_method),
        escapeCSV(e.ncbi_accession || ''),
        escapeCSV(e.reference?.title || ''),
        e.latitude ?? '',
        e.longitude ?? '',
        e.observation_date || '',
        e.isComplete ? 'COMPLETE' : 'PARTIAL'
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\n');
      downloadCSVFile({
        filename: `Microbiome_Complete_Entries_${new Date().toISOString().split('T')[0]}.csv`,
        content: csvContent
      });
      notify('Exported complete entries to CSV', 'success');
    } catch (err) {
      console.error(err);
      notify('Failed to export CSV: ' + err.message, 'error');
    }
  };

  // Helper to trigger Excel Template Download (.xlsx) for standard categories
  const handleDownloadExcelTemplate = (tabKey = activeTab) => {
    try {
      const config = TAB_CONFIG[tabKey] || TAB_CONFIG.crops;
      const lines = config.templateContent.trim().split('\n');
      const headers = lines[0].split(',');
      const sampleRows = lines.slice(1).map(l => {
        const parts = l.split(',');
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = parts[idx] || '';
        });
        return obj;
      });

      let currentRecords = [];
      if (tabKey === 'crops') {
        currentRecords = (masterData.crops || []).map(c => ({
          common_name: c.common_name,
          scientific_name: c.scientific_name || '',
          plant_group: c.plant_group || ''
        }));
      } else if (tabKey === 'types') {
        currentRecords = (masterData.endophyteTypes || []).map(t => ({
          type_name: t.type_name
        }));
      } else if (tabKey === 'endophytes') {
        currentRecords = (masterData.endophytes || []).map(e => ({
          scientific_name: e.scientific_name,
          type_name: e.endophyte_types?.type_name || ''
        }));
      } else if (tabKey === 'structures') {
        currentRecords = (masterData.structures || []).map(s => ({
          name: s.name
        }));
      } else if (tabKey === 'references') {
        currentRecords = (masterData.references || []).map(r => ({
          title: r.title,
          publication_year: r.publication_year || '',
          reference_link: r.reference_link || ''
        }));
      } else if (tabKey === 'sequencing') {
        currentRecords = (masterData.sequencingMethods || []).map(s => ({
          method_name: s.method_name,
          platform_type: s.platform_type || '',
          description: s.description || ''
        }));
      }

      downloadExcelFile({
        filename: config.filename.replace('.csv', '.xlsx'),
        sheets: [
          {
            name: `${config.label}_Template`,
            headers: config.headers,
            rows: sampleRows
          },
          {
            name: 'Instructions',
            data2D: [
              [`Master Data Template: ${config.label}`],
              [''],
              ['Required Column:', config.requiredCol],
              ['Accepted Columns:', config.headers.join(', ')],
              ['Guidelines:', config.description],
              [''],
              ['Tips:', 'You can edit this file in Microsoft Excel, Google Sheets, or Numbers and upload it back as .xlsx, .csv, or .txt!']
            ]
          },
          {
            name: 'Current_Database_Records',
            headers: config.headers,
            rows: currentRecords
          }
        ]
      });
      notify(`Downloaded Excel template for ${config.label}`, 'success');
    } catch (err) {
      console.error('Error generating Excel template:', err);
      handleDownloadCSVTemplate(tabKey);
    }
  };

  const handleDownloadCSVTemplate = (tabKey = activeTab) => {
    const config = TAB_CONFIG[tabKey] || TAB_CONFIG.crops;
    downloadCSVFile({
      filename: config.filename,
      content: config.templateContent
    });
    notify(`Downloaded CSV template for ${config.label}`, 'success');
  };

  const handleDownloadTemplate = handleDownloadExcelTemplate;

  const handleOpenImportModal = (tabKey = activeTab) => {
    const target = tabKey === 'full_entries' ? 'crops' : tabKey;
    setImportTargetTab(target);
    setParsedData(null);
    setFileName('');
    setImportError('');
    setIsImportModalOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportError('');

    try {
      const { headers, rows } = await parseDataFile(file);
      if (!rows || rows.length === 0) {
        setImportError('The selected file does not contain any data rows.');
        setParsedData(null);
        return;
      }

      const config = TAB_CONFIG[importTargetTab];
      const hasRequired = headers.some(h => 
        h === config.requiredCol || 
        h.includes(config.requiredCol) || 
        (config.requiredCol === 'common_name' && (h === 'name' || h === 'crop')) ||
        (config.requiredCol === 'type_name' && (h === 'name' || h === 'type')) ||
        (config.requiredCol === 'scientific_name' && (h === 'species' || h === 'name')) ||
        (config.requiredCol === 'title' && (h === 'name' || h === 'article')) ||
        (config.requiredCol === 'method_name' && (h === 'method' || h === 'sequencing_method' || h === 'name'))
      );

      if (!hasRequired) {
        setImportError(`Missing required column "${config.requiredCol}". Please download the template to view the expected format.`);
      }

      setParsedData({ headers, rows });
    } catch (err) {
      console.error('Error parsing file:', err);
      setImportError(err.message || 'Could not parse the file. Please verify its formatting.');
      setParsedData(null);
    }
  };

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
          return { title, publication_year: year ? parseInt(year) : null, reference_link: link };
        }).filter(item => item.title);
      } else if (importTargetTab === 'sequencing') {
        formattedItems = parsedData.rows.map(row => {
          const method = row.method_name || row.method || row.sequencing_method || row[Object.keys(row)[0]];
          const platform = row.platform_type || row.platform || null;
          const desc = row.description || row.desc || null;
          return { method_name: method, platform_type: platform, description: desc };
        }).filter(item => item.method_name);
      }

      if (formattedItems.length === 0) {
        throw new Error('No valid records could be extracted from the file.');
      }

      const res = await api.post(config.batchEndpoint, { items: formattedItems });
      const createdCount = res.created_count || formattedItems.length;
      notify(`Successfully imported ${createdCount} record(s) to ${config.label}!`, 'success');
      
      setIsImportModalOpen(false);
      setParsedData(null);
      setFileName('');
      refreshData();
    } catch (err) {
      console.error(err);
      setImportError(err.message || 'Failed to import data. Please check your file formatting.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddData = async (e) => {
    e.preventDefault();
    if (activeTab === 'full_entries') return;

    let payload = {};
    const config = TAB_CONFIG[activeTab];

    if (activeTab === 'crops') {
      payload = { common_name: newValue, scientific_name: newSubValue, plant_group: newCropGroup };
    } else if (activeTab === 'types') {
      payload = { type_name: newValue };
    } else if (activeTab === 'endophytes') {
      payload = { scientific_name: newValue, endophyte_type_id: parseInt(newSubValue) };
    } else if (activeTab === 'structures') {
      payload = { name: newValue };
    } else if (activeTab === 'references') {
      payload = { 
        title: newValue, 
        publication_year: newRefYear ? parseInt(newRefYear) : null,
        reference_link: newRefLink || null
      };
    } else if (activeTab === 'sequencing') {
      payload = {
        method_name: newValue,
        platform_type: newSubValue || null,
        description: newRefLink || null
      };
    }

    try {
      await api.post(config.endpoint, payload);
      notify(`${config.label.slice(0, -1)} added successfully!`, 'success');
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
        ...crop,
        plant_group: newGroup
      });
      notify(`Updated plant clade for ${crop.common_name} to ${newGroup}`, 'success');
      refreshData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDelete = async (id, endpoint) => {
    if (!window.confirm('Are you sure you want to delete this master record?')) return;
    try {
      await api.delete(`${endpoint}${id}`);
      notify('Item deleted successfully!', 'success');
      refreshData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteObservation = async (obsId) => {
    if (!window.confirm(`Delete observation record #${obsId}?`)) return;
    try {
      await api.delete(`/observations/${obsId}/`);
      notify(`Deleted observation record #${obsId}`, 'success');
      refreshData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  // Standard tab filtering
  const term = searchTerm.toLowerCase();
  
  const filteredCrops = (masterData.crops || []).filter(c => 
    c.common_name.toLowerCase().includes(term) || 
    (c.scientific_name && c.scientific_name.toLowerCase().includes(term))
  );
  
  const filteredTypes = (masterData.endophyteTypes || []).filter(t => 
    t.type_name.toLowerCase().includes(term)
  );

  const filteredEndophytes = (masterData.endophytes || []).filter(e => 
    e.scientific_name.toLowerCase().includes(term)
  );
  
  const filteredStructures = (masterData.structures || []).filter(s => 
    s.name.toLowerCase().includes(term)
  );
  
  const filteredReferences = (masterData.references || []).filter(r => 
    r.title.toLowerCase().includes(term) || 
    (r.publication_year && r.publication_year.toString().includes(term))
  );

  const filteredSequencing = (masterData.sequencingMethods || []).filter(s => 
    s.method_name.toLowerCase().includes(term) || 
    (s.platform_type && s.platform_type.toLowerCase().includes(term)) ||
    (s.description && s.description.toLowerCase().includes(term))
  );

  return (
    <div className="space-y-6">
      {/* Header with Title and Global Export/Import Tools */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Master Data Management</h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Admin Portal
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            Audit, verify, and manage definitions for crops, taxonomy, tissue tropism, and full biological records.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportFullDatabaseWorkbook}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-xs cursor-pointer"
            title="Download complete database audit workbook (.xlsx) containing all master registries and joined records"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Export Full Database (.xlsx)</span>
          </button>

          <button
            onClick={() => handleOpenImportModal(activeTab === 'full_entries' ? 'crops' : activeTab)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer"
            title="Import batch master data via Excel (.xlsx), CSV (.csv), or text (.txt)"
          >
            <Upload className="w-4 h-4" />
            <span>Import Data File</span>
          </button>

          <button
            onClick={() => { refreshData(); notify('Master data refreshed from server', 'info'); }}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            title="Reload all master data from database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tabs Navigation Bar */}
      <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto pb-px">
        {Object.entries(TAB_CONFIG).map(([id, config]) => {
          const Icon = config.icon;
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setSearchTerm(''); }}
              className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive 
                  ? 'border-emerald-600 text-emerald-700 font-semibold bg-emerald-50/40 rounded-t-lg' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{config.label}</span>
              {config.badge && (
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {config.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* COMPLETE / FULL ENTRIES SECTION (THE ADMIN AUDIT & VERIFICATION WORKSPACE) */}
      {/* ========================================================================= */}
      {activeTab === 'full_entries' && (
        <section className="space-y-6">
          
          {/* Top KPI Metrics & Verification Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-medium text-slate-500">Total Observations</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{verificationStats.total}</div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Joined Records</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-xs bg-emerald-50/20">
              <span className="text-xs font-medium text-emerald-800">Fully Verified</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{verificationStats.completeCount}</div>
              <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">{verificationStats.pctComplete}% complete entries</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-medium text-slate-500">Host Crops</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{verificationStats.cropsCount}</div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Species cataloged</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-medium text-slate-500">Endophyte Taxa</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{verificationStats.endophytesCount}</div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Microbial isolates</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-medium text-slate-500">NCBI Accessions</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{verificationStats.withAccession}</div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">GenBank / SRA linked</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-medium text-slate-500">Literature Citations</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{verificationStats.withRef}</div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Published DOIs</span>
            </div>
          </div>

          {/* Sub-View Switcher & Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              
              {/* View Switcher Toggle */}
              <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setVerificationSubView('joined')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    verificationSubView === 'joined'
                      ? 'bg-white text-emerald-800 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Joined Composite Records ({joinedFullEntries.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVerificationSubView('all_tables')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    verificationSubView === 'all_tables'
                      ? 'bg-white text-emerald-800 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span>All 6 Master Registries on One Page</span>
                </button>
              </div>

              {/* Quick Export Shortcuts */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportFullCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                  title="Download CSV of all joined records"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export Joined CSV</span>
                </button>
                <button
                  onClick={handleExportFullDatabaseWorkbook}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
                  title="Download complete multi-sheet Excel workbook"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Full Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Universal Search & Quality Filter Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-1 border-t border-slate-100">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Filter by crop name, endophyte species, accession, tissue, reference, or specimen ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {verificationSubView === 'joined' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <div className="flex items-center gap-1 flex-wrap">
                    {[
                      { id: 'all', label: 'All Records' },
                      { id: 'complete', label: 'Verified Complete' },
                      { id: 'missing_accession', label: 'Missing NCBI' },
                      { id: 'missing_reference', label: 'Missing Citation' },
                      { id: 'missing_coords', label: 'Missing GPS' },
                      { id: 'fungal', label: 'Fungal Only' },
                      { id: 'bacterial', label: 'Bacterial Only' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setVerificationFilter(f.id)}
                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                          verificationFilter === f.id
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* SUB-VIEW 1: CONSOLIDATED JOINED RECORDS TABLE */}
          {/* ------------------------------------------------------------- */}
          {verificationSubView === 'joined' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-800 text-sm">
                    Complete Database Entries Verification
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    ({filteredFullEntries.length} of {joinedFullEntries.length} records shown)
                  </span>
                </div>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Click the eye icon to inspect complete relational keys
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left divide-y divide-slate-200">
                  <thead className="bg-slate-100/80 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3 w-16">ID</th>
                      <th className="px-4 py-3 min-w-[140px]">Specimen Voucher</th>
                      <th className="px-4 py-3 min-w-[150px]">Host Crop Species</th>
                      <th className="px-4 py-3 min-w-[110px]">Plant Tissue</th>
                      <th className="px-4 py-3 min-w-[180px]">Microbial Endophyte</th>
                      <th className="px-4 py-3 min-w-[140px]">Sequencing Strategy</th>
                      <th className="px-4 py-3 min-w-[120px]">NCBI Accession</th>
                      <th className="px-4 py-3 min-w-[180px]">Reference / DOI</th>
                      <th className="px-4 py-3 min-w-[110px]">Coordinates</th>
                      <th className="px-4 py-3 w-28 text-center">Quality</th>
                      <th className="px-4 py-3 w-20 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredFullEntries.map((row) => (
                      <tr key={row.observation_id} className="hover:bg-slate-50/80 transition-colors">
                        
                        {/* ID */}
                        <td className="px-4 py-3 font-mono text-slate-400 font-medium">
                          #{row.observation_id}
                        </td>

                        {/* Specimen Voucher */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{row.specimen_identifier}</div>
                          <span className="text-[11px] text-slate-400">
                            {row.observation_date || 'No date'}
                          </span>
                        </td>

                        {/* Host Crop */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{row.crop_common_name}</div>
                          {row.crop_scientific_name && (
                            <div className="italic text-slate-500 text-[11px]">{row.crop_scientific_name}</div>
                          )}
                          <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                            {row.crop_plant_group}
                          </span>
                        </td>

                        {/* Plant Structure */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Leaf className="w-3 h-3 text-emerald-600" />
                            {row.structure_name}
                          </span>
                        </td>

                        {/* Endophyte Species & Taxon Type */}
                        <td className="px-4 py-3">
                          <div className="font-semibold italic text-slate-900">{row.endophyte_name}</div>
                          <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded font-medium border ${
                            row.endophyte_type.toLowerCase().includes('fung')
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : row.endophyte_type.toLowerCase().includes('bact')
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {row.endophyte_type}
                          </span>
                        </td>

                        {/* Sequencing Strategy */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-700">{row.sequencing_method}</div>
                          {row.sequencing_platform && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[130px]">
                              {row.sequencing_platform}
                            </span>
                          )}
                        </td>

                        {/* NCBI Accession */}
                        <td className="px-4 py-3 font-mono">
                          {row.ncbi_accession ? (
                            <a
                              href={`https://www.ncbi.nlm.nih.gov/nuccore/${row.ncbi_accession}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 hover:underline bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                            >
                              <span>{row.ncbi_accession}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-slate-300 italic">None</span>
                          )}
                        </td>

                        {/* Reference / DOI */}
                        <td className="px-4 py-3">
                          {row.reference ? (
                            <div>
                              <div className="text-slate-800 line-clamp-1 font-medium" title={row.reference.title}>
                                {row.reference.title}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {row.reference.publication_year && (
                                  <span className="text-[10px] text-slate-400">({row.reference.publication_year})</span>
                                )}
                                {row.reference.reference_link && (
                                  <a
                                    href={row.reference.reference_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-emerald-600 hover:underline inline-flex items-center gap-0.5"
                                  >
                                    <span>DOI / Link</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300 italic">No citation</span>
                          )}
                        </td>

                        {/* Coordinates */}
                        <td className="px-4 py-3">
                          {row.hasCoordinates ? (
                            <div>
                              <div className="font-mono text-[11px] text-slate-700">
                                {row.latitude.toFixed(2)}, {row.longitude.toFixed(2)}
                              </div>
                              {row.location_estimated && (
                                <span className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                  Estimated
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 italic">No GPS</span>
                          )}
                        </td>

                        {/* Quality Badge */}
                        <td className="px-4 py-3 text-center">
                          {row.isComplete ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800" title="Missing accession number or citation">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              Partial
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setInspectingEntry(row)}
                            className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded transition-colors mr-1 cursor-pointer"
                            title="Inspect complete relational entity"
                          >
                            <Eye className="w-3.5 h-3.5 inline" />
                          </button>
                          <button
                            onClick={() => handleDeleteObservation(row.observation_id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Delete this observation record"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredFullEntries.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No entries match the active filter or search</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try clearing your search query or switching the verification filter.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* SUB-VIEW 2: MULTI-REGISTRY OVERVIEW (ALL 6 TABLES ON ONE PAGE) */}
          {/* ------------------------------------------------------------- */}
          {verificationSubView === 'all_tables' && (
            <div className="space-y-6">
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 text-xs text-emerald-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Multi-Registry Overview</span>: Verify all 6 base database tables in one unified screen without switching tabs. You can view definitions, inspect counts, or delete erroneous definitions directly below.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* 1. Crop Species Registry */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-96 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Leaf className="w-4 h-4 text-emerald-600" />
                      <h4 className="font-bold text-slate-800 text-xs">Crop Species ({masterData.crops?.length || 0})</h4>
                    </div>
                    <button
                      onClick={() => { setActiveTab('crops'); }}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Manage &rarr;
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 text-xs">
                    {(masterData.crops || []).map(c => (
                      <div key={c.crop_species_id} className="p-2 hover:bg-slate-50 rounded flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">{c.common_name}</span>
                          {c.scientific_name && <span className="italic text-slate-400 block text-[11px]">{c.scientific_name}</span>}
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded mt-0.5 inline-block">{c.plant_group}</span>
                        </div>
                        <button onClick={() => handleDelete(c.crop_species_id, '/crops/')} className="text-slate-300 hover:text-red-500 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Endophyte Species Registry */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-96 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Dna className="w-4 h-4 text-purple-600" />
                      <h4 className="font-bold text-slate-800 text-xs">Endophyte Taxa ({masterData.endophytes?.length || 0})</h4>
                    </div>
                    <button
                      onClick={() => { setActiveTab('endophytes'); }}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Manage &rarr;
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 text-xs">
                    {(masterData.endophytes || []).map(e => {
                      const type = masterData.endophyteTypes?.find(t => t.endophyte_type_id === e.endophyte_type_id);
                      return (
                        <div key={e.endophyte_id} className="p-2 hover:bg-slate-50 rounded flex items-center justify-between">
                          <div>
                            <span className="font-semibold italic text-slate-800">{e.scientific_name}</span>
                            {type && <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 block mt-0.5 w-max">{type.type_name}</span>}
                          </div>
                          <button onClick={() => handleDelete(e.endophyte_id, '/endophytes/')} className="text-slate-300 hover:text-red-500 p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Plant Structures Registry */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-96 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-600" />
                      <h4 className="font-bold text-slate-800 text-xs">Plant Tissues ({masterData.structures?.length || 0})</h4>
                    </div>
                    <button
                      onClick={() => { setActiveTab('structures'); }}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Manage &rarr;
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 text-xs">
                    {(masterData.structures || []).map(s => (
                      <div key={s.plant_structure_id} className="p-2 hover:bg-slate-50 rounded flex items-center justify-between">
                        <span className="font-medium text-slate-800">{s.name}</span>
                        <button onClick={() => handleDelete(s.plant_structure_id, '/structures/')} className="text-slate-300 hover:text-red-500 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Sequencing Methods Registry */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-96 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Binary className="w-4 h-4 text-blue-600" />
                      <h4 className="font-bold text-slate-800 text-xs">Sequencing Technologies ({masterData.sequencingMethods?.length || 0})</h4>
                    </div>
                    <button
                      onClick={() => { setActiveTab('sequencing'); }}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Manage &rarr;
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 text-xs">
                    {(masterData.sequencingMethods || []).map(s => (
                      <div key={s.sequencing_method_id} className="p-2 hover:bg-slate-50 rounded flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">{s.method_name}</span>
                          {s.platform_type && <span className="text-[10px] text-blue-600 bg-blue-50 px-1 py-0.2 rounded block mt-0.5">{s.platform_type}</span>}
                        </div>
                        <button onClick={() => handleDelete(s.sequencing_method_id, '/sequencing-methods/')} className="text-slate-300 hover:text-red-500 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Literature References Registry */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-96 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-amber-600" />
                      <h4 className="font-bold text-slate-800 text-xs">Literature References ({masterData.references?.length || 0})</h4>
                    </div>
                    <button
                      onClick={() => { setActiveTab('references'); }}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Manage &rarr;
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 text-xs">
                    {(masterData.references || []).map(r => (
                      <div key={r.reference_id} className="p-2 hover:bg-slate-50 rounded flex items-center justify-between">
                        <div className="flex-1 pr-2">
                          <span className="font-semibold text-slate-800 line-clamp-1">{r.title}</span>
                          <span className="text-[10px] text-slate-400 block">{r.publication_year ? `(${r.publication_year})` : ''}</span>
                        </div>
                        <button onClick={() => handleDelete(r.reference_id, '/references/')} className="text-slate-300 hover:text-red-500 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. Taxonomic Categories Registry */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-96 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Microscope className="w-4 h-4 text-emerald-600" />
                      <h4 className="font-bold text-slate-800 text-xs">Endophyte Types ({masterData.endophyteTypes?.length || 0})</h4>
                    </div>
                    <button
                      onClick={() => { setActiveTab('types'); }}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Manage &rarr;
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 text-xs">
                    {(masterData.endophyteTypes || []).map(t => (
                      <div key={t.endophyte_type_id} className="p-2 hover:bg-slate-50 rounded flex items-center justify-between">
                        <span className="font-medium text-slate-800">{t.type_name}</span>
                        <button onClick={() => handleDelete(t.endophyte_type_id, '/endophyte-types/')} className="text-slate-300 hover:text-red-500 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

        </section>
      )}

      {/* ========================================================================= */}
      {/* STANDARD SINGLE-CATEGORY TABS (CROPS, ENDOPHYTES, STRUCTURES, ETC.) */}
      {/* ========================================================================= */}
      {activeTab !== 'full_entries' && (
        <div className="space-y-6">
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
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Get Template ({currentTabConfig.filename})
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => handleOpenImportModal(activeTab)}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-1">
            {/* Quick Add Form Column */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200">
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

                  <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-md transition-colors cursor-pointer">
                    Save Single Record
                  </button>
                </form>
              </div>

              {/* Quick CSV Card */}
              <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
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
                        className="flex-1 py-1.5 px-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Template
                      </button>
                      <button
                        onClick={() => handleOpenImportModal(activeTab)}
                        className="flex-1 py-1.5 px-2.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs bg-white"
                />
              </div>

              <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden overflow-x-auto">
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
                        <td className="px-6 py-4 text-slate-500 font-mono">#{c.crop_species_id}</td>
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
                          <button onClick={() => handleDelete(c.crop_species_id, '/crops/')} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 className="w-4 h-4 inline" /></button>
                        </td>
                      </tr>
                    ))}
                    
                    {activeTab === 'types' && filteredTypes.map(t => (
                      <tr key={t.endophyte_type_id} className="hover:bg-slate-50/60">
                        <td className="px-6 py-4 text-slate-500 font-mono">#{t.endophyte_type_id}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{t.type_name}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleDelete(t.endophyte_type_id, '/endophyte-types/')} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 className="w-4 h-4 inline" /></button>
                        </td>
                      </tr>
                    ))}

                    {activeTab === 'endophytes' && filteredEndophytes.map(e => {
                      const type = masterData.endophyteTypes?.find(t => t.endophyte_type_id === e.endophyte_type_id);
                      return (
                        <tr key={e.endophyte_id} className="hover:bg-slate-50/60">
                          <td className="px-6 py-4 text-slate-500 font-mono">#{e.endophyte_id}</td>
                          <td className="px-6 py-4 font-medium text-slate-800">
                            <span className="italic">{e.scientific_name}</span>
                            {type && <span className="ml-2 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full border border-slate-200">{type.type_name}</span>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDelete(e.endophyte_id, '/endophytes/')} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 className="w-4 h-4 inline" /></button>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {activeTab === 'structures' && filteredStructures.map(s => (
                      <tr key={s.plant_structure_id} className="hover:bg-slate-50/60">
                        <td className="px-6 py-4 text-slate-500 font-mono">#{s.plant_structure_id}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{s.name}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleDelete(s.plant_structure_id, '/structures/')} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 className="w-4 h-4 inline" /></button>
                        </td>
                      </tr>
                    ))}
                    
                    {activeTab === 'references' && filteredReferences.map(r => (
                      <tr key={r.reference_id} className="hover:bg-slate-50/60">
                        <td className="px-6 py-4 text-slate-500 font-mono">#{r.reference_id}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">
                          <div>{r.title}</div>
                          {r.publication_year && <span className="text-slate-500 text-xs font-normal">Published {r.publication_year}</span>}
                          {r.reference_link && (
                            <a href={r.reference_link} target="_blank" rel="noreferrer" className="block text-xs text-emerald-600 hover:text-emerald-700 hover:underline mt-0.5">View Research Article</a>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleDelete(r.reference_id, '/references/')} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 className="w-4 h-4 inline" /></button>
                        </td>
                      </tr>
                    ))}

                    {activeTab === 'sequencing' && filteredSequencing.map(s => (
                      <tr key={s.sequencing_method_id} className="hover:bg-slate-50/60">
                        <td className="px-6 py-4 text-slate-500 font-mono">#{s.sequencing_method_id}</td>
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
                          <button onClick={() => handleDelete(s.sequencing_method_id, '/sequencing-methods/')} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 className="w-4 h-4 inline" /></button>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* INSPECT ENTRY RELATIONAL KEYS MODAL */}
      {/* ========================================================================= */}
      {inspectingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Record #{inspectingEntry.observation_id} Database Inspection</h3>
                  <p className="text-xs text-slate-500">Specimen {inspectingEntry.specimen_identifier}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectingEntry(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              
              {/* Relational Database Foreign Keys */}
              <div>
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2">
                  Database Foreign Keys & Identifiers
                </h4>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px]">
                  <div><span className="text-slate-400">observation_id:</span> {inspectingEntry.observation_id}</div>
                  <div><span className="text-slate-400">plant_specimen_id:</span> {inspectingEntry.specimen?.plant_specimen_id}</div>
                  <div><span className="text-slate-400">crop_species_id:</span> {inspectingEntry.crop?.crop_species_id || 'null'}</div>
                  <div><span className="text-slate-400">endophyte_id:</span> {inspectingEntry.endophyte?.endophyte_id || 'null'}</div>
                  <div><span className="text-slate-400">plant_structure_id:</span> {inspectingEntry.structure?.plant_structure_id || 'null'}</div>
                  <div><span className="text-slate-400">reference_id:</span> {inspectingEntry.reference?.reference_id || 'null'}</div>
                  <div><span className="text-slate-400">sequencing_method_id:</span> {inspectingEntry.raw?.sequencing_method_id || 'null'}</div>
                </div>
              </div>

              {/* Resolved Biological Metadata */}
              <div>
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2">
                  Resolved Biological Metadata
                </h4>
                <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-white">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Host Crop:</span>
                    <span className="font-semibold text-slate-800">
                      {inspectingEntry.crop_common_name} ({inspectingEntry.crop_scientific_name || 'No sci name'}) · {inspectingEntry.crop_plant_group}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Target Plant Structure:</span>
                    <span className="font-semibold text-slate-800">{inspectingEntry.structure_name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Microbial Endophyte:</span>
                    <span className="font-semibold text-purple-700 italic">
                      {inspectingEntry.endophyte_name} ({inspectingEntry.endophyte_type})
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Sequencing Technology:</span>
                    <span className="font-medium text-slate-800">
                      {inspectingEntry.sequencing_method} {inspectingEntry.sequencing_platform ? `[${inspectingEntry.sequencing_platform}]` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">NCBI GenBank Accession:</span>
                    <span>
                      {inspectingEntry.ncbi_accession ? (
                        <a
                          href={`https://www.ncbi.nlm.nih.gov/nuccore/${inspectingEntry.ncbi_accession}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono font-bold text-emerald-700 hover:underline flex items-center gap-1"
                        >
                          {inspectingEntry.ncbi_accession}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">None logged</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Collection Coordinates:</span>
                    <span className="font-mono text-slate-800">
                      {inspectingEntry.hasCoordinates 
                        ? `${inspectingEntry.latitude}, ${inspectingEntry.longitude} ${inspectingEntry.location_estimated ? '(Estimated)' : '(Verified GPS)'}` 
                        : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Literature Reference:</span>
                    <span className="text-right max-w-[280px]">
                      {inspectingEntry.reference ? (
                        <>
                          <div className="font-medium text-slate-800">{inspectingEntry.reference.title}</div>
                          {inspectingEntry.reference.reference_link && (
                            <a href={inspectingEntry.reference.reference_link} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">
                              {inspectingEntry.reference.reference_link}
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 italic">No reference cited</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  handleDeleteObservation(inspectingEntry.observation_id);
                  setInspectingEntry(null);
                }}
                className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Record
              </button>
              <button
                type="button"
                onClick={() => setInspectingEntry(null)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CSV/EXCEL IMPORT MODAL */}
      {/* ========================================================================= */}
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
                  <h3 className="font-bold text-slate-800 text-lg">Import Master Data via File</h3>
                  <p className="text-xs text-slate-500">Upload batch records into your dataset using Excel (.xlsx), CSV, or text</p>
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
                  {Object.entries(TAB_CONFIG).filter(([id]) => id !== 'full_entries').map(([id, config]) => {
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
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
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
              {TAB_CONFIG[importTargetTab] && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-slate-400" />
                      Expected Columns for {TAB_CONFIG[importTargetTab].label}:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadExcelTemplate(importTargetTab)}
                        className="text-emerald-700 hover:text-emerald-900 font-semibold bg-emerald-100/70 hover:bg-emerald-200 px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        Excel Template (.xlsx)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadCSVTemplate(importTargetTab)}
                        className="text-slate-600 hover:text-slate-800 font-medium bg-white border border-slate-200 px-2 py-0.5 rounded hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-400" />
                        CSV (.csv)
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {TAB_CONFIG[importTargetTab].headers?.map((h, i) => (
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
              )}

              {/* File Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Upload Data File (Excel, CSV, or Text)
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center transition-colors bg-slate-50/50">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileChange}
                    className="hidden"
                    id="master-data-file-input"
                  />
                  <label htmlFor="master-data-file-input" className="cursor-pointer flex flex-col items-center justify-center">
                    {fileName?.endsWith('.xlsx') || fileName?.endsWith('.xls') ? (
                      <FileSpreadsheet className="w-8 h-8 text-emerald-600 mb-2" />
                    ) : fileName?.endsWith('.txt') ? (
                      <FileText className="w-8 h-8 text-blue-600 mb-2" />
                    ) : (
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    )}
                    <span className="text-sm font-medium text-slate-700">
                      {fileName ? fileName : 'Click to select or drag and drop an Excel (.xlsx), CSV (.csv), or Text file (.txt)'}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      Works seamlessly with Microsoft Excel, Google Sheets, CSV, or tab-delimited text exports
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
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!parsedData || parsedData.rows.length === 0 || isImporting}
                onClick={handleExecuteImport}
                className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 cursor-pointer"
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