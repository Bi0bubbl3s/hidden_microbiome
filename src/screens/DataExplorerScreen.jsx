import React, { useState } from 'react';
import { Search, Filter, BookOpen, RefreshCw, AlertCircle, ExternalLink, Dna } from 'lucide-react';

const DataExplorerScreen = ({ masterData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCrop, setFilterCrop] = useState('');
  const [filterClade, setFilterClade] = useState('');
  const [filterEndophyte, setFilterEndophyte] = useState('');
  const [filterStructure, setFilterStructure] = useState('');
  const [filterSequencing, setFilterSequencing] = useState('');

  // Safely grab the observations
  const obsList = masterData?.observations || [];

  const enrichedObservations = obsList.map(obs => {
    const specimen = masterData.specimens?.find(s => String(s.plant_specimen_id) === String(obs.plant_specimen_id)) || {};
    const crop = masterData.crops?.find(c => String(c.crop_species_id) === String(specimen.crop_species_id)) || {};
    const endo = masterData.endophytes?.find(e => String(e.endophyte_id) === String(obs.endophyte_id)) || {};
    const structure = masterData.structures?.find(s => String(s.plant_structure_id) === String(obs.plant_structure_id)) || {};
    const ref = masterData.references?.find(r => String(r.reference_id) === String(obs.reference_id)) || {};
    const seqMethod = obs.sequencing_method || 
      (masterData.sequencingMethods?.find(s => String(s.sequencing_method_id) === String(obs.sequencing_method_id))?.method_name) || '';

    return {
      ...obs,
      specimen_identifier: specimen.specimen_identifier || `Specimen #${obs.plant_specimen_id}`,
      crop_species_id: crop.crop_species_id || '',
      crop_name: crop.common_name || 'Unknown Crop',
      crop_group: crop.plant_group || 'Unknown',
      endophyte_name: endo.scientific_name || 'Unknown Endophyte',
      structure_name: structure.name || 'Unknown Structure',
      sequencing_method: seqMethod,
      ncbi_accession: obs.ncbi_accession || '',
      reference_title: ref.title || '',
      reference_link: ref.reference_link || '',
      reference_year: ref.publication_year || ''
    };
  });

  const filteredData = enrichedObservations.filter(item => {
    const term = (searchTerm || '').toLowerCase().trim();
    const matchesSearch = term === '' || (
      item.crop_name.toLowerCase().includes(term) ||
      item.endophyte_name.toLowerCase().includes(term) ||
      item.specimen_identifier.toLowerCase().includes(term) ||
      item.sequencing_method.toLowerCase().includes(term) ||
      item.ncbi_accession.toLowerCase().includes(term) ||
      item.reference_title.toLowerCase().includes(term) ||
      String(item.reference_year).includes(term)
    );
    
    const matchesCrop = filterCrop ? String(item.crop_species_id) === String(filterCrop) : true;
    const matchesClade = filterClade ? item.crop_group === filterClade : true;
    const matchesEndo = filterEndophyte ? String(item.endophyte_id) === String(filterEndophyte) : true;
    const matchesStruct = filterStructure ? String(item.plant_structure_id) === String(filterStructure) : true;
    const matchesSeq = filterSequencing ? item.sequencing_method === filterSequencing : true;

    return matchesSearch && matchesCrop && matchesClade && matchesEndo && matchesStruct && matchesSeq;
  });

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterCrop('');
    setFilterClade('');
    setFilterEndophyte('');
    setFilterStructure('');
    setFilterSequencing('');
  };

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Data Explorer</h2>
        <p className="text-slate-500">Search, filter, and review all recorded endophyte observations and genomic accessions.</p>
      </header>

      {/* Control Panel: Search and Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="relative md:col-span-2 lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Keyword Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" placeholder="Search accession, crop, taxa..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
              <Filter className="w-3 h-3 mr-1" /> Filter by Crop
            </label>
            <select 
              value={filterCrop} onChange={(e) => setFilterCrop(e.target.value)}
              className="w-full py-2.5 px-3 rounded-lg border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 text-sm"
            >
              <option value="">All Crops</option>
              {masterData.crops?.map(c => <option key={c.crop_species_id} value={c.crop_species_id}>{c.common_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
              <Filter className="w-3 h-3 mr-1" /> Filter by Clade
            </label>
            <select 
              value={filterClade} onChange={(e) => setFilterClade(e.target.value)}
              className="w-full py-2.5 px-3 rounded-lg border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 text-sm"
            >
              <option value="">All Clades</option>
              <option value="Monocot">Monocot</option>
              <option value="Dicot">Dicot</option>
              <option value="Other">Other</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
              <Filter className="w-3 h-3 mr-1" /> Filter by Endophyte
            </label>
            <select 
              value={filterEndophyte} onChange={(e) => setFilterEndophyte(e.target.value)}
              className="w-full py-2.5 px-3 rounded-lg border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 text-sm"
            >
              <option value="">All Endophytes</option>
              {masterData.endophytes?.map(e => <option key={e.endophyte_id} value={e.endophyte_id}>{e.scientific_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
              <Filter className="w-3 h-3 mr-1" /> Structure
            </label>
            <select 
              value={filterStructure} onChange={(e) => setFilterStructure(e.target.value)}
              className="w-full py-2.5 px-3 rounded-lg border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 text-sm"
            >
              <option value="">All Structures</option>
              {masterData.structures?.map(s => <option key={s.plant_structure_id} value={s.plant_structure_id}>{s.name}</option>)}
            </select>
          </div>

          {/* Filter by Sequencing Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
              <Dna className="w-3 h-3 mr-1 text-emerald-600" /> Sequencing Method
            </label>
            <select 
              value={filterSequencing} onChange={(e) => setFilterSequencing(e.target.value)}
              className="w-full py-2.5 px-3 rounded-lg border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 text-sm"
            >
              <option value="">All Methods</option>
              {masterData.sequencingMethods?.map(s => <option key={s.sequencing_method_id} value={s.method_name}>{s.method_name}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 flex justify-end items-center space-x-3 pt-3 border-t border-slate-100">
          <button onClick={handleClearFilters} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center">
            <RefreshCw className="w-4 h-4 mr-2" /> Clear All Filters
          </button>
        </div>
      </div>

      {/* The Master Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-700">Observation Records</h3>
          <span className="text-sm text-slate-500 font-medium px-3 py-1 bg-white rounded-full border border-slate-200">
            Showing {filteredData.length} result{filteredData.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-5 py-4 font-semibold">Date</th>
                <th className="px-5 py-4 font-semibold">Specimen & Crop</th>
                <th className="px-4 py-4 font-semibold">Clade</th>
                <th className="px-5 py-4 font-semibold">Endophyte</th>
                <th className="px-4 py-4 font-semibold">Structure</th>
                <th className="px-5 py-4 font-semibold">Sequencing Method</th>
                <th className="px-5 py-4 font-semibold">NCBI Accession</th>
                <th className="px-5 py-4 font-semibold">Literature Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {obsList.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-amber-500 mb-3" />
                      <p className="text-base font-medium text-slate-700">No observations exist in the database yet.</p>
                      <p className="text-sm mt-1">Head over to the <span className="font-semibold text-emerald-600">Log Observation</span> tab to capture your first record!</p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-8 h-8 text-slate-300 mb-3" />
                      <p className="text-base">No observations match your current filters.</p>
                      <button onClick={handleClearFilters} className="mt-2 text-emerald-600 hover:underline">Clear all filters</button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((obs) => (
                  <tr key={obs.observation_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-slate-600">
                      {new Date(obs.observation_date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{obs.specimen_identifier}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{obs.crop_name}</div>
                    </td>
                    
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                        obs.crop_group === 'Monocot' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                        obs.crop_group === 'Dicot' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {obs.crop_group}
                      </span>
                    </td>

                    <td className="px-5 py-4 font-medium italic text-slate-800">
                      {obs.endophyte_name}
                    </td>
                    
                    <td className="px-4 py-4 text-slate-600">
                      {obs.structure_name}
                    </td>

                    {/* Sequencing Method Column */}
                    <td className="px-5 py-4">
                      {obs.sequencing_method ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Dna className="w-3 h-3 mr-1 text-emerald-600" />
                          {obs.sequencing_method}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">-</span>
                      )}
                    </td>

                    {/* NCBI Accession Column with link */}
                    <td className="px-5 py-4 whitespace-nowrap font-mono text-xs">
                      {obs.ncbi_accession ? (
                        <a
                          href={`https://www.ncbi.nlm.nih.gov/search/all/?term=${encodeURIComponent(obs.ncbi_accession)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 hover:underline bg-slate-100 hover:bg-emerald-50 px-2 py-1 rounded border border-slate-200"
                          title="Open accession on NCBI database"
                        >
                          <span>{obs.ncbi_accession}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      ) : (
                        <span className="text-slate-400 italic font-sans">-</span>
                      )}
                    </td>

                    <td className="px-5 py-4 max-w-xs">
                      {obs.reference_title ? (
                        <div>
                          <p className="text-slate-800 text-xs line-clamp-2" title={obs.reference_title}>{obs.reference_title}</p>
                          {obs.reference_link && (
                            <a href={obs.reference_link} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline inline-flex items-center mt-0.5">
                              <BookOpen className="w-3 h-3 mr-1"/> Read Article
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DataExplorerScreen;