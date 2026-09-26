import type { ProjectCategory } from "../types";

// Geographic filter options used before the live backend response arrives.
const STATES_DISTRICTS: Record<string, string[]> = {
  Maharashtra: ["Pune", "Nashik", "Nagpur", "Ahilyanagar", "Satara", "Kolhapur"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot"],
  Karnataka: ["Bengaluru Urban", "Mysuru", "Belagavi", "Hubballi"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior", "Jabalpur"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Agra"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem"],
  Punjab: ["Amritsar", "Ludhiana", "Patiala"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur"],
  Bihar: ["Patna", "Gaya", "Bhagalpur"],
  Delhi: ["Delhi"],
  Jharkhand: ["Giridih", "Ranchi", "Dhanbad"],
  Kerala: ["Thiruvananthapuram", "Kollam", "Ernakulam"],
  Odisha: ["Bhubaneswar", "Cuttack", "Puri"],
};

const CATEGORIES: ProjectCategory[] = [
  "Road", "Community Hall", "School Infrastructure", "Drinking Water",
  "Sanitation", "Healthcare", "Street Lighting", "Public Infrastructure",
];

export const DISTRICTS_BY_STATE = STATES_DISTRICTS;
export const ALL_CATEGORIES = CATEGORIES;
