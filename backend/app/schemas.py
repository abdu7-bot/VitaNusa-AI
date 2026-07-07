from pydantic import BaseModel


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    question: str
    intent: str
    answer: str
    disclaimer: str
    safetyLevel: str
    recommendedAction: str | None = None
