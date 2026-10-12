import React, { useState, useEffect } from 'react';
import { Menu, MapPin, FilePlus, Database, Sprout, Search } from 'lucide-react';

// Leaflet Setup
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Import our modules
import api from './utils/api';
import Toast from './components/Toast';
import MapScreen from './screens/MapScreen';
import SpecimenScreen from './screens/SpecimenScreen';
import CaptureScreen from './screens/CaptureScreen';
import MasterDataScreen from './screens/MasterDataScreen';

// NEW: Import the Data Explorer Screen!
import DataExplorerScreen from './screens/DataExplorerScreen';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export default function App() {
  const [currentView, setCurrentView] = useState('map');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toastMsg, setToastMsg] = useState({ text: '', type: '' });

  const [masterData, setMasterData] = useState({
    crops: [], endophyteTypes: [], endophytes: [], structures: [], 
    references: [], specimens: [], observations: [], sequencingMethods: []
  });

  const showToast = (text, type = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg({ text: '', type: '' }), 4000);
  };

  const loadAllData = async () => {
    try {
      const [crops, types, endos, structs, refs, specs, obs, seqs] = await Promise.all([
        api.get('/crops/'), api.get('/endophyte-types/'), api.get('/endophytes/'),
        api.get('/structures/'), api.get('/references/'), api.get('/specimens/'),
        api.get('/observations/'), api.get('/sequencing-methods/')
      ]);
      
      setMasterData({ 
        crops, endophyteTypes: types, endophytes: endos, 
        structures: structs, references: refs, specimens: specs, observations: obs,
        sequencingMethods: Array.isArray(seqs) ? seqs : []
      });
    } catch (error) {
      console.error(error);
      showToast("System error: Failed to fetch data from the database.", "error");
    }
  };

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [crops, types, endos, structs, refs, specs, obs, seqs] = await Promise.all([
          api.get('/crops/'), api.get('/endophyte-types/'), api.get('/endophytes/'),
          api.get('/structures/'), api.get('/references/'), api.get('/specimens/'),
          api.get('/observations/'), api.get('/sequencing-methods/')
        ]);
        if (!ignore) {
          setMasterData({ 
            crops, endophyteTypes: types, endophytes: endos, 
            structures: structs, references: refs, specimens: specs, observations: obs,
            sequencingMethods: Array.isArray(seqs) ? seqs : []
          });
        }
      } catch (err) {
        if (!ignore) {
          console.error(err);
          setToastMsg({ text: "System error: Failed to fetch data from the database.", type: "error" });
        }
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const renderContent = () => {
    switch(currentView) {
      case 'map': return <MapScreen specimens={masterData.specimens} observations={masterData.observations} />;
      // NEW: Added the routing for the explorer
      case 'explorer': return <DataExplorerScreen masterData={masterData} />;
      case 'specimen': return <SpecimenScreen masterData={masterData} notify={showToast} refreshData={loadAllData} />;
      case 'form': return <CaptureScreen masterData={masterData} notify={showToast} refreshData={loadAllData} />;
      case 'master': return <MasterDataScreen masterData={masterData} notify={showToast} refreshData={loadAllData} />;
      default: return <MapScreen specimens={masterData.specimens} observations={masterData.observations} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className={`bg-slate-900 text-slate-300 w-64 flex-shrink-0 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-0' : '-ml-64'}`}>
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center space-x-3">
          <Sprout className="w-8 h-8 text-emerald-500" />
          <span className="text-xl font-bold text-white tracking-tight">Hidden Microbiome</span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          <button onClick={() => setCurrentView('map')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'map' ? 'bg-emerald-600/10 text-emerald-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <MapPin className="w-5 h-5" />
            <span className="font-medium">Spatial Overview</span>
          </button>
          
          {/* NEW: Data Explorer Sidebar Button */}
          <button onClick={() => setCurrentView('explorer')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'explorer' ? 'bg-emerald-600/10 text-emerald-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Search className="w-5 h-5" />
            <span className="font-medium">Data Explorer</span>
          </button>

          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Entry</p>
          </div>

          <button onClick={() => setCurrentView('specimen')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'specimen' ? 'bg-emerald-600/10 text-emerald-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Sprout className="w-5 h-5" />
            <span className="font-medium">Register Specimen</span>
          </button>
          <button onClick={() => setCurrentView('form')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'form' ? 'bg-emerald-600/10 text-emerald-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <FilePlus className="w-5 h-5" />
            <span className="font-medium">Log Observation</span>
          </button>
          
          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Administration</p>
          </div>

          <button onClick={() => setCurrentView('master')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'master' ? 'bg-emerald-600/10 text-emerald-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Database className="w-5 h-5" />
            <span className="font-medium">Master Data</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6 justify-between flex-shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50">
          {renderContent()}
        </main>
      </div>

      {/* Pop-up Notifications */}
      <Toast message={toastMsg.text} type={toastMsg.type} onClose={() => setToastMsg({text: '', type: ''})} />
    </div>
  );
}