import random
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import SessionLocal
import models

def seed_data():
    db: Session = SessionLocal()
    
    try:
        # 1. Add Crop Species
        crops = [
            models.CropSpecies(common_name="Maize", scientific_name="Zea mays"),
            models.CropSpecies(common_name="Wheat", scientific_name="Triticum aestivum"),
            models.CropSpecies(common_name="Soybean", scientific_name="Glycine max")
        ]
        db.add_all(crops)
        db.commit()

        # 2. Add Plant Structures
        structures = [
            models.PlantStructure(name="Root"),
            models.PlantStructure(name="Leaf"),
            models.PlantStructure(name="Stem"),
            models.PlantStructure(name="Seed")
        ]
        db.add_all(structures)
        
        # 3. Add Endophyte Types & Species
        f_type = models.EndophyteType(type_name="Fungal")
        b_type = models.EndophyteType(type_name="Bacterial")
        db.add_all([f_type, b_type])
        db.commit()

        endophytes = [
            models.Endophyte(scientific_name="Beauveria bassiana", endophyte_type_id=f_type.endophyte_type_id),
            models.Endophyte(scientific_name="Bacillus subtilis", endophyte_type_id=b_type.endophyte_type_id),
            models.Endophyte(scientific_name="Metarhizium anisopliae", endophyte_type_id=f_type.endophyte_type_id)
        ]
        db.add_all(endophytes)
        db.commit()

        # 4. Generate 50 Random Specimens with PostGIS Points
        # Centered near Iowa (Agricultural Hub)
        for i in range(50):
            lat = 41.5 + random.uniform(-0.5, 0.5)
            lon = -93.5 + random.uniform(-0.5, 0.5)
            point_wkt = f"SRID=4326;POINT({lon} {lat})"
            
            specimen = models.PlantSpecimen(
                crop_species_id=random.choice(crops).crop_species_id,
                specimen_identifier=f"Field-Plot-{i+1}",
                location=func.ST_GeomFromText(point_wkt),
                created_by="SeedScript"
            )
            db.add(specimen)
            db.commit() 

            # 5. Add a random observation for each specimen
            obs = models.EndophyteObservation(
                plant_specimen_id=specimen.plant_specimen_id,
                endophyte_id=random.choice(endophytes).endophyte_id,
                plant_structure_id=random.choice(structures).plant_structure_id,
                observation_date=datetime.utcnow()
            )
            db.add(obs)

        db.commit()
        print("✅ Database seeded successfully with 50 specimens!")
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()