import asyncio, base64, os
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

load_dotenv("/app/backend/.env")

SRC = "/app/frontend/assets/images/livreur-pinkberry.jpg"

PROMPT = (
    "Keep exactly the same smiling delivery rider and the same motorbike from this photo, "
    "same pose, same white t-shirt with the pink 'pinkberry' logo, same pink insulated "
    "delivery backpack and helmet. Completely remove the street, people, cars, buildings and "
    "trees: isolate the rider and the motorbike as a clean cut-out on a perfectly uniform pure "
    "white background (#FFFFFF), studio product-shot style, no ground, no shadow, no gradient, "
    "no reflection, sharp clean edges around the subject, nothing else in the frame."
)


async def main():
    with open(SRC, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    chat = LlmChat(
        api_key=os.getenv("EMERGENT_LLM_KEY"),
        session_id="pinkberry-hero-cutout",
        system_message="You are an image editing assistant.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    text, images = await chat.send_message_multimodal_response(
        UserMessage(text=PROMPT, file_contents=[ImageContent(b64)])
    )
    print("text:", (text or "")[:120])
    for i, img in enumerate(images or []):
        print("image", i, img["mime_type"])
        with open(f"/app/frontend/assets/images/cutout-{i}.png", "wb") as f:
            f.write(base64.b64decode(img["data"]))


asyncio.run(main())
