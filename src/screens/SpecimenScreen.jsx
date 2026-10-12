import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Sprout } from 'lucide-react';
import api from '../utils/api'; // Our newly extracted API helper

const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    },
  });
  return null;
};

const SpecimenScreen = ({ masterData, notify, refreshData }) => {
  const [formData, setFormData] = useState({
    crop_species_id: '',
    specimen_identifier: '',
    latitude: '',
    longitude: '',
    created_by: 'Researcher Admin'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.latitude === '' || formData.longitude === '') {
      notify('Please select a location on the map.', 'error');
      return;
    }

    try {
      const payload = {
        ...formData,
        crop_species_id: parseInt(formData.crop_species_id),
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude)
      };
      
      await api.post('/specimens/', payload);
      notify('Plant Specimen registered successfully!', 'success');
      refreshData();
      setFormData({ ...formData, crop_species_id: '', specimen_identifier: '', latitude: '', longitude: '' });
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Register Specimen</h2>
        <p className="text-slate-500">Log a new physical plant specimen and map its geographic location.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Registration Form */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Crop Species *</label>
              <select 
                required
                value={formData.crop_species_id}
                onChange={(e) => {
                  const selectedCropId = e.target.value;
                  let generatedId = '';

                  // The Automation Magic: If they pick a crop, build the ID
                  if (selectedCropId) {
                    const crop = masterData.crops.find(c => String(c.crop_species_id) === String(selectedCropId));
                    if (crop) {
                      // Grab first 3 letters of crop name
                      const cropCode = crop.common_name.substring(0, 3).toUpperCase();
                      
                      // Build a clean date string (DDMMYY)
                      const d = new Date();
                      const day = String(d.getDate()).padStart(2, '0');
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const year = String(d.getFullYear()).slice(-2);
                      const dateCode = `${day}${month}${year}`;
                      
                      // Generate a random 4 digit number
                      const serialNum = Math.floor(1000 + Math.random() * 9000); 
                      
                      // Stitch it all together!
                      generatedId = `${cropCode}-${dateCode}-${serialNum}`;
                    }
                  }

                  // Update the form with both the crop AND the new ID
                  setFormData({
                    ...formData, 
                    crop_species_id: selectedCropId,
                    specimen_identifier: generatedId
                  });
                }}
                className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
              >
                <option value="">Select a Crop</option>
                {masterData.crops.map(c => (
                  <option key={c.crop_species_id} value={c.crop_species_id}>
                    {c.common_name} ({c.scientific_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
  <label className="block text-sm font-medium text-slate-700">Specimen Identifier (Auto-Generated) *</label>
  <input 
    type="text" required
    value={formData.specimen_identifier}
    onChange={(e) => setFormData({...formData, specimen_identifier: e.target.value.toUpperCase()})}
    className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-100 font-mono text-slate-600"
  />
  <p className="text-xs text-slate-500 mt-1">This ID is automatically generated to ensure data uniformity, but you can edit it if necessary.</p>
</div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Latitude *</label>
                <input 
                  type="number" step="any" required
                  placeholder="-25.7479"
                  value={formData.latitude}
                  onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                  className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Longitude *</label>
                <input 
                  type="number" step="any" required
                  placeholder="28.2293"
                  value={formData.longitude}
                  onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                  className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
                />
              </div>
            </div>
            
            <p className="text-xs text-slate-500 italic">Tip: You can manually type coordinates or click on the map to set them automatically.</p>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center w-full justify-center">
                <Sprout className="w-5 h-5 mr-2" />
                Register Specimen
              </button>
            </div>
          </form>
        </div>

        {/* Coordinate Picker Map */}
        <div className="bg-white rounded-xl border border-slate-200 h-[500px] relative overflow-hidden shadow-sm z-0">
          <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom={true} className="w-full h-full relative z-0">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler 
              onLocationSelect={(latlng) => {
                setFormData({
                  ...formData, 
                  latitude: parseFloat(latlng.lat).toFixed(6), 
                  longitude: parseFloat(latlng.lng).toFixed(6)
                })
              }} 
            />
            {formData.latitude && formData.longitude && (
              <Marker position={[parseFloat(formData.latitude), parseFloat(formData.longitude)]}>
                <Popup>Selected Location</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default SpecimenScreen;