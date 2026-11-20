export type WantedResponseCriteria = {
  maxBudget: number;
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  maxMileage?: number;
  area?: string;
  radiusMiles?: number;
};

export type WantedResponseDraft = {
  year: string;
  make: string;
  model: string;
  askingPrice: string;
  mileage: string;
  city: string;
  state: string;
};

export function mileageAsMiles(mileage: number, unit: "mi" | "km" = "mi") {
  return unit === "km" ? Math.round(mileage / 1.609344) : mileage;
}

export function wantedResponseDifferences(request: WantedResponseCriteria, form: WantedResponseDraft) {
  const notes: string[] = [];
  const year = Number(form.year);
  const askingPrice = Number(form.askingPrice);
  const mileage = Number(form.mileage);
  if (request.make && form.make.trim() && request.make.trim().toLowerCase() !== form.make.trim().toLowerCase()) notes.push("make");
  if (request.model && form.model.trim() && request.model.trim().toLowerCase() !== form.model.trim().toLowerCase()) notes.push("model");
  if (form.year && ((request.yearMin !== undefined && year < request.yearMin) || (request.yearMax !== undefined && year > request.yearMax))) notes.push("year");
  if (form.askingPrice && askingPrice > request.maxBudget) notes.push("price");
  if (form.mileage && request.maxMileage !== undefined && mileage > request.maxMileage) notes.push("mileage");
  // City/state is a general-area cue, not a precise distance calculation.
  if (request.radiusMiles && request.area && form.city.trim() && form.state.trim() &&
      `${form.city.trim()}, ${form.state.trim().toUpperCase()}`.toLowerCase() !== request.area.trim().toLowerCase())
    notes.push("location (check the requested radius)");
  return notes;
}
