import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

const MapScreen = ({ specimens, observations }) => {
  // Center map on the first specimen, or default to a global view
  const defaultCenter = specimens.length > 0 
    ? [specimens[0].latitude, specimens[0].longitude] 
    : [20, 0];
  const defaultZoom = specimens.length > 0 ? 5 : 2;

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Spatial Overview</h2>
        <p className="text-slate-500">View specimen locations and related endophyte observations.</p>
      </header>

      {/* Interactive Map Visualization */}
      <div className="bg-white rounded-xl border border-slate-200 h-[500px] relative overflow-hidden shadow-sm z-0">
        <MapContainer center={defaultCenter} zoom={defaultZoom} scrollWheelZoom={true} className="w-full h-full relative z-0">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {specimens.map((spec) => (
            <Marker 
              key={spec.plant_specimen_id} 
              position={[spec.latitude, spec.longitude]}
            >
              <Popup>
                <div className="p-1 min-w-[150px]">
                  <h4 className="font-bold text-slate-800 border-b pb-1 mb-2">
                    {spec.specimen_identifier || `Specimen #${spec.plant_specimen_id}`}
                  </h4>
                  <p className="text-sm text-slate-600 mb-1">
                    <strong>Latitude:</strong> {spec.latitude.toFixed(4)}
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>Longitude:</strong> {spec.longitude.toFixed(4)}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-700">Recent Observations</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Specimen</th>
                <th className="px-6 py-3">Endophyte</th>
                <th className="px-6 py-3">Sequencing Method</th>
                <th className="px-6 py-3">NCBI Accession</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {observations.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-4 text-center text-slate-500">No observations recorded yet.</td></tr>
              ) : (
                observations.map((obs) => (
                  <tr key={obs.observation_id} className="border-b hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">#{obs.observation_id}</td>
                    <td className="px-6 py-4">Specimen #{obs.plant_specimen_id}</td>
                    <td className="px-6 py-4">Endophyte #{obs.endophyte_id}</td>
                    <td className="px-6 py-4 text-slate-700">
                      {obs.sequencing_method ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {obs.sequencing_method}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {obs.ncbi_accession ? (
                        <a 
                          href={`https://www.ncbi.nlm.nih.gov/search/all/?term=${encodeURIComponent(obs.ncbi_accession)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-700 hover:text-emerald-900 hover:underline font-semibold"
                        >
                          {obs.ncbi_accession} ↗
                        </a>
                      ) : (
                        <span className="text-slate-400 font-sans italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{new Date(obs.observation_date).toLocaleDateString()}</td>
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

export default MapScreen;