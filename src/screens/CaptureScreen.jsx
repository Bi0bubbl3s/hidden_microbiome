// @ts-nocheck
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  FilePlus, 
  Search, 
  ExternalLink, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Leaf, 
  Database, 
  Binary, 
  Sparkles, 
  RefreshCw,
  Crosshair,
  Compass,
  Plus,
  Check,
  User,
  Hash,
  Calendar
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
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

// Component to handle map clicks
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
    },
  });
  return null; 
};

// Component to recenter map when coordinates change
const MapRecenter = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
      map.panTo([parseFloat(lat), parseFloat(lng)]);
    }
  }, [lat, lng, map]);
  return null;
};

const CaptureScreen = ({ masterData, notify, refreshData }) => {
  // Specimen mode: 'new' (register new physical specimen) or 'existing' (link to previously logged specimen)
  const [specimenMode, setSpecimenMode] = useState('new');
  const [selectedExistingSpecimenId, setSelectedExistingSpecimenId] = useState('');

  const [formData, setFormData] = useState({
    specimen_identifier: '',
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
    created_by: 'Researcher Admin',
    isolation_notes: ''
  });

  // Inline creation states
  const [isNewCrop, setIsNewCrop] = useState(false);
  const [isNewReference, setIsNewReference] = useState(false);
  const [isNewEndophyte, setIsNewEndophyte] = useState(false);
  const [isNewSequencingMethod, setIsNewSequencingMethod] = useState(false);
  const [isAddingStructure, setIsAddingStructure] = useState(false);
  const [newStructureName, setNewStructureName] = useState('');
  
  // Search & Filter state
  const [endoSearch, setEndoSearch] = useState('');
  const [pastedCoordinates, setPastedCoordinates] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CSV/Excel Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvError, setCsvError] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // Auto-generate a standardized specimen voucher code
  const handleGenerateSpecimenCode = () => {
    const selectedCrop = masterData.crops?.find(c => String(c.crop_species_id) === String(formData.crop_species_id));
    const prefix = selectedCrop ? selectedCrop.common_name.slice(0, 3).toUpperCase() : 'SPEC';
    const year = new Date().getFullYear();
    const randomSerial = Math.floor(1000 + Math.random() * 9000);
    const code = `${prefix}-${year}-${randomSerial}`;
    setFormData(prev => ({ ...prev, specimen_identifier: code }));
    notify(`Generated specimen voucher ID: ${code}`, 'success');
  };

  // Switch to existing specimen and auto-populate known values
  const handleSelectExistingSpecimen = (specimenId) => {
    setSelectedExistingSpecimenId(specimenId);
    if (!specimenId) return;

    const spec = masterData.specimens?.find(s => String(s.plant_specimen_id) === String(specimenId));
    if (spec) {
      setFormData(prev => ({
        ...prev,
        specimen_identifier: spec.specimen_identifier || `SPEC-${spec.plant_specimen_id}`,
        crop_species_id: spec.crop_species_id ? String(spec.crop_species_id) : '',
        latitude: spec.latitude !== undefined && spec.latitude !== null ? String(spec.latitude) : '',
        longitude: spec.longitude !== undefined && spec.longitude !== null ? String(spec.longitude) : '',
        location_estimated: Boolean(spec.location_estimated),
        created_by: spec.created_by || prev.created_by
      }));
      setIsNewCrop(false);
      notify(`Linked Specimen: ${spec.specimen_identifier}`, 'success');
    }
  };

  // Get current device GPS location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      notify('Geolocation is not supported by your browser.', 'error');
      return;
    }
    notify('Requesting GPS location from browser...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
          location_estimated: false
        }));
        notify(`GPS coordinates obtained: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`, 'success');
      },
      (err) => {
        notify(`Unable to retrieve GPS: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Handle Pasting DMS Coordinates from published literature / PDF
  const handleConvertPastedCoords = () => {
    if (!pastedCoordinates.trim()) return;
    const { lat, lng } = parseCoordinates(pastedCoordinates);
    if (lat && lng) {
      setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
      setPastedCoordinates('');
      notify(`Coordinates parsed: ${lat}, ${lng}`, 'success');
    } else {
      notify('Could not parse DMS format. Example format: 33°55\'12"S 18°25\'10"E', 'error');
    }
  };

  // Toggle structure selection
  const handleStructureToggle = (structureId) => {
    setFormData((prev) => {
      const currentIds = prev.plant_structure_ids;
      return currentIds.includes(structureId) 
        ? { ...prev, plant_structure_ids: currentIds.filter(id => id !== structureId) }
        : { ...prev, plant_structure_ids: [...currentIds, structureId] };
    });
  };

  // Inline add new plant structure
  const handleCreateNewStructure = async (e) => {
    e.preventDefault();
    if (!newStructureName.trim()) return;
    try {
      const created = await api.post('/structures/', { name: newStructureName.trim() });
      setFormData(prev => ({
        ...prev,
        plant_structure_ids: [...prev.plant_structure_ids, created.plant_structure_id.toString()]
      }));
      setNewStructureName('');
      setIsAddingStructure(false);
      refreshData();
      notify(`Added & selected new plant tissue: "${created.name}"`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  // Toggle endophyte selection
  const handleEndophyteToggle = (endoId) => {
    setFormData((prev) => {
      const currentIds = prev.endophyte_ids;
      return currentIds.includes(endoId) 
        ? { ...prev, endophyte_ids: currentIds.filter(id => id !== endoId) }
        : { ...prev, endophyte_ids: [...currentIds, endoId] };
    });
  };

  // Download Excel Workbook (.xlsx)
  const handleDownloadExcelTemplate = () => {
    try {
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
        }
      ];

      const cropReferenceRows = (masterData.crops || []).map(c => ({
        crop_species_id: c.crop_species_id,
        common_name: c.common_name,
        scientific_name: c.scientific_name || '',
        plant_group: c.plant_group || 'Unknown'
      }));

      const endophyteReferenceRows = (masterData.endophytes || []).map(e => {
        const type = masterData.endophyteTypes?.find(t => t.endophyte_type_id === e.endophyte_type_id);
        return {
          endophyte_id: e.endophyte_id,
          scientific_name: e.scientific_name,
          taxonomy_type: type?.type_name || ''
        };
      });

      const structureReferenceRows = (masterData.structures || []).map(s => ({
        plant_structure_id: s.plant_structure_id,
        name: s.name
      }));

      const seqMethodsReferenceRows = (masterData.sequencingMethods || []).map(m => ({
        sequencing_method_id: m.sequencing_method_id,
        method_name: m.method_name,
        platform_type: m.platform_type || ''
      }));

      const sheets = [
        { name: 'Observations_Template', headers: observationHeaders, rows: sampleRows },
        { name: 'Ref_Crops', headers: ['crop_species_id', 'common_name', 'scientific_name', 'plant_group'], rows: cropReferenceRows },
        { name: 'Ref_Endophytes', headers: ['endophyte_id', 'scientific_name', 'taxonomy_type'], rows: endophyteReferenceRows },
        { name: 'Ref_PlantStructures', headers: ['plant_structure_id', 'name'], rows: structureReferenceRows },
        { name: 'Ref_SequencingMethods', headers: ['sequencing_method_id', 'method_name', 'platform_type'], rows: seqMethodsReferenceRows }
      ];

      downloadExcelFile(sheets, 'Microbiome_Observation_Template.xlsx');
      notify('Excel template (.xlsx) downloaded with reference sheets!', 'success');
    } catch (err) {
      console.error(err);
      notify('Failed to generate Excel file: ' + err.message, 'error');
    }
  };

  // Download standard CSV template
  const handleDownloadCSVTemplate = () => {
    try {
      downloadCSVFile({
        filename: 'microbiome_observation_template.csv',
        content: OBSERVATION_CSV_TEMPLATE
      });
      notify('CSV template (.csv) downloaded successfully!', 'success');
    } catch (err) {
      notify('Failed to download CSV: ' + err.message, 'error');
    }
  };

  // Handle uploaded data file
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

      const first = rows[0];
      const hasCrop = 'crop_common_name' in first || 'crop_name' in first || 'common_name' in first || 'crop' in first;
      const hasEndo = 'endophyte_scientific_name' in first || 'endophyte_name' in first || 'scientific_name' in first || 'endophyte' in first;

      if (!hasCrop || !hasEndo) {
        setCsvError('File requires columns for host crop (e.g. crop_common_name) and endophyte species (e.g. endophyte_scientific_name). Check template guidelines.');
      }

      setParsedRows(rows);
    } catch (err) {
      console.error('Error parsing data file:', err);
      setCsvError(err.message || 'Error parsing file. Please check that it is a valid Excel, CSV, or Text table.');
      setParsedRows([]);
    }
  };

  // Master data analysis of batch rows
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

  // Execute batch import
  const handleExecuteImport = async () => {
    if (!parsedRows || parsedRows.length === 0) {
      return notify('Please select a valid data file first.', 'error');
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
      
      setTimeout(() => {
        setIsImportModalOpen(false);
        setCsvFile(null);
        setParsedRows([]);
        setImportResult(null);
      }, 1500);

    } catch (err) {
      notify(err.message || 'Failed to import observations', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // Submit manual observation form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.plant_structure_ids.length === 0) {
      return notify('Please select at least one plant tissue/structure.', 'error');
    }
    if (formData.endophyte_ids.length === 0 && !isNewEndophyte) {
      return notify('Please select at least one endophyte, or register a new one.', 'error');
    }
    if (specimenMode === 'new' && !isNewCrop && !formData.crop_species_id) {
      return notify('Please select a host crop species.', 'error');
    }
    if (specimenMode === 'existing' && !selectedExistingSpecimenId) {
      return notify('Please select an existing specimen to link.', 'error');
    }

    setIsSubmitting(true);
    try {
      let finalReferenceId = formData.reference_id ? parseInt(formData.reference_id) : null;
      let finalEndophyteIds = [...formData.endophyte_ids.map(id => parseInt(id))];
      let finalCropId = formData.crop_species_id ? parseInt(formData.crop_species_id) : null;

      // Create new crop if requested
      if (isNewCrop && formData.new_crop_name && formData.new_crop_group) {
        const cropPayload = {
          common_name: formData.new_crop_name,
          scientific_name: formData.new_crop_scientific || null,
          plant_group: formData.new_crop_group
        };
        const newCrop = await api.post('/crops/', cropPayload);
        finalCropId = newCrop.crop_species_id;
      }

      // Create new reference if requested
      if (isNewReference && formData.new_reference_title) {
        const refPayload = {
          title: formData.new_reference_title,
          publication_year: formData.new_reference_year ? parseInt(formData.new_reference_year) : null,
          reference_link: formData.new_reference_link || null
        };
        const newRef = await api.post('/references/', refPayload); 
        finalReferenceId = newRef.reference_id; 
      }

      // Create new endophyte if requested
      if (isNewEndophyte && formData.new_endophyte_name && formData.new_endophyte_type_id) {
        const endoPayload = {
          scientific_name: formData.new_endophyte_name,
          endophyte_type_id: parseInt(formData.new_endophyte_type_id)
        };
        const newEndo = await api.post('/endophytes/', endoPayload);
        finalEndophyteIds.push(newEndo.endophyte_id);
      }

      // Handle Sequencing Method
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

      // Determine specimen identifier
      let finalSpecimenIdentifier = formData.specimen_identifier.trim();
      if (!finalSpecimenIdentifier) {
        const cropObj = masterData.crops?.find(c => c.crop_species_id === finalCropId);
        const prefix = cropObj ? cropObj.common_name.slice(0, 3).toUpperCase() : 'SPEC';
        finalSpecimenIdentifier = `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const fullPayload = {
        plant_specimen_id: specimenMode === 'existing' && selectedExistingSpecimenId ? parseInt(selectedExistingSpecimenId) : undefined,
        crop_species_id: finalCropId,
        specimen_identifier: finalSpecimenIdentifier,
        latitude: parseFloat(formData.latitude) || 0,
        longitude: parseFloat(formData.longitude) || 0,
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
      
      const totalCreated = finalEndophyteIds.length * formData.plant_structure_ids.length;
      notify(`Observation logged! Recorded ${totalCreated} observation record(s) for specimen "${finalSpecimenIdentifier}".`, 'success');
      await refreshData();
      
      // Reset form fields
      setFormData({ 
        specimen_identifier: '',
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
        created_by: 'Researcher Admin',
        isolation_notes: ''
      });
      setIsNewCrop(false);
      setIsNewReference(false);
      setIsNewEndophyte(false);
      setIsNewSequencingMethod(false);
      setSelectedExistingSpecimenId('');
      setSpecimenMode('new');

    } catch (error) {
      console.error(error);
      notify(error.message || 'Error saving observation.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered endophytes for searching
  const filteredEndophytes = (masterData.endophytes || []).filter(e => 
    e.scientific_name.toLowerCase().includes(endoSearch.toLowerCase())
  );

  // Selected crop info helper
  const activeCrop = masterData.crops?.find(c => String(c.crop_species_id) === String(formData.crop_species_id));

  // Count calculations
  const totalSpecimens = masterData.specimens?.length || 0;
  const totalObservations = masterData.observations?.length || 0;
  const totalCrops = masterData.crops?.length || 0;
  const projectedCount = (formData.endophyte_ids.length + (isNewEndophyte && formData.new_endophyte_name ? 1 : 0)) * formData.plant_structure_ids.length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      
      {/* Top Header & Quick Actions */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
              Primary Data Entry
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">Specimen Voucher & Microbiome Log</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Log Observation & Specimen
          </h1>
          <p className="text-slate-600 text-sm mt-1 max-w-2xl">
            Register plant vouchers, sample georeferencing, anatomical tissue tropism, isolated endophytes, and NCBI molecular evidence in one unified workspace.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
          {/* Download Options */}
          <div className="flex items-center rounded-xl border border-slate-300 bg-white shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={handleDownloadExcelTemplate}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
              title="Download rich Excel workbook (.xlsx) with reference sheets"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Download Excel (.xlsx)</span>
            </button>
            <div className="h-5 w-px bg-slate-200"></div>
            <button
              type="button"
              onClick={handleDownloadCSVTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              title="Download standard CSV template (.csv)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>

          {/* Import Button */}
          <button
            type="button"
            onClick={() => {
              setIsImportModalOpen(true);
              setCsvError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all cursor-pointer"
            title="Import observations from Excel (.xlsx/.xls), CSV, or text (.tsv/.txt)"
          >
            <Upload className="w-4 h-4" />
            <span>Import Data File</span>
          </button>
        </div>
      </header>

      {/* Database Context Statistics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs text-xs">
        <div className="px-3 py-1 border-r border-slate-100 last:border-none">
          <span className="text-slate-500 block">Total Specimens</span>
          <span className="text-base font-bold text-slate-800 font-mono">{totalSpecimens}</span>
        </div>
        <div className="px-3 py-1 border-r border-slate-100 last:border-none">
          <span className="text-slate-500 block">Recorded Observations</span>
          <span className="text-base font-bold text-emerald-700 font-mono">{totalObservations}</span>
        </div>
        <div className="px-3 py-1 border-r border-slate-100 last:border-none">
          <span className="text-slate-500 block">Registered Crops</span>
          <span className="text-base font-bold text-slate-800 font-mono">{totalCrops}</span>
        </div>
        <div className="px-3 py-1">
          <span className="text-slate-500 block">Endophyte Species</span>
          <span className="text-base font-bold text-purple-700 font-mono">{masterData.endophytes?.length || 0}</span>
        </div>
      </div>

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
                  <h3 className="text-lg font-bold text-slate-800">Batch Import Observations & Specimens</h3>
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
              
              {/* Guidance Card */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-950 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-emerald-900">
                    Smart Master Data Synchronization & Multi-Format Support
                  </div>
                  <p className="text-emerald-800 leading-relaxed">
                    Download an <strong>Excel workbook (.xlsx)</strong> with instructions and existing reference tables, edit it in Microsoft Excel, Google Sheets, or LibreOffice, and upload it directly. Any new crops, endophytes, tissues, or sequencing platforms are automatically created in Master Data!
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
                  </div>
                </div>
              </div>

              {/* Upload Drop Zone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-all cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv, .txt, .tsv, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleFileChange}
                  className="hidden"
                  id="data-file-upload-input"
                />
                <label htmlFor="data-file-upload-input" className="cursor-pointer block space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    {csvFile ? csvFile.name : 'Click to select or drag and drop your data file'}
                  </div>
                  <p className="text-xs text-slate-500">
                    Supports Microsoft Excel (.xlsx, .xls), CSV (.csv), and Tab/Text tables (.txt, .tsv) up to 25MB
                  </p>
                  {csvFile && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{parsedRows.length} valid row(s) parsed</span>
                    </div>
                  )}
                </label>
              </div>

              {/* Parsing Error Display */}
              {csvError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Formatting Error</div>
                    <div>{csvError}</div>
                  </div>
                </div>
              )}

              {/* Preview table when rows exist */}
              {parsedRows.length > 0 && !importResult && (
                <div className="space-y-4 pt-2">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                        <Database className="w-4 h-4 text-emerald-600" />
                        <span>Pre-Import Discovery Summary</span>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                        {parsedRows.length} Row(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                        <span className="text-slate-500 block text-[11px]">New Crops</span>
                        <span className="font-bold text-slate-800">+{masterDataAnalysis.newCrops.length} New</span>
                      </div>
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                        <span className="text-slate-500 block text-[11px]">New Endophytes</span>
                        <span className="font-bold text-purple-700">+{masterDataAnalysis.newEndophytes.length} New</span>
                      </div>
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                        <span className="text-slate-500 block text-[11px]">New Plant Tissues</span>
                        <span className="font-bold text-blue-700">+{masterDataAnalysis.newStructures.length} New</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="p-2.5 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-700 flex justify-between">
                      <span>Row Preview (first 5 records)</span>
                      <span className="text-slate-400 font-normal">Auto-validating coordinates and taxonomy</span>
                    </div>
                    <div className="overflow-x-auto max-h-48">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Specimen Voucher</th>
                            <th className="py-2 px-3">Host Crop</th>
                            <th className="py-2 px-3">Coords (Lat, Lng)</th>
                            <th className="py-2 px-3">Tissue</th>
                            <th className="py-2 px-3">Endophyte Species</th>
                            <th className="py-2 px-3">Sequencing & Accession</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedRows.slice(0, 5).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="py-2 px-3 font-mono font-medium text-slate-700">{row.specimen_identifier || `AUTO`}</td>
                              <td className="py-2 px-3 font-medium text-slate-800">{row.crop_common_name || row.crop_name || '-'}</td>
                              <td className="py-2 px-3 text-slate-500 font-mono">{row.latitude}, {row.longitude}</td>
                              <td className="py-2 px-3 text-slate-600">{row.plant_structure || '-'}</td>
                              <td className="py-2 px-3 italic text-emerald-700 font-medium">{row.endophyte_scientific_name || '-'}</td>
                              <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                                {row.sequencing_method || ''} {row.ncbi_accession ? `[${row.ncbi_accession}]` : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {parsedRows.length > 0 ? `Ready to process ${parsedRows.length} observation records` : 'Select an Excel, CSV, or text table to proceed'}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setCsvFile(null);
                    setParsedRows([]);
                    setCsvError(null);
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
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Execute Import ({parsedRows.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Main Data Entry Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: PHYSICAL PLANT SPECIMEN & HOST IDENTIFIER */}
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Plant Specimen & Host Identity
                </h2>
                <p className="text-xs text-slate-500">
                  Assign a physical sample voucher identifier, select or register the host crop, and record the collector.
                </p>
              </div>
            </div>

            {/* Specimen Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-center">
              <button
                type="button"
                onClick={() => {
                  setSpecimenMode('new');
                  setSelectedExistingSpecimenId('');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  specimenMode === 'new'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Register New Specimen
              </button>
              <button
                type="button"
                onClick={() => setSpecimenMode('existing')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  specimenMode === 'existing'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🔗 Link Existing Specimen ({masterData.specimens?.length || 0})
              </button>
            </div>
          </div>

          {/* If Linking Existing Specimen */}
          {specimenMode === 'existing' && (
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-emerald-900 uppercase tracking-wide">
                  Select Registered Specimen from Database *
                </label>
                <span className="text-[11px] text-emerald-700">Auto-fills coordinates and host crop</span>
              </div>
              <select
                value={selectedExistingSpecimenId}
                onChange={(e) => handleSelectExistingSpecimen(e.target.value)}
                required={specimenMode === 'existing'}
                className="w-full rounded-xl border-slate-300 border bg-white p-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="">-- Choose a previously registered plant specimen --</option>
                {masterData.specimens?.map(spec => {
                  const crop = masterData.crops?.find(c => c.crop_species_id === spec.crop_species_id);
                  const obsCount = (masterData.observations || []).filter(o => o.plant_specimen_id === spec.plant_specimen_id).length;
                  return (
                    <option key={spec.plant_specimen_id} value={spec.plant_specimen_id}>
                      {spec.specimen_identifier || `Specimen #${spec.plant_specimen_id}`} — {crop?.common_name || 'Crop'} (Lat: {spec.latitude}, Lng: {spec.longitude}) · [{obsCount} observation(s)]
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Specimen Identifier & Collector Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Field: Specimen Identifier / Voucher ID */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-800">
                  Specimen Voucher / Sample ID *
                </label>
                {specimenMode === 'new' && (
                  <button
                    type="button"
                    onClick={handleGenerateSpecimenCode}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Auto-Generate ID</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. ZM-2024-001, VOUCHER-ZA-42"
                  value={formData.specimen_identifier}
                  onChange={(e) => setFormData({ ...formData, specimen_identifier: e.target.value.toUpperCase() })}
                  disabled={specimenMode === 'existing'}
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm font-mono transition-all ${
                    specimenMode === 'existing'
                      ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                      : 'border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Unique identifier for the physical botanical voucher, field collection tag, or herbarium accession.
              </p>
            </div>

            {/* Field: Recorded By / Researcher */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800">
                Collector / Recorded By
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="e.g. Dr. A. Smith, Researcher Admin"
                  value={formData.created_by}
                  onChange={(e) => setFormData({ ...formData, created_by: e.target.value })}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Primary investigator or collector associated with this plant sampling.
              </p>
            </div>

            {/* Field: Host Crop Species Selection */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-800">
                  Host Crop Species *
                </label>
                {specimenMode === 'new' && (
                  <button 
                    type="button" 
                    onClick={() => setIsNewCrop(!isNewCrop)} 
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                  >
                    {isNewCrop ? "- Select From Existing Crops" : "+ Add New Host Crop"}
                  </button>
                )}
              </div>

              {!isNewCrop ? (
                <div className="relative">
                  <select 
                    required
                    disabled={specimenMode === 'existing'}
                    value={formData.crop_species_id}
                    onChange={(e) => setFormData({ ...formData, crop_species_id: e.target.value })}
                    className={`w-full rounded-xl border p-2.5 text-sm transition-all ${
                      specimenMode === 'existing'
                        ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                        : 'border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                    }`}
                  >
                    <option value="">-- Choose Host Crop Species --</option>
                    {masterData.crops?.map(c => (
                      <option key={c.crop_species_id} value={c.crop_species_id}>
                        {c.common_name} {c.scientific_name ? `(${c.scientific_name})` : ''} · {c.plant_group || 'Plant'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-4 border border-emerald-200 bg-emerald-50/60 rounded-xl space-y-3.5 animate-in fade-in duration-150">
                  <div className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                    Register New Host Crop Species
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Common Name *</label>
                      <input 
                        type="text" required={isNewCrop} placeholder="e.g. Quinoa, Sorghum"
                        value={formData.new_crop_name} 
                        onChange={(e) => setFormData({ ...formData, new_crop_name: e.target.value })}
                        className="w-full rounded-lg border-slate-300 border p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Scientific Name (Optional)</label>
                      <input 
                        type="text" placeholder="e.g. Chenopodium quinoa"
                        value={formData.new_crop_scientific} 
                        onChange={(e) => setFormData({ ...formData, new_crop_scientific: e.target.value })}
                        className="w-full rounded-lg border-slate-300 border p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 italic"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Botanical Clade *</label>
                      <select 
                        required={isNewCrop}
                        value={formData.new_crop_group} 
                        onChange={(e) => setFormData({ ...formData, new_crop_group: e.target.value })}
                        className="w-full rounded-lg border-slate-300 border p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      >
                        <option value="">Select Clade...</option>
                        <option value="Monocot">Monocot</option>
                        <option value="Dicot">Dicot</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* SECTION 2: GEOGRAPHIC LOCALIZATION & SAMPLING SITE */}
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Sampling Location & Field Coordinates
                </h2>
                <p className="text-xs text-slate-500">
                  Select coordinates interactively on the global map, query your device GPS, or convert DMS strings.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                title="Detect current location via browser GPS"
              >
                <Crosshair className="w-3.5 h-3.5 text-emerald-700" />
                <span>Use Current GPS</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Coordinate Inputs & Converters (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Decimal Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Latitude (Decimal) *</label>
                  <input 
                    type="number" 
                    step="any" 
                    required 
                    placeholder="-33.9248"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    disabled={specimenMode === 'existing'}
                    className={`w-full rounded-xl border p-2.5 text-sm font-mono ${
                      specimenMode === 'existing'
                        ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                        : 'border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                    }`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Longitude (Decimal) *</label>
                  <input 
                    type="number" 
                    step="any" 
                    required 
                    placeholder="18.4240"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    disabled={specimenMode === 'existing'}
                    className={`w-full rounded-xl border p-2.5 text-sm font-mono ${
                      specimenMode === 'existing'
                        ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                        : 'border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                    }`}
                  />
                </div>
              </div>

              {/* DMS Converter Box */}
              {specimenMode === 'new' && (
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-slate-500" />
                      Paste DMS from Literature / PDF
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder={`e.g. 33°55'12"S 18°25'10"E`}
                      value={pastedCoordinates}
                      onChange={(e) => setPastedCoordinates(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleConvertPastedCoords();
                        }
                      }}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={handleConvertPastedCoords}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Convert
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Converts Degrees-Minutes-Seconds with N/S/E/W automatically into decimal format.
                  </p>
                </div>
              )}

              {/* Estimate Checkbox */}
              <div className="pt-1">
                <label className="flex items-start cursor-pointer group select-none">
                  <input 
                    type="checkbox" 
                    checked={formData.location_estimated}
                    onChange={(e) => setFormData({ ...formData, location_estimated: e.target.checked })}
                    disabled={specimenMode === 'existing'}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 mt-0.5 cursor-pointer"
                  />
                  <div className="ml-2.5 text-xs text-slate-600 group-hover:text-slate-800">
                    <span className="font-semibold text-slate-700 block">Location is approximate / estimated</span>
                    <span className="text-slate-400">Mark if exact field GPS coordinates were not provided in the original study.</span>
                  </div>
                </label>
              </div>

            </div>

            {/* Right Column: Interactive Leaflet Map (7 cols) */}
            <div className="lg:col-span-7">
              <div className="rounded-xl overflow-hidden border border-slate-300 shadow-2xs relative z-0 h-64 sm:h-72 w-full">
                <MapContainer 
                  center={[
                    formData.latitude && !isNaN(parseFloat(formData.latitude)) ? parseFloat(formData.latitude) : 20, 
                    formData.longitude && !isNaN(parseFloat(formData.longitude)) ? parseFloat(formData.longitude) : 0
                  ]} 
                  zoom={formData.latitude ? 4 : 2} 
                  scrollWheelZoom={true} 
                  className="h-full w-full relative z-0"
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  
                  {specimenMode === 'new' && (
                    <MapClickHandler 
                      onLocationSelect={(lat, lng) => {
                        setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
                      }} 
                    />
                  )}
                  
                  {formData.latitude && formData.longitude && !isNaN(parseFloat(formData.latitude)) && !isNaN(parseFloat(formData.longitude)) && (
                    <>
                      <MapRecenter lat={formData.latitude} lng={formData.longitude} />
                      <Marker position={[parseFloat(formData.latitude), parseFloat(formData.longitude)]}>
                        <Popup>
                          <div className="p-1 text-xs">
                            <strong className="block font-semibold text-emerald-800">
                              {formData.specimen_identifier || 'Sampling Location'}
                            </strong>
                            <span className="text-slate-600">
                              {activeCrop?.common_name || 'Plant Voucher'}
                            </span>
                            <div className="text-[11px] text-slate-400 font-mono mt-1">
                              {formData.latitude}, {formData.longitude}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    </>
                  )}
                </MapContainer>
                
                <div className="absolute bottom-2 left-2 z-1000 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-700 border border-slate-200 shadow-xs">
                  {specimenMode === 'new' ? 'Click anywhere on map to pin sampling coordinates' : 'Specimen coordinates pinned'}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 3: PLANT ANATOMY & TISSUE LOCALIZATION */}
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Plant Anatomy & Tissue Localization *
                </h2>
                <p className="text-xs text-slate-500">
                  Select which anatomical plant compartments were sampled for endophyte isolation. Multiple allowed.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingStructure(!isAddingStructure)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-center"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingStructure ? 'Close Add Tissue' : '+ Add New Tissue'}</span>
            </button>
          </div>

          {/* Inline Add Structure Form */}
          {isAddingStructure && (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2.5 max-w-md animate-in fade-in duration-150">
              <input
                type="text"
                placeholder="Tissue name (e.g. Flower, Bark, Petiole, Nodule)"
                value={newStructureName}
                onChange={(e) => setNewStructureName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={handleCreateNewStructure}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Add Tissue
              </button>
            </div>
          )}

          {/* Interactive Structure Chips Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {masterData.structures?.map(s => {
              const isSelected = formData.plant_structure_ids.includes(s.plant_structure_id.toString());
              return (
                <button
                  type="button"
                  key={s.plant_structure_id}
                  onClick={() => handleStructureToggle(s.plant_structure_id.toString())}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer group ${
                    isSelected
                      ? 'bg-emerald-50/90 border-emerald-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Leaf className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                      isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold ${isSelected ? 'text-emerald-950 font-bold' : 'text-slate-700'}`}>
                    {s.name}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="font-semibold text-slate-700">Selected Tissues:</span>
            <span>{formData.plant_structure_ids.length} tissue compartment(s) selected</span>
          </div>
        </section>

        {/* SECTION 4: ENDOPHYTIC MICROORGANISMS */}
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Isolated Endophytic Microorganisms *
                </h2>
                <p className="text-xs text-slate-500">
                  Identify and check symbiotic fungi, bacteria, or actinomycetes isolated from this plant sample.
                </p>
              </div>
            </div>

            <button 
              type="button" 
              onClick={() => setIsNewEndophyte(!isNewEndophyte)} 
              className="text-xs font-semibold text-purple-700 hover:text-purple-800 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-center"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isNewEndophyte ? '- Cancel Adding Unlisted' : '+ Add Unlisted Endophyte'}</span>
            </button>
          </div>

          {/* Search Bar for Endophytes */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search endophyte species by scientific name (e.g. Fusarium, Bacillus, Streptomyces)..." 
              value={endoSearch} 
              onChange={(e) => setEndoSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-white"
            />
          </div>

          {/* Endophyte Selection Grid */}
          <div className="h-44 overflow-y-auto bg-slate-50/50 border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {filteredEndophytes.length > 0 ? filteredEndophytes.map(e => {
              const isChecked = formData.endophyte_ids.includes(e.endophyte_id.toString());
              const type = masterData.endophyteTypes?.find(t => t.endophyte_type_id === e.endophyte_type_id);
              return (
                <label 
                  key={e.endophyte_id} 
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isChecked 
                      ? 'bg-purple-50 border-purple-400 shadow-2xs' 
                      : 'bg-white border-slate-200 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                      checked={isChecked}
                      onChange={() => handleEndophyteToggle(e.endophyte_id.toString())}
                    />
                    <span className="text-xs font-semibold italic text-slate-800 truncate" title={e.scientific_name}>
                      {e.scientific_name}
                    </span>
                  </div>
                  {type && (
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                      {type.type_name}
                    </span>
                  )}
                </label>
              );
            }) : (
              <div className="col-span-full py-8 text-center text-xs text-slate-400">
                No matching endophytes found. Use "+ Add Unlisted Endophyte" above to register a new species!
              </div>
            )}
          </div>

          {/* Inline Add Unlisted Endophyte */}
          {isNewEndophyte && (
            <div className="p-4 border border-purple-200 bg-purple-50/60 rounded-xl space-y-3.5 animate-in fade-in duration-150">
              <div className="text-xs font-bold text-purple-950 uppercase tracking-wide">
                Register New Unlisted Endophyte Species
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Scientific Binomial Name *</label>
                  <input 
                    type="text" 
                    required={isNewEndophyte} 
                    placeholder="e.g. Trichoderma harzianum"
                    value={formData.new_endophyte_name} 
                    onChange={(e) => setFormData({ ...formData, new_endophyte_name: e.target.value })}
                    className="w-full rounded-lg border-slate-300 border p-2 text-xs bg-white italic focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Taxonomic Type *</label>
                  <select 
                    required={isNewEndophyte} 
                    value={formData.new_endophyte_type_id}
                    onChange={(e) => setFormData({ ...formData, new_endophyte_type_id: e.target.value })}
                    className="w-full rounded-lg border-slate-300 border p-2 text-xs bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  >
                    <option value="">Select Category...</option>
                    {masterData.endophyteTypes?.map(t => (
                      <option key={t.endophyte_type_id} value={t.endophyte_type_id}>{t.type_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>{formData.endophyte_ids.length} endophyte species checked</span>
            {isNewEndophyte && formData.new_endophyte_name && (
              <span className="text-purple-700 font-semibold">+ 1 new unlisted species will be created</span>
            )}
          </div>
        </section>

        {/* SECTION 5: MOLECULAR & SEQUENCING EVIDENCE */}
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-sm">
                5
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Genomic & Molecular Sequencing Evidence
                </h2>
                <p className="text-xs text-slate-500">
                  Specify the sequencing technology utilized and verify NCBI accession identifiers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => setIsNewSequencingMethod(!isNewSequencingMethod)} 
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-center"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isNewSequencingMethod ? "Select Existing Method" : "+ Add New Sequencing Method"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Field: Sequencing Method */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                Sequencing Technology / Method
              </label>

              {!isNewSequencingMethod ? (
                <select 
                  value={formData.sequencing_method_id}
                  onChange={(e) => setFormData({ ...formData, sequencing_method_id: e.target.value })}
                  className="w-full rounded-xl border-slate-300 border p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white text-sm"
                >
                  <option value="">-- Select Sequencing Method --</option>
                  {masterData.sequencingMethods?.map(s => (
                    <option key={s.sequencing_method_id} value={s.sequencing_method_id}>
                      {s.method_name} {s.platform_type ? `[${s.platform_type}]` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-3 p-3.5 border border-indigo-200 bg-indigo-50/70 rounded-xl">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Method Name *</label>
                    <input 
                      type="text" 
                      required={isNewSequencingMethod}
                      placeholder="e.g. Sanger Sequencing, NGS - WGS, Amplicon 16S"
                      value={formData.new_sequencing_name}
                      onChange={(e) => setFormData({ ...formData, new_sequencing_name: e.target.value })}
                      className="w-full rounded-lg border-slate-300 border p-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Platform / Instrument (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Illumina MiSeq, Oxford Nanopore MinION, PacBio Sequel"
                      value={formData.new_sequencing_platform}
                      onChange={(e) => setFormData({ ...formData, new_sequencing_platform: e.target.value })}
                      className="w-full rounded-lg border-slate-300 border p-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    />
                  </div>
                </div>
              )}
              <p className="text-[11px] text-slate-400">
                Identifies Sanger, whole genome (WGS), metabarcoding amplicons, or long-read platforms.
              </p>
            </div>

            {/* Field: NCBI Accession Number */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-800">
                  NCBI Accession Number
                </label>
                {formData.ncbi_accession && (
                  <a
                    href={`https://www.ncbi.nlm.nih.gov/search/all/?term=${encodeURIComponent(formData.ncbi_accession.trim())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
                    title="Search accession in NCBI"
                  >
                    <span>Verify on NCBI</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="relative">
                <Binary className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input 
                  type="text" 
                  placeholder="e.g. OQ542198, PRJNA912834, SRR21894012"
                  value={formData.ncbi_accession}
                  onChange={(e) => setFormData({ ...formData, ncbi_accession: e.target.value.toUpperCase() })}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border-slate-300 border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white text-sm font-mono uppercase"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                GenBank, BioProject, SRA Run, or BioSample accession assigned by NCBI to this sample.
              </p>
            </div>

          </div>
        </section>

        {/* SECTION 6: PROVENANCE, LITERATURE & METADATA */}
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-sm">
                6
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Observation Date & Literature Citation
                </h2>
                <p className="text-xs text-slate-500">
                  Document the publication source, sampling date, and experimental remarks.
                </p>
              </div>
            </div>

            <button 
              type="button" 
              onClick={() => setIsNewReference(!isNewReference)} 
              className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-center"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isNewReference ? "Select Existing Reference" : "+ Add New Reference"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Field: Observation Date */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800">
                Observation Date *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input 
                  type="date" 
                  required
                  value={formData.observation_date}
                  onChange={(e) => setFormData({ ...formData, observation_date: e.target.value })}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border-slate-300 border focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-white text-sm"
                />
              </div>
              <p className="text-[11px] text-slate-400">Date field observation or sample was collected.</p>
            </div>

            {/* Field: Reference Selection (2 cols) */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-800">
                Published Study / Literature Reference (Optional)
              </label>

              {!isNewReference ? (
                <select 
                  value={formData.reference_id}
                  onChange={(e) => setFormData({ ...formData, reference_id: e.target.value })}
                  className="w-full rounded-xl border-slate-300 border p-2.5 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-white text-sm"
                >
                  <option value="">None / Unpublished Field Data</option>
                  {masterData.references?.map(r => (
                    <option key={r.reference_id} value={r.reference_id}>
                      {r.title} {r.publication_year ? `(${r.publication_year})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-3 p-4 border border-amber-200 bg-amber-50/60 rounded-xl">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Article Title *</label>
                    <input 
                      type="text" 
                      required={isNewReference}
                      placeholder="e.g. Endophytic fungi of drought-tolerant cereal crops..."
                      value={formData.new_reference_title}
                      onChange={(e) => setFormData({ ...formData, new_reference_title: e.target.value })}
                      className="w-full rounded-lg border-slate-300 border p-2 text-xs bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Publication Year</label>
                      <input 
                        type="number" 
                        placeholder="2024"
                        value={formData.new_reference_year}
                        onChange={(e) => setFormData({ ...formData, new_reference_year: e.target.value })}
                        className="w-full rounded-lg border-slate-300 border p-2 text-xs bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">DOI / Web Link</label>
                      <input 
                        type="url" 
                        placeholder="https://doi.org/10.1016/..."
                        value={formData.new_reference_link}
                        onChange={(e) => setFormData({ ...formData, new_reference_link: e.target.value })}
                        className="w-full rounded-lg border-slate-300 border p-2 text-xs bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                      />
                    </div>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-slate-400">Links observation to peer-reviewed source literature.</p>
            </div>

          </div>
        </section>

        {/* BOTTOM SUBMISSION STRIP */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Ready to Log
            </span>
            <p className="text-xs text-slate-500">
              {projectedCount > 0 ? (
                <>Will record <strong className="text-emerald-700 font-semibold">{projectedCount}</strong> observation item(s) for specimen <span className="font-mono">{formData.specimen_identifier || 'Auto-ID'}</span>.</>
              ) : (
                'Select plant structures and endophytes above to preview logged count.'
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setFormData({
                  specimen_identifier: '',
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
                  created_by: 'Researcher Admin',
                  isolation_notes: ''
                });
                setIsNewCrop(false);
                setIsNewReference(false);
                setIsNewEndophyte(false);
                setIsNewSequencingMethod(false);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Reset Form
            </button>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-xs transition-all cursor-pointer ${
                isSubmitting
                  ? 'bg-slate-400 cursor-not-allowed opacity-75'
                  : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-sm'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Observation & Specimen...</span>
                </>
              ) : (
                <>
                  <FilePlus className="w-4 h-4" />
                  <span>Save Observation & Specimen</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};

export default CaptureScreen;