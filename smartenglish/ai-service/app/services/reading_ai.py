from app.schemas.ai_core import AiGenerateRequest, AiResponse
from app.schemas.reading import ReadingExplainRequest, ReadingQuizRequest
from app.services.ai_core import ai_generate


def explain_vocabulary(request: ReadingExplainRequest) -> AiResponse:
    context_parts = [
        f"Term: {request.term}",
        f"Learner level: {request.learner_level or 'unknown'}",
    ]
    if request.sentence:
        context_parts.append(f"Sentence: {request.sentence}")
    if request.passage_context:
        context_parts.append(f"Passage context: {request.passage_context}")

    return ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="reading_explain",
            response_format="json",
            temperature=0.2,
            prompt="\n".join(context_parts),
            instruction=(
                "Explain the vocabulary item for an English learner. Return JSON with "
                "term, simple_definition, meaning_in_context, cefr_guess, example, "
                "common_collocations, and vietnamese_hint."
            ),
        )
    )


def generate_comprehension_quiz(request: ReadingQuizRequest) -> AiResponse:
    return ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="reading_quiz",
            response_format="json",
            temperature=0.3,
            prompt=(
                f"Title: {request.passage_title}\n"
                f"Learner level: {request.learner_level or 'unknown'}\n"
                f"Question count: {request.question_count}\n"
                f"Question type: {request.question_type}\n\n"
                f"Passage:\n{request.passage_body}"
            ),
            instruction=(
                "Generate reading comprehension questions. Return JSON array only. "
                "Each item must include question_type, prompt, choices, correct_index, "
                "explanation, difficulty, and skill_focus."
            ),
        )
    )
