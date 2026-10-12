from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import models, schemas
from database import engine, get_db
from fastapi.middleware.cors import CORSMiddleware

# This initializes the tables in Postgres
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Hidden Microbiome API")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SPECIMEN ENDPOINTS ---

@app.post("/specimens/", response_model=schemas.SpecimenOut)
def create_specimen(specimen: schemas.SpecimenCreate, db: Session = Depends(get_db)):
    # Convert incoming lat/lon to PostGIS format
    point_wkt = f"POINT({specimen.longitude} {specimen.latitude})"
    
    db_specimen = models.PlantSpecimen(
        crop_species_id=specimen.crop_species_id,
        specimen_identifier=specimen.specimen_identifier,
        location=func.ST_GeomFromText(point_wkt, 4326),
        location_estimated=specimen.location_estimated,  # <-- NEW FIELD
        created_by=specimen.created_by
    )
    
    db.add(db_specimen)
    db.commit()
    db.refresh(db_specimen)

    # Manual mapping for response
    db_specimen.latitude = specimen.latitude
    db_specimen.longitude = specimen.longitude
    
    return db_specimen

@app.get("/specimens/", response_model=list[schemas.SpecimenOut])
def list_specimens(db: Session = Depends(get_db)):
    specimens = db.query(models.PlantSpecimen).all()
    for s in specimens:
        s.latitude = s.location
        s.longitude = s.location
    return specimens

@app.delete("/specimens/{specimen_id}")
def delete_specimen(specimen_id: int, db: Session = Depends(get_db)):
    db_specimen = db.query(models.PlantSpecimen).get(specimen_id)
    if not db_specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")
    
    # Observations are usually CASCADE deleted if defined in models, 
    # but we can also manually clear or delete them here if needed.
    db.delete(db_specimen)
    db.commit()
    return {"message": "Specimen deleted"}

from datetime import datetime

@app.post("/capture-full/")
def create_full_capture(payload: schemas.FullCaptureCreate, db: Session = Depends(get_db)):
    # 1. Generate an automated Specimen ID if one isn't provided
    identifier = payload.specimen_identifier
    if not identifier:
        identifier = f"SPEC-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    # 2. Prepare geospatial point
    point_wkt = f"POINT({payload.longitude} {payload.latitude})"
    
    # 3. Stage the Specimen
    db_specimen = models.PlantSpecimen(
        crop_species_id=payload.crop_species_id,
        specimen_identifier=identifier,
        location=func.ST_GeomFromText(point_wkt, 4326),
        created_by=payload.created_by
    )
    
    db.add(db_specimen)
    # FLUSH: Assigns the new ID without permanently committing to the database yet!
    db.flush() 
    
   # 4. Stage the Observations (Nested Loop for Multiple Endophytes & Structures)
    created_count = 0
    for endo_id in payload.endophyte_ids:
        for struct_id in payload.plant_structure_ids:
            db_obs = models.EndophyteObservation(
                plant_specimen_id=db_specimen.plant_specimen_id,
                endophyte_id=endo_id,                 # <-- Uses the loop variable
                plant_structure_id=struct_id,         # <-- Uses the loop variable
                reference_id=payload.reference_id,
                observation_date=payload.observation_date,
                created_by=payload.created_by
            )
            db.add(db_obs)
            created_count += 1
        
    # 5. COMMIT: Save everything together. If this fails, the specimen is rolled back too.
    db.commit()
    
    return {
        "message": "Transaction successful", 
        "plant_specimen_id": db_specimen.plant_specimen_id,
        "observations_logged": created_count
    }

# --- CROP ENDPOINTS ---

@app.put("/crops/{crop_id}", response_model=schemas.CropOut)
def update_crop(crop_id: int, crop: schemas.CropCreate, db: Session = Depends(get_db)):
    db_crop = db.query(models.CropSpecies).get(crop_id)
    if not db_crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    
    db_crop.common_name = crop.common_name
    db_crop.scientific_name = crop.scientific_name
    db_crop.plant_group = crop.plant_group
    
    db.commit()
    db.refresh(db_crop)
    return db_crop

@app.get("/crops/", response_model=list[schemas.CropOut])
def list_crops(db: Session = Depends(get_db)):
    return db.query(models.CropSpecies).all()

@app.delete("/crops/{crop_id}")
def delete_crop(crop_id: int, db: Session = Depends(get_db)):
    db_crop = db.query(models.CropSpecies).get(crop_id)
    if not db_crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    
    # Check for existing specimens before deleting
    has_specimens = db.query(models.PlantSpecimen).filter(models.PlantSpecimen.crop_species_id == crop_id).first()
    if has_specimens:
        raise HTTPException(status_code=400, detail="Cannot delete crop: Specimens are still linked to this species.")
        
    db.delete(db_crop)
    db.commit()
    return {"message": "Deleted successfully"}

# --- ENDOPHYTE TYPE ENDPOINTS ---

@app.post("/endophyte-types/", response_model=schemas.EndophyteTypeOut)
def create_endophyte_type(etype: schemas.EndophyteTypeCreate, db: Session = Depends(get_db)):
    db_type = models.EndophyteType(**etype.model_dump())
    db.add(db_type)
    db.commit()
    db.refresh(db_type)
    return db_type

