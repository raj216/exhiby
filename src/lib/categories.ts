// Shared category definitions for consistent filtering across the app
import { Pencil, Droplets, Palette, Brush, Scissors, Container, Gem, LayoutGrid, LucideIcon } from "lucide-react";

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
}

// Master list of categories - used by both LeftSidebar and GoLiveWizard
export const CATEGORIES: Category[] = [
  { id: "all", name: "All", icon: LayoutGrid },
  { id: "pencil-art", name: "Pencil Art", icon: Pencil },
  { id: "watercolor", name: "Watercolor", icon: Droplets },
  { id: "oil-painting", name: "Oil Painting", icon: Palette },
  { id: "acrylic", name: "Acrylic", icon: Brush },
  { id: "handmade-art", name: "Handmade Art", icon: Scissors },
  { id: "pottery", name: "Pottery", icon: Container },
  { id: "jewelry", name: "Jewelry", icon: Gem },
];

// Categories for GoLive (excludes "All")
export const GO_LIVE_CATEGORIES = CATEGORIES.filter(cat => cat.id !== "all");

// Helper to get category name by id
export function getCategoryName(id: string): string {
  const category = CATEGORIES.find(cat => cat.id === id);
  return category?.name || id;
}

// Helper to get category id by name
export function getCategoryId(name: string): string {
  const category = CATEGORIES.find(cat => cat.name === name);
  return category?.id || name.toLowerCase().replace(/\s+/g, '-');
}
