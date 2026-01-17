
export enum Language {
  EN = 'EN',
  ZH = 'ZH'
}

export interface MenuItem {
  id: string;
  day: string;
  dayZh: string;
  dayIndex: number;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  price: number;
  image: string;
  maxInventory: number;
  allergies?: string[];
  allergiesZh?: string[];
  sideDishes?: string;
  sideDishesZh?: string;
  story?: string;
  storyZh?: string;
}

export interface AddOn {
  id: string;
  title: string;
  titleZh: string;
  price: number;
  type: 'drink' | 'fruit';
  days?: string[];
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  deliveryInstruction?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}



export enum AppStep {
  MENU = 'MENU',
  DETAILS = 'DETAILS',
  REVIEW = 'REVIEW',
  PAYMENT = 'PAYMENT',
  VERIFYING = 'VERIFYING',
  CONFIRMATION = 'CONFIRMATION'
}
