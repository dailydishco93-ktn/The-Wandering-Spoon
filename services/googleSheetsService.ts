
import { CustomerInfo, MenuItem, AddOn } from '../types';

export interface OrderData {
    orderId: string;
    customer: CustomerInfo;
    paymentMethod: string;
    items: string;
    total: number;
    chefNote?: { en: string; zh: string };
    receiptBase64?: string;
    receiptMimeType?: string;
    itemsJson: string;
}

export interface SheetMenuData {
    theme: any;
    menuItems: MenuItem[];
    addOns: AddOn[];
}

export const submitOrderToSheet = async (orderData: OrderData) => {
    const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SHEETS_SCRIPT_URL;

    if (!SCRIPT_URL) {
        console.warn("Google Sheets Script URL not configured. Skipping sheet update.");
        return false;
    }

    try {
        // Google Apps Script Web App requires 'no-cors' for simple POST requests from browser 
        // depending on deployment, but standard JSON POST generally needs following pattern:

        // Note: 'no-cors' mode means we can't read the response, but the request will go through.
        // If we want to read response, we need proper CORS headers on GAS side (complicated).
        // For fire-and-forget logging, no-cors is sufficient and most robust.

        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(orderData),
        });

        console.log("Order submitted to Google Sheet");
        return true;
    } catch (error) {
        console.error("Failed to submit order to Google Sheet", error);
        return false;
    }
};

export const fetchMenuData = async (): Promise<SheetMenuData | null> => {
    const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SHEETS_SCRIPT_URL;

    if (!SCRIPT_URL) {
        console.warn("Google Sheets Script URL not configured.");
        return null;
    }

    try {
        // GET requests are simpler and support CORS if the script is deployed correctly as 'Anyone'
        const response = await fetch(`${SCRIPT_URL}?t=${new Date().getTime()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch menu data from Google Sheet", error);
        return null;
    }
};

export const getOrderStatus = async (orderId: string): Promise<string | null> => {
    const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SHEETS_SCRIPT_URL;

    if (!SCRIPT_URL) {
        return null;
    }

    try {
        const response = await fetch(`${SCRIPT_URL}?action=check_status&orderId=${orderId}`);
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        // Expecting { status: 'Confirmed' | 'Pending' | ... }
        return data.status || null;
    } catch (error) {
        console.error("Failed to fetch order status", error);
        return null;
    }
};
