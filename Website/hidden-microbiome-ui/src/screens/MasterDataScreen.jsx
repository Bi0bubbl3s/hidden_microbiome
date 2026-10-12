import React, { useState } from 'react';
import { Leaf, Microscope, Database, BookOpen, Trash2, Search, Dna } from 'lucide-react';
import api from '../utils/api'; 

const MasterDataScreen = ({ masterData, notify, refreshData }) => {
  const [activeTab, setActiveTab] = useState('crops');
  
  const [newValue, setNewValue] = useState('');
  const [newSubValue, setNewSubValue] = useState(''); 
  const [newCropGroup, setNewCropGroup] = useState(''); // NEW: For crop clade
  const [newRefYear, setNewRefYear] = useState('');
  const [newRefLink, setNewRefLink] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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

  // NEW: Function to handle inline updating of the crop clade
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
    if (!window.confirm("Are you sure you want to delete this item?")) return;
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

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Master Data Management</h2>
        <p className="text-slate-500">Manage definitions for crops, structures, and endophyte taxonomy.</p>
      </header>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto">
        {[
          { id: 'crops', label: 'Crop Species', icon: Leaf },
          { id: 'types', label: 'Endophyte Types', icon: Microscope },
          { id: 'endophytes', label: 'Endophyte Species', icon: Dna },
          { id: 'structures', label: 'Plant Structures', icon: Database },
          { id: 'references', label: 'References', icon: BookOpen },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
            className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id 
              ? 'border-emerald-500 text-emerald-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
        {/* Quick Add Form */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4 capitalize">
              Add New {activeTab === 'endophytes' ? 'Species' : activeTab.slice(0, -1)}
            </h3>
            <form onSubmit={handleAddData} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  {activeTab === 'references' ? 'Article Title *' : 
                   activeTab === 'endophytes' ? 'Scientific Name *' : 
                   'Name / Title *'}
                </label>
                <input 
                  required value={newValue} onChange={(e) => setNewValue(e.target.value)}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" 
                  placeholder={
                    activeTab === 'references' ? "Enter article title..." : 
                    activeTab === 'endophytes' ? "e.g. Aspergillus niger" : 
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
                      className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" 
                      placeholder="Enter scientific name..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Plant Clade *</label>
                    <select 
                      required value={newCropGroup} onChange={(e) => setNewCropGroup(e.target.value)}
                      className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white" 
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
                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white" 
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
                      className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" placeholder="e.g. 2024"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Link / DOI</label>
                    <input 
                      type="url" value={newRefLink} onChange={(e) => setNewRefLink(e.target.value)}
                      className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" placeholder="https://doi.org/..."
                    />
                  </div>
                </>
              )}

              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
                Save
              </button>
            </form>
          </div>
        </div>

        {/* List View with Search Bar */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" placeholder={`Search ${activeTab}...`}
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-6 py-3 w-24">ID</th>
                  <th className="px-6 py-3">Details</th>
                  {/* NEW: Extra column specifically for Crops */}
                  {activeTab === 'crops' && <th className="px-6 py-3 w-32">Plant Clade</th>}
                  <th className="px-6 py-3 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeTab === 'crops' && filteredCrops.map(c => (
                  <tr key={c.crop_species_id}>
                    <td className="px-6 py-4">#{c.crop_species_id}</td>
                    <td className="px-6 py-4 font-medium">{c.common_name} <span className="text-slate-400 italic font-normal ml-2">{c.scientific_name}</span></td>
                    {/* NEW: Inline Editable Dropdown for Clade */}
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
                      <button onClick={() => handleDelete(c.crop_species_id, '/crops/')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5 inline" /></button>
                    </td>
                  </tr>
                ))}
                
                {activeTab === 'types' && filteredTypes.map(t => (
                  <tr key={t.endophyte_type_id}>
                    <td className="px-6 py-4">#{t.endophyte_type_id}</td>
                    <td className="px-6 py-4 font-medium">{t.type_name}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(t.endophyte_type_id, '/endophyte-types/')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5 inline" /></button>
                    </td>
                  </tr>
                ))}

                {activeTab === 'endophytes' && filteredEndophytes.map(e => {
                  const type = masterData.endophyteTypes?.find(t => t.endophyte_type_id === e.endophyte_type_id);
                  return (
                    <tr key={e.endophyte_id}>
                      <td className="px-6 py-4">#{e.endophyte_id}</td>
                      <td className="px-6 py-4 font-medium">
                        <span className="italic">{e.scientific_name}</span>
                        {type && <span className="ml-2 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full border border-slate-200">{type.type_name}</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDelete(e.endophyte_id, '/endophytes/')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5 inline" /></button>
                      </td>
                    </tr>
                  )
                })}
                
                {activeTab === 'structures' && filteredStructures.map(s => (
                  <tr key={s.plant_structure_id}>
                    <td className="px-6 py-4">#{s.plant_structure_id}</td>
                    <td className="px-6 py-4 font-medium">{s.name}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(s.plant_structure_id, '/structures/')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5 inline" /></button>
                    </td>
                  </tr>
                ))}
                
                {activeTab === 'references' && filteredReferences.map(r => (
                  <tr key={r.reference_id}>
                    <td className="px-6 py-4">#{r.reference_id}</td>
                    <td className="px-6 py-4 font-medium">
                      {r.title} 
                      {r.publication_year && <span className="text-slate-500 font-normal ml-2">({r.publication_year})</span>}
                      {r.reference_link && (
                        <a href={r.reference_link} target="_blank" rel="noreferrer" className="block text-xs text-emerald-600 hover:text-emerald-700 hover:underline mt-1">View Research Article</a>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(r.reference_id, '/references/')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5 inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {((activeTab === 'crops' && filteredCrops.length === 0) ||
              (activeTab === 'types' && filteredTypes.length === 0) ||
              (activeTab === 'endophytes' && filteredEndophytes.length === 0) ||
              (activeTab === 'structures' && filteredStructures.length === 0) ||
              (activeTab === 'references' && filteredReferences.length === 0)) && (
              <div className="p-8 text-center text-slate-500 italic">
                No items found matching "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterDataScreen;