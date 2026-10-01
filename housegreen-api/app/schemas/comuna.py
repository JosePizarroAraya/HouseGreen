from pydantic import BaseModel

class ComunaOut(BaseModel):
    id: int
    name: str
    region_id: int

    class Config:
        from_attributes = True