
import { GoogleGenAI, Type } from "@google/genai";
import { CustomerInfo, MenuItem, ChatMessage, Language } from '../types';

export interface OrderedDishInfo {
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
}

// Generate a personalized thank you note from the chef
export const generateChefNote = async (customer: CustomerInfo, orderedDishes: OrderedDishInfo[]) => {
  if (!process.env.API_KEY) return { en: "Thank you for your order!", zh: "感谢您的订购！" };

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const dishesContextEn = orderedDishes.map(d => `- ${d.title}: ${d.description}`).join('\n');
    const dishesContextZh = orderedDishes.map(d => `- ${d.titleZh}: ${d.descriptionZh}`).join('\n');
    
    const promptContents = `
      A customer named ${customer.name} just ordered these main dishes:
      
      EN Order Details:
      ${dishesContextEn}
      
      ZH Order Details:
      ${dishesContextZh}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: promptContents,
      config: {
        systemInstruction: `
          You are the head chef of a premium home-based Bento business called "The Wandering Spoon" (漫游勺).
          The current theme is "Nyonya Heritage Tour".
          Write a warm, sophisticated, and personal thank you note.
          
          CRITICAL RULE:
          - You MUST include a brief, enticing description or a unique culinary highlight for EACH AND EVERY main dish they ordered.
          - Do not just list them; weave them into a narrative that highlights the Nyonya heritage and flavor profile to make the customer excited.
          - Ensure the note remains elegant and concise.
          
          Word limit: Max 80 words per language.
          
          You MUST provide the response in JSON format with exactly two keys: "en" for the English version and "zh" for the Chinese (Simplified) version.
        `,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            en: { type: Type.STRING, description: "The English version of the chef's note." },
            zh: { type: Type.STRING, description: "The Chinese version of the chef's note." }
          },
          required: ["en", "zh"]
        }
      }
    });

    try {
      // Correctly access the .text property from GenerateContentResponse
      const text = response.text;
      return text ? JSON.parse(text) : { en: "Thank you for your order!", zh: "感谢您的订购！" };
    } catch (e) {
      return { en: "Thank you for your order!", zh: "感谢您的订购！" };
    }
  } catch (error) {
    console.error(error);
    return { en: "Thank you for your order!", zh: "感谢您的订购！" };
  }
};

// Draft an internal notification email for the business owner
export const generateOwnerEmail = async (customer: CustomerInfo, orderSummary: string, orderId: string) => {
  if (!process.env.API_KEY) return "Email body could not be generated.";

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      Generate a professional and clear internal order notification email for the owner of "The Wandering Spoon".
      The recipient is the owner at thewonderingspoon09@gmail.com.
      
      Order ID: ${orderId}
      Customer: ${customer.name}
      Phone: ${customer.phone}
      Email: ${customer.email}
      Address: ${customer.address}
      Instructions: ${customer.deliveryInstruction}
      
      Items Ordered:
      ${orderSummary}
      
      Requirements:
      - Structure this as an HTML email.
      - Include a prominent section for the owner to review the provided payment receipt (assume attached).
      - Include a large, styled "CONFIRM PAYMENT" button (visual representation only).
      - Make it look premium, organized, and urgent.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Correctly access the .text property
    return response.text || "Email summary generated.";
  } catch (error) {
    console.error(error);
    return "Error drafting owner notification.";
  }
};

// Generate a cultural story for a specific dish
export const getDishStory = async (item: MenuItem, lang: string) => {
  if (!process.env.API_KEY) return "Story unavailable.";

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      As a culinary historian and food critic for "${lang === 'ZH' ? '漫游勺' : 'The Wandering Spoon'}", 
      write a mouth-watering, culturally rich story about the dish "${lang === 'ZH' ? item.titleZh : item.title}".
      Mention its historical roots in Peranakan (Nyonya) culture, its flavor profile (spices, textures), 
      and why it is a premium choice.
      Keep it around 100-150 words. Use a storytelling tone.
      Language: ${lang === 'ZH' ? 'Chinese (Simplified)' : 'English'}.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Correctly access the .text property
    return response.text || "Story could not be generated.";
  } catch (error) {
    console.error(error);
    return "Error unfolding the story.";
  }
};

// Handle concierge Q&A and recommendations
export const getConciergeResponse = async (query: string, history: ChatMessage[], menu: MenuItem[], lang: Language | string) => {
  if (!process.env.API_KEY) return "Concierge is offline.";

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const menuContext = menu.map(m => 
      `${m.day}: ${m.title} (${m.description}). Price: RM${m.price}. Allergies: ${m.allergies?.join(', ')}`
    ).join('\n');

    // System instruction defines the concierge behavior and static rules
    const systemInstruction = `
      You are the AI Concierge for "The Wandering Spoon" (漫游勺), a premium bento kitchen.
      
      CRITICAL RULE:
      - You CANNOT take orders, reserve dishes, or modify inventory.
      - You MUST explicitly tell customers to use the "+" buttons on the menu page to select their items and click the "Next" button at the bottom of the screen to complete their order.
      - NEVER say "I will reserve this for you" or "Your order is confirmed". 
      - If a user says "I want to order X", respond with: "That is a great choice! Please select [Dish Name] using the '+' button in our menu list above, then click 'Next' to proceed with your details and payment."
      
      Current Menu:
      ${menuContext}

      Task:
      - Answer the user's question about the menu.
      - Be professional, helpful, and sophisticated.
      - If they ask for recommendations, suggest a specific day/dish and remind them to select it on the page.
      - Keep responses concise (max 60 words).
      - Language: ${lang === Language.ZH ? 'Chinese (Simplified)' : 'English'}.
    `;

    // Construct multi-turn contents for contextual awareness
    const contents = [
      ...history.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      })),
      {
        role: 'user' as const,
        parts: [{ text: query }]
      }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: contents,
      config: { systemInstruction }
    });

    // Correctly access the .text property
    return response.text || "I am here to help, but I didn't catch that.";
  } catch (error) {
    console.error(error);
    return "Something went wrong with our concierge service.";
  }
};