@app.get("/endophyte-types/", response_model=list[schemas.EndophyteTypeOut])
def list_endophyte_types(db: Session = Depends(get_db)):
    return db.query(models.EndophyteType).all()

@app.delete("/endophyte-types/{type_id}")
def delete_endophyte_type(type_id: int, db: Session = Depends(get_db)):
    db_type = db.query(models.EndophyteType).get(type_id)
    if not db_type:
        raise HTTPException(status_code=404, detail="Type not found")
        
    # Check for existing endophytes
    has_endophytes = db.query(models.Endophyte).filter(models.Endophyte.endophyte_type_id == type_id).first()
    if has_endophytes:
        raise HTTPException(status_code=400, detail="Cannot delete type: Endophyte species are still linked to this category.")
        
    db.delete(db_type)
    db.commit()
    return {"message": "Deleted successfully"}

# --- ENDOPHYTE ENDPOINTS ---

@app.post("/endophytes/", response_model=schemas.EndophyteOut)
def create_endophyte(endophyte: schemas.EndophyteCreate, db: Session = Depends(get_db)):
    db_endophyte = models.Endophyte(**endophyte.model_dump())
    db.add(db_endophyte)
    db.commit()
    db.refresh(db_endophyte)
    return db_endophyte

@app.get("/endophytes/", response_model=list[schemas.EndophyteOut])
def list_endophytes(db: Session = Depends(get_db)):
    return db.query(models.Endophyte).all()

@app.delete("/endophytes/{endophyte_id}")
def delete_endophyte(endophyte_id: int, db: Session = Depends(get_db)):
    db_endophyte = db.query(models.Endophyte).get(endophyte_id)
    if not db_endophyte:
        raise HTTPException(status_code=404, detail="Endophyte not found")
        
    # Check for existing observations
    has_obs = db.query(models.EndophyteObservation).filter(models.EndophyteObservation.endophyte_id == endophyte_id).first()
    if has_obs:
        raise HTTPException(status_code=400, detail="Cannot delete endophyte: Observations have been recorded for this species.")
        
    db.delete(db_endophyte)
    db.commit()
    return {"message": "Deleted successfully"}

# --- OBSERVATION ENDPOINTS ---

@app.post("/observations/", response_model=schemas.ObservationOut)
def create_observation(obs: schemas.ObservationCreate, db: Session = Depends(get_db)):
    db_obs = models.EndophyteObservation(**obs.model_dump())
    db.add(db_obs)
    db.commit()
    db_obs_id = db_obs.observation_id
    db.refresh(db_obs)
    return db_obs

@app.get("/observations/", response_model=list[schemas.ObservationOut])
def list_observations(db: Session = Depends(get_db)):
    return db.query(models.EndophyteObservation).all()

@app.delete("/observations/{observation_id}")
def delete_observation(observation_id: int, db: Session = Depends(get_db)):
    db_obs = db.query(models.EndophyteObservation).get(observation_id)
    if not db_obs:
        raise HTTPException(status_code=404, detail="Observation not found")
    db.delete(db_obs)
    db.commit()
    return {"message": "Deleted successfully"}

# --- STRUCTURE ENDPOINTS ---

@app.post("/structures/", response_model=schemas.StructureOut)
def create_structure(structure: schemas.StructureBase, db: Session = Depends(get_db)):
    db_structure = models.PlantStructure(**structure.model_dump())
    db.add(db_structure)
    db.commit()
    db.refresh(db_structure)
    return db_structure

@app.get("/structures/", response_model=list[schemas.StructureOut])
def list_structures(db: Session = Depends(get_db)):
    return db.query(models.PlantStructure).all()

@app.delete("/structures/{structure_id}")
def delete_structure(structure_id: int, db: Session = Depends(get_db)):
    db_struct = db.query(models.PlantStructure).get(structure_id)
    if not db_struct:
        raise HTTPException(status_code=404, detail="Structure not found")
        
    # Check for linked observations
    has_obs = db.query(models.EndophyteObservation).filter(models.EndophyteObservation.plant_structure_id == structure_id).first()
    if has_obs:
        raise HTTPException(status_code=400, detail="Cannot delete structure: It is referenced in existing observations.")
        
    db.delete(db_struct)
    db.commit()
    return {"message": "Deleted successfully"}

# --- REFERENCE ENDPOINTS ---

@app.post("/references/", response_model=schemas.ReferenceOut)
def create_reference(ref: schemas.ReferenceCreate, db: Session = Depends(get_db)):
    db_ref = models.Reference(**ref.model_dump())
    db.add(db_ref)
    db.commit()
    db.refresh(db_ref)
    return db_ref

@app.get("/references/", response_model=list[schemas.ReferenceOut])
def list_references(db: Session = Depends(get_db)):
    return db.query(models.Reference).all()

@app.delete("/references/{reference_id}")
def delete_reference(reference_id: int, db: Session = Depends(get_db)):
    db_ref = db.query(models.Reference).get(reference_id)
    if not db_ref:
        raise HTTPException(status_code=404, detail="Reference not found")
    
    # FIX: Unlink this reference from any observations before deleting
    # This sets the reference_id to NULL in the observation table
    db.query(models.EndophyteObservation).filter(
        models.EndophyteObservation.reference_id == reference_id
    ).update({models.EndophyteObservation.reference_id: None})
    
    db.delete(db_ref)
    db.commit()
    return {"message": "Deleted successfully"}