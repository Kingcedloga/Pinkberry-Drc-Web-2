import asyncio, base64, os
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")

PROMPT = (
    "Photorealistic square photo, bright natural daylight: a smiling young Congolese food "
    "delivery rider sitting on a clean modern delivery motorbike (scooter) in a sunny Kinshasa "
    "street with palm trees and soft blurred background. He wears a crisp white t-shirt with a "
    "pink swirl 'pinkberry' logo printed on the chest, and carries a pink insulated delivery "
    "backpack with the same pink swirl logo. Friendly, professional, vibrant pink and white "
    "brand colours, shallow depth of field, commercial food-delivery advertising style, "
    "no text other than the pinkberry wordmark on the shirt."
)


async def main():
    chat = LlmChat(
        api_key=os.getenv("EMERGENT_LLM_KEY"),
        session_id="pinkberry-hero-livreur",
        system_message="You are an image generation assistant.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    text, images = await chat.send_message_multimodal_response(UserMessage(text=PROMPT))
    print("text:", (text or "")[:120])
    os.makedirs("/app/frontend/assets/images", exist_ok=True)
    for i, img in enumerate(images or []):
        print("image", i, img["mime_type"])
        with open(f"/app/frontend/assets/images/livreur-{i}.png", "wb") as f:
            f.write(base64.b64decode(img["data"]))


asyncio.run(main())
