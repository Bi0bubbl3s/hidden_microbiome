from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Boolean
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date
from sqlalchemy.orm import relationship, declarative_base
from geoalchemy2 import Geometry
from datetime import datetime

Base = declarative_base()

class CropSpecies(Base):
    __tablename__ = 'crop_species'
    crop_species_id = Column(Integer, primary_key=True, index=True)
    common_name = Column(String(255), nullable=False)
    scientific_name = Column(String(255))
    plant_group = Column(String(50), default="Unknown") # <-- NEW FIELD
    created_at = Column(DateTime, default=datetime.utcnow)
    specimens = relationship("PlantSpecimen", back_populates="species")

class PlantSpecimen(Base):
    __tablename__ = 'plant_specimen'
    plant_specimen_id = Column(Integer, primary_key=True, index=True)
    crop_species_id = Column(Integer, ForeignKey('crop_species.crop_species_id'))
    specimen_identifier = Column(String(255))
    # PostGIS Geometry type for spatial analysis
    location = Column(Geometry('POINT', srid=4326))
    location_estimated = Column(Boolean, default=False) # <-- NEW FIELD
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    species = relationship("CropSpecies", back_populates="specimens")
    observations = relationship("EndophyteObservation", back_populates="specimen")

class PlantStructure(Base):
    __tablename__ = 'plant_structure'
    plant_structure_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    
    # Matches the relationship in EndophyteObservation
    observations = relationship("EndophyteObservation", back_populates="structure")

class Reference(Base):
    __tablename__ = 'reference'
    reference_id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    reference_link = Column(String(500), nullable=True)
    publication_year = Column(Integer, nullable=True)

# In models.py

class EndophyteObservation(Base):
    __tablename__ = 'endophyte_observation'
    
    observation_id = Column(Integer, primary_key=True, index=True)
    plant_specimen_id = Column(Integer, ForeignKey('plant_specimen.plant_specimen_id', ondelete='CASCADE'))
    
    # --- CHECK THIS LINE ---
    # It must have the ForeignKey('') part!
    endophyte_id = Column(Integer, ForeignKey('endophyte.endophyte_id', ondelete='CASCADE')) 
    # -----------------------
    
    plant_structure_id = Column(Integer, ForeignKey('plant_structure.plant_structure_id'))
    reference_id = Column(Integer, ForeignKey('reference.reference_id'), nullable=True)
    observation_date = Column(Date)
    created_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    specimen = relationship("PlantSpecimen", back_populates="observations")
    endophyte = relationship("Endophyte", back_populates="observations") # This relies on the FK above
    structure = relationship("PlantStructure", back_populates="observations")

class EndophyteType(Base):
    __tablename__ = 'endophyte_type'
    
    endophyte_type_id = Column(Integer, primary_key=True, index=True)
    type_name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# In models.py

class Endophyte(Base): # Make sure this is exactly "Endophyte"
    __tablename__ = 'endophyte'
    
    endophyte_id = Column(Integer, primary_key=True, index=True)
    endophyte_type_id = Column(Integer, ForeignKey('endophyte_type.endophyte_type_id'))
    scientific_name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships (Optional but helpful)
    type = relationship("EndophyteType")
    observations = relationship("EndophyteObservation", back_populates="endophyte")

