// @ts-nocheck
import React, { useState, useRef, useMemo } from 'react';
import { 
  FilePlus, 
  CheckSquare, 
  Search, 
  ExternalLink, 
  Dna, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  Leaf, 
  Microscope, 
  Database, 
  BookOpen, 
  Binary, 
  Sparkles, 
  RefreshCw,
  Info,
  FileText,
  FileCheck
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import api from '../utils/api'; 
import { parseDataFile, downloadExcelFile, downloadCSVFile } from '../utils/fileImportExport'; 

const OBSERVATION_CSV_TEMPLATE = `crop_common_name,crop_scientific_name,plant_group,latitude,longitude,location_estimated,plant_structure,endophyte_scientific_name,endophyte_type,sequencing_method,sequencing_platform,ncbi_accession,reference_title,publication_year,reference_link,specimen_identifier,observation_date
Pearl Millet,Pennisetum glaucum,Monocot,-25.7479,28.2293,false,Root,Streptomyces avermitilis,Bacterial,Long-Read (Oxford Nanopore),Oxford Nanopore MinION,PRJNA912834,Microbiome of drought-resilient millets,2024,https://doi.org/10.1016/j.agron.2024.08,PMI-2024-001,2024-04-15
Chickpea,Cicer arietinum,Dicot,42.0308,-93.6319,false,Nodule; Root,Rhizobium leguminosarum,Bacterial,Sanger Sequencing,Capillary Electrophoresis,OQ542198,Symbiotic endophytes in pulse crop nodules,2023,https://doi.org/10.1007/s00284-023-0192,CHK-2024-002,2024-05-10
Maize,Zea mays,Monocot,41.6005,-93.6091,false,Leaf,Fusarium oxysporum,Fungal,NGS - Whole Genome Sequencing (WGS),Illumina NovaSeq 6000,SRR21894012,Endophytic fungi in cereal crops: diversity and biocontrol potential,2023,https://doi.org/10.1016/j.funbio.2023.01.002,MAI-2024-003,2024-06-01
Canola,Brassica napus,Dicot,-33.9249,18.4241,true,Stem,Trichoderma atroviride,Fungal,NGS - Amplicon Metabarcoding,Illumina MiSeq,MK876543,Foliar and vascular fungal endophytes of oilseed rape,2024,https://doi.org/10.1111/mpp.13421,CAN-2024-004,2024-06-20
Sorghum,Sorghum bicolor,Monocot,40.8136,-96.7026,false,Coleoptile,Bacillus amyloliquefaciens,Bacterial,Sanger Sequencing,Capillary Electrophoresis,CP054321,Plant growth promoting bacilli of grain sorghum,2023,https://doi.org/10.1038/s41598-023-0001,SOR-2024-005,2024-07-04
`;

const parseCoordinates = (input) => {
  const regex = new RegExp("(\\d+)[°\\s]*(\\d+)?['\\s]*(\\d+(?:\\.\\d+)?)?[\"\\s]*([NSEW])", "gi");
  let lat = null;
  let lng = null;
  
  let match;
  while ((match = regex.exec(input)) !== null) {
    let degrees = parseFloat(match[1]);
    let minutes = match[2] ? parseFloat(match[2]) / 60 : 0;
    let seconds = match[3] ? parseFloat(match[3]) / 3600 : 0;
    let direction = match[4].toUpperCase();
    
    let decimal = degrees + minutes + seconds;
    if (direction === 'S' || direction === 'W') {
      decimal = decimal * -1;
    }
    
    if (direction === 'N' || direction === 'S') lat = decimal.toFixed(6);
    if (direction === 'E' || direction === 'W') lng = decimal.toFixed(6);
  }
  return { lat, lng };
};

const MapClickHandler = ({ setFormData }) => {
  useMapEvents({
    click(e) {
      setFormData(prev => ({
        ...prev,
        latitude: e.latlng.lat.toFixed(6),
        longitude: e.latlng.lng.toFixed(6)
      }));
    },
  });
  return null; 
};

const CaptureScreen = ({ masterData, notify, refreshData }) => {
  const [formData, setFormData] = useState({
    crop_species_id: '', 
    new_crop_name: '',
    new_crop_scientific: '',
    new_crop_group: '',
    latitude: '',          
    longitude: '',      
    location_estimated: false,
    endophyte_ids: [],
    plant_structure_ids: [], 
    reference_id: '',
    new_reference_title: '',
    new_reference_year: '',
    new_reference_link: '',
    new_endophyte_name: '',
    new_endophyte_type_id: '',
    sequencing_method_id: '',
    new_sequencing_name: '',
    new_sequencing_platform: '',
    ncbi_accession: '',
    observation_date: new Date().toISOString().split('T')[0],
    created_by: 'Researcher Admin'
  });

  const [isNewCrop, setIsNewCrop] = useState(false);
  const [isNewReference, setIsNewReference] = useState(false);
  const [isNewEndophyte, setIsNewEndophyte] = useState(false);
  const [isNewSequencingMethod, setIsNewSequencingMethod] = useState(false);
  const [endoSearch, setEndoSearch] = useState('');

  // CSV Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvError, setCsvError] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleStructureToggle = (structureId) => {
    setFormData((prev) => {
      const currentIds = prev.plant_structure_ids;
      return currentIds.includes(structureId) 
        ? { ...prev, plant_structure_ids: currentIds.filter(id => id !== structureId) }
        : { ...prev, plant_structure_ids: [...currentIds, structureId] };
    });
  };

  const handleEndophyteToggle = (endoId) => {
    setFormData((prev) => {
      const currentIds = prev.endophyte_ids;
      return currentIds.includes(endoId) 
        ? { ...prev, endophyte_ids: currentIds.filter(id => id !== endoId) }
        : { ...prev, endophyte_ids: [...currentIds, endoId] };
    });
  };

  // Download template function in Excel (.xlsx) or CSV format
  const handleDownloadExcelTemplate = () => {
    try {
      // 1. Observation Data Sheet
      const observationHeaders = [
        'crop_common_name',
        'crop_scientific_name',
        'plant_group',
        'latitude',
        'longitude',
        'location_estimated',
        'plant_structure',
        'endophyte_scientific_name',
        'endophyte_type',
        'sequencing_method',
        'sequencing_platform',
        'ncbi_accession',
        'reference_title',
        'publication_year',
        'reference_link',
        'specimen_identifier',
        'observation_date'
      ];

      const sampleRows = [
        {
          crop_common_name: 'Pearl Millet',
          crop_scientific_name: 'Pennisetum glaucum',
          plant_group: 'Monocot',
          latitude: '-25.7479',
          longitude: '28.2293',
          location_estimated: 'false',
          plant_structure: 'Root',
          endophyte_scientific_name: 'Streptomyces avermitilis',
          endophyte_type: 'Bacterial',
          sequencing_method: 'Long-Read (Oxford Nanopore)',
          sequencing_platform: 'Oxford Nanopore MinION',
          ncbi_accession: 'PRJNA912834',
          reference_title: 'Microbiome of drought-resilient millets',
          publication_year: '2024',
          reference_link: 'https://doi.org/10.1016/j.agron.2024.08',
          specimen_identifier: 'PMI-2024-001',
          observation_date: '2024-04-15'
        },
        {
          crop_common_name: 'Chickpea',
          crop_scientific_name: 'Cicer arietinum',
          plant_group: 'Dicot',
          latitude: '42.0308',
          longitude: '-93.6319',
          location_estimated: 'false',
          plant_structure: 'Nodule; Root',
          endophyte_scientific_name: 'Rhizobium leguminosarum',
          endophyte_type: 'Bacterial',
          sequencing_method: 'Sanger Sequencing',
          sequencing_platform: 'Capillary Electrophoresis',
          ncbi_accession: 'OQ542198',
          reference_title: 'Symbiotic endophytes in pulse crop nodules',
          publication_year: '2023',
          reference_link: 'https://doi.org/10.1007/s00284-023-0192',
          specimen_identifier: 'CHK-2024-002',
          observation_date: '2024-05-10'
        },
        {
          crop_common_name: 'Maize',
          crop_scientific_name: 'Zea mays',
          plant_group: 'Monocot',
          latitude: '41.6005',
          longitude: '-93.6091',
          location_estimated: 'false',
          plant_structure: 'Leaf',
          endophyte_scientific_name: 'Fusarium oxysporum',
          endophyte_type: 'Fungal',
          sequencing_method: 'NGS - Whole Genome Sequencing (WGS)',
          sequencing_platform: 'Illumina NovaSeq 6000',
          ncbi_accession: 'SRR21894012',
          reference_title: 'Endophytic fungi in cereal crops: diversity and biocontrol potential',
          publication_year: '2023',
          reference_link: 'https://doi.org/10.1016/j.funbio.2023.01.002',
          specimen_identifier: 'MAI-2024-003',
          observation_date: '2024-06-01'
        },
        {
          crop_common_name: 'Canola',
          crop_scientific_name: 'Brassica napus',
          plant_group: 'Dicot',
          latitude: '-33.9249',
          longitude: '18.4241',
          location_estimated: 'true',
          plant_structure: 'Stem',
          endophyte_scientific_name: 'Trichoderma atroviride',
          endophyte_type: 'Fungal',
          sequencing_method: 'NGS - Amplicon Metabarcoding',
          sequencing_platform: 'Illumina MiSeq',
          ncbi_accession: 'MK876543',
          reference_title: 'Foliar and vascular fungal endophytes of oilseed rape',
          publication_year: '2024',
          reference_link: 'https://doi.org/10.1111/mpp.13421',
          specimen_identifier: 'CAN-2024-004',
          observation_date: '2024-06-20'
        },
        {
          crop_common_name: 'Sorghum',
          crop_scientific_name: 'Sorghum bicolor',
          plant_group: 'Monocot',
          latitude: '40.8136',
          longitude: '-96.7026',
          location_estimated: 'false',
          plant_structure: 'Coleoptile',
          endophyte_scientific_name: 'Bacillus amyloliquefaciens',
          endophyte_type: 'Bacterial',
          sequencing_method: 'Sanger Sequencing',
          sequencing_platform: 'Capillary Electrophoresis',
          ncbi_accession: 'CP054321',
          reference_title: 'Plant growth promoting bacilli of grain sorghum',
          publication_year: '2023',
          reference_link: 'https://doi.org/10.1038/s41598-023-0001',
          specimen_identifier: 'SOR-2024-005',
          observation_date: '2024-07-04'
        }
      ];

      // 2. Instructions Sheet
      const instructionsData = [
        ['Endophyte Observation Import - Field Guidelines & Auto Master Data'],
        [''],
        ['Column Header', 'Required / Optional', 'Auto-Created in Master Data if New?', 'Format / Accepted Values', 'Description'],
        ['crop_common_name', 'Required', 'YES (Auto-added to Crops)', 'Text (e.g. Maize, Pearl Millet)', 'Common name of host plant species'],
        ['crop_scientific_name', 'Optional', 'YES (Saved to Crop)', 'Text (e.g. Zea mays)', 'Botanical binomial name'],
        ['plant_group', 'Optional', 'YES', 'Monocot / Dicot / Unknown', 'Taxonomic angiosperm group'],
        ['latitude', 'Recommended', 'Specimen Coords', 'Decimal (-90.0 to 90.0)', 'Specimen collection latitude'],
        ['longitude', 'Recommended', 'Specimen Coords', 'Decimal (-180.0 to 180.0)', 'Specimen collection longitude'],
        ['location_estimated', 'Optional', 'NO', 'true / false', 'Whether GPS coordinates are approximated'],
        ['plant_structure', 'Optional', 'YES (Auto-added to Tissues)', 'Text (e.g. Root; Stem; Nodule)', 'Plant tissues colonized; separate multiples with semicolon (;)'],
        ['endophyte_scientific_name', 'Required', 'YES (Auto-added to Endophytes)', 'Text (e.g. Streptomyces avermitilis)', 'Microorganism species scientific name'],
        ['endophyte_type', 'Optional', 'YES (Auto-added to Types)', 'Bacterial / Fungal / Actinomycete / Viral / Other', 'Classification of endophyte organism'],
        ['sequencing_method', 'Optional', 'YES (Auto-added to Methods)', 'Text (e.g. Sanger, NGS WGS, Nanopore)', 'Sequencing molecular technique'],
        ['sequencing_platform', 'Optional', 'YES', 'Text (e.g. Illumina NovaSeq, Oxford Nanopore)', 'Sequencing instrument platform'],
        ['ncbi_accession', 'Optional', 'Saved with Observation', 'Text (e.g. PRJNA912834, OQ542198)', 'NCBI GenBank / BioProject / SRA accession code'],
        ['reference_title', 'Optional', 'YES (Auto-added to References)', 'Text', 'Journal article or publication title'],
        ['publication_year', 'Optional', 'YES', 'Year number (e.g. 2024)', 'Year of scientific literature'],
        ['reference_link', 'Optional', 'YES', 'URL / DOI (https://doi.org/...)', 'Direct hyperlink or DOI to study'],
        ['specimen_identifier', 'Optional', 'YES (Used or Auto-generated)', 'Text (e.g. PMI-2024-001)', 'Unique voucher or sample code; left blank to auto-generate'],
        ['observation_date', 'Optional', 'Observation Record', 'YYYY-MM-DD (e.g. 2024-06-15)', 'Collection or observation date']
      ];

      // 3. Existing Master Data Reference Sheet for convenient copy-pasting
      const currentCrops = (masterData.crops || []).map(c => ({
        Crop_Common_Name: c.common_name,
        Scientific_Name: c.scientific_name || '',
        Plant_Group: c.plant_group || ''
      }));

      const currentEndophytes = (masterData.endophytes || []).map(e => ({
        Endophyte_Scientific_Name: e.scientific_name,
        Classification_Type: e.endophyte_types?.type_name || ''
      }));

      const currentStructures = (masterData.structures || []).map(s => ({
        Tissue_Structure_Name: s.structure_name
      }));

      const currentSeqMethods = (masterData.sequencingMethods || []).map(m => ({
        Sequencing_Method: m.method_name,
        Platform: m.platform_type || ''
      }));

      downloadExcelFile({
        filename: 'observation_import_template.xlsx',
        sheets: [
          {
            name: 'Observations_Template',
            headers: observationHeaders,
            rows: sampleRows
          },
          {
            name: 'Column_Guidelines',
            data2D: instructionsData
          },
          {
            name: 'Existing_Crops',
            headers: ['Crop_Common_Name', 'Scientific_Name', 'Plant_Group'],
            rows: currentCrops
          },
          {
            name: 'Existing_Endophytes',
            headers: ['Endophyte_Scientific_Name', 'Classification_Type'],
            rows: currentEndophytes
          },
          {
            name: 'Existing_Tissues',
            headers: ['Tissue_Structure_Name'],
            rows: currentStructures
          },
          {
            name: 'Existing_Seq_Methods',
            headers: ['Sequencing_Method', 'Platform'],
            rows: currentSeqMethods
          }
        ]
      });

      notify('Excel (.xlsx) observation template with guidelines downloaded!', 'success');
    } catch (err) {
      console.error('Error generating Excel template:', err);
      notify('Failed to generate Excel template. Downloading CSV instead.', 'warning');
      handleDownloadCSVTemplate();
    }
  };

  const handleDownloadCSVTemplate = () => {
    try {
      downloadCSVFile({
        filename: 'observation_import_template.csv',
        content: OBSERVATION_CSV_TEMPLATE
      });
      notify('Observation CSV template downloaded successfully!', 'success');
    } catch {
      notify('Failed to generate CSV template.', 'error');
    }
  };

  // Universal File Selection & Parsing (.xlsx, .xls, .csv, .tsv, .txt)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvError(null);
    setImportResult(null);

    try {
      const { rows } = await parseDataFile(file);
      if (!rows || rows.length === 0) {
        setCsvError('The selected file does not contain any valid observation data rows.');
        setParsedRows([]);
        return;
      }

      // Validate basic headers: must have at least crop and endophyte identifier
      const first = rows[0];
      const hasCrop = 'crop_common_name' in first || 'crop_name' in first || 'common_name' in first || 'crop' in first;
      const hasEndo = 'endophyte_scientific_name' in first || 'endophyte_name' in first || 'scientific_name' in first || 'endophyte' in first;

      if (!hasCrop || !hasEndo) {
        setCsvError('File requires columns for host crop (e.g. crop_common_name) and endophyte species (e.g. endophyte_scientific_name). Check the template guidelines.');
      }

      setParsedRows(rows);
    } catch (err) {
      console.error('Error parsing data file:', err);
      setCsvError(err.message || 'Error parsing file. Please check that it is a valid Excel, CSV, or Text table.');
      setParsedRows([]);
    }
  };

  // Detect which entities in the parsed CSV are brand new (not pre-existing in masterData)
  const masterDataAnalysis = useMemo(() => {
    if (!parsedRows || parsedRows.length === 0) {
      return {
        newCrops: [],
        newEndophytes: [],
        newTypes: [],
        newStructures: [],
        newSeqMethods: [],
        newReferences: [],
        invalidCoordsCount: 0
      };
    }

    const existingCropNames = new Set((masterData.crops || []).map(c => c.common_name.toLowerCase().trim()));
    const existingEndoNames = new Set((masterData.endophytes || []).map(e => e.scientific_name.toLowerCase().trim()));
    const existingTypeNames = new Set((masterData.endophyteTypes || []).map(t => t.type_name.toLowerCase().trim()));
    const existingStructNames = new Set((masterData.structures || []).map(s => s.name.toLowerCase().trim()));
    const existingSeqNames = new Set((masterData.sequencingMethods || []).map(s => s.method_name.toLowerCase().trim()));
    const existingRefTitles = new Set((masterData.references || []).map(r => r.title.toLowerCase().trim()));

    const newCrops = new Set();
    const newEndophytes = new Set();
    const newTypes = new Set();
    const newStructures = new Set();
    const newSeqMethods = new Set();
    const newReferences = new Set();
    let invalidCoordsCount = 0;

    for (const r of parsedRows) {
      const crop = (r.crop_common_name || r.crop_name || r.common_name || r.crop || '').trim();
      if (crop && !existingCropNames.has(crop.toLowerCase())) {
        newCrops.add(crop);
      }

      const endo = (r.endophyte_scientific_name || r.endophyte_name || r.endophyte_species || r.endophyte || '').trim();
      if (endo && !existingEndoNames.has(endo.toLowerCase())) {
        newEndophytes.add(endo);
      }

      const type = (r.endophyte_type || r.taxonomy_type || r.type_name || '').trim();
      if (type && !existingTypeNames.has(type.toLowerCase())) {
        newTypes.add(type);
      }

      const rawStruct = (r.plant_structure || r.structure_name || r.tissue || '').trim();
      if (rawStruct) {
        const parts = rawStruct.includes(';') ? rawStruct.split(';') : rawStruct.includes('|') ? rawStruct.split('|') : [rawStruct];
        for (const p of parts) {
          const sName = p.trim();
          if (sName && !existingStructNames.has(sName.toLowerCase())) {
            newStructures.add(sName);
          }
        }
      }

      const seq = (r.sequencing_method || r.sequencing_technology || r.method_name || '').trim();
      if (seq && !existingSeqNames.has(seq.toLowerCase())) {
        newSeqMethods.add(seq);
      }

      const ref = (r.reference_title || r.article_title || r.reference || '').trim();
      if (ref && !existingRefTitles.has(ref.toLowerCase())) {
        newReferences.add(ref);
      }

      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        invalidCoordsCount++;
      }
    }

    return {
      newCrops: Array.from(newCrops),
      newEndophytes: Array.from(newEndophytes),
      newTypes: Array.from(newTypes),
      newStructures: Array.from(newStructures),
      newSeqMethods: Array.from(newSeqMethods),
      newReferences: Array.from(newReferences),
      invalidCoordsCount
    };
  }, [parsedRows, masterData]);

  // Execute CSV batch import
  const handleExecuteImport = async () => {
    if (!parsedRows || parsedRows.length === 0) {
      return notify('Please select a valid CSV file first.', 'error');
    }

    setIsImporting(true);
    try {
      const res = await api.post('/observations/batch-import/', { rows: parsedRows });
      setImportResult(res);
      
      const newItemsSummary = [];
      if (res.auto_created?.crops?.length) newItemsSummary.push(`${res.auto_created.crops.length} crop(s)`);
      if (res.auto_created?.endophytes?.length) newItemsSummary.push(`${res.auto_created.endophytes.length} endophyte(s)`);
      if (res.auto_created?.structures?.length) newItemsSummary.push(`${res.auto_created.structures.length} plant structure(s)`);
      if (res.auto_created?.sequencing_methods?.length) newItemsSummary.push(`${res.auto_created.sequencing_methods.length} sequencing method(s)`);
      if (res.auto_created?.references?.length) newItemsSummary.push(`${res.auto_created.references.length} reference(s)`);

      const extraText = newItemsSummary.length > 0 
        ? ` Auto-provisioned into Master Data: ${newItemsSummary.join(', ')}.`
        : '';

      notify(`Successfully imported ${res.observations_created} observation(s)!${extraText}`, 'success');
      await refreshData();
      
      // Auto close after brief pause or user can inspect results
      setTimeout(() => {
        setIsImportModalOpen(false);
        setCsvFile(null);
        setParsedRows([]);
        setImportResult(null);
      }, 1400);

    } catch (err) {
      notify(err.message || 'Failed to import CSV observations', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Safety checks
    if (formData.plant_structure_ids.length === 0) {
      return notify('Please select at least one plant structure.', 'error');
    }
    if (formData.endophyte_ids.length === 0 && !isNewEndophyte) {
      return notify('Please select at least one endophyte, or add a new one.', 'error');
    }

    try {
      let finalReferenceId = formData.reference_id ? parseInt(formData.reference_id) : null;
      let finalEndophyteIds = [...formData.endophyte_ids.map(id => parseInt(id))];
      let finalCropId = formData.crop_species_id ? parseInt(formData.crop_species_id) : null;

      if (isNewCrop && formData.new_crop_name && formData.new_crop_group) {
        const cropPayload = {
          common_name: formData.new_crop_name,
          scientific_name: formData.new_crop_scientific || null,
          plant_group: formData.new_crop_group
        };
        const newCrop = await api.post('/crops/', cropPayload);
        finalCropId = newCrop.crop_species_id;
      }

      if (isNewReference && formData.new_reference_title) {
        const refPayload = {
          title: formData.new_reference_title,
          publication_year: formData.new_reference_year ? parseInt(formData.new_reference_year) : null,
          reference_link: formData.new_reference_link || null
        };
        const newRef = await api.post('/references/', refPayload); 
        finalReferenceId = newRef.reference_id; 
      }

      if (isNewEndophyte && formData.new_endophyte_name && formData.new_endophyte_type_id) {
        const endoPayload = {
          scientific_name: formData.new_endophyte_name,
          endophyte_type_id: parseInt(formData.new_endophyte_type_id)
        };
        const newEndo = await api.post('/endophytes/', endoPayload);
        finalEndophyteIds.push(newEndo.endophyte_id);
      }

      // Handle Sequencing Method (Selected or New)
      let finalSequencingMethodId = formData.sequencing_method_id ? parseInt(formData.sequencing_method_id) : null;
      let finalSequencingMethodName = null;

      if (isNewSequencingMethod && formData.new_sequencing_name) {
        const seqPayload = {
          method_name: formData.new_sequencing_name,
          platform_type: formData.new_sequencing_platform || null
        };
        const newSeq = await api.post('/sequencing-methods/', seqPayload);
        finalSequencingMethodId = newSeq.sequencing_method_id;
        finalSequencingMethodName = newSeq.method_name;
      } else if (finalSequencingMethodId) {
        const found = masterData.sequencingMethods?.find(s => s.sequencing_method_id === finalSequencingMethodId);
        if (found) finalSequencingMethodName = found.method_name;
      }

      const cleanAccession = formData.ncbi_accession ? formData.ncbi_accession.trim().toUpperCase() : null;

      const fullPayload = {
        crop_species_id: finalCropId,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        location_estimated: formData.location_estimated,
        endophyte_ids: finalEndophyteIds,
        plant_structure_ids: formData.plant_structure_ids.map(id => parseInt(id)),
        reference_id: finalReferenceId,
        sequencing_method_id: finalSequencingMethodId,
        sequencing_method: finalSequencingMethodName,
        ncbi_accession: cleanAccession,
        observation_date: formData.observation_date,
        created_by: formData.created_by
      };

      await api.post('/capture-full/', fullPayload);
      
      notify(`Success! Recorded ${finalEndophyteIds.length * formData.plant_structure_ids.length} observation(s)!`, 'success');
      refreshData();
      
      setFormData({ 
        crop_species_id: '', new_crop_name: '', new_crop_scientific: '', new_crop_group: '',
        latitude: '', longitude: '', location_estimated: false,
        endophyte_ids: [], plant_structure_ids: [], reference_id: '',
        new_reference_title: '', new_reference_year: '', new_reference_link: '',
        new_endophyte_name: '', new_endophyte_type_id: '',
        sequencing_method_id: '', new_sequencing_name: '', new_sequencing_platform: '',
        ncbi_accession: '',
        observation_date: new Date().toISOString().split('T')[0],
        created_by: 'Researcher Admin'
      });
      setIsNewCrop(false);
      setIsNewReference(false); 
      setIsNewEndophyte(false);
      setIsNewSequencingMethod(false);
      setEndoSearch('');
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  // Filter endophytes by search term so it's easy to find them
  const filteredEndophytes = masterData.endophytes?.filter(e => 
    e.scientific_name.toLowerCase().includes(endoSearch.toLowerCase())
  ) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header with CSV Quick Actions */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Log Observation</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Capture endophyte occurrences, tissue localization, and molecular evidence.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Download Options */}
          <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={handleDownloadExcelTemplate}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
              title="Download rich Excel workbook (.xlsx) with guidelines, data validation tabs, and master data references"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Download Excel Template (.xlsx)</span>
            </button>
            <div className="h-5 w-px bg-slate-200"></div>
            <button
              type="button"
              onClick={handleDownloadCSVTemplate}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              title="Download standard CSV template (.csv)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsImportModalOpen(true);
              setCsvError(null);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all cursor-pointer"
            title="Import observations from Excel (.xlsx/.xls), CSV, or text file (.txt/.tsv) with automatic master data provisioning"
          >
            <Upload className="w-4 h-4" />
            <span>Import Data File</span>
          </button>
        </div>
      </header>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Import Observations (Excel / CSV / Text)</h3>
                  <p className="text-xs text-slate-500">
                    Upload observation records from Excel (.xlsx/.xls), CSV (.csv), or delimited text files (.tsv/.txt). Novel items are auto-provisioned to Master Data.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvFile(null);
                  setParsedRows([]);
                  setCsvError(null);
                  setImportResult(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* Informative Guidance Banner */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-950 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-emerald-900">
                    Smart Master Data Synchronization & Multi-Format Support
                  </div>
                  <p className="text-emerald-800 leading-relaxed">
                    You can download an <strong>Excel workbook (.xlsx)</strong> with instructions and existing reference tables, edit it in Microsoft Excel, Google Sheets, or LibreOffice, and upload it directly as <strong>.xlsx, .csv, or .txt</strong>. Any new crops, endophytes, structures, or sequencing platforms are automatically created in Master Data!
                  </p>
                  <div className="pt-2 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleDownloadExcelTemplate}
                      className="inline-flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-md hover:bg-emerald-200 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                      Download Excel Template (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCSVTemplate}
                      className="inline-flex items-center gap-1.5 font-semibold text-slate-700 bg-white border border-slate-300 px-2.5 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      Download CSV Template (.csv)
                    </button>
                    <span className="text-slate-400 text-[11px]">Accepts .xlsx, .xls, .csv, .txt, .tsv</span>
                  </div>
                </div>
              </div>

              {/* Upload Drop Area */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  csvFile 
                    ? 'border-emerald-500 bg-emerald-50/40' 
                    : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-slate-100 rounded-full text-slate-600 group-hover:scale-105 transition-transform">
                    {csvFile?.name?.endsWith('.xlsx') || csvFile?.name?.endsWith('.xls') ? (
                      <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                    ) : csvFile?.name?.endsWith('.txt') ? (
                      <FileText className="w-6 h-6 text-blue-600" />
                    ) : (
                      <Upload className="w-6 h-6 text-emerald-600" />
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    {csvFile ? csvFile.name : 'Click to select or drag and drop your Excel, CSV, or Text file'}
                  </div>
                  <p className="text-xs text-slate-400">
                    {csvFile 
                      ? `${(csvFile.size / 1024).toFixed(1)} KB • ${parsedRows.length} record(s) ready` 
                      : 'Supports Excel (.xlsx, .xls), CSV (.csv), and Tab/Comma-delimited text (.txt, .tsv)'}
                  </p>
                </div>
              </div>

              {/* Error Alert */}
              {csvError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{csvError}</span>
                </div>
              )}

              {/* Success Result Alert */}
              {importResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-emerald-900">{importResult.message}</div>
                    <div className="text-emerald-700 mt-0.5">
                      Updated database state. Closing dialog...
                    </div>
                  </div>
                </div>
              )}

              {/* Master Data Discovery & Preview when rows exist */}
              {parsedRows.length > 0 && !importResult && (
                <div className="space-y-4 pt-2">
                  
                  {/* Summary Bar of Detected Entities */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                        <Database className="w-4 h-4 text-emerald-600" />
                        <span>Pre-Import Validation & Discovery</span>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                        {parsedRows.length} Observation Row(s)
                      </span>
                    </div>

                    {/* Chips for New Master Data Items */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                      
                      {/* Crops */}
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                            Crops
                          </span>
                          {masterDataAnalysis.newCrops.length > 0 ? (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded text-[11px]">
                              +{masterDataAnalysis.newCrops.length} New
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">All existing</span>
                          )}
                        </div>
                        {masterDataAnalysis.newCrops.length > 0 && (
                          <div className="text-[11px] text-emerald-700 font-medium truncate" title={masterDataAnalysis.newCrops.join(', ')}>
                            {masterDataAnalysis.newCrops.join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Endophytes */}
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Dna className="w-3.5 h-3.5 text-purple-600" />
                            Endophytes
                          </span>
                          {masterDataAnalysis.newEndophytes.length > 0 ? (
                            <span className="bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded text-[11px]">
                              +{masterDataAnalysis.newEndophytes.length} New
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">All existing</span>
                          )}
                        </div>
                        {masterDataAnalysis.newEndophytes.length > 0 && (
                          <div className="text-[11px] text-purple-700 font-medium truncate" title={masterDataAnalysis.newEndophytes.join(', ')}>
                            {masterDataAnalysis.newEndophytes.join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Structures */}
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Database className="w-3.5 h-3.5 text-blue-600" />
                            Plant Tissues
                          </span>
                          {masterDataAnalysis.newStructures.length > 0 ? (
                            <span className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded text-[11px]">
                              +{masterDataAnalysis.newStructures.length} New
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">All existing</span>
                          )}
                        </div>
                        {masterDataAnalysis.newStructures.length > 0 && (
                          <div className="text-[11px] text-blue-700 font-medium truncate" title={masterDataAnalysis.newStructures.join(', ')}>
                            {masterDataAnalysis.newStructures.join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Sequencing Methods */}
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Binary className="w-3.5 h-3.5 text-indigo-600" />
                            Sequencing
                          </span>
                          {masterDataAnalysis.newSeqMethods.length > 0 ? (
                            <span className="bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded text-[11px]">
                              +{masterDataAnalysis.newSeqMethods.length} New
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">All existing</span>
                          )}
                        </div>
                        {masterDataAnalysis.newSeqMethods.length > 0 && (
                          <div className="text-[11px] text-indigo-700 font-medium truncate" title={masterDataAnalysis.newSeqMethods.join(', ')}>
                            {masterDataAnalysis.newSeqMethods.join(', ')}
                          </div>
                        )}
                      </div>

                      {/* References */}
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                          <span className="flex items-center gap-1.5 font-medium">
                            <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                            References
                          </span>
                          {masterDataAnalysis.newReferences.length > 0 ? (
                            <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded text-[11px]">
                              +{masterDataAnalysis.newReferences.length} New
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">All existing</span>
                          )}
                        </div>
                        {masterDataAnalysis.newReferences.length > 0 && (
                          <div className="text-[11px] text-amber-700 font-medium truncate" title={masterDataAnalysis.newReferences.join(', ')}>
                            {masterDataAnalysis.newReferences.join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Coordinates Validation */}
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                          <span className="font-medium">Georeferencing</span>
                          {masterDataAnalysis.invalidCoordsCount > 0 ? (
                            <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded text-[11px]">
                              {masterDataAnalysis.invalidCoordsCount} Missing/0,0
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold text-[11px]">100% Valid</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {masterDataAnalysis.invalidCoordsCount > 0 
                            ? 'Will default coordinates to (0,0)' 
                            : 'All coordinates within range'}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Table Preview */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Records Preview (showing up to 10 rows)</span>
                      <span className="text-slate-500">Green badges indicate entities auto-created into Master Data</span>
                    </div>

                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Host Crop</th>
                            <th className="py-2 px-3">Coords (Lat, Lng)</th>
                            <th className="py-2 px-3">Structure</th>
                            <th className="py-2 px-3">Endophyte Species</th>
                            <th className="py-2 px-3">Sequencing & Accession</th>
                            <th className="py-2 px-3">Reference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedRows.slice(0, 10).map((row, idx) => {
                            const cropName = row.crop_common_name || row.crop_name || row.common_name || row.crop || '-';
                            const isNewCrop = masterDataAnalysis.newCrops.includes(cropName);

                            const endoName = row.endophyte_scientific_name || row.endophyte_name || row.endophyte_species || row.endophyte || '-';
                            const isNewEndo = masterDataAnalysis.newEndophytes.includes(endoName);

                            const rawStruct = row.plant_structure || row.structure_name || row.tissue || '-';
                            const seqMethod = row.sequencing_method || row.sequencing_technology || row.method_name || '';
                            const isNewSeq = seqMethod && masterDataAnalysis.newSeqMethods.includes(seqMethod);

                            const accession = row.ncbi_accession || row.accession || '';
                            const refTitle = row.reference_title || row.article_title || row.reference || '';

                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                                
                                <td className="py-2 px-3 font-medium text-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    <span>{cropName}</span>
                                    {isNewCrop && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                                        NEW CROP
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                                  {row.latitude && row.longitude 
                                    ? `${parseFloat(row.latitude).toFixed(4)}, ${parseFloat(row.longitude).toFixed(4)}` 
                                    : <span className="text-amber-500 italic">Not specified</span>}
                                </td>

                                <td className="py-2 px-3 text-slate-700">
                                  {rawStruct}
                                </td>

                                <td className="py-2 px-3 italic text-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    <span>{endoName}</span>
                                    {isNewEndo && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded not-italic">
                                        NEW SPECIES
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2 px-3">
                                  <div className="space-y-0.5">
                                    {seqMethod ? (
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-700">{seqMethod}</span>
                                        {isNewSeq && (
                                          <span className="text-[9px] font-bold px-1 bg-indigo-100 text-indigo-800 rounded">NEW</span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">—</span>
                                    )}
                                    {accession && (
                                      <div className="font-mono text-[11px] text-emerald-700 font-semibold">
                                        {accession}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2 px-3 text-slate-600 max-w-[160px] truncate" title={refTitle}>
                                  {refTitle || <span className="text-slate-400 text-[11px]">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                {parsedRows.length > 0 && (
                  <span>Ready to import <strong>{parsedRows.length}</strong> observation record(s)</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setCsvFile(null);
                    setParsedRows([]);
                    setCsvError(null);
                    setImportResult(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={parsedRows.length === 0 || isImporting || !!importResult}
                  onClick={handleExecuteImport}
                  className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white rounded-lg transition-all cursor-pointer ${
                    parsedRows.length === 0 || isImporting || !!importResult
                      ? 'bg-slate-400 cursor-not-allowed opacity-70'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-sm'
                  }`}
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing & Provisioning Master Data...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Import {parsedRows.length > 0 ? `${parsedRows.length} Observations` : 'CSV'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Manual Observation Entry Form */}
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-1">
               <label className="block text-sm font-medium text-slate-700">Host Crop Species *</label>
               <button 
                 type="button" 
                 onClick={() => setIsNewCrop(!isNewCrop)} 
                 className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
               >
                 {isNewCrop ? "- Select Existing" : "+ Add New Crop"}
               </button>
            </div>

            {!isNewCrop ? (
              <div>
                <select 
                  required
                  value={formData.crop_species_id}
                  onChange={(e) => setFormData({...formData, crop_species_id: e.target.value})}
                  className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
                >
                  <option value="">Select a Crop</option>
                  {masterData.crops?.map(c => (
                    <option key={c.crop_species_id} value={c.crop_species_id}>
                      {c.common_name} {c.plant_group && c.plant_group !== 'Unknown' ? `[${c.plant_group}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-4 p-4 border border-emerald-200 bg-emerald-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Common Name *</label>
                  <input 
                    type="text" required={isNewCrop} placeholder="e.g. Maize"
                    value={formData.new_crop_name} 
                    onChange={(e) => setFormData({...formData, new_crop_name: e.target.value})}
                    className="w-full rounded-lg border-slate-300 border p-2.5 bg-white focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Scientific Name</label>
                    <input 
                      type="text" placeholder="Zea mays"
                      value={formData.new_crop_scientific} 
                      onChange={(e) => setFormData({...formData, new_crop_scientific: e.target.value})}
                      className="w-full rounded-lg border-slate-300 border p-2.5 bg-white focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Plant Clade *</label>
                    <select 
                      required={isNewCrop}
                      value={formData.new_crop_group} 
                      onChange={(e) => setFormData({...formData, new_crop_group: e.target.value})}
                      className="w-full rounded-lg border-slate-300 border p-2.5 bg-white focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Select...</option>
                      <option value="Monocot">Monocot</option>
                      <option value="Dicot">Dicot</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200 md:row-span-2">
            <label className="block text-sm font-medium text-slate-700">
              Location Setup *
            </label>
            
            <div className="mb-2">
              <input 
                type="text" 
                placeholder={`Paste from PDF (e.g. 33°55'12"S) and press Enter`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const { lat, lng } = parseCoordinates(e.target.value);
                    if (lat && lng) {
                       setFormData(prev => ({...prev, latitude: lat, longitude: lng}));
                       notify('Coordinates converted!', 'success');
                    } else {
                       notify('Format not recognized.', 'error');
                    }
                  }
                }}
                className="w-full rounded-lg border-emerald-300 border-dashed border-2 p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50/50 text-sm placeholder-slate-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Latitude (Decimal)</label>
                <input 
                  type="number" step="any" required placeholder="-33.9248"
                  value={formData.latitude}
                  onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                  className="w-full rounded border-slate-300 border p-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Longitude (Decimal)</label>
                <input 
                  type="number" step="any" required placeholder="18.4240"
                  value={formData.longitude}
                  onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                  className="w-full rounded border-slate-300 border p-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                />
              </div>
            </div>
            <div className="pt-2">
              <label className="flex items-center cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={formData.location_estimated}
                  onChange={(e) => setFormData({...formData, location_estimated: e.target.checked})}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="ml-2 text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                  This location is an estimate <span className="text-slate-400 italic">(exact coordinates not provided in article)</span>
                </span>
              </label>
            </div>

            <div className="mt-4">
              <label className="block text-xs text-slate-500 mb-1">Click the map to set location:</label>
              <div className="h-56 w-full rounded-lg overflow-hidden border border-slate-300 relative z-0">
                <MapContainer center={[20, 0]} zoom={1} scrollWheelZoom={true} className="h-full w-full relative z-0">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapClickHandler setFormData={setFormData} />
                  {formData.latitude && formData.longitude && !isNaN(parseFloat(formData.latitude)) && !isNaN(parseFloat(formData.longitude)) && (
                    <Marker position={[parseFloat(formData.latitude), parseFloat(formData.longitude)]} />
                  )}
                </MapContainer>
              </div>
            </div>
          </div>
          
          {/* Multi-select Endophytes UI */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex justify-between items-center mb-1">
               <label className="block text-sm font-medium text-slate-700">Select Endophytes (Multiple) *</label>
            </div>
            
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input 
                type="text" placeholder="Search unlisted endophytes..." 
                value={endoSearch} onChange={(e) => setEndoSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              />
            </div>

            {/* Scrollable Checkbox List for Endophytes */}
            <div className="h-32 overflow-y-auto bg-white border border-slate-300 rounded-lg p-2 space-y-1">
              {filteredEndophytes.length > 0 ? filteredEndophytes.map(e => (
                <label key={e.endophyte_id} className="flex items-center p-2 hover:bg-slate-50 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 mr-3"
                    checked={formData.endophyte_ids.includes(e.endophyte_id.toString())}
                    onChange={() => handleEndophyteToggle(e.endophyte_id.toString())}
                  />
                  <span className="text-sm text-slate-700">{e.scientific_name}</span>
                </label>
              )) : (
                <p className="text-xs text-slate-400 text-center py-4">No matching endophytes found.</p>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200">
               <button 
                 type="button" onClick={() => setIsNewEndophyte(!isNewEndophyte)} 
                 className="text-sm font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer"
               >
                 {isNewEndophyte ? "- Cancel Adding New" : "+ Add a New Unlisted Endophyte"}
               </button>
            </div>

            {isNewEndophyte && (
              <div className="space-y-4 p-4 border border-emerald-200 bg-emerald-50 rounded-lg mt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Scientific Name *</label>
                  <input 
                    type="text" required={isNewEndophyte} placeholder="e.g. Aspergillus niger"
                    value={formData.new_endophyte_name} onChange={(e) => setFormData({...formData, new_endophyte_name: e.target.value})}
                    className="w-full rounded border-slate-300 border p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Taxonomic Type *</label>
                  <select 
                    required={isNewEndophyte} value={formData.new_endophyte_type_id}
                    onChange={(e) => setFormData({...formData, new_endophyte_type_id: e.target.value})}
                    className="w-full rounded border-slate-300 border p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="">Select Category...</option>
                    {masterData.endophyteTypes?.map(t => (
                      <option key={t.endophyte_type_id} value={t.endophyte_type_id}>{t.type_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center">
              <CheckSquare className="w-4 h-4 mr-2 text-emerald-600" />
              Select Plant Structures (Multiple allowed) *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {masterData.structures?.map(s => (
                <label 
                  key={s.plant_structure_id} 
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.plant_structure_ids.includes(s.plant_structure_id.toString()) 
                    ? 'bg-emerald-50 border-emerald-500 shadow-xs' 
                    : 'bg-white border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 rounded border-slate-300 mr-2"
                    checked={formData.plant_structure_ids.includes(s.plant_structure_id.toString())}
                    onChange={() => handleStructureToggle(s.plant_structure_id.toString())}
                  />
                  <span className="text-sm font-medium text-slate-700 select-none">{s.name}</span>
                </label>
              ))}
            </div>
            {(!masterData.structures || masterData.structures.length === 0) && (
              <p className="text-sm text-slate-500 italic">No structures found. Add some in Master Data first!</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Observation Date *</label>
            <input 
              type="date" required
              value={formData.observation_date}
              onChange={(e) => setFormData({...formData, observation_date: e.target.value})}
              className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
            />
          </div>

          {/* Genomic & Sequencing Data Section */}
          <div className="space-y-4 md:col-span-2 bg-slate-50 p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <Dna className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-800">Genomic & Sequencing Data</h3>
              </div>
              <span className="text-xs text-slate-400">Taxonomic & molecular evidence</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
              {/* Field 1: Sequencing Method */}
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-700">Sequencing Method</label>
                  <button 
                    type="button" 
                    onClick={() => setIsNewSequencingMethod(!isNewSequencingMethod)} 
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                  >
                    {isNewSequencingMethod ? "Select Existing" : "+ Add New Method"}
                  </button>
                </div>

                {!isNewSequencingMethod ? (
                  <select 
                    value={formData.sequencing_method_id}
                    onChange={(e) => setFormData({...formData, sequencing_method_id: e.target.value})}
                    className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-sm"
                  >
                    <option value="">Select Sequencing Type...</option>
                    {masterData.sequencingMethods?.map(s => (
                      <option key={s.sequencing_method_id} value={s.sequencing_method_id}>
                        {s.method_name} {s.platform_type ? `(${s.platform_type})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3 p-3.5 border border-emerald-200 bg-emerald-50/70 rounded-lg">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Method Name *</label>
                      <input 
                        type="text" 
                        required={isNewSequencingMethod}
                        placeholder="e.g. Sanger, NGS - WGS, Amplicon 16S"
                        value={formData.new_sequencing_name}
                        onChange={(e) => setFormData({...formData, new_sequencing_name: e.target.value})}
                        className="w-full rounded border-slate-300 border p-2 text-xs focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Platform / Instrument (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Illumina MiSeq, Oxford Nanopore MinION"
                        value={formData.new_sequencing_platform}
                        onChange={(e) => setFormData({...formData, new_sequencing_platform: e.target.value})}
                        className="w-full rounded border-slate-300 border p-2 text-xs focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-400">Specifies Sanger, NGS WGS, amplicon metabarcoding, or long-read technology.</p>
              </div>

              {/* Field 2: NCBI Accession Number */}
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-700">NCBI Accession Number</label>
                  {formData.ncbi_accession && (
                    <a
                      href={`https://www.ncbi.nlm.nih.gov/search/all/?term=${encodeURIComponent(formData.ncbi_accession.trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
                      title="Open accession on NCBI database"
                    >
                      <span>Verify on NCBI</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div>
                  <input 
                    type="text" 
                    placeholder="e.g. OQ542198, PRJNA912834, SRR21894012"
                    value={formData.ncbi_accession}
                    onChange={(e) => setFormData({...formData, ncbi_accession: e.target.value.toUpperCase()})}
                    className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-sm font-mono"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  GenBank, SRA, BioProject, or BioSample accession assigned by NCBI to your sample.
                </p>
              </div>
            </div>
          </div>

           <div className="space-y-2 md:col-span-2">
            <div className="flex justify-between items-center mb-1">
               <label className="block text-sm font-medium text-slate-700">Literature Reference (Optional)</label>
               <button 
                 type="button" 
                 onClick={() => setIsNewReference(!isNewReference)} 
                 className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
               >
                 {isNewReference ? "Select Existing Reference" : "+ Add New Reference"}
               </button>
            </div>

            {!isNewReference ? (
              <select 
                value={formData.reference_id}
                onChange={(e) => setFormData({...formData, reference_id: e.target.value})}
                className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
              >
                <option value="">None</option>
                {masterData.references?.map(r => (
                  <option key={r.reference_id} value={r.reference_id}>
                    {r.title} {r.publication_year ? `(${r.publication_year})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-4 p-5 border border-emerald-200 bg-emerald-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Article Title *</label>
                  <input 
                    type="text" required={isNewReference}
                    placeholder="e.g. Endophytic fungi of medicinal plants..."
                    value={formData.new_reference_title}
                    onChange={(e) => setFormData({...formData, new_reference_title: e.target.value})}
                    className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Publication Year</label>
                    <input 
                      type="number" placeholder="2024"
                      value={formData.new_reference_year}
                      onChange={(e) => setFormData({...formData, new_reference_year: e.target.value})}
                      className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Link / DOI</label>
                    <input 
                      type="url" placeholder="https://doi.org/..."
                      value={formData.new_reference_link}
                      onChange={(e) => setFormData({...formData, new_reference_link: e.target.value})}
                      className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center cursor-pointer">
            <FilePlus className="w-5 h-5 mr-2" />
            Save Observation
          </button>
        </div>
      </form>
    </div>
  );
};

export default CaptureScreen;