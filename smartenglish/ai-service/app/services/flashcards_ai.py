from app.schemas.ai_core import AiGenerateRequest, AiResponse
from app.schemas.flashcards import FlashcardGenerateRequest
from app.services.ai_core import ai_generate


def generate_flashcards(request: FlashcardGenerateRequest) -> AiResponse:
    return ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="flashcards_generate",
            response_format="json",
            temperature=0.25,
            prompt=(
                f"Learner level: {request.learner_level or 'unknown'}\n"
                f"Target cert: {request.target_cert or 'general English'}\n"
                f"Card count: {request.count}\n"
                f"Language hint: {request.language_hint}\n"
                f"Include image prompts: {request.include_image_prompts}\n\n"
                f"Source text:\n{request.source_text}"
            ),
            instruction=(
                "Create high-value English flashcards from the source text. Return JSON "
                "with a cards array only. Each card must include front, back, definition, "
                "example_sentence, pronunciation, tags, difficulty, image_prompt, and "
                "source_ref. Prefer useful vocabulary, collocations, and learner errors."
            ),
        )
    )
