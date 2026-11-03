from typing import Literal

from pydantic import BaseModel


class Probabilities(BaseModel):
    organic: float
    paper: float
    plastic: float


class PredictionResponse(BaseModel):
    category: Literal["organic", "paper", "plastic"]
    confidence: float
    probabilities: Probabilities
    model_version: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    message: str
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody
