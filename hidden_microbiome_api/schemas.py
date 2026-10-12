from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime, date
from typing import Optional
from geoalchemy2.shape import to_shape

# In schemas.py
class SpecimenCreate(BaseModel):  # Change 'SpecimenBase' to 'SpecimenCreate'
    crop_species_id: int
    specimen_identifier: Optional[str] = None
    latitude: float
    longitude: float
    created_by: Optional[str] = None  

class SpecimenOut(BaseModel):
    plant_specimen_id: int
    crop_species_id: int
    specimen_identifier: Optional[str] = None
    # We define these even though they aren't 'columns' in the DB
    latitude: float 
    longitude: float

    model_config = ConfigDict(from_attributes=True)

    @field_validator('latitude', mode='before')
    @classmethod
    def get_latitude(cls, v, info):
        # If 'v' is the PostGIS 'location' blob, extract the Y coordinate
        if hasattr(v, '__class__') and 'WKBElement' in str(v.__class__):
            return to_shape(v).y
        return v

    @field_validator('longitude', mode='before')
    @classmethod
    def get_longitude(cls, v, info):
        # If 'v' is the PostGIS 'location' blob, extract the X coordinate
        if hasattr(v, '__class__') and 'WKBElement' in str(v.__class__):
            return to_shape(v).x
        return v

class CropBase(BaseModel):
    common_name: str
    scientific_name: Optional[str] = None
    plant_group: Optional[str] = "Unknown"  # <-- NEW FIELD added here!

class CropCreate(CropBase):
    pass # This is what we use for POST requests

class CropOut(CropBase):
    crop_species_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

CropOut.model_rebuild()

# --- Endophyte Type Schemas ---
class EndophyteTypeBase(BaseModel):
    type_name: str

class EndophyteTypeCreate(EndophyteTypeBase):
    pass

class EndophyteTypeOut(EndophyteTypeBase):
    endophyte_type_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Endophyte Species Schemas ---
class EndophyteBase(BaseModel):
    scientific_name: str
    endophyte_type_id: int

class EndophyteCreate(EndophyteBase):
    pass

class EndophyteOut(EndophyteBase):
    endophyte_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Don't forget to rebuild at the bottom of the file
EndophyteOut.model_rebuild()
EndophyteTypeOut.model_rebuild()

class ObservationCreate(BaseModel):
    # Change these three IDs to be Optional, so the API doesn't crash if it reads a null from the DB
    plant_specimen_id: Optional[int] = None
    endophyte_id: Optional[int] = None
    plant_structure_id: Optional[int] = None
    
    reference_id: Optional[int] = None
    observation_date: date
    created_by: Optional[str] = None

class ObservationOut(ObservationCreate):
    observation_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

ObservationOut.model_rebuild()

# --- Plant Structure Schemas ---
class StructureBase(BaseModel):
    name: str

class StructureOut(StructureBase):
    plant_structure_id: int
    model_config = ConfigDict(from_attributes=True)

# --- Reference Schemas ---
class ReferenceBase(BaseModel):
    title: str
    reference_link: Optional[str] = None
    publication_year: Optional[int] = None

class ReferenceCreate(ReferenceBase):
    pass

class ReferenceOut(ReferenceBase):
    reference_id: int
    model_config = ConfigDict(from_attributes=True)

# --- Composite Schemas ---
class FullCaptureCreate(BaseModel):
    crop_species_id: int
    latitude: float
    longitude: float
    location_estimated: bool = False  # <-- NEW FIELD
    specimen_identifier: Optional[str] = None
    
    # NEW: Expect a list of IDs instead of a single ID
    endophyte_ids: list[int]
    
    plant_structure_ids: list[int] 
    reference_id: Optional[int] = None
    observation_date: date
    created_by: Optional[str] = "Researcher Admin"

StructureOut.model_rebuild()
ReferenceOut.model_rebuild()