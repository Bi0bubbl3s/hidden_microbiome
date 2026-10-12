import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CropSpecies {
  crop_species_id: number;
  common_name: string;
  scientific_name: string | null;
  plant_group: string;
  created_at: string;
}

interface PlantStructure {
  plant_structure_id: number;
  name: string;
}

interface EndophyteType {
  endophyte_type_id: number;
  type_name: string;
  created_at: string;
}

interface Endophyte {
  endophyte_id: number;
  endophyte_type_id: number;
  scientific_name: string;
  created_at: string;
}

interface Reference {
  reference_id: number;
  title: string;
  publication_year: number | null;
  reference_link: string | null;
}

interface PlantSpecimen {
  plant_specimen_id: number;
  crop_species_id: number;
  specimen_identifier: string;
  latitude: number;
  longitude: number;
  location_estimated: boolean;
  created_by: string;
  created_at: string;
}

interface SequencingMethod {
  sequencing_method_id: number;
  method_name: string;
  platform_type: string | null;
  description: string | null;
  created_at: string;
}

interface EndophyteObservation {
  observation_id: number;
  plant_specimen_id: number;
  endophyte_id: number;
  plant_structure_id: number;
  reference_id: number | null;
  sequencing_method_id: number | null;
  sequencing_method: string | null;
  ncbi_accession: string | null;
  observation_date: string;
  created_by: string;
  created_at: string;
}

// In-Memory Data Store (seeded with initial domain data)
let nextCropId = 1;
let nextStructureId = 1;
let nextTypeId = 1;
let nextEndoId = 1;
let nextRefId = 1;
let nextSpecimenId = 1;
let nextObsId = 1;
let nextSeqMethodId = 1;


const crops: CropSpecies[] = [
  { crop_species_id: nextCropId++, common_name: 'Maize', scientific_name: 'Zea mays', plant_group: 'Monocot', created_at: new Date('2024-01-10').toISOString() },
  { crop_species_id: nextCropId++, common_name: 'Wheat', scientific_name: 'Triticum aestivum', plant_group: 'Monocot', created_at: new Date('2024-01-11').toISOString() },
  { crop_species_id: nextCropId++, common_name: 'Soybean', scientific_name: 'Glycine max', plant_group: 'Dicot', created_at: new Date('2024-01-12').toISOString() },
  { crop_species_id: nextCropId++, common_name: 'Sorghum', scientific_name: 'Sorghum bicolor', plant_group: 'Monocot', created_at: new Date('2024-02-01').toISOString() },
  { crop_species_id: nextCropId++, common_name: 'Canola', scientific_name: 'Brassica napus', plant_group: 'Dicot', created_at: new Date('2024-02-15').toISOString() },
];

const structures: PlantStructure[] = [
  { plant_structure_id: nextStructureId++, name: 'Root' },
  { plant_structure_id: nextStructureId++, name: 'Leaf' },
  { plant_structure_id: nextStructureId++, name: 'Stem' },
  { plant_structure_id: nextStructureId++, name: 'Seed' },
];

const endophyteTypes: EndophyteType[] = [
  { endophyte_type_id: nextTypeId++, type_name: 'Fungal', created_at: new Date('2024-01-01').toISOString() },
  { endophyte_type_id: nextTypeId++, type_name: 'Bacterial', created_at: new Date('2024-01-01').toISOString() },
];

const endophytes: Endophyte[] = [
  { endophyte_id: nextEndoId++, endophyte_type_id: 1, scientific_name: 'Beauveria bassiana', created_at: new Date('2024-01-05').toISOString() },
  { endophyte_id: nextEndoId++, endophyte_type_id: 2, scientific_name: 'Bacillus subtilis', created_at: new Date('2024-01-05').toISOString() },
  { endophyte_id: nextEndoId++, endophyte_type_id: 1, scientific_name: 'Metarhizium anisopliae', created_at: new Date('2024-01-06').toISOString() },
  { endophyte_id: nextEndoId++, endophyte_type_id: 2, scientific_name: 'Pseudomonas fluorescens', created_at: new Date('2024-01-15').toISOString() },
  { endophyte_id: nextEndoId++, endophyte_type_id: 1, scientific_name: 'Trichoderma harzianum', created_at: new Date('2024-02-01').toISOString() },
];

const references: Reference[] = [
  { reference_id: nextRefId++, title: 'Endophytic fungi in cereal crops: diversity and biocontrol potential', publication_year: 2023, reference_link: 'https://doi.org/10.1016/j.funbio.2023.01.002' },
  { reference_id: nextRefId++, title: 'Bacterial endophytes of Glycine max and their role in plant growth promotion', publication_year: 2022, reference_link: 'https://doi.org/10.1007/s00284-022-02845-6' },
  { reference_id: nextRefId++, title: 'Microbiome colonization dynamics in root and foliar structures of Zea mays', publication_year: 2024, reference_link: 'https://doi.org/10.1111/mpp.13421' },
];

const sequencingMethods: SequencingMethod[] = [
  { sequencing_method_id: nextSeqMethodId++, method_name: 'Sanger Sequencing', platform_type: 'Capillary Electrophoresis (ABI 3730)', description: 'Targeted amplicon marker sequencing (16S rRNA / ITS1-4 regions)', created_at: new Date('2024-01-01').toISOString() },
  { sequencing_method_id: nextSeqMethodId++, method_name: 'NGS - Whole Genome Sequencing (WGS)', platform_type: 'Illumina NovaSeq 6000', description: 'Comprehensive short-read whole genome sequencing of microbial isolates', created_at: new Date('2024-01-01').toISOString() },
  { sequencing_method_id: nextSeqMethodId++, method_name: 'NGS - Amplicon Metabarcoding', platform_type: 'Illumina MiSeq', description: 'High-throughput 16S V3-V4 and fungal ITS community profiling', created_at: new Date('2024-01-01').toISOString() },
  { sequencing_method_id: nextSeqMethodId++, method_name: 'Long-Read (Oxford Nanopore)', platform_type: 'Oxford Nanopore MinION', description: 'Full-length 16S-ITS-23S rRNA operon long-read sequencing', created_at: new Date('2024-01-01').toISOString() },
  { sequencing_method_id: nextSeqMethodId++, method_name: 'Long-Read (PacBio HiFi)', platform_type: 'PacBio Sequel IIe', description: 'High-accuracy consensus long reads for complex endophyte genomes', created_at: new Date('2024-01-01').toISOString() },
  { sequencing_method_id: nextSeqMethodId++, method_name: 'Shotgun Metagenomics', platform_type: 'Illumina / DNBSEQ', description: 'Direct total community metagenomic sequencing without PCR target bias', created_at: new Date('2024-01-01').toISOString() },
];

const specimens: PlantSpecimen[] = [];
const observations: EndophyteObservation[] = [];

// Seed 25 realistic agricultural specimens
const sampleLocations = [
  { lat: 41.6005, lng: -93.6091, name: 'Iowa-Central' },
  { lat: 42.0308, lng: -93.6319, name: 'Ames-Research-Plot' },
  { lat: 41.2565, lng: -95.9345, name: 'Omaha-Valley' },
  { lat: 40.8136, lng: -96.7026, name: 'Lincoln-East-Field' },
  { lat: 40.1164, lng: -88.2434, name: 'Champaign-Agronomy' },
  { lat: 40.4173, lng: -86.8753, name: 'Lafayette-Ag-Center' },
  { lat: 44.9778, lng: -93.2650, name: 'TwinCities-Field-01' },
  { lat: -25.7479, lng: 28.2293, name: 'Pretoria-Experimental-Farm' },
  { lat: -29.0852, lng: 26.1596, name: 'FreeState-Maize-Belt' },
  { lat: -33.9249, lng: 18.4241, name: 'WesternCape-Canola-Plot' },
  { lat: 52.2053, lng: 0.1218, name: 'Cambridge-Crop-Station' },
  { lat: 48.8566, lng: 2.3522, name: 'Paris-Basin-Cereal' },
];

const sampleAccessions = [
  'OQ542198', 'MW392104', 'PRJNA912834', 'OR789123', 'SRR21894012', 
  'MK876543', 'CP054321', 'SAMN34201928', 'OP192837', 'OK564738', 
  'MZ829104', 'ON123987'
];

for (let i = 0; i < 25; i++) {
  const loc = sampleLocations[i % sampleLocations.length];
  const crop = crops[i % crops.length];
  const cropCode = crop.common_name.substring(0, 3).toUpperCase();
  const serial = 1000 + (i * 137) % 8999;
  const specId = nextSpecimenId++;
  const spec: PlantSpecimen = {
    plant_specimen_id: specId,
    crop_species_id: crop.crop_species_id,
    specimen_identifier: `${cropCode}-2405-${serial}`,
    latitude: loc.lat + ((i % 5) - 2) * 0.08,
    longitude: loc.lng + ((i % 5) - 2) * 0.08,
    location_estimated: i % 4 === 0,
    created_by: 'Researcher Admin',
    created_at: new Date(Date.now() - (25 - i) * 86400000).toISOString(),
  };
  specimens.push(spec);

  const endo = endophytes[i % endophytes.length];
  const struct = structures[i % structures.length];
  const ref = references[i % references.length];
  const seq = sequencingMethods[i % sequencingMethods.length];
  const acc = i % 4 === 3 ? null : sampleAccessions[i % sampleAccessions.length];

  observations.push({
    observation_id: nextObsId++,
    plant_specimen_id: spec.plant_specimen_id,
    endophyte_id: endo.endophyte_id,
    plant_structure_id: struct.plant_structure_id,
    reference_id: ref.reference_id,
    sequencing_method_id: seq.sequencing_method_id,
    sequencing_method: seq.method_name,
    ncbi_accession: acc,
    observation_date: spec.created_at.split('T')[0],
    created_by: 'Researcher Admin',
    created_at: spec.created_at,
  });
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // --- CROPS ENDPOINTS ---
  app.get(['/crops', '/crops/'], (_req: Request, res: Response) => {
    res.json(crops);
  });

  app.post(['/crops', '/crops/'], (req: Request, res: Response) => {
    const { common_name, scientific_name, plant_group } = req.body;
    if (!common_name) {
      return res.status(400).json({ detail: 'Common name is required' });
    }
    const newCrop: CropSpecies = {
      crop_species_id: nextCropId++,
      common_name,
      scientific_name: scientific_name || null,
      plant_group: plant_group || 'Unknown',
      created_at: new Date().toISOString(),
    };
    crops.push(newCrop);
    res.status(201).json(newCrop);
  });

  app.post(['/crops/batch', '/crops/batch/'], (req: Request, res: Response) => {
    const items = Array.isArray(req.body) ? req.body : req.body.items || [];
    const added: CropSpecies[] = [];
    for (const item of items) {
      if (item.common_name) {
        const newCrop: CropSpecies = {
          crop_species_id: nextCropId++,
          common_name: String(item.common_name).trim(),
          scientific_name: item.scientific_name ? String(item.scientific_name).trim() : null,
          plant_group: item.plant_group ? String(item.plant_group).trim() : 'Unknown',
          created_at: new Date().toISOString(),
        };
        crops.push(newCrop);
        added.push(newCrop);
      }
    }
    res.status(201).json({ count: added.length, items: added });
  });

  app.put(['/crops/:crop_id', '/crops/:crop_id/'], (req: Request, res: Response) => {
    const cropId = parseInt(req.params.crop_id);
    const crop = crops.find(c => c.crop_species_id === cropId);
    if (!crop) {
      return res.status(404).json({ detail: 'Crop not found' });
    }
    const { common_name, scientific_name, plant_group } = req.body;
    if (common_name !== undefined) crop.common_name = common_name;
    if (scientific_name !== undefined) crop.scientific_name = scientific_name;
    if (plant_group !== undefined) crop.plant_group = plant_group;
    res.json(crop);
  });

  app.delete(['/crops/:crop_id', '/crops/:crop_id/'], (req: Request, res: Response) => {
    const cropId = parseInt(req.params.crop_id);
    const hasSpecimens = specimens.some(s => s.crop_species_id === cropId);
    if (hasSpecimens) {
      return res.status(400).json({ detail: 'Cannot delete crop: Specimens are still linked to this species.' });
    }
    const index = crops.findIndex(c => c.crop_species_id === cropId);
    if (index === -1) {
      return res.status(404).json({ detail: 'Crop not found' });
    }
    crops.splice(index, 1);
    res.json({ message: 'Deleted successfully' });
  });

  // --- ENDOPHYTE TYPES ENDPOINTS ---
  app.get(['/endophyte-types', '/endophyte-types/'], (_req: Request, res: Response) => {
    res.json(endophyteTypes);
  });

  app.post(['/endophyte-types', '/endophyte-types/'], (req: Request, res: Response) => {
    const { type_name } = req.body;
    if (!type_name) {
      return res.status(400).json({ detail: 'Type name is required' });
    }
    const newType: EndophyteType = {
      endophyte_type_id: nextTypeId++,
      type_name,
      created_at: new Date().toISOString(),
    };
    endophyteTypes.push(newType);
    res.status(201).json(newType);
  });

  app.post(['/endophyte-types/batch', '/endophyte-types/batch/'], (req: Request, res: Response) => {
    const items = Array.isArray(req.body) ? req.body : req.body.items || [];
    const added: EndophyteType[] = [];
    for (const item of items) {
      if (item.type_name) {
        const newType: EndophyteType = {
          endophyte_type_id: nextTypeId++,
          type_name: String(item.type_name).trim(),
          created_at: new Date().toISOString(),
        };
        endophyteTypes.push(newType);
        added.push(newType);
      }
    }
    res.status(201).json({ count: added.length, items: added });
  });

  app.delete(['/endophyte-types/:type_id', '/endophyte-types/:type_id/'], (req: Request, res: Response) => {
    const typeId = parseInt(req.params.type_id);
    const hasEndos = endophytes.some(e => e.endophyte_type_id === typeId);
    if (hasEndos) {
      return res.status(400).json({ detail: 'Cannot delete type: Endophyte species are still linked to this category.' });
    }
    const idx = endophyteTypes.findIndex(t => t.endophyte_type_id === typeId);
    if (idx === -1) {
      return res.status(404).json({ detail: 'Type not found' });
    }
    endophyteTypes.splice(idx, 1);
    res.json({ message: 'Deleted successfully' });
  });

  // --- ENDOPHYTE SPECIES ENDPOINTS ---
  app.get(['/endophytes', '/endophytes/'], (_req: Request, res: Response) => {
    res.json(endophytes);
  });

  app.post(['/endophytes', '/endophytes/'], (req: Request, res: Response) => {
    const { scientific_name, endophyte_type_id } = req.body;
    if (!scientific_name) {
      return res.status(400).json({ detail: 'Scientific name is required' });
    }
    const newEndo: Endophyte = {
      endophyte_id: nextEndoId++,
      endophyte_type_id: parseInt(endophyte_type_id),
      scientific_name,
      created_at: new Date().toISOString(),
    };
    endophytes.push(newEndo);
    res.status(201).json(newEndo);
  });

  app.post(['/endophytes/batch', '/endophytes/batch/'], (req: Request, res: Response) => {
    const items = Array.isArray(req.body) ? req.body : req.body.items || [];
    const added: Endophyte[] = [];
    for (const item of items) {
      if (item.scientific_name) {
        let typeId = item.endophyte_type_id ? parseInt(item.endophyte_type_id) : 0;
        if (!typeId && item.type_name) {
          const match = endophyteTypes.find(t => t.type_name.toLowerCase() === String(item.type_name).trim().toLowerCase());
          if (match) {
            typeId = match.endophyte_type_id;
          } else {
            const newType: EndophyteType = {
              endophyte_type_id: nextTypeId++,
              type_name: String(item.type_name).trim(),
              created_at: new Date().toISOString(),
            };
            endophyteTypes.push(newType);
            typeId = newType.endophyte_type_id;
          }
        }
        if (!typeId) {
          typeId = endophyteTypes[0]?.endophyte_type_id || 1;
        }
        const newEndo: Endophyte = {
          endophyte_id: nextEndoId++,
          endophyte_type_id: typeId,
          scientific_name: String(item.scientific_name).trim(),
          created_at: new Date().toISOString(),
        };
        endophytes.push(newEndo);
        added.push(newEndo);
      }
    }
    res.status(201).json({ count: added.length, items: added });
  });

  app.delete(['/endophytes/:endophyte_id', '/endophyte/:endophyte_id', '/endophytes/:endophyte_id/'], (req: Request, res: Response) => {
    const endoId = parseInt(req.params.endophyte_id);
    const hasObs = observations.some(o => o.endophyte_id === endoId);
    if (hasObs) {
      return res.status(400).json({ detail: 'Cannot delete endophyte: Observations have been recorded for this species.' });
    }
    const idx = endophytes.findIndex(e => e.endophyte_id === endoId);
    if (idx === -1) {
      return res.status(404).json({ detail: 'Endophyte not found' });
    }
    endophytes.splice(idx, 1);
    res.json({ message: 'Deleted successfully' });
  });

  // --- STRUCTURE ENDPOINTS ---
  app.get(['/structures', '/structures/'], (_req: Request, res: Response) => {
    res.json(structures);
  });

  app.post(['/structures', '/structures/'], (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ detail: 'Structure name is required' });
    }
    const newStruct: PlantStructure = {
      plant_structure_id: nextStructureId++,
      name,
    };
    structures.push(newStruct);
    res.status(201).json(newStruct);
  });

  app.post(['/structures/batch', '/structures/batch/'], (req: Request, res: Response) => {
    const items = Array.isArray(req.body) ? req.body : req.body.items || [];
    const added: PlantStructure[] = [];
    for (const item of items) {
      if (item.name) {
        const newStruct: PlantStructure = {
          plant_structure_id: nextStructureId++,
          name: String(item.name).trim(),
        };
        structures.push(newStruct);
        added.push(newStruct);
      }
    }
    res.status(201).json({ count: added.length, items: added });
  });

  app.delete(['/structures/:structure_id', '/structures/:structure_id/'], (req: Request, res: Response) => {
    const structId = parseInt(req.params.structure_id);
    const hasObs = observations.some(o => o.plant_structure_id === structId);
    if (hasObs) {
      return res.status(400).json({ detail: 'Cannot delete structure: It is referenced in existing observations.' });
    }
    const idx = structures.findIndex(s => s.plant_structure_id === structId);
    if (idx === -1) {
      return res.status(404).json({ detail: 'Structure not found' });
    }
    structures.splice(idx, 1);
    res.json({ message: 'Deleted successfully' });
  });

  // --- REFERENCE ENDPOINTS ---
  app.get(['/references', '/references/'], (_req: Request, res: Response) => {
    res.json(references);
  });

  app.post(['/references', '/references/'], (req: Request, res: Response) => {
    const { title, publication_year, reference_link } = req.body;
    if (!title) {
      return res.status(400).json({ detail: 'Title is required' });
    }
    const newRef: Reference = {
      reference_id: nextRefId++,
      title,
      publication_year: publication_year ? parseInt(publication_year) : null,
      reference_link: reference_link || null,
    };
    references.push(newRef);
    res.status(201).json(newRef);
  });

  app.post(['/references/batch', '/references/batch/'], (req: Request, res: Response) => {
    const items = Array.isArray(req.body) ? req.body : req.body.items || [];
    const added: Reference[] = [];
    for (const item of items) {
      if (item.title) {
        const newRef: Reference = {
          reference_id: nextRefId++,
          title: String(item.title).trim(),
          publication_year: item.publication_year ? parseInt(item.publication_year) : null,
          reference_link: item.reference_link ? String(item.reference_link).trim() : null,
        };
        references.push(newRef);
        added.push(newRef);
      }
    }
    res.status(201).json({ count: added.length, items: added });
  });

  app.delete(['/references/:reference_id', '/references/:reference_id/'], (req: Request, res: Response) => {
    const refId = parseInt(req.params.reference_id);
    // Unlink from observations
    for (const obs of observations) {
      if (obs.reference_id === refId) {
        obs.reference_id = null;
      }
    }
    const idx = references.findIndex(r => r.reference_id === refId);
    if (idx === -1) {
      return res.status(404).json({ detail: 'Reference not found' });
    }
    references.splice(idx, 1);
    res.json({ message: 'Deleted successfully' });
  });

  // --- SEQUENCING METHODS ENDPOINTS ---
  app.get(['/sequencing-methods', '/sequencing-methods/'], (_req: Request, res: Response) => {
    res.json(sequencingMethods);
  });

  app.post(['/sequencing-methods', '/sequencing-methods/'], (req: Request, res: Response) => {
    const { method_name, platform_type, description } = req.body;
    if (!method_name) {
      return res.status(400).json({ detail: 'Method name is required' });
    }
    const newMethod: SequencingMethod = {
      sequencing_method_id: nextSeqMethodId++,
      method_name: String(method_name).trim(),
      platform_type: platform_type ? String(platform_type).trim() : null,
      description: description ? String(description).trim() : null,
      created_at: new Date().toISOString(),
    };
    sequencingMethods.push(newMethod);
    res.status(201).json(newMethod);
  });

  app.post(['/sequencing-methods/batch', '/sequencing-methods/batch/'], (req: Request, res: Response) => {
    const items = Array.isArray(req.body) ? req.body : req.body.items || [];
    const added: SequencingMethod[] = [];
    for (const item of items) {
      const name = item.method_name || item.name;
      if (name) {
        const newMethod: SequencingMethod = {
          sequencing_method_id: nextSeqMethodId++,
          method_name: String(name).trim(),
          platform_type: item.platform_type ? String(item.platform_type).trim() : null,
          description: item.description ? String(item.description).trim() : null,
          created_at: new Date().toISOString(),
        };
        sequencingMethods.push(newMethod);
        added.push(newMethod);
      }
    }
    res.status(201).json({ count: added.length, items: added });
  });

  app.delete(['/sequencing-methods/:id', '/sequencing-methods/:id/'], (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const hasObs = observations.some(o => o.sequencing_method_id === id);
    if (hasObs) {
      return res.status(400).json({ detail: 'Cannot delete sequencing method: It is linked to existing observations.' });
    }
    const idx = sequencingMethods.findIndex(s => s.sequencing_method_id === id);
    if (idx === -1) {
      return res.status(404).json({ detail: 'Sequencing method not found' });
    }
    sequencingMethods.splice(idx, 1);
    res.json({ message: 'Deleted successfully' });
  });

  // --- SPECIMEN ENDPOINTS ---
  app.get(['/specimens', '/specimens/'], (_req: Request, res: Response) => {
    res.json(specimens);
  });

  app.post(['/specimens', '/specimens/'], (req: Request, res: Response) => {
    const { crop_species_id, specimen_identifier, latitude, longitude, location_estimated, created_by } = req.body;
    const identifier = specimen_identifier || `SPEC-${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}`;
    const newSpecimen: PlantSpecimen = {
      plant_specimen_id: nextSpecimenId++,
      crop_species_id: parseInt(crop_species_id),
      specimen_identifier: identifier,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      location_estimated: Boolean(location_estimated),
      created_by: created_by || 'Researcher Admin',
      created_at: new Date().toISOString(),
    };
    specimens.push(newSpecimen);
    res.status(201).json(newSpecimen);
  });

  app.delete(['/specimens/:specimen_id', '/specimens/:specimen_id/'], (req: Request, res: Response) => {
    const specId = parseInt(req.params.specimen_id);
    const idx = specimens.findIndex(s => s.plant_specimen_id === specId);
    if (idx === -1) {
      return res.status(404).json({ detail: 'Specimen not found' });
    }
    // Delete specimen and cascade observations
    specimens.splice(idx, 1);
    const remainingObs = observations.filter(o => o.plant_specimen_id !== specId);
    observations.length = 0;
    observations.push(...remainingObs);
    res.json({ message: 'Specimen deleted' });
  });

  // --- OBSERVATION ENDPOINTS ---
  app.get(['/observations', '/observations/'], (_req: Request, res: Response) => {
    res.json(observations);
  });

  app.post(['/observations', '/observations/'], (req: Request, res: Response) => {
    const { 
      plant_specimen_id, 
      endophyte_id, 
      plant_structure_id, 
      reference_id, 
      sequencing_method_id,
      sequencing_method,
      ncbi_accession,
      observation_date, 
      created_by 
    } = req.body;

    let seqId = sequencing_method_id ? parseInt(sequencing_method_id) : null;
    let seqName = sequencing_method || null;
    if (seqId && !seqName) {
      const found = sequencingMethods.find(s => s.sequencing_method_id === seqId);
      if (found) seqName = found.method_name;
    } else if (seqName && !seqId) {
      const found = sequencingMethods.find(s => s.method_name.toLowerCase() === String(seqName).toLowerCase());
      if (found) seqId = found.sequencing_method_id;
    }

    const newObs: EndophyteObservation = {
      observation_id: nextObsId++,
      plant_specimen_id: plant_specimen_id ? parseInt(plant_specimen_id) : 0,
      endophyte_id: endophyte_id ? parseInt(endophyte_id) : 0,
      plant_structure_id: plant_structure_id ? parseInt(plant_structure_id) : 0,
      reference_id: reference_id ? parseInt(reference_id) : null,
      sequencing_method_id: seqId,
      sequencing_method: seqName,
      ncbi_accession: ncbi_accession ? String(ncbi_accession).trim().toUpperCase() : null,
      observation_date: observation_date || new Date().toISOString().split('T')[0],
      created_by: created_by || 'Researcher Admin',
      created_at: new Date().toISOString(),
    };
    observations.push(newObs);
    res.status(201).json(newObs);
  });

  app.delete(['/observations/:observation_id', '/observations/:observation_id/'], (req: Request, res: Response) => {
    const obsId = parseInt(req.params.observation_id);
    const idx = observations.findIndex(o => o.observation_id === obsId);
    if (idx === -1) {
      return res.status(404).json({ detail: 'Observation not found' });
    }
    observations.splice(idx, 1);
    res.json({ message: 'Deleted successfully' });
  });

  // --- FULL CAPTURE COMPOSITE ENDPOINT ---
  app.post(['/capture-full', '/capture-full/'], (req: Request, res: Response) => {
    const {
      crop_species_id,
      specimen_identifier,
      latitude,
      longitude,
      location_estimated,
      endophyte_ids,
      plant_structure_ids,
      reference_id,
      sequencing_method_id,
      sequencing_method,
      ncbi_accession,
      observation_date,
      created_by,
    } = req.body;

    const identifier = specimen_identifier || `SPEC-${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}`;

    const newSpecimen: PlantSpecimen = {
      plant_specimen_id: nextSpecimenId++,
      crop_species_id: parseInt(crop_species_id),
      specimen_identifier: identifier,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      location_estimated: Boolean(location_estimated),
      created_by: created_by || 'Researcher Admin',
      created_at: new Date().toISOString(),
    };
    specimens.push(newSpecimen);

    let seqId = sequencing_method_id ? parseInt(sequencing_method_id) : null;
    let seqName = sequencing_method || null;
    if (seqId && !seqName) {
      const found = sequencingMethods.find(s => s.sequencing_method_id === seqId);
      if (found) seqName = found.method_name;
    } else if (seqName && !seqId) {
      const found = sequencingMethods.find(s => s.method_name.toLowerCase() === String(seqName).toLowerCase());
      if (found) seqId = found.sequencing_method_id;
    }
    const cleanAccession = ncbi_accession ? String(ncbi_accession).trim().toUpperCase() : null;

    let createdCount = 0;
    const endoList: number[] = Array.isArray(endophyte_ids) ? endophyte_ids.map(Number) : [];
    const structList: number[] = Array.isArray(plant_structure_ids) ? plant_structure_ids.map(Number) : [];

    for (const endoId of endoList) {
      for (const structId of structList) {
        observations.push({
          observation_id: nextObsId++,
          plant_specimen_id: newSpecimen.plant_specimen_id,
          endophyte_id: endoId,
          plant_structure_id: structId,
          reference_id: reference_id ? parseInt(reference_id) : null,
          sequencing_method_id: seqId,
          sequencing_method: seqName,
          ncbi_accession: cleanAccession,
          observation_date: observation_date || new Date().toISOString().split('T')[0],
          created_by: created_by || 'Researcher Admin',
          created_at: new Date().toISOString(),
        });
        createdCount++;
      }
    }

    res.json({
      message: 'Transaction successful',
      plant_specimen_id: newSpecimen.plant_specimen_id,
      observations_logged: createdCount,
    });
  });

  // --- OBSERVATION & SPECIMEN BATCH IMPORT WITH AUTO MASTER DATA PROVISIONING ---
  app.post(['/observations/batch-import', '/observations/batch-import/', '/capture-batch', '/capture-batch/'], (req: Request, res: Response) => {
    const rawRows = Array.isArray(req.body) ? req.body : (req.body.rows || req.body.items || []);
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(400).json({ detail: 'No observation rows provided for import.' });
    }

    const createdCrops: CropSpecies[] = [];
    const createdStructures: PlantStructure[] = [];
    const createdTypes: EndophyteType[] = [];
    const createdEndophytes: Endophyte[] = [];
    const createdSeqMethods: SequencingMethod[] = [];
    const createdReferences: Reference[] = [];
    const createdSpecimens: PlantSpecimen[] = [];
    const createdObservations: EndophyteObservation[] = [];

    // Helper finders
    const findCrop = (name: string) => {
      const trimmed = name.trim().toLowerCase();
      return crops.find(c => c.common_name.toLowerCase() === trimmed || (c.scientific_name && c.scientific_name.toLowerCase() === trimmed));
    };

    const findStructure = (name: string) => {
      const trimmed = name.trim().toLowerCase();
      return structures.find(s => s.name.toLowerCase() === trimmed);
    };

    const findType = (name: string) => {
      const trimmed = name.trim().toLowerCase();
      return endophyteTypes.find(t => t.type_name.toLowerCase() === trimmed);
    };

    const findEndo = (name: string) => {
      const trimmed = name.trim().toLowerCase();
      return endophytes.find(e => e.scientific_name.toLowerCase() === trimmed);
    };

    const findSeqMethod = (name: string) => {
      const trimmed = name.trim().toLowerCase();
      return sequencingMethods.find(s => s.method_name.toLowerCase() === trimmed);
    };

    const findRef = (title: string) => {
      const trimmed = title.trim().toLowerCase();
      return references.find(r => r.title.toLowerCase() === trimmed);
    };

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      // 1. CROP IDENTIFICATION / CREATION
      const cropName = (row.crop_common_name || row.crop_name || row.common_name || row.crop || '').toString().trim();
      if (!cropName) {
        continue; // skip empty rows without crop
      }

      let cropObj = findCrop(cropName);
      if (!cropObj) {
        const cropSci = (row.crop_scientific_name || row.scientific_name || '').toString().trim() || null;
        const cropGroup = (row.plant_group || row.crop_plant_group || row.clade || 'Unknown').toString().trim();
        cropObj = {
          crop_species_id: nextCropId++,
          common_name: cropName,
          scientific_name: cropSci,
          plant_group: cropGroup,
          created_at: new Date().toISOString(),
        };
        crops.push(cropObj);
        createdCrops.push(cropObj);
      }

      // 2. COORDINATES & SPECIMEN
      let lat = parseFloat(row.latitude);
      let lng = parseFloat(row.longitude);
      if (isNaN(lat)) lat = 0.0;
      if (isNaN(lng)) lng = 0.0;
      const isEst = Boolean(row.location_estimated === true || String(row.location_estimated).toLowerCase() === 'true' || String(row.location_estimated) === '1');
      const obsDate = (row.observation_date || new Date().toISOString().split('T')[0]).toString().trim();
      const createdBy = (row.created_by || 'Researcher Admin').toString().trim();

      let specIdentifier = (row.specimen_identifier || '').toString().trim();
      let specimenObj: PlantSpecimen | undefined;

      if (specIdentifier) {
        specimenObj = specimens.find(s => s.specimen_identifier.toLowerCase() === specIdentifier.toLowerCase());
      }

      if (!specimenObj) {
        const cropPrefix = cropObj.common_name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'CRP') || 'CRP';
        if (!specIdentifier) {
          specIdentifier = `${cropPrefix}-IMP-${1000 + nextSpecimenId}`;
        }
        specimenObj = {
          plant_specimen_id: nextSpecimenId++,
          crop_species_id: cropObj.crop_species_id,
          specimen_identifier: specIdentifier,
          latitude: lat,
          longitude: lng,
          location_estimated: isEst,
          created_by: createdBy,
          created_at: new Date().toISOString(),
        };
        specimens.push(specimenObj);
        createdSpecimens.push(specimenObj);
      }

      // 3. PLANT STRUCTURE(S)
      const rawStructs = (row.plant_structure || row.structure_name || row.tissue || row.plant_structures || 'Root').toString();
      // Support multiple structures separated by ; or / or , (unless single word)
      const structNames = rawStructs.includes(';') 
        ? rawStructs.split(';').map((s: string) => s.trim()).filter(Boolean)
        : rawStructs.includes('|')
        ? rawStructs.split('|').map((s: string) => s.trim()).filter(Boolean)
        : [rawStructs.trim()];

      const resolvedStructures: PlantStructure[] = [];
      for (const sName of structNames) {
        if (!sName) continue;
        let sObj = findStructure(sName);
        if (!sObj) {
          sObj = {
            plant_structure_id: nextStructureId++,
            name: sName,
          };
          structures.push(sObj);
          createdStructures.push(sObj);
        }
        resolvedStructures.push(sObj);
      }
      if (resolvedStructures.length === 0 && structures.length > 0) {
        resolvedStructures.push(structures[0]);
      }

      // 4. ENDOPHYTE TYPE & ENDOPHYTE
      const endoName = (row.endophyte_scientific_name || row.endophyte_name || row.endophyte_species || row.endophyte || '').toString().trim();
      if (!endoName) continue;

      let endoObj = findEndo(endoName);
      if (!endoObj) {
        // Need endophyte type
        const typeName = (row.endophyte_type || row.taxonomy_type || row.type_name || 'Fungal').toString().trim();
        let typeObj = findType(typeName);
        if (!typeObj) {
          typeObj = {
            endophyte_type_id: nextTypeId++,
            type_name: typeName,
            created_at: new Date().toISOString(),
          };
          endophyteTypes.push(typeObj);
          createdTypes.push(typeObj);
        }

        endoObj = {
          endophyte_id: nextEndoId++,
          endophyte_type_id: typeObj.endophyte_type_id,
          scientific_name: endoName,
          created_at: new Date().toISOString(),
        };
        endophytes.push(endoObj);
        createdEndophytes.push(endoObj);
      }

      // 5. SEQUENCING METHOD
      const rawSeqMethod = (row.sequencing_method || row.sequencing_technology || row.method_name || '').toString().trim();
      let seqMethodObj: SequencingMethod | undefined;
      let seqMethodName: string | null = null;
      let seqMethodId: number | null = null;

      if (rawSeqMethod) {
        seqMethodObj = findSeqMethod(rawSeqMethod);
        if (!seqMethodObj) {
          const platform = (row.sequencing_platform || row.platform_type || '').toString().trim() || null;
          seqMethodObj = {
            sequencing_method_id: nextSeqMethodId++,
            method_name: rawSeqMethod,
            platform_type: platform,
            description: 'Imported via CSV template',
            created_at: new Date().toISOString(),
          };
          sequencingMethods.push(seqMethodObj);
          createdSeqMethods.push(seqMethodObj);
        }
        seqMethodId = seqMethodObj.sequencing_method_id;
        seqMethodName = seqMethodObj.method_name;
      }

      // 6. NCBI ACCESSION
      const rawAccession = (row.ncbi_accession || row.accession || '').toString().trim();
      const cleanAccession = rawAccession ? rawAccession.toUpperCase() : null;

      // 7. REFERENCE
      const rawRefTitle = (row.reference_title || row.article_title || row.reference || '').toString().trim();
      let refObj: Reference | undefined;
      let refId: number | null = null;

      if (rawRefTitle) {
        refObj = findRef(rawRefTitle);
        if (!refObj) {
          const pubYear = row.publication_year || row.reference_year ? parseInt(row.publication_year || row.reference_year) : null;
          const refLink = (row.reference_link || row.doi || '').toString().trim() || null;
          refObj = {
            reference_id: nextRefId++,
            title: rawRefTitle,
            publication_year: isNaN(pubYear as number) ? null : pubYear,
            reference_link: refLink,
          };
          references.push(refObj);
          createdReferences.push(refObj);
        }
        refId = refObj.reference_id;
      }

      // 8. LOG OBSERVATION(S)
      for (const sObj of resolvedStructures) {
        const obs: EndophyteObservation = {
          observation_id: nextObsId++,
          plant_specimen_id: specimenObj.plant_specimen_id,
          endophyte_id: endoObj.endophyte_id,
          plant_structure_id: sObj.plant_structure_id,
          reference_id: refId,
          sequencing_method_id: seqMethodId,
          sequencing_method: seqMethodName,
          ncbi_accession: cleanAccession,
          observation_date: obsDate,
          created_by: createdBy,
          created_at: new Date().toISOString(),
        };
        observations.push(obs);
        createdObservations.push(obs);
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully imported ${createdObservations.length} observation(s) linked to ${createdSpecimens.length} specimen(s)!`,
      observations_created: createdObservations.length,
      specimens_created: createdSpecimens.length,
      auto_created: {
        crops: createdCrops,
        structures: createdStructures,
        endophyte_types: createdTypes,
        endophytes: createdEndophytes,
        sequencing_methods: createdSeqMethods,
        references: createdReferences,
      }
    });
  });


  // --- HEALTH CHECK ---
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // --- FRONTEND INTEGRATION ---
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hidden Microbiome server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
