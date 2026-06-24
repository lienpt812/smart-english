from app.schemas.ai_core import AiGenerateRequest, AiResponse
from app.schemas.reading import (
    ReadingDifficultyRequest,
    ReadingExplainRequest,
    ReadingGenerateRequest,
    ReadingQuizRequest,
    ReadingSummarizeRequest,
)
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


def generate_reading_passage(request: ReadingGenerateRequest) -> AiResponse:
    return ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="reading_generate",
            response_format="json",
            temperature=0.6,
            prompt=(
                f"Learner level: {request.learner_level}\n"
                f"Topic: {request.topic}\n"
                f"Target word count: {request.word_count}\n"
                f"Question count: {request.question_count}"
            ),
            instruction=(
                "Create an original English reading practice passage for a language learner. "
                "Return JSON with title, topic, level, estimated_minutes, body, "
                "vocabulary, and questions. vocabulary must be an array of objects with "
                "term, definition, example, and cefr_level. questions must be an array of "
                "multiple-choice objects with question_type, prompt, choices, correct_index, "
                "explanation, difficulty, and skill_focus. Keep the body coherent, natural, "
                "and appropriate for the requested CEFR level."
            ),
        )
    )


def summarize_reading(request: ReadingSummarizeRequest) -> AiResponse:
    return ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="reading_summary",
            response_format="json",
            temperature=0.2,
            prompt=(
                f"Title: {request.passage_title}\n"
                f"Learner level: {request.learner_level or 'unknown'}\n"
                f"Output language: {request.output_language}\n\n"
                f"Passage:\n{request.passage_body}"
            ),
            instruction=(
                "Summarize and analyze this reading passage for an English learner. "
                "Return JSON with short_summary, key_points, main_idea, structure, "
                "important_vocabulary, inference_notes, and suggested_flashcards."
            ),
        )
    )


def assess_reading_difficulty(request: ReadingDifficultyRequest) -> AiResponse:
    word_count = len(request.passage_body.split())
    return ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="reading_difficulty",
            response_format="json",
            temperature=0.1,
            prompt=(
                f"Title: {request.passage_title}\n"
                f"Learner level: {request.learner_level or 'unknown'}\n"
                f"Approx word count: {word_count}\n\n"
                f"Passage:\n{request.passage_body}"
            ),
            instruction=(
                "Assess the reading difficulty. Return JSON with cefr_estimate, "
                "difficulty_1_to_5, reasons, hard_sentences, hard_vocabulary, "
                "skimming_prompt, scanning_prompt, and next_practice_recommendation."
            ),
        )
    )
