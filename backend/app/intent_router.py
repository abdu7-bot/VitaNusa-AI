from .safety import check_safety


def detect_intent(question: str) -> dict:
    safety = check_safety(question)

    return {
        "intent": safety.category,
        "safetyLevel": safety.safetyLevel,
        "recommendedAction": safety.recommendedAction,
    }
