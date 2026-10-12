// @ts-nocheck
import React, { useState } from 'react';
import { FilePlus, CheckSquare, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import api from '../utils/api'; 

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
    new_crop_name: '',       // <-- ADD THIS
    new_crop_scientific: '', // <-- ADD THIS
    new_crop_group: '',      // <-- ADD THIS  
    latitude: '',          
    longitude: '',      
    location_estimated: false,  // <-- ADD THIS LINE   
    endophyte_ids: [],     // NEW: Changed to array for multiple selections
    plant_structure_ids: [], 
    reference_id: '',
    new_reference_title: '',
    new_reference_year: '',
    new_reference_link: '',
    new_endophyte_name: '',
    new_endophyte_type_id: '',
    observation_date: new Date().toISOString().split('T')[0],
    created_by: 'Researcher Admin'
  });

  const [isNewCrop, setIsNewCrop] = useState(false); // <-- ADD THIS
  const [isNewReference, setIsNewReference] = useState(false);
  const [isNewEndophyte, setIsNewEndophyte] = useState(false);
  const [endoSearch, setEndoSearch] = useState(''); // Helps filter long lists!

  const handleStructureToggle = (structureId) => {
    setFormData((prev) => {
      const currentIds = prev.plant_structure_ids;
      return currentIds.includes(structureId) 
        ? { ...prev, plant_structure_ids: currentIds.filter(id => id !== structureId) }
        : { ...prev, plant_structure_ids: [...currentIds, structureId] };
    });
  };

  // NEW: Handler for multiple endophyte checkboxes
  const handleEndophyteToggle = (endoId) => {
    setFormData((prev) => {
      const currentIds = prev.endophyte_ids;
      return currentIds.includes(endoId) 
        ? { ...prev, endophyte_ids: currentIds.filter(id => id !== endoId) }
        : { ...prev, endophyte_ids: [...currentIds, endoId] };
    });
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
      
      // Convert existing checked endophytes to integers
      let finalEndophyteIds = [...formData.endophyte_ids.map(id => parseInt(id))];

      // --- ADD THIS BLOCK ---
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
      // ----------------------

      if (isNewReference && formData.new_reference_title) {
        const refPayload = {
          title: formData.new_reference_title,
          publication_year: formData.new_reference_year ? parseInt(formData.new_reference_year) : null,
          reference_link: formData.new_reference_link || null
        };
        const newRef = await api.post('/references/', refPayload); 
        finalReferenceId = newRef.reference_id; 
      }

      // If they added a new endophyte, create it and push the new ID into our list!
      if (isNewEndophyte && formData.new_endophyte_name && formData.new_endophyte_type_id) {
        const endoPayload = {
          scientific_name: formData.new_endophyte_name,
          endophyte_type_id: parseInt(formData.new_endophyte_type_id)
        };
        const newEndo = await api.post('/endophytes/', endoPayload);
        finalEndophyteIds.push(newEndo.endophyte_id);
      }

      const fullPayload = {
        crop_species_id: finalCropId, // <-- UPDATE THIS LINE
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        location_estimated: formData.location_estimated, // <-- ADD THIS LINE
        endophyte_ids: finalEndophyteIds, // Send the array!
        plant_structure_ids: formData.plant_structure_ids.map(id => parseInt(id)),
        reference_id: finalReferenceId,
        observation_date: formData.observation_date,
        created_by: formData.created_by
      };

      await api.post('/capture-full/', fullPayload);
      
      notify(`Success! Recorded ${finalEndophyteIds.length * formData.plant_structure_ids.length} observation(s)!`, 'success');
      refreshData();
      
      setFormData({ 
        crop_species_id: '', new_crop_name: '', new_crop_scientific: '', new_crop_group: '', // <-- UPDATE THIS LINE
        latitude: '', longitude: '', location_estimated: false,
        endophyte_ids: [], plant_structure_ids: [], reference_id: '',
        new_reference_title: '', new_reference_year: '', new_reference_link: '',
        new_endophyte_name: '', new_endophyte_type_id: '',
        observation_date: new Date().toISOString().split('T')[0],
        created_by: 'Researcher Admin'
      });
      setIsNewReference(false); 
      setIsNewEndophyte(false);
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
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Capture Observation</h2>
        <p className="text-slate-500">Record endophyte observations linked to a plant specimen.</p>
      </header>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-1">
               <label className="block text-sm font-medium text-slate-700">Host Crop Species *</label>
               <button 
                 type="button" 
                 onClick={() => setIsNewCrop(!isNewCrop)} 
                 className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
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
                  className="w-full rounded border-slate-300 border p-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Longitude (Decimal)</label>
                <input 
                  type="number" step="any" required placeholder="18.4240"
                  value={formData.longitude}
                  onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                  className="w-full rounded border-slate-300 border p-2 focus:ring-emerald-500 focus:border-emerald-500"
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
          
          {/* NEW: Multi-select Endophytes UI */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex justify-between items-center mb-1">
               <label className="block text-sm font-medium text-slate-700">Select Endophytes (Multiple) *</label>
            </div>
            
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input 
                type="text" placeholder="Search unlisted endophytes..." 
                value={endoSearch} onChange={(e) => setEndoSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
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
                 className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
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
                    ? 'bg-emerald-50 border-emerald-500 shadow-sm' 
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

           <div className="space-y-2 md:col-span-2">
            <div className="flex justify-between items-center mb-1">
               <label className="block text-sm font-medium text-slate-700">Literature Reference (Optional)</label>
               <button 
                 type="button" 
                 onClick={() => setIsNewReference(!isNewReference)} 
                 className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
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
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center">
            <FilePlus className="w-5 h-5 mr-2" />
            Save Observation
          </button>
        </div>
      </form>
    </div>
  );
};

export default CaptureScreen;