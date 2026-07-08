from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str
    includeQuranicReflection: bool = False


class ActionLink(BaseModel):
    label: str
    href: str


class QuranicReflection(BaseModel):
    type: str
    text: str
    note: str


class AskResponse(BaseModel):
    question: str
    intent: str
    safetyLevel: str
    answer: str
    disclaimer: str
    recommendedAction: str | None = None
    actions: list[ActionLink] = Field(default_factory=list)
    sources: list[dict[str, str]] = Field(default_factory=list)
    quranicReflection: QuranicReflection | None = None
